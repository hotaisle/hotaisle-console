// Hot Aisle Console: static assets, email authentication, and a stateless API proxy.
//
// Routes:
//   /auth/*       email sign-in, API-key verification, session status, sign-out,
//                 and authenticated derivation of the browser-history encryption key
//   /api/*        forward requests to the configured Hot Aisle API without following redirects
//   /records/*    retired; returns 410, as does /live/*
//   other paths   serve the app; /__preview is restricted to preview.localhost
//
// Credentials:
//   API keys arrive in Authorization headers for each request and are never persisted here.
//   Email-session tokens and pending login claims stay in encrypted HttpOnly, Secure,
//   SameSite=Strict cookies; their secrets are not returned in frontend response bodies.
//   History is encrypted in browser storage. This Worker verifies the account before
//   deriving its key with HISTORY_SECRET and stores neither history nor per-account keys.
//
// Request protections:
//   /auth and /api require X-Requested-With: hotaisle-console and reject a mismatched
//   Origin when supplied. These are browser CSRF protections, not authentication.
//   Auth and API calls have rate limits; request bodies are bounded where consumed.
//   Auth/API responses use no-store, and security headers also cover static assets.
//   Cloudflare diagnostics are configured separately; never log credentials or request bodies.

import { emailLoginFingerprint } from "./email-login-fingerprint";
import { historyKey } from "./history-key";
import {
	apiBase,
	authHeaders,
	type Credential,
	completeEmailLogin,
	type Env,
	send,
	startEmailLogin,
	waitEmailLogin,
	whoIs,
} from "./hotaisle";
import { allowRate, requestIp } from "./rate-limit";
import { readSession, type Session, sessionCookie } from "./session";

const TOKEN_SCHEME_PATTERN = /^Token\s+/iu;
const WHITESPACE_PATTERN = /\s/u;
const MAX_EMAIL_START_BYTES = 1024;
const MAX_API_BODY_BYTES = 1024 * 1024;

const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy":
		"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
	"Referrer-Policy": "no-referrer",
	"Strict-Transport-Security": "max-age=31536000",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
};

function withHeaders(
	r: Response,
	extra: Record<string, string> = {}
): Response {
	const out = new Response(r.body, r);
	for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) {
		out.headers.set(k, v);
	}
	return out;
}

const json = (v: unknown, status = 200, headers: Record<string, string> = {}) =>
	withHeaders(
		new Response(JSON.stringify(v), {
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "application/json",
				...headers,
			},
			status,
		})
	);
const fail = (
	status: number,
	message: string,
	headers: Record<string, string> = {}
) =>
	withHeaders(
		new Response(message, {
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "text/plain; charset=utf-8",
				...headers,
			},
			status,
		})
	);

async function rateLimitResponse(
	limiter: RateLimit,
	secret: string,
	scope: string,
	actor: string
): Promise<Response | undefined> {
	try {
		if (await allowRate(limiter, secret, scope, actor)) {
			return undefined;
		}
		return fail(429, "Too many requests. Try again shortly.", {
			"Retry-After": "60",
		});
	} catch {
		return fail(503, "Request limiting is temporarily unavailable.");
	}
}

