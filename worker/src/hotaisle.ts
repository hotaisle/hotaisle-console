import {
	EMAIL_LOGIN_PATH,
	EmailLoginSigningError,
	emailLoginIdentityHeaders,
} from "./email-login-identity";

const TRAILING_SLASH_PATTERN = /\/+$/u;
// Calls to the Hot Aisle API made by the Worker itself (sign-in).
// Everything the page asks for goes through the proxy in index.ts instead.

export interface Env {
	/** Default https://admin.hotaisle.app/api */
	API_BASE?: string;
	API_READ_RATE_LIMITER: RateLimit;
	API_WRITE_RATE_LIMITER: RateLimit;
	ASSETS: Fetcher;
	AUTH_RATE_LIMITER: RateLimit;
	EMAIL_LOGIN_EMAIL_RATE_LIMITER: RateLimit;
	EMAIL_LOGIN_IP_RATE_LIMITER: RateLimit;
	/** Dedicated Ed25519 PKCS#8 DER private key, encoded as base64. Worker secret only. */
	EMAIL_LOGIN_SIGNING_KEY?: string;
	/** Dedicated, stable secret for browser-history keys. Never rotate without a recovery plan. */
	HISTORY_SECRET?: string;
	/** At least 32 random characters. Encrypts session cookies. A Worker secret. */
	SESSION_SECRET: string;
	/** Tests and local development only: a stand-in Hot Aisle API that calls go to instead of API_BASE. */
	UPSTREAM?: Fetcher;
	VERSION?: string;
}

/** Both API keys and email access tokens use one canonical bearer header. */
export interface Credential {
	kind: "key" | "email";
	token: string;
}

export const authHeaders = (c: Credential): Record<string, string> => ({
	Authorization: `Bearer ${c.token}`,
});

/** Sends a request to the Hot Aisle API (or, in tests and local development, its stand-in). */
export const send = (env: Env, url: string, init: RequestInit) =>
	env.UPSTREAM ? env.UPSTREAM.fetch(url, init) : fetch(url, init);

export const apiBase = (env: Env) =>
	(env.API_BASE || "https://admin.hotaisle.app/api").replace(
		TRAILING_SLASH_PATTERN,
		""
	);

const UA = (env: Env) => `hotaisle-console/${env.VERSION ?? "dev"}`;

export async function upstream(
	env: Env,
	method: string,
	path: string,
	opts: { cred?: Credential; body?: unknown } = {}
): Promise<Response> {
	const headers: Record<string, string> = {
		Accept: "application/json",
		"User-Agent": UA(env),
		...(opts.cred ? authHeaders(opts.cred) : {}),
	};
	if (opts.body !== undefined) {
		headers["Content-Type"] = "application/json";
	}
	const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
	const target = apiBase(env) + path;
	if (method === "POST" && path === EMAIL_LOGIN_PATH) {
		Object.assign(
			headers,
			await emailLoginIdentityHeaders(
				target,
				body ?? "",
				env.EMAIL_LOGIN_SIGNING_KEY
			)
		);
	}
	const response = await send(env, target, {
		body,
		headers,
		method,
		redirect: "manual",
	});
	if (response.status >= 300 && response.status < 400) {
		return new Response("Unexpected upstream redirect.", { status: 502 });
	}
	return response;
}

export interface Who {
	teams: unknown[];
	user: { created?: string; email?: string; name?: string };
}

/** Who a credential belongs to, or why it can't be used. */
export async function whoIs(
	env: Env,
	cred: Credential
): Promise<
	| { ok: true; who: Who; body: string }
	| { ok: false; status: number; message: string }
> {
	let r: Response;
	let body: string;
	try {
		r = await upstream(env, "GET", "/user/", { cred });
		body = await r.text();
	} catch {
		return {
			message: "Could not reach the Hot Aisle API.",
			ok: false,
			status: 502,
		};
	}
	if (r.status === 401 || r.status === 403) {
		return {
			message:
				cred.kind === "key"
					? "Hot Aisle didn't accept that key. Check you copied all of it, and that it hasn't been deleted."
					: "Hot Aisle ended that sign-in. Sign in again.",
			ok: false,
			status: 401,
		};
	}
	if (!r.ok) {
		return {
			message: `The API answered ${r.status}.`,
			ok: false,
			status: 502,
		};
	}
	try {
		const who = JSON.parse(body) as Who | null;
		if (
			!who?.user ||
			typeof who.user !== "object" ||
			!Array.isArray(who.teams)
		) {
			throw new Error("Invalid account response");
		}
		return { body, ok: true, who };
	} catch {
		return {
			message: "The API answered with something other than JSON.",
			ok: false,
			status: 502,
		};
	}
}

// ---------------------------------------------------------------- email sign-in
//
//   POST /user/email/login/     {email}        -> 200 {email, claim_ticket, expires_at}; Hot Aisle emails an approval link
//   POST /user/email/wait/      {claim_ticket} -> waits up to 20 s: 202 still pending, 204 approved
//   POST /user/email/complete/  {claim_ticket} -> 200 TokenPair; 401 if unavailable
//   POST /auth/token/          form grant_type=refresh_token&refresh_token=... -> 200 TokenPair
//   POST /auth/logout/         {refresh_token} -> 204 (including an authentic spent verifier)
//
// The claim ticket is private to this Worker (it lives in the encrypted session); the emailed link only approves.

const EMAIL_WAIT = "/user/email/wait/";
const EMAIL_COMPLETE = "/user/email/complete/";

export interface EmailLoginStart {
	claim_ticket: string;
	email: string;
	expires_at: string;
}

export async function startEmailLogin(
	env: Env,
	email: string
): Promise<
	| { ok: true; start: EmailLoginStart }
	| { ok: false; status: number; message: string }
