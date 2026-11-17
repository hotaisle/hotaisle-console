// Only nonsecret coordination state is stored here. Credentials stay in the
// Worker's encrypted HttpOnly cookie; Web Locks serialize its use across tabs.
const STATE_KEY = "hotaisle-console:email-session:v2";
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

function state(): State {
	const stored = localStorage.getItem(STATE_KEY);
	if (stored === null) {
		return { epoch: "initial", phase: "active" };
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
			return value as State;
		}
	} catch {
		// Damaged coordination state cannot authorize a retry of a refresh token.
	}
	return { epoch: "invalid", phase: "ended" };
}

function store(value: State) {
	localStorage.setItem(STATE_KEY, JSON.stringify(value));
}

export function endEmailSession() {
	store({ epoch: crypto.randomUUID(), phase: "ended" });
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
		response.status >= 500 ||
		response.status === 401 ||
		(mode === "complete" && response.status === 410) ||
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
			store({ epoch, phase: "ended" });
		}
		throw error;
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
		store({ epoch: crypto.randomUUID(), phase: "login" });
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
			if (current.phase === "pending" || current.phase === "pending-login") {
				store({ epoch, phase: "ended" });
			}
			return await operation();
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
