import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { keyVault } from "./key-vault";

const STATE_KEY = "hotaisle-console:email-session:v2";
const ACCOUNT = { teams: [], user: { email: "fixture@example.test" } };
beforeEach(() => keyVault.lock());

describe("email-session transport", () => {
	it("serializes independent cookie requests until the response body is received", async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered: () => void = () => undefined;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const fetcher = vi.fn(async () => {
			entered();
			await gate;
			return Response.json(ACCOUNT);
		});
		vi.stubGlobal("fetch", fetcher);
		const first = api.user();
		await started;
		const second = api.user();
		expect(fetcher).toHaveBeenCalledOnce();
		release();
		await expect(Promise.all([first, second])).resolves.toEqual([
			ACCOUNT,
			ACCOUNT,
		]);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("does not retry a possibly spent refresh after a lost response, but permits explicit signout", async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error("Response lost"))
			.mockResolvedValueOnce(Response.json({ ok: true }))
			.mockResolvedValueOnce(
				Response.json({
					email_login: true,
					passkeys: false,
					signed_in: true,
					version: "fixture",
				})
			);
		vi.stubGlobal("fetch", fetcher);
		await expect(api.user()).rejects.toThrow("Response lost");
		await expect(api.teams()).rejects.toMatchObject({ status: 401 });
		expect(fetcher).toHaveBeenCalledOnce();
		await expect(api.signOut()).resolves.toEqual({ ok: true });
		expect(fetcher.mock.calls[1][0]).toBe("/auth/signout");
		await expect(api.status()).resolves.toMatchObject({ signed_in: false });
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it("does not reuse the cookie when response-body receipt fails", async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.error(new Error("Body lost"));
					},
				})
			)
		);
		vi.stubGlobal("fetch", fetcher);
		await expect(api.user()).rejects.toThrow("Body lost");
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it.each([
		["pending", true, true],
		["pending", false, false],
		["ended", true, false],
		["pending-login", true, false],
		["active", false, true],
	] as const)(
		"restores reload state %s with reusable cookie %s as signed in %s",
		async (phase, canResume, signedIn) => {
			localStorage.setItem(
				STATE_KEY,
				JSON.stringify({ epoch: "reload", phase })
			);
			const fetcher = vi
				.fn()
				.mockResolvedValueOnce(
					Response.json({ can_resume: canResume, signed_in: true })
				)
				.mockResolvedValueOnce(Response.json(ACCOUNT));
			vi.stubGlobal("fetch", fetcher);
			await expect(api.status()).resolves.toMatchObject({
				signed_in: signedIn,
			});
			expect(await Promise.allSettled([api.user()])).toEqual([
				signedIn
					? { status: "fulfilled", value: ACCOUNT }
					: {
							reason: expect.objectContaining({ status: 401 }),
							status: "rejected",
						},
			]);
			expect(fetcher.mock.calls.map(([path]) => path)).toEqual(
				signedIn ? ["/auth/status", "/api/user/"] : ["/auth/status"]
			);
		}
	);

	it("recovers an interrupted resource only after status confirms a usable cookie", async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error("Navigation interrupted receipt"))
			.mockResolvedValueOnce(
				Response.json({ can_resume: true, signed_in: true })
			)
			.mockResolvedValueOnce(Response.json(ACCOUNT));
		vi.stubGlobal("fetch", fetcher);
		await expect(api.user()).rejects.toThrow("Navigation interrupted receipt");
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		await expect(api.status()).resolves.toMatchObject({ signed_in: true });
		await expect(api.user()).resolves.toEqual(ACCOUNT);
		expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
			"/api/user/",
			"/auth/status",
			"/api/user/",
		]);
	});

	it("does not restore an interrupted session when logout races its status reply", async () => {
		localStorage.setItem(
			STATE_KEY,
			JSON.stringify({ epoch: "reload", phase: "pending" })
		);
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered: () => void = () => undefined;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const fetcher = vi.fn(async (path: string) => {
			if (path === "/auth/status") {
				entered();
				await gate;
				return Response.json({ can_resume: true, signed_in: true });
			}
			return Response.json({ ok: true });
		});
		vi.stubGlobal("fetch", fetcher);
		const status = expect(api.status()).rejects.toMatchObject({ status: 401 });
		await started;
		const logout = api.signOut();
		release();
		await Promise.all([status, logout]);
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
			"/auth/status",
			"/auth/signout",
		]);
	});

	it("requires a fresh completed login after interrupted work survives a tab restart", async () => {
		localStorage.setItem(
			STATE_KEY,
			JSON.stringify({ epoch: "interrupted", phase: "pending" })
		);
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					email: "fixture@example.test",
					expires_at: "2030-01-01",
					request_code: "ABCD-EFGH",
				})
			)
			.mockResolvedValueOnce(Response.json({ done: false }))
			.mockResolvedValueOnce(Response.json({ done: true, ...ACCOUNT }))
			.mockResolvedValueOnce(Response.json(ACCOUNT));
		vi.stubGlobal("fetch", fetcher);
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		expect(fetcher).not.toHaveBeenCalled();
		await api.emailStart("fixture@example.test");
		await expect(api.emailWait()).resolves.toEqual({ done: false });
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		await expect(api.emailWait()).resolves.toMatchObject({ done: true });
		await expect(api.user()).resolves.toEqual(ACCOUNT);
		expect(fetcher).toHaveBeenCalledTimes(4);
	});

	it("still revokes the cookie when another tab logs out between the epoch check and phase write", async () => {
		const fetcher = vi.fn((path: string) => {
			if (path === "/auth/signout") {
				return Promise.resolve(Response.json({ ok: true }));
			}
			if (path === "/auth/status") {
				return Promise.resolve(Response.json({ signed_in: true }));
			}
			return Promise.resolve(Response.json(ACCOUNT));
		});
		vi.stubGlobal("fetch", fetcher);
		const { setItem } = Storage.prototype;
		let logout: Promise<{ ok: boolean }> | undefined;
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
			this: Storage,
			key: string,
			value: string
		) {
			if (
				key === STATE_KEY &&
				JSON.parse(value).phase === "active" &&
				!logout
			) {
				// Model another tab running after the epoch check, before this write.
				logout = api.signOut();
			}
			setItem.call(this, key, value);
		});
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		expect(logout).toBeDefined();
		await expect(logout).resolves.toEqual({ ok: true });
		expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
			"/api/user/",
			"/auth/signout",
		]);
		await expect(api.status()).resolves.toMatchObject({ signed_in: false });
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it("keeps logout terminal when a refresh response and queued resource request race it", async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered: () => void = () => undefined;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const fetcher = vi.fn(async (path: string) => {
			if (path === "/api/user/") {
				entered();
				await gate;
				return Response.json(ACCOUNT);
			}
			return Response.json({ ok: true });
		});
		vi.stubGlobal("fetch", fetcher);
		const first = expect(api.user()).rejects.toMatchObject({ status: 401 });
		await started;
		const queued = expect(api.teams()).rejects.toMatchObject({ status: 401 });
		const logout = api.signOut();
		release();
		await Promise.all([first, queued, logout]);
		expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
			"/api/user/",
			"/auth/signout",
		]);
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
	});

	it("does not let a canceled email completion recreate a session after logout", async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered: () => void = () => undefined;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const fetcher = vi.fn(async (path: string) => {
			if (path === "/auth/email/wait") {
				entered();
				await gate;
				return Response.json({ done: true, ...ACCOUNT });
			}
			return Response.json({ ok: true });
		});
		vi.stubGlobal("fetch", fetcher);
		await api.emailStart("fixture@example.test");
		const completion = expect(api.emailWait()).rejects.toMatchObject({
			status: 401,
		});
		await started;
		const logout = api.signOut();
		release();
		await Promise.all([completion, logout]);
		await expect(api.emailWait()).rejects.toMatchObject({ status: 401 });
		expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
			"/auth/email/start",
			"/auth/email/wait",
			"/auth/signout",
		]);
	});

	it.each([
		["/api/user/", 500],
		["/auth/history-key", 502],
		["/auth/history-key", 503],
	] as const)(
		"preserves sign-in after a fully received %s HTTP %s",
		async (path, status) => {
			const fetcher = vi
				.fn()
				.mockResolvedValueOnce(new Response("Unavailable", { status }))
				.mockResolvedValueOnce(Response.json(ACCOUNT))
				.mockResolvedValueOnce(Response.json({ signed_in: true }));
			vi.stubGlobal("fetch", fetcher);
			const request = path === "/auth/history-key" ? api.historyKey : api.user;
			await expect(request()).rejects.toMatchObject({ status });
			await expect(api.user()).resolves.toEqual(ACCOUNT);
			await expect(api.status()).resolves.toMatchObject({ signed_in: true });
			expect(fetcher.mock.calls.map(([requested]) => requested)).toEqual([
				path,
				"/api/user/",
				"/auth/status",
			]);
		}
	);

	it.each([401, 503])(
		"does not replay a mutation after an explicit HTTP %s session failure",
		async (status) => {
			const fetcher = vi.fn().mockResolvedValue(
				new Response("Sign in again", {
					headers: { "X-Session-Ended": "true" },
					status,
				})
			);
			vi.stubGlobal("fetch", fetcher);
			await expect(
				api.createTeam({ handle: "fixture", name: "Fixture" })
			).rejects.toMatchObject({ status });
			await expect(
				api.createTeam({ handle: "fixture", name: "Fixture" })
			).rejects.toMatchObject({ status: 401 });
			expect(fetcher).toHaveBeenCalledOnce();
		}
	);

	it("fails closed without browser locking while API keys remain usable", async () => {
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: undefined,
		});
		const fetcher = vi.fn().mockResolvedValue(Response.json(ACCOUNT));
		vi.stubGlobal("fetch", fetcher);
		await expect(api.user()).rejects.toThrow("Web Locks");
		expect(fetcher).not.toHaveBeenCalled();
		vi.spyOn(keyVault, "token").mockReturnValue("fixture-api-key");
		await expect(api.user()).resolves.toEqual(ACCOUNT);
		expect(fetcher).toHaveBeenCalledOnce();
	});
});
