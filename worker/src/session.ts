const BASE64_PADDING_PATTERN = /[=]+$/u;
// The session: who is signed in, and the Hot Aisle token their calls go out with.
//
// It lives in one cookie, encrypted and authenticated with AES-GCM under a key derived from the Worker's
// SESSION_SECRET. The cookie is HttpOnly (page scripts can't read it), SameSite=Strict (other sites can't send
// it) and Secure. The browser only ever holds ciphertext; the token is decrypted inside the Worker for the
// length of one request and never reaches the page.

export interface Session {
	/** When this session stops being accepted (ms since 1970). */
	exp: number;
	/** How it was obtained. */
	kind?: "key" | "email" | "passkey";
	/** An email sign-in waiting for its link to be opened. */
	pending?: { ticket: string; email: string; expires_at: string };
	/** The Hot Aisle token API calls are made with. */
	token?: string;
	/** When Hot Aisle stops accepting the token (ms since 1970). Email sessions last about 20 minutes and are renewed. */
	tokenExp?: number;
	v: 1;
}

export const COOKIE = "hai_session";
const SESSION_DAYS = 30;

const enc = new TextEncoder();
const dec = new TextDecoder();

const keys = new Map<string, Promise<CryptoKey>>();
/** A key derived from SESSION_SECRET for one purpose ("session", "token at rest"), so keys are never reused across them. */
export function deriveKey(secret: string, purpose: string): Promise<CryptoKey> {
	const id = `${purpose}\0${secret}`;
	let k = keys.get(id);
	if (!k) {
		k = (async () => {
			if (!secret || secret.length < 32) {
				throw new Error(
					"SESSION_SECRET must be set to at least 32 random characters"
				);
			}
			const base = await crypto.subtle.importKey(
				"raw",
				enc.encode(secret),
				"HKDF",
				false,
				["deriveKey"]
			);
			return crypto.subtle.deriveKey(
				{
					hash: "SHA-256",
					info: enc.encode(purpose),
					name: "HKDF",
					salt: enc.encode("hotaisle-ui"),
				},
				base,
				{ length: 256, name: "AES-GCM" },
				false,
				["encrypt", "decrypt"]
			);
		})();
		keys.set(id, k);
	}
	return k;
}

const b64u = (b: Uint8Array) =>
	btoa(String.fromCharCode(...b))
		.replace(/\+/gu, "-")
		.replace(/\//gu, "_")
		.replace(BASE64_PADDING_PATTERN, "");
const unb64u = (s: string) =>
	Uint8Array.from(atob(s.replace(/-/gu, "+").replace(/_/gu, "/")), (c) =>
		c.charCodeAt(0)
	);

export async function seal(key: CryptoKey, value: unknown): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = new Uint8Array(
		await crypto.subtle.encrypt(
			{ iv, name: "AES-GCM" },
			key,
			enc.encode(JSON.stringify(value))
		)
	);
	const out = new Uint8Array(iv.length + ct.length);
	out.set(iv);
	out.set(ct, iv.length);
	return b64u(out);
}

export async function open<T>(
	key: CryptoKey,
	sealed: string
): Promise<T | undefined> {
	try {
		const raw = unb64u(sealed);
		const pt = await crypto.subtle.decrypt(
			{ iv: raw.slice(0, 12), name: "AES-GCM" },
			key,
			raw.slice(12)
		);
		return JSON.parse(dec.decode(pt)) as T;
	} catch {
		return undefined; // tampered, from another secret, or not ours
	}
}

function cookieValue(req: Request, name: string): string | undefined {
	for (const part of (req.headers.get("Cookie") ?? "").split(";")) {
		const i = part.indexOf("=");
		if (i > 0 && part.slice(0, i).trim() === name) {
			return part.slice(i + 1).trim();
		}
	}
	return undefined;
}

/** The request's session, if it carries a valid, unexpired one. */
export async function readSession(
	req: Request,
	secret: string
): Promise<Session | undefined> {
	const v = cookieValue(req, COOKIE);
	if (!v) {
		return undefined;
	}
	const s = await open<Session>(await deriveKey(secret, "session"), v);
	if (s?.v !== 1 || !(s.exp > Date.now()) || s.kind === "key") {
		return undefined;
	}
	if (s.tokenExp && s.tokenExp <= Date.now()) {
		return undefined; // Hot Aisle's session has ended: sign in again
	}
	return s;
}

/** A Set-Cookie header that stores the session (or clears it, given undefined). */
export async function sessionCookie(
	secret: string,
	s: Omit<Session, "v" | "exp"> | undefined,
	maxAgeDays = SESSION_DAYS
): Promise<string> {
	const attrs = "Path=/; HttpOnly; Secure; SameSite=Strict";
	if (!s) {
		return `${COOKIE}=; ${attrs}; Max-Age=0`;
	}
	const exp = Date.now() + maxAgeDays * 86_400_000;
	const value = await seal(await deriveKey(secret, "session"), {
		...s,
		exp,
		v: 1,
	});
	return `${COOKIE}=${value}; ${attrs}; Max-Age=${maxAgeDays * 86_400}`;
}
