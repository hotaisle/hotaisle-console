const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Visual comparison only; waiting and completion still require the private ticket. */
export async function emailLoginFingerprint(ticket: string): Promise<string> {
	const digest = new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticket))
	);
	let value = 0;
	for (const byte of digest.slice(0, 5)) {
		value = value * 256 + byte;
	}
	let code = "";
	for (let index = 7; index >= 0; index -= 1) {
		code += ALPHABET[Math.floor(value / 2 ** (index * 5)) % 32];
	}
	return `${code.slice(0, 4)}-${code.slice(4)}`;
}
