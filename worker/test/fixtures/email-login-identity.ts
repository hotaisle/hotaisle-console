// Public RFC 8032 test vector, never a deployment credential.
export const TEST_EMAIL_LOGIN_KEY =
	"MC4CAQAwBQYDK2VwBCIEIJ1hsZ3v/VpguoRK9JLsLMREScVpezJpGXA7rAMcrn9g";
const TEST_PUBLIC_KEY_HEX =
	"d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const PROFILE =
	/^client=\("@method" "@target-uri" "content-digest"\);alg="ed25519";created=(?<created>\d+);expires=(?<expires>\d+);keyid="hotaisle-console";nonce="[A-Za-z0-9_-]{43}";tag="hotmanager-email-login"$/u;
const SIGNATURE = /^client=:(?<signature>[A-Za-z0-9+/]+={0,2}):$/u;

/** Independent RFC 9421 verifier for the isolated fixture; no production signing code. */
export async function verifyTestEmailLogin(
	request: {
		headers: { get: (name: string) => string | null };
		method: string;
		url: string;
	},
	body: string
): Promise<boolean> {
	const input = request.headers.get("Signature-Input") ?? "";
	const profile = PROFILE.exec(input)?.groups;
	const signature = SIGNATURE.exec(
		request.headers.get("Signature") ?? ""
	)?.groups;
	const now = Math.floor(Date.now() / 1000);
	if (
		!(profile && signature) ||
		Number(profile.created) > now + 5 ||
		Number(profile.created) < now - 60 ||
		Number(profile.expires) !== Number(profile.created) + 60 ||
		Number(profile.expires) <= now
	) {
		return false;
	}
	const digest = new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))
	);
	const expected = `sha-256=:${btoa(String.fromCharCode(...digest))}:`;
	if (request.headers.get("Content-Digest") !== expected) {
		return false;
	}
	const key = await crypto.subtle.importKey(
		"raw",
		Uint8Array.from(TEST_PUBLIC_KEY_HEX.match(/../gu) ?? [], (hex) =>
			Number.parseInt(hex, 16)
		),
		"Ed25519",
		false,
		["verify"]
	);
	const signatureBase = [
		`"@method": ${request.method}`,
		`"@target-uri": ${request.url}`,
		`"content-digest": ${expected}`,
		`"@signature-params": ${input.slice("client=".length)}`,
	].join("\n");
	return crypto.subtle.verify(
		"Ed25519",
		key,
		Uint8Array.from(atob(signature.signature), (char) => char.charCodeAt(0)),
		new TextEncoder().encode(signatureBase)
	);
}
