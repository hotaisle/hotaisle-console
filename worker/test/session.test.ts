import { describe, expect, it } from "vitest";
import type { Env } from "../src/hotaisle";
import entrypoint from "../src/index";
import { deriveKey, readSession, seal, sessionCookie } from "../src/session";
import { rateLimitWindow } from "./fixtures/rate-limit";
import { fakeHotAisle } from "./fixtures/upstream";
import { env } from "./runtime";

const ORIGIN = "https://ui.test";
const HEADERS = { "X-Requested-With": "hotaisle-console" };

function fixtureBrowser() {
	const fake = fakeHotAisle(() => Date.now());
	const bindings: Env = {
		...env,
		API_READ_RATE_LIMITER: rateLimitWindow(120).binding,
		API_WRITE_RATE_LIMITER: rateLimitWindow(30).binding,
		AUTH_RATE_LIMITER: rateLimitWindow(60).binding,
		EMAIL_LOGIN_EMAIL_RATE_LIMITER: rateLimitWindow(3).binding,
		EMAIL_LOGIN_IP_RATE_LIMITER: rateLimitWindow(10).binding,
		UPSTREAM: { fetch: fake.fetch } as unknown as Fetcher,
	};
	let cookie = "";
	async function call(
		method: string,
		path: string,
		body?: unknown,
		headers: Record<string, string> = {}
	) {
		const response = await entrypoint.fetch(
			new Request(ORIGIN + path, {
				body: body === undefined ? undefined : JSON.stringify(body),
				headers: { ...HEADERS, Cookie: cookie, ...headers },
				method,
			}),
			bindings
		);
		const replacement = response.headers.get("Set-Cookie");
		if (replacement) {
			[cookie] = replacement.split(";");
		}
		return response;
	}
	async function configure(
		email: string,
		options: Record<string, string> = {}
	) {
		await fake.fetch(
			`https://api.test/api/__configure?${new URLSearchParams({ email, ...options })}`
		);
	}
	async function login(
		email = "session@example.com",
		options: Record<string, string> = {}
	) {
		await configure(email, options);
		const started = await call("POST", "/auth/email/start", { email });
		if (started.status !== 200) {
			throw new Error(`Fixture email start failed: ${started.status}`);
		}
		await fake.fetch(
			`https://api.test/api/__open?${new URLSearchParams({ email })}`
		);
		return call("POST", "/auth/email/wait");
	}
	return {
		bindings,
		call,
		configure,
		cookie: () => cookie,
		fake,
		login,
		replaceCookie: (value: string) => {
			[cookie] = value.split(";");
		},
		session: () =>
			readSession(
				new Request(ORIGIN, { headers: { Cookie: cookie } }),
				env.SESSION_SECRET
			),
	};
}

