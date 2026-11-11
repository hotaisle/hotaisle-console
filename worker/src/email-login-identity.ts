import { createSignature, webcrypto } from "http-message-sig";

export const EMAIL_LOGIN_PATH = "/user/email/login/";
const CANONICAL_PATH = `/api${EMAIL_LOGIN_PATH}`;
const BASE64_PADDING = /[=]+$/u;
const BASE64_KEY = /^[A-Za-z0-9+/]+={0,2}$/u;

export class EmailLoginSigningError extends Error {
	override name = "EmailLoginSigningError";
}

function base64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

/** Sign only email-login issuance, using hotManager's RFC 9421 client profile. */
export async function emailLoginIdentityHeaders(
	target: string,
	body: string,
	privateKey: string | undefined
): Promise<Record<string, string>> {
	try {
		const url = new URL(target);
		if (
			url.protocol !== "https:" ||
			url.pathname !== CANONICAL_PATH ||
			url.search ||
			url.hash ||
			url.username ||
			url.password ||
			!privateKey ||
			privateKey.length > 256 ||
			!BASE64_KEY.test(privateKey)
		) {
			throw new EmailLoginSigningError(
				"Invalid email-login identity configuration."
			);
		}
		// PKCS#8 DER, encoded as standard base64. Never export or return the key.
		const key = await crypto.subtle.importKey(
			"pkcs8",
			Uint8Array.from(atob(privateKey), (char) => char.charCodeAt(0)),
			"Ed25519",
			false,
			["sign"]
		);
		const digest = base64(
			new Uint8Array(
				await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))
			)
		);
		const contentDigest = `sha-256=:${digest}:`;
		const created = Math.floor(Date.now() / 1000);
		const nonce = base64(crypto.getRandomValues(new Uint8Array(32)))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replace(BASE64_PADDING, "");
		const signature = await createSignature(
			{
				fields: [{ name: "content-digest", value: contentDigest }],
				kind: "request",
				method: "POST",
				targetUri: url.href,
			},
			{
				components: ["@method", "@target-uri", "content-digest"],
				label: "client",
				parameters: {
					alg: "ed25519",
					created,
					expires: created + 60,
					keyid: "hotaisle-console",
					nonce,
					tag: "hotmanager-email-login",
				},
				signer: webcrypto.signer(key),
			}
		);
		return {
			"Content-Digest": contentDigest,
			Signature: signature.signature,
			"Signature-Input": signature.signatureInput,
		};
	} catch (cause) {
		// Only the generic message reaches the browser; signing never falls back to unsigned.
		throw new EmailLoginSigningError(
			"Email sign-in is temporarily unavailable.",
			{ cause }
		);
	}
}
