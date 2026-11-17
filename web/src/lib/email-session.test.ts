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

	it("does not replay a rejected mutation or recover from an upstream refresh failure", async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response("Sign in again", {
				headers: { "X-Session-Ended": "true" },
				status: 401,
			})
		);
		vi.stubGlobal("fetch", fetcher);
		await expect(
			api.createTeam({ handle: "fixture", name: "Fixture" })
		).rejects.toMatchObject({ status: 401 });
		await expect(
			api.createTeam({ handle: "fixture", name: "Fixture" })
		).rejects.toMatchObject({ status: 401 });
		expect(fetcher).toHaveBeenCalledOnce();
	});

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
