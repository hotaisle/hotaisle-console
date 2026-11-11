const encoder = new TextEncoder();
const RATE_KEY_PURPOSE = "hotaisle-console-rate-limit-v1";

/** The Cloudflare counter sees an opaque, purpose-separated key, never the credential, email, or IP. */
export async function allowRate(
	limiter: RateLimit,
	secret: string,
	scope: string,
	actor: string
): Promise<boolean> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ hash: "SHA-256", name: "HMAC" },
		false,
		["sign"]
	);
	const input = `${RATE_KEY_PURPOSE}\0${scope}\0${actor}`;
	const digest = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, encoder.encode(input))
	);
	const counterKey = Array.from(digest, (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
	return (await limiter.limit({ key: counterKey })).success;
}

export function requestIp(req: Request): string {
	return req.headers.get("CF-Connecting-IP") ?? "unknown";
}
