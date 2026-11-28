// Only nonsecret coordination state is stored here. Credentials stay in the
// Worker's encrypted HttpOnly cookie; Web Locks serialize its use across tabs.
const STATE_KEY = "hotaisle-console:email-session:v2";
const EPOCH_KEY = "hotaisle-console:email-session:epoch";
const LOCK_NAME = "hotaisle-console:email-session";
type Phase = "active" | "pending" | "login" | "pending-login" | "ended";
interface State {
	epoch: string;
	phase: Phase;
}
export interface EmailSessionReply {
	response: Response;
	text: string;
}

export class EmailSessionError extends Error {}

// Each preview page owns an independent, memory-only simulated session.
let previewState: Map<string, string> | undefined;

function readCoordination(key: string) {
	return import.meta.env.MODE === "preview"
		? (previewState?.get(key) ?? null)
		: localStorage.getItem(key);
}

function writeCoordination(key: string, value: string) {
	if (import.meta.env.MODE === "preview") {
		previewState ??= new Map();
		previewState.set(key, value);
	} else {
		localStorage.setItem(key, value);
	}
}

function state(): State {
	const epoch = readCoordination(EPOCH_KEY);
	const stored = readCoordination(STATE_KEY);
	if (stored === null) {
		return {
			epoch: epoch ?? "initial",
			phase: epoch === null ? "active" : "ended",
		};
	}
	try {
		const value: unknown = JSON.parse(stored);
		if (
			typeof value === "object" &&
			value !== null &&
			"epoch" in value &&
			typeof value.epoch === "string" &&
			"phase" in value &&
			typeof value.phase === "string" &&
			["active", "pending", "login", "pending-login", "ended"].includes(
				value.phase
			)
		) {
			if (epoch !== null && value.epoch !== epoch) {
				return { epoch, phase: "ended" };
			}
			return value as State;
		}
	} catch {
		// Damaged coordination state cannot authorize a retry of a refresh token.
	}
	return { epoch: epoch ?? "invalid", phase: "ended" };
}

function store(value: State) {
	writeCoordination(STATE_KEY, JSON.stringify(value));
}

export function endEmailSession() {
	// Exchange phase writes must never overwrite a newer cancellation epoch.
	writeCoordination(EPOCH_KEY, crypto.randomUUID());
}

export function emailSessionEnded() {
	const { phase } = state();
	return phase !== "active" && phase !== "pending";
}

type Mode = "status" | "start" | "complete" | "logout" | "protected";
const MODES: Record<string, Mode> = {
	"/auth/email/start": "start",
	"/auth/email/wait": "complete",
	"/auth/signout": "logout",
	"/auth/status": "status",
};

function phaseAfterReply(
	{ response, text }: EmailSessionReply,
	mode: Mode
): Phase {
	if (
		mode === "logout" ||
		response.status === 401 ||
		(mode === "complete" &&
			(response.status === 410 || response.status >= 500)) ||
		response.headers.get("X-Session-Ended") === "true"
	) {
		return "ended";
	}
	if (mode === "start") {
		return response.ok ? "login" : "ended";
	}
	if (mode !== "complete") {
		return "active";
	}
	if (!response.ok) {
		return "login";
	}
	const value: unknown = JSON.parse(text);
	if (
		typeof value !== "object" ||
		value === null ||
		!("done" in value) ||
		typeof value.done !== "boolean"
	) {
		throw new EmailSessionError("Unexpected email sign-in response.");
	}
	return value.done ? "active" : "login";
}

async function exchange(
	epoch: string,
	mode: Mode,
	operation: () => Promise<EmailSessionReply>
) {
	if (mode !== "logout") {
		store({ epoch, phase: mode === "protected" ? "pending" : "pending-login" });
	}
	try {
		const reply = await operation();
		if (state().epoch !== epoch) {
			throw new EmailSessionError("That sign-in ended. Sign in again.");
		}
		store({ epoch, phase: phaseAfterReply(reply, mode) });
		return reply;
	} catch (error) {
		if (state().epoch === epoch) {
			store({ epoch, phase: mode === "protected" ? "pending" : "ended" });
		}
		throw error;
	}
}

function reconcileStatus(current: State, reply: EmailSessionReply) {
	const { epoch } = current;
	if (state().epoch !== epoch) {
		throw new EmailSessionError("That sign-in ended. Sign in again.");
	}
	if (current.phase === "pending") {
		// Only the Worker can tell whether the cookie avoids an uncertain renewal.
		const status = reply.response.ok
			? (JSON.parse(reply.text) as {
					can_resume?: boolean;
					signed_in?: boolean;
				})
			: undefined;
		store({
			epoch,
			phase:
				status?.signed_in === true && status.can_resume === true
					? "active"
					: "ended",
		});
	} else if (current.phase === "pending-login") {
		store({ epoch, phase: "ended" });
	}
}

/** Serialize cookie exchanges, including response-body receipt, across tabs. */
export async function emailSessionRequest(
	path: string,
	operation: () => Promise<EmailSessionReply>
): Promise<EmailSessionReply> {
	const mode = MODES[path] ?? "protected";
	if (mode === "logout") {
		endEmailSession();
	} else if (mode === "start") {
		const epoch = crypto.randomUUID();
		writeCoordination(EPOCH_KEY, epoch);
		store({ epoch, phase: "login" });
	}
	const { epoch } = state();
	if (!navigator.locks?.request) {
		// Status cannot rotate credentials, and logout must still attempt revocation.
		if (mode === "status" || mode === "logout") {
			return await operation();
		}
		throw new EmailSessionError(
			"Email sign-in requires a browser with Web Locks support. Update your browser or use an API key."
		);
	}
	return await navigator.locks.request(LOCK_NAME, async () => {
		const current = state();
		if (current.epoch !== epoch) {
			throw new EmailSessionError(
				"The sign-in changed. Try again after signing in."
			);
		}
		if (mode === "status") {
			const reply = await operation();
			reconcileStatus(current, reply);
			return reply;
		}
		if (
			mode !== "start" &&
			mode !== "logout" &&
			current.phase !== (mode === "complete" ? "login" : "active")
		) {
			throw new EmailSessionError("That sign-in ended. Sign in again.");
		}
		return await exchange(epoch, mode, operation);
	});
}
