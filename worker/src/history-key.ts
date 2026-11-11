import type { Who } from "./hotaisle";

const encoder = new TextEncoder();
const CONTEXT = encoder.encode("hotaisle-console:browser-history:v1");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** Only call after verifying the credential with Hot Aisle. No per-account state is stored. */
export async function historyKey(secret: string, origin: string, who: Who) {
	const { email, created } = who.user;
	if (
		!(
			email &&
			EMAIL.test(email) &&
			created &&
			Number.isFinite(Date.parse(created))
		)
	) {
		throw new Error("Hot Aisle did not return a complete account identity.");
	}
	// The API currently exposes email and creation time, rather than an immutable user ID.
	// Creation time prevents a later account reusing an email from inheriting its history key.
	const identity = encoder.encode(
		JSON.stringify([
			origin,
			email.toLowerCase(),
			new Date(created).toISOString(),
		])
	);
	const scope = encode(
		new Uint8Array(await crypto.subtle.digest("SHA-256", identity))
	);
	const material = encoder.encode(secret);
	try {
		const root = await crypto.subtle.importKey("raw", material, "HKDF", false, [
			"deriveBits",
		]);
		const bytes = new Uint8Array(
			await crypto.subtle.deriveBits(
				{ hash: "SHA-256", info: identity, name: "HKDF", salt: CONTEXT },
				root,
				256
			)
		);
		try {
			return { key: encode(bytes), scope, version: 1 as const };
		} finally {
			bytes.fill(0);
		}
	} finally {
		material.fill(0);
	}
}