async function readBody(
	req: Request,
	limit: number
): Promise<Uint8Array | null> {
	const declaredLength = Number(req.headers.get("Content-Length"));
	if (Number.isFinite(declaredLength) && declaredLength > limit) {
		return null;
	}
	if (!req.body) {
		return new Uint8Array();
	}
	const chunks: Uint8Array[] = [];
	let length = 0;
	for await (const chunk of req.body) {
		length += chunk.byteLength;
		if (length > limit) {
			return null;
		}
		chunks.push(chunk);
	}
	const body = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

interface TokenSession extends Session {
	token: string;
}
interface AuthenticatedSession extends TokenSession {
	token: string;
}

function isAuthenticatedSession(
	session: Session | undefined
): session is AuthenticatedSession {
	return Boolean(session?.token);
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (
			url.pathname.startsWith("/__preview") &&
			url.hostname !== "preview.localhost"
		) {
			return fail(404, "not found");
		}
		const [, area] = url.pathname.split("/");
		if (
			url.hostname === "preview.localhost" &&
			(area === "api" || area === "auth")
		) {
			return fail(
				403,
				"The preview origin cannot call the real API. Open /__preview/ for simulated machines."
			);
		}
		if (area === "records" || area === "live") {
			return fail(
				410,
				"Server-side console records and live channels have been removed. Reload the console to use browser-session data and automatic availability checks."
			);
		}
		if (
			area !== "auth" &&
			area !== "api" &&
			area !== "records" &&
			area !== "live"
		) {
			return withHeaders(await env.ASSETS.fetch(req));
		}

		// only this site's own pages can call these
		if (req.headers.get("X-Requested-With") !== "hotaisle-console") {
			return fail(403, "missing X-Requested-With header");
		}
		const origin = req.headers.get("Origin");
		if (origin && origin !== url.origin) {
			return fail(403, "cross-origin request refused");
		}

		if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
			return fail(
				500,
				"This Worker has no SESSION_SECRET. Set a secret of 32+ random characters in Cloudflare (locally, in .dev.vars)."
			);
		}
		const authorization = req.headers.get("Authorization");
		if (authorization && area !== "auth") {
			return stateless(req, env, url, authorization);
		}
		const session = await readSession(req, env.SESSION_SECRET);
		if (area === "auth") {
			return auth(req, env, url, session);
		}
		if (!isAuthenticatedSession(session)) {
			return fail(401, "not signed in");
		}
		if (area === "api") {
			return proxy(req, env, url, session);
		}
		return fail(404, "not found");
	},
} satisfies ExportedHandler<Env>;

/** What this session's calls go out with: an API key, or a session from email sign-in (each has its own header). */
const credentialOf = (s: TokenSession): Credential => ({
	kind: s.kind === "email" ? "email" : "key",
	token: s.token,
});

// ---------------------------------------------------------------- sign-in

async function auth(
	req: Request,
	env: Env,
	url: URL,
	session: Session | undefined
): Promise<Response> {
	switch (`${req.method} ${url.pathname}`) {
		case "GET /auth/status":
			return await authGetAuthStatus(env, session);
		case "GET /auth/key":
			return await authGetAuthKey(req, env);
		case "POST /auth/history-key":
			return await authPostHistoryKey(req, env, url, session);
		case "POST /auth/email/start":
			return await authPostAuthEmailStart(req, env);
		case "POST /auth/email/wait":
			return await authPostAuthEmailWait(req, env, session);
		case "POST /auth/signout":
			return await authPostAuthSignout(env);
		default:
			return fail(404, "not found");
	}
}

async function authPostHistoryKey(
	req: Request,
	env: Env,
	url: URL,
	session: Session | undefined
) {
	const header = req.headers.get("Authorization");
	let credential: Credential | undefined;
	if (header) {
		credential = keyFromHeader(header);
	} else if (isAuthenticatedSession(session)) {
		credential = credentialOf(session);
	}
	if (!credential) {
		return fail(401, "Sign in to unlock browser history.");
	}
	const limited = await rateLimitResponse(
		env.AUTH_RATE_LIMITER,
		env.SESSION_SECRET,
		"auth-verify",
		requestIp(req)
	);
	if (limited) {
		return limited;
	}
	const who = await whoIs(env, credential);
	if (!who.ok) {
		return fail(who.status, "Sign in again to unlock browser history.");
	}
	if (!env.HISTORY_SECRET || env.HISTORY_SECRET.length < 32) {
		return fail(
			503,
			"Encrypted browser history is unavailable until HISTORY_SECRET is configured. Existing saved history has not been changed."
		);
	}
	try {
		return json(
			await historyKey(env.HISTORY_SECRET, url.origin, who.who),
			200,
			{ "Cross-Origin-Resource-Policy": "same-origin" }
		);
	} catch {
		return fail(
			502,
			"Could not establish the account identity for browser history. Existing saved history has not been changed."
		);
	}
}
async function authGetAuthStatus(env: Env, session: Session | undefined) {
	return json({
		email_login: true,
		kind: session?.token ? session.kind : undefined,
		passkeys: false,
		signed_in: !!session?.token,
		version: env.VERSION ?? "dev",
		waiting_for_email:
			session?.pending && !session.token
				? {
						email: session.pending.email,
						expires_at: session.pending.expires_at,
						request_code: await emailLoginFingerprint(session.pending.ticket),
					}
				: undefined,
	});
}

