import { describe, expect, it } from "vitest";
import { allowRate } from "../src/rate-limit";

const OPAQUE_KEY = /^[0-9a-f]{64}$/u;

describe("rate-limit counter keys", () => {
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
