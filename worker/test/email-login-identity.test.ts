import { describe, expect, it, vi } from "vitest";
import { emailLoginIdentityHeaders } from "../src/email-login-identity";
import { type Env, startEmailLogin, upstream } from "../src/hotaisle";
import {
	TEST_EMAIL_LOGIN_KEY,
	verifyTestEmailLogin,
} from "./fixtures/email-login-identity";

const TARGET = "https://api.test/api/user/email/login/";
const BODY = JSON.stringify({ email: "alice@example.com" });

async function signedRequest() {
	return new Request(TARGET, {
		body: BODY,
		headers: await emailLoginIdentityHeaders(
			TARGET,
			BODY,
			TEST_EMAIL_LOGIN_KEY
		),
		method: "POST",
	});
}

describe("verified email-login client", () => {
	it("signs the exact JSON bytes, method, canonical URL and hotManager profile", async () => {
		const request = await signedRequest();
		expect(await verifyTestEmailLogin(request, BODY)).toBe(true);
		expect(await verifyTestEmailLogin(request, `${BODY}\n`)).toBe(false);
		expect(
			await verifyTestEmailLogin(
				{ headers: request.headers, method: "GET", url: TARGET },
				BODY
			)
		).toBe(false);
		expect(
			await verifyTestEmailLogin(
				{
					headers: request.headers,
					method: "POST",
					url: "https://other.test/api/user/email/login/",
				},
				BODY
			)
		).toBe(false);
	});

	it("uses a fresh nonce and signature on each login attempt", async () => {
		const first = await signedRequest();
		const second = await signedRequest();
		expect(first.headers.get("Signature-Input")).not.toBe(
			second.headers.get("Signature-Input")
		);
		expect(first.headers.get("Signature")).not.toBe(
			second.headers.get("Signature")
		);
		expect(await verifyTestEmailLogin(second, BODY)).toBe(true);
	});

	it.each([undefined, "", "not-a-private-key", btoa("invalid DER")])(
		"never falls back to unsigned login for absent or invalid key %s",
		async (key) => {
			const fetcher = vi.fn();
			const result = await startEmailLogin(
				{
					EMAIL_LOGIN_SIGNING_KEY: key,
					UPSTREAM: { fetch: fetcher },
				} as unknown as Env,
				"alice@example.com"
			);
			expect(result).toEqual({
				message: "Email sign-in is temporarily unavailable.",
				ok: false,
				status: 503,
			});
			expect(fetcher).not.toHaveBeenCalled();
		}
	);

	it.each([
		"http://api.test/api/user/email/login/",
		`${TARGET}?client=other`,
		`${TARGET}#fragment`,
		"https://api.test/user/email/login/",
		"https://user:password@api.test/api/user/email/login/",
	])("rejects invalid signing target %s", async (target) => {
		await expect(
			emailLoginIdentityHeaders(target, BODY, TEST_EMAIL_LOGIN_KEY)
		).rejects.toThrow("Email sign-in is temporarily unavailable.");
	});

	it("sends the signed body once and never follows an upstream redirect", async () => {
		const fetcher = vi.fn().mockImplementation(async (url, init) => {
			const request = new Request(url, init);
			expect(await verifyTestEmailLogin(request, await request.text())).toBe(
				true
			);
			return Response.redirect("https://redirect.invalid/", 307);
		});
		const response = await upstream(
			{
				API_BASE: "https://api.test/api/",
				EMAIL_LOGIN_SIGNING_KEY: TEST_EMAIL_LOGIN_KEY,
				UPSTREAM: { fetch: fetcher },
			} as unknown as Env,
			"POST",
			"/user/email/login/",
			{ body: JSON.parse(BODY) }
		);
		expect(response.status).toBe(502);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
	});

	it("does not sign account, wait, completion or proxy requests", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 204 }));
		const env = {
			EMAIL_LOGIN_SIGNING_KEY: TEST_EMAIL_LOGIN_KEY,
			UPSTREAM: { fetch: fetcher },
		} as unknown as Env;
		await Promise.all(
			[
				["GET", "/user/"],
				["POST", "/user/email/wait/"],
				["POST", "/user/email/complete/"],
				["DELETE", "/teams/lab/virtual_machines/example/"],
			].map(([method, path]) => upstream(env, method, path))
		);
		for (const [, init] of fetcher.mock.calls) {
			const headers = new Headers(init.headers);
			expect(headers.has("Signature")).toBe(false);
			expect(headers.has("Signature-Input")).toBe(false);
			expect(headers.has("Content-Digest")).toBe(false);
		}
	});
});