describe("email token-pair cookie protocol", () => {
	it("keeps the complete validated pair in a v2 cookie, not frontend JSON or headers", async () => {
		const b = fixtureBrowser();
		const result = await b.login();
		expect(result.status).toBe(200);
		const completion = (await result.json()) as Record<string, unknown>;
		expect(Object.keys(completion).sort()).toEqual(["done", "teams", "user"]);
		const session = await b.session();
		expect(session).toMatchObject({ kind: "email", v: 2 });
		expect(session?.pair?.accessToken.startsWith("ha_at_")).toBe(true);
		expect(session?.pair?.refreshToken.startsWith("ha_rt_")).toBe(true);
		expect(session?.exp).toBe(session?.pair?.sessionExpiresAt);
		expect(b.cookie()).not.toContain("ha_at_");
		expect(b.cookie()).not.toContain("ha_rt_");
		expect(result.headers.get("X-New-Session-Key")).toBeNull();
		const status = await b.call("GET", "/auth/status");
		const statusBody = await status.text();
		expect(JSON.parse(statusBody)).toMatchObject({
			kind: "email",
			signed_in: true,
		});
		expect(statusBody).not.toContain("access");
		expect(statusBody).not.toContain("refresh");
		expect(statusBody).not.toContain("session_handle");
		expect((await b.call("GET", "/api/user/")).status).toBe(200);
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
		).toHaveLength(0);
	});

	it.each([
		[60_001, true],
		[60_000, false],
		[0, false],
	] as const)(
		"allows interrupted-request recovery only outside renewal with %s ms remaining",
		async (remaining, canResume) => {
			const b = fixtureBrowser();
			expect(await (await b.call("GET", "/auth/status")).json()).toMatchObject({
				can_resume: false,
				signed_in: false,
			});
			await b.login();
			const pair = (await b.session())?.pair;
			if (!pair) {
				throw new Error("Missing fixture pair");
			}
			b.replaceCookie(
				await sessionCookie(env.SESSION_SECRET, {
					kind: "email",
					pair: { ...pair, accessExpiresAt: Date.now() + remaining },
				})
			);
			const status = await b.call("GET", "/auth/status");
			expect(await status.json()).toMatchObject({
				can_resume: canResume,
				signed_in: true,
			});
			expect(status.headers.get("Set-Cookie")).toBeNull();
			expect(
				b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
			).toEqual([]);
			b.replaceCookie(
				await sessionCookie(env.SESSION_SECRET, {
					ended: true,
					kind: "email",
					pair,
				})
			);
			expect(await (await b.call("GET", "/auth/status")).json()).toMatchObject({
				can_resume: false,
				signed_in: false,
			});
		}
	);

	it("renews open email sessions before access expires and skips a second rotation", async () => {
		const b = fixtureBrowser();
		await b.login("renew-open@example.com", { access_in: "30" });
		const previous = (await b.session())?.pair;
		if (!previous) {
			throw new Error("Missing fixture pair");
		}
		expect(await (await b.call("GET", "/auth/status")).json()).toMatchObject({
			check_session_in_ms: 0,
			signed_in: true,
		});
		expect(previous.accessExpiresAt).toBeGreaterThan(Date.now());
		const renewed = await b.call("POST", "/auth/refresh");
		expect(renewed.status).toBe(200);
		expect(renewed.headers.get("Set-Cookie")).toContain("HttpOnly");
		const payload = (await renewed.json()) as { check_session_in_ms: number };
		expect(payload.check_session_in_ms).toBeGreaterThan(0);
		const current = (await b.session())?.pair;
		expect(current?.refreshToken).not.toBe(previous.refreshToken);
		expect(current?.sessionExpiresAt).toBe(previous.sessionExpiresAt);
		const secondTab = await b.call("POST", "/auth/refresh");
		expect(secondTab.headers.get("Set-Cookie")).toBeNull();
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
		).toEqual(["POST /auth/token/ -"]);
	});

	it.each([
		[30_000, 200],
		[-1000, 401],
	])(
		"never rotates when access lasts through the absolute deadline (%s ms remaining)",
		async (remaining, status) => {
			const b = fixtureBrowser();
			await b.login();
			const previous = (await b.session())?.pair;
			if (!previous) {
				throw new Error("Missing fixture pair");
			}
			const deadline = Date.now() + remaining;
			b.replaceCookie(
				await sessionCookie(env.SESSION_SECRET, {
					kind: "email",
					pair: {
						...previous,
						accessExpiresAt: deadline,
						refreshExpiresAt: deadline,
						sessionExpiresAt: deadline,
					},
				})
			);
			const response = await b.call("POST", "/auth/refresh");
			expect(response.status).toBe(status);
			expect(response.headers.get("Set-Cookie")).toBeNull();
			expect(
				b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
			).toEqual([]);
		}
	);

	it("renews expired access before sending a mutation exactly once, without extending its family", async () => {
		const b = fixtureBrowser();
		await b.login();
		const previous = (await b.session())?.pair;
		if (!previous) {
			throw new Error("Missing fixture pair");
		}
		b.replaceCookie(
			await sessionCookie(env.SESSION_SECRET, {
				kind: "email",
				pair: { ...previous, accessExpiresAt: Date.now() - 1 },
			})
		);
		expect(await (await b.call("GET", "/auth/status")).json()).toMatchObject({
			signed_in: true,
		});
		const result = await b.call("DELETE", "/api/teams/lab/machine/");
		expect(result.status).toBe(204);
		expect(result.headers.get("Set-Cookie")).not.toBeNull();
		const after = (await b.session())?.pair;
		expect(after?.accessToken).not.toBe(previous.accessToken);
		expect(after?.refreshToken).not.toBe(previous.refreshToken);
		expect(after?.sessionHandle).toBe(previous.sessionHandle);
		expect(after?.sessionExpiresAt).toBe(previous.sessionExpiresAt);
		expect(
			b.fake.calls.filter((call) =>
				call.startsWith("DELETE /teams/lab/machine/")
			)
		).toHaveLength(1);
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
		).toEqual(["POST /auth/token/ -"]);
	});

	it.each([403, 404, 401])(
		"preserves replacement cookies on resource HTTP %s without auth replay",
		async (status) => {
			const b = fixtureBrowser();
			await b.login("resource-error@example.com", { access_in: "30" });
			const path = { 401: "unauthorized", 403: "forbidden", 404: "missing" }[
				status
			];
			const response = await b.call("POST", `/api/fixture/${path}/`);
			expect(response.status).toBe(status);
			expect(response.headers.get("Set-Cookie")).not.toBeNull();
			expect(
				b.fake.calls.filter((call) => call.startsWith(`POST /fixture/${path}/`))
			).toHaveLength(1);
			expect(
				b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
			).toHaveLength(1);
		}
	);

	it("renews before verifying history identity and retains the cookie on a history failure", async () => {
		const b = fixtureBrowser();
		await b.login("history@example.com", { access_in: "30" });
		await b.configure("history@example.com", { identity: "fail" });
		const response = await b.call("POST", "/auth/history-key");
		expect(response.status).toBe(502);
		expect(response.headers.get("Set-Cookie")).not.toBeNull();
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
		).toHaveLength(1);
		await b.configure("history@example.com");
		expect((await b.call("POST", "/auth/history-key")).status).toBe(200);
	});

	it.each([
		"malformed",
		"lost",
		"rejected",
		"handle",
		"deadline",
		"expired",
		"missing",
		"ordering",
		"same-refresh",
		"credential",
	])(
		"ends %s refresh exchanges without retry, retaining a spent verifier only for logout",
		async (mode) => {
			const b = fixtureBrowser();
			await b.login("failure@example.com", { access_in: "30", refresh: mode });
			const original = (await b.session())?.pair;
			if (!original) {
				throw new Error("Missing fixture pair");
			}
			const response = await b.call("DELETE", "/api/teams/lab/machine/");
			expect(response.status).toBe(401);
			expect(response.headers.get("X-Session-Ended")).toBe("true");
			expect(await response.text()).not.toContain(original.refreshToken);
			expect(await b.session()).toMatchObject({ ended: true, pair: original });
			expect(await (await b.call("GET", "/auth/status")).json()).toMatchObject({
				signed_in: false,
			});
			expect((await b.call("GET", "/api/user/")).status).toBe(401);
			expect((await b.call("POST", "/auth/history-key")).status).toBe(401);
			expect(
				b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
			).toHaveLength(1);
			expect(
				b.fake.calls.filter((call) =>
					call.startsWith("DELETE /teams/lab/machine/")
				)
			).toHaveLength(0);
			const logout = await b.call("POST", "/auth/signout");
			expect(logout.status).toBe(200);
			expect(logout.headers.get("Set-Cookie")).toContain("Max-Age=0");
			expect(
				b.fake.calls.filter((call) => call.startsWith("POST /auth/logout/"))
			).toEqual(["POST /auth/logout/ -"]);
			expect(
				(
					await b.fake.fetch("https://api.test/api/user/", {
						headers: { Authorization: `Bearer ${original.accessToken}` },
					})
				).status
			).toBe(401);
		}
	);

	it("revokes a successfully rotated family using its current refresh verifier", async () => {
		const b = fixtureBrowser();
		await b.login("rotated-logout@example.com", { access_in: "30" });
		await b.call("GET", "/api/user/");
		const pair = (await b.session())?.pair;
		if (!pair) {
			throw new Error("Missing fixture pair");
		}
		expect((await b.call("POST", "/auth/signout")).status).toBe(200);
		expect(
			(
				await b.fake.fetch("https://api.test/api/user/", {
					headers: { Authorization: `Bearer ${pair.accessToken}` },
				})
			).status
		).toBe(401);
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/logout/"))
		).toHaveLength(1);
	});

	it.each([
		["Bearer", "lookup.secret"],
		["Bearer", "ha_ak_lookup.secret"],
		["Token", "lookup.secret"],
		["Token", "ha_ak_lookup.secret"],
	])("canonicalizes %s %s without a cookie", async (scheme, key) => {
		const b = fixtureBrowser();
		const response = await b.call("GET", "/auth/key", undefined, {
			Authorization: `${scheme} ${key}`,
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("Set-Cookie")).toBeNull();
		expect(await response.text()).not.toContain(key);
		expect(
			(
				await b.call("POST", "/auth/history-key", undefined, {
					Authorization: `${scheme} ${key}`,
				})
			).status
		).toBe(200);
		await b.call("POST", "/auth/signout", undefined, {
			Authorization: `${scheme} ${key}`,
		});
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/logout/"))
		).toHaveLength(0);
	});

	it("revokes the current rotated verifier and clears the cookie even when logout fails", async () => {
		const b = fixtureBrowser();
		await b.login("logout@example.com", { access_in: "30" });
		await b.call("GET", "/api/user/");
		await b.configure("logout@example.com", { logout: "fail" });
		const result = await b.call("POST", "/auth/signout");
		expect(result.status).toBe(502);
		expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
		expect(result.headers.get("X-Session-Ended")).toBe("true");
		expect(await result.text()).toContain(
			"remote revocation could not be confirmed"
		);
	});

	it("does not fall back to a cookie or rotate it for explicit API-key authorization", async () => {
		const b = fixtureBrowser();
		await b.login("source@example.com", { access_in: "30" });
		const cookie = b.cookie();
		const response = await b.call("GET", "/api/user/", undefined, {
			Authorization: "bEaReR tok-bob",
		});
		expect(await response.json()).toMatchObject({
			user: { email: "bob@example.com" },
		});
		expect(b.cookie()).toBe(cookie);
		expect(
			(
				await b.call("POST", "/auth/history-key", undefined, {
					Authorization: "Bearer invalid",
				})
			).status
		).toBe(401);
		expect(
			(await b.call("GET", "/api/user/", undefined, { Authorization: "" }))
				.status
		).toBe(401);
		expect(
			(
				await b.call("POST", "/auth/history-key", undefined, {
					Authorization: "",
				})
			).status
		).toBe(401);
		expect(
			(
				await b.call("GET", "/api/user/", undefined, {
					Authorization: "Bearer ha_rt_body-only",
				})
			).status
		).toBe(401);
		expect(
			(
				await b.call("GET", "/api/user/", undefined, {
					Authorization: "Token ha_at_not-an-api-key",
				})
			).status
		).toBe(401);
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
		).toHaveLength(0);
		await b.call("POST", "/auth/signout", undefined, {
			Authorization: "Token tok-bob",
		});
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/logout/"))
		).toHaveLength(1);
	});

	it("rejects legacy cookies and expired logical/refresh deadlines but allows explicit expired-verifier logout", async () => {
		const b = fixtureBrowser();
		const legacy = await seal(await deriveKey(env.SESSION_SECRET, "session"), {
			exp: Date.now() + 86_400_000,
			kind: "email",
			token: "old-session",
			v: 1,
		});
		b.replaceCookie(`hai_session=${legacy}`);
		expect((await b.call("GET", "/api/user/")).status).toBe(401);
		await b.login();
		const pair = (await b.session())?.pair;
		if (!pair) {
			throw new Error("Missing fixture pair");
		}
		b.replaceCookie(
			await sessionCookie(env.SESSION_SECRET, {
				kind: "email",
				pair: {
					...pair,
					accessExpiresAt: Date.now() - 2,
					refreshExpiresAt: Date.now() - 1,
				},
			})
		);
		expect(await (await b.call("GET", "/auth/status")).json()).toMatchObject({
			signed_in: false,
		});
		expect(
			(await b.call("GET", "/api/user/")).headers.get("X-Session-Ended")
		).toBe("true");
		expect((await b.call("POST", "/auth/signout")).status).toBe(200);
		b.replaceCookie(
			await sessionCookie(env.SESSION_SECRET, {
				kind: "email",
				pair: {
					...pair,
					accessExpiresAt: Date.now() - 3,
					refreshExpiresAt: Date.now() - 2,
					sessionExpiresAt: Date.now() - 1,
				},
			})
		);
		expect(await b.session()).toBeUndefined();
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /auth/token/"))
		).toHaveLength(0);
	});

	it("clears malformed completion claims, and revokes valid completion pairs if identity verification fails", async () => {
		const malformed = fixtureBrowser();
		const result = await malformed.login("malformed@example.com", {
			complete: "malformed",
		});
		expect(result.status).toBe(410);
		expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
		expect(result.headers.get("X-Session-Ended")).toBe("true");
		expect((await malformed.call("POST", "/auth/email/wait")).status).toBe(400);
		expect(
			malformed.fake.calls.filter((call) =>
				call.startsWith("POST /user/email/complete/")
			)
		).toHaveLength(1);
		const failedIdentity = fixtureBrowser();
		expect(
			(await failedIdentity.login("identity@example.com", { identity: "fail" }))
				.status
		).toBe(502);
		expect(
			failedIdentity.fake.calls.filter((call) =>
				call.startsWith("POST /auth/logout/")
			)
		).toHaveLength(1);
	});

	it("revokes the old family before replacing its only verifier with a new login claim", async () => {
		const b = fixtureBrowser();
		await b.login();
		const old = (await b.session())?.pair;
		if (!old) {
			throw new Error("Missing fixture pair");
		}
		expect(
			(
				await b.call("POST", "/auth/email/start", {
					email: "replacement@example.com",
				})
			).status
		).toBe(200);
		expect((await b.session())?.pending).toBeDefined();
		expect(
			(
				await b.fake.fetch("https://api.test/api/user/", {
					headers: { Authorization: `Bearer ${old.accessToken}` },
				})
			).status
		).toBe(401);
	});

	it("retains an ended verifier rather than orphaning a family when replacement revocation fails", async () => {
		const b = fixtureBrowser();
		await b.login("replacement-fail@example.com", { logout: "fail" });
		const old = (await b.session())?.pair;
		const result = await b.call("POST", "/auth/email/start", {
			email: "new@example.com",
		});
		expect(result.status).toBe(502);
		expect(result.headers.get("X-Session-Ended")).toBe("true");
		expect(await b.session()).toMatchObject({ ended: true, pair: old });
		expect(
			b.fake.calls.filter((call) => call.startsWith("POST /user/email/login/"))
		).toHaveLength(1);
	});
});