> {
	let r: Response;
	let text: string;
	try {
		r = await upstream(env, "POST", EMAIL_LOGIN_PATH, { body: { email } });
		text = await r.text();
	} catch (e) {
		return {
			message:
				e instanceof EmailLoginSigningError
					? e.message
					: "Could not reach the Hot Aisle API. Try again shortly.",
			ok: false,
			status: e instanceof EmailLoginSigningError ? 503 : 502,
		};
	}
	if (!r.ok) {
		let status = 400;
		if (r.status === 429) {
			status = 429;
		} else if (r.status >= 500) {
			status = 502;
		}
		return {
			message: `Could not start email sign-in (${r.status}). Try again shortly.`,
			ok: false,
			status,
		};
	}
	try {
		const j = JSON.parse(text) as EmailLoginStart;
		if (!(j.claim_ticket && j.expires_at)) {
			throw new Error("missing claim_ticket");
		}
		return { ok: true, start: j };
	} catch {
		return {
			message: "Unexpected answer from the API when starting email sign-in.",
			ok: false,
			status: 502,
		};
	}
}

/** Waits (up to about 20 seconds) for the emailed link to be approved. */
export async function waitEmailLogin(
	env: Env,
	ticket: string
): Promise<"approved" | "waiting" | { failed: string }> {
	let r: Response;
	try {
		r = await upstream(env, "POST", EMAIL_WAIT, {
			body: { claim_ticket: ticket },
		});
	} catch {
		return { failed: "Could not reach the Hot Aisle API." };
	}
	if (r.status === 204) {
		return "approved";
	}
	if (r.status === 202) {
		return "waiting";
	}
	return {
		failed:
			r.status === 401
				? "That sign-in link has expired. Send a new one."
				: `Could not check email approval (${r.status}). Send a new link.`,
	};
}

export interface TokenPair {
	accessExpiresAt: number;
	accessToken: string;
	refreshExpiresAt: number;
	refreshToken: string;
	sessionExpiresAt: number;
	sessionHandle: string;
}

const ACCESS_TOKEN = /^ha_at_[0-9a-f]{24}\.[0-9a-f]{64}$/u;
const REFRESH_TOKEN = /^ha_rt_[0-9a-f]{24}\.[0-9a-f]{64}$/u;
const HANDLE = /^[0-9a-f]{24}$/u;

export function isTokenPair(value: unknown): value is TokenPair {
	if (!value || typeof value !== "object") {
		return false;
	}
	const p = value as TokenPair;
	return (
		typeof p.accessToken === "string" &&
		p.accessToken.length <= 4096 &&
		ACCESS_TOKEN.test(p.accessToken) &&
		typeof p.refreshToken === "string" &&
		p.refreshToken.length <= 4096 &&
		REFRESH_TOKEN.test(p.refreshToken) &&
		typeof p.sessionHandle === "string" &&
		HANDLE.test(p.sessionHandle) &&
		Number.isFinite(p.accessExpiresAt) &&
		Number.isFinite(p.refreshExpiresAt) &&
		Number.isFinite(p.sessionExpiresAt) &&
		p.accessExpiresAt <= p.refreshExpiresAt &&
		p.refreshExpiresAt <= p.sessionExpiresAt
	);
}

function parseTokenPair(
	value: unknown,
	previous?: TokenPair
): TokenPair | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const wire = value as Record<string, unknown>;
	if (wire.token_type !== "Bearer") {
		return undefined;
	}
	const deadline = (v: unknown) =>
		typeof v === "string" ? Date.parse(v) : Number.NaN;
	const pair = {
		accessExpiresAt: deadline(wire.access_token_expires_at),
		accessToken: wire.access_token,
		refreshExpiresAt: deadline(wire.refresh_token_expires_at),
		refreshToken: wire.refresh_token,
		sessionExpiresAt: deadline(wire.session_expires_at),
		sessionHandle: wire.session_handle,
	};
	if (
		!isTokenPair(pair) ||
		pair.accessExpiresAt <= Date.now() ||
		pair.refreshExpiresAt <= Date.now() ||
		(previous &&
			(pair.sessionHandle !== previous.sessionHandle ||
				pair.sessionExpiresAt !== previous.sessionExpiresAt ||
				pair.accessToken === previous.accessToken ||
				pair.refreshToken === previous.refreshToken))
	) {
		return undefined;
	}
	return pair;
}

/** A single-use exchange is never retried, even if its response is lost or malformed. */
export async function completeEmailLogin(
	env: Env,
	ticket: string
): Promise<TokenPair | { failed: string }> {
	try {
		const response = await upstream(env, "POST", EMAIL_COMPLETE, {
			body: { claim_ticket: ticket },
		});
		const pair =
			response.status === 200
				? parseTokenPair(await response.json())
				: undefined;
		return (
			pair ?? { failed: "Could not finish email sign-in. Send a new link." }
		);
	} catch {
		return { failed: "Could not finish email sign-in. Send a new link." };
	}
}

export async function refreshEmailSession(
	env: Env,
	previous: TokenPair
): Promise<TokenPair | undefined> {
	try {
		const response = await send(env, `${apiBase(env)}/auth/token/`, {
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: previous.refreshToken,
			}).toString(),
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": UA(env),
			},
			method: "POST",
			redirect: "manual",
		});
		return response.status === 200
			? parseTokenPair(await response.json(), previous)
			: undefined;
	} catch {
		return undefined;
	}
}

export async function logoutEmailSession(
	env: Env,
	refreshToken: string
): Promise<boolean> {
	try {
		const response = await upstream(env, "POST", "/auth/logout/", {
			body: { refresh_token: refreshToken },
		});
		return response.status === 204;
	} catch {
		return false;
	}
}