async function authGetAuthKey(req: Request, env: Env) {
	const credential = keyFromHeader(req.headers.get("Authorization"));
	if (!credential) {
		return fail(401, "An API key is required for this request.");
	}
	const limited = await rateLimitResponse(
		env.AUTH_RATE_LIMITER,
		env.SESSION_SECRET,
		"auth-verify",
		requestIp(req)
	);
	if (limited) {
		return limited;
	}
	const who = await whoIs(env, credential);
	if (!who.ok) {
		return fail(who.status, "Hot Aisle did not accept this API key.");
	}
	return json(JSON.parse(who.body));
}

async function authPostAuthEmailStart(req: Request, env: Env) {
	const ipLimit = await rateLimitResponse(
		env.EMAIL_LOGIN_IP_RATE_LIMITER,
		env.SESSION_SECRET,
		"email-start-ip",
		requestIp(req)
	);
	if (ipLimit) {
		return ipLimit;
	}
	const body = await readBody(req, MAX_EMAIL_START_BYTES);
	if (!body) {
		return fail(413, "Email sign-in request is too large.");
	}
	let email = "";
	try {
		const parsed = JSON.parse(
			new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(body)
		) as {
			email?: string;
		};
		email = (parsed.email ?? "").trim();
	} catch {
		return fail(400, "That doesn't look like an email address.");
	}
	if (!EMAIL.test(email) || email.length > 254) {
		return fail(400, "That doesn't look like an email address.");
	}
	const emailLimit = await rateLimitResponse(
		env.EMAIL_LOGIN_EMAIL_RATE_LIMITER,
		env.SESSION_SECRET,
		"email-start-address",
		email.toLowerCase()
	);
	if (emailLimit) {
		return emailLimit;
	}
	const r = await startEmailLogin(env, email);
	if (!r.ok) {
		return fail(r.status, r.message);
	}
	const pending = {
		email: r.start.email || email,
		expires_at: r.start.expires_at,
		ticket: r.start.claim_ticket,
	};
	const days = Math.max(
		1 / 1440,
		(Date.parse(pending.expires_at) - Date.now()) / 86_400_000
	);
	return json(
		{
			email: pending.email,
			expires_at: pending.expires_at,
			request_code: await emailLoginFingerprint(pending.ticket),
		},
		200,
		{
			"Set-Cookie": await sessionCookie(env.SESSION_SECRET, { pending }, days),
		}
	);
}

async function authPostAuthEmailWait(
	req: Request,
	env: Env,
	session: Session | undefined
) {
	const p = session?.pending;
	if (!p) {
		return fail(400, "No email sign-in in progress.");
	}
	if (Date.parse(p.expires_at) <= Date.now()) {
		return fail(410, "That link has expired. Send a new one.");
	}
	const limited = await rateLimitResponse(
		env.AUTH_RATE_LIMITER,
		env.SESSION_SECRET,
		"email-wait",
		requestIp(req)
	);
	if (limited) {
		return limited;
	}
	// Hot Aisle holds this request for up to 20 seconds while the link isn't approved yet
	const w = await waitEmailLogin(env, p.ticket);
	if (w === "waiting") {
		return json({ done: false });
	}
	if (typeof w === "object") {
		return fail(410, w.failed);
	}
	const c = await completeEmailLogin(env, p.ticket);
	if ("failed" in c) {
		return fail(410, c.failed);
	}
	const cred: Credential = { kind: "email", token: c.token };
	const who = await whoIs(env, cred);
	if (!who.ok) {
		return fail(who.status, who.message);
	}
	// the cookie lasts as long as Hot Aisle's session (it's renewed as the app is used), and at most 30 days
	const days = c.expires
		? Math.max(1 / 1440, (c.expires - Date.now()) / 86_400_000)
		: 30;
	return json({ done: true, ...JSON.parse(who.body) }, 200, {
		"Set-Cookie": await sessionCookie(
			env.SESSION_SECRET,
			{ kind: "email", token: c.token, tokenExp: c.expires },
			Math.min(days, 30)
		),
	});
}

