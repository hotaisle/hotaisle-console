import { describe, expect, it, vi } from "vitest";
import { type Env, upstream } from "../src/hotaisle";

describe("internal upstream requests", () => {
	it("rejects redirects without following credential-bearing requests", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(Response.redirect("https://redirect.invalid/", 307));
		const env = {
			API_BASE: "https://upstream.invalid/api",
			UPSTREAM: { fetch: fetcher },
		} as unknown as Env;
		const result = await upstream(env, "GET", "/user/", {
			cred: { kind: "key", token: "dummy-token" },
		});
		expect(result.status).toBe(502);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledWith(
			"https://upstream.invalid/api/user/",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Token dummy-token",
				}),
				redirect: "manual",
			})
		);
	});
});
