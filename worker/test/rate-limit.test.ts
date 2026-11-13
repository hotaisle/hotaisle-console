import { describe, expect, it } from "vitest";
import { allowRate } from "../src/rate-limit";
import { env } from "./runtime";

const OPAQUE_KEY = /^[0-9a-f]{64}$/u;

describe("rate-limit counter keys", () => {
	it.each([
		"API_READ_RATE_LIMITER",
		"API_WRITE_RATE_LIMITER",
		"AUTH_RATE_LIMITER",
		"EMAIL_LOGIN_EMAIL_RATE_LIMITER",
		"EMAIL_LOGIN_IP_RATE_LIMITER",
	] as const)("exercises the configured native %s binding", async (name) => {
		expect(
			await allowRate(
				env[name],
				env.SESSION_SECRET,
				"binding-smoke",
				crypto.randomUUID()
			)
		).toBe(true);
	});
	it("uses stable, purpose-separated HMAC keys without exposing the actor", async () => {
		const seen: string[] = [];
		const limiter: RateLimit = {
			limit: ({ key }) => {
				seen.push(key);
				return Promise.resolve({ success: true });
			},
		};
		const secret = "test-only-secret-0123456789abcdefghijklmnop";
		await allowRate(limiter, secret, "api-read", "Token private-key");
		await allowRate(limiter, secret, "api-read", "Token private-key");
		await allowRate(limiter, secret, "api-write", "Token private-key");
		expect(seen[0]).toMatch(OPAQUE_KEY);
		expect(seen[0]).toBe(seen[1]);
		expect(seen[2]).not.toBe(seen[0]);
		expect(seen.join("")).not.toContain("private-key");
	});
});