async function authPostAuthSignout(env: Env) {
	return json({ ok: true }, 200, {
		"Set-Cookie": await sessionCookie(env.SESSION_SECRET, undefined),
	});
}

// ---------------------------------------------------------------- the Hot Aisle API

const FORWARD_HEADERS = ["Content-Type", "Accept"];

async function proxy(
	req: Request,
	env: Env,
	url: URL,
	session: TokenSession
): Promise<Response> {
	const cred = credentialOf(session);
	const path = url.pathname.slice("/api".length) + url.search;
	const read = req.method === "GET" || req.method === "HEAD";
	const limited = await rateLimitResponse(
		read ? env.API_READ_RATE_LIMITER : env.API_WRITE_RATE_LIMITER,
		env.SESSION_SECRET,
		read ? "api-read" : "api-write",
		read
			? `${cred.kind}\0${cred.token}\0${url.pathname}`
			: `${cred.kind}\0${cred.token}`
	);
	if (limited) {
		return limited;
	}
	const headers = new Headers();
	for (const h of FORWARD_HEADERS) {
		const v = req.headers.get(h);
		if (v) {
			headers.set(h, v);
		}
	}
	for (const [k, v] of Object.entries(authHeaders(cred))) {
		headers.set(k, v);
	}
	headers.set("User-Agent", `hotaisle-console/${env.VERSION ?? "dev"}`);
	let r: Response;
	try {
		const body = read ? undefined : await readBody(req, MAX_API_BODY_BYTES);
		if (body === null) {
			return fail(413, "API request body is too large.");
		}
		r = await send(env, apiBase(env) + path, {
			body,
			headers,
			method: req.method,
			redirect: "manual",
		});
	} catch (e) {
		return fail(
			502,
			`Could not reach the Hot Aisle API: ${(e as Error).message}`
		);
	}
	const out = new Response(r.body, {
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": r.headers.get("Content-Type") ?? "application/json",
		},
		status: r.status,
	});
	// Renewal: when an email session has under a minute left, Hot Aisle answers any call with a new key and its
	// expiry. The old key keeps working until its own expiry, so requests already in flight finish; the session
	// switches to the new key only if it lasts at least as long as the one it has (expiries come in whole seconds),
	// so a slow, older answer can't undo it.
	const fresh = r.headers.get("X-New-Session-Key");
	const until = Date.parse(r.headers.get("X-Session-Key-Expires") ?? "");
	if (
		cred.kind === "email" &&
		fresh &&
		Number.isFinite(until) &&
		until >= (session.tokenExp ?? 0) &&
		fresh !== session.token
	) {
		const days = Math.min(
			30,
			Math.max(1 / 1440, (until - Date.now()) / 86_400_000)
		);
		out.headers.set(
			"Set-Cookie",
			await sessionCookie(
				env.SESSION_SECRET,
				{
					kind: "email",
					token: fresh,
					tokenExp: until,
				},
				days
			)
		);
	}
	return withHeaders(out);
}

function keyFromHeader(header: string | null): Credential | undefined {
	if (!(header && TOKEN_SCHEME_PATTERN.test(header))) {
		return undefined;
	}
	const token = header.replace(TOKEN_SCHEME_PATTERN, "");
	if (!token || token.length > 4096 || WHITESPACE_PATTERN.test(token)) {
		return undefined;
	}
	return { kind: "key", token };
}
async function stateless(
	req: Request,
	env: Env,
	url: URL,
	authorization: string
): Promise<Response> {
	const credential = keyFromHeader(authorization);
	if (!credential) {
		return fail(401, "Invalid API-key authorization header.");
	}
	const identity: TokenSession = {
		exp: Date.now(),
		kind: "key",
		token: credential.token,
		v: 1,
	};
	return await proxy(req, env, url, identity);
}
