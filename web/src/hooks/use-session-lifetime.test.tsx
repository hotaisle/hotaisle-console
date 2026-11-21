import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { keyVault } from "../lib/key-vault";
import { setPrefs } from "../lib/prefs";
import {
	beginBrowserSession,
	browserSessionExpired,
	endBrowserSession,
	resumeBrowserSession,
	sessionRemaining,
} from "../lib/session-lifetime";
import { useSessionLifetime } from "./use-session-lifetime";

const MINUTE = 60_000;
beforeEach(() => {
	vi.useFakeTimers();
	setPrefs({ sessionMinutes: 60 });
	keyVault.lock();
});
afterEach(() => setPrefs({ sessionMinutes: 60 }));

describe("browser session lifetime", () => {
	it("expires at 60 minutes without extending the deadline on reload", () => {
		beginBrowserSession();
		const expired = vi.fn();
		const first = renderHook(() => useSessionLifetime(true, expired));
		act(() => vi.advanceTimersByTime(30 * MINUTE));
		first.unmount();
		resumeBrowserSession();
		renderHook(() => useSessionLifetime(true, expired));
		act(() => vi.advanceTimersByTime(30 * MINUTE - 1));
		expect(expired).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(1));
		expect(expired).toHaveBeenCalledOnce();
	});

	it("extends the current deadline and expires immediately when shortened below elapsed time", () => {
		beginBrowserSession();
		const expired = vi.fn();
		renderHook(() => useSessionLifetime(true, expired));
		act(() => setPrefs({ sessionMinutes: 240 }));
		act(() => vi.advanceTimersByTime(120 * MINUTE));
		expect(expired).not.toHaveBeenCalled();
		expect(sessionRemaining()).toBe(120 * MINUTE);
		act(() => setPrefs({ sessionMinutes: 60 }));
		expect(expired).toHaveBeenCalledOnce();
	});

	it("allows Infinite without resurrecting a signed-out session", () => {
		beginBrowserSession();
		setPrefs({ sessionMinutes: null });
		const expired = vi.fn();
		renderHook(() => useSessionLifetime(true, expired));
		act(() => vi.advanceTimersByTime(90 * 24 * 60 * MINUTE));
		expect(expired).not.toHaveBeenCalled();
		act(() => {
			endBrowserSession();
			window.dispatchEvent(new StorageEvent("storage"));
		});
		expect(expired).toHaveBeenCalledOnce();
		resumeBrowserSession();
		expect(browserSessionExpired()).toBe(true);
	});

	it.each([null, 240] as const)(
		"uses the latest cross-tab session limit (%s) before React rerenders",
		(sessionMinutes) => {
			beginBrowserSession();
			const expired = vi.fn();
			renderHook(() => useSessionLifetime(true, expired));
			vi.setSystemTime(Date.now() + 61 * MINUTE);
			act(() => {
				localStorage.setItem(
					"hotaisle-ui:prefs",
					JSON.stringify({ sessionMinutes })
				);
				window.dispatchEvent(
					new StorageEvent("storage", { key: "hotaisle-ui:prefs" })
				);
			});
			expect(expired).not.toHaveBeenCalled();
			expect(browserSessionExpired()).toBe(false);
			act(() => vi.advanceTimersByTime(179 * MINUTE));
			expect(expired).toHaveBeenCalledTimes(sessionMinutes === null ? 0 : 1);
		}
	);

	it("checks elapsed wall time when a suspended page regains focus", () => {
		beginBrowserSession();
		const expired = vi.fn();
		renderHook(() => useSessionLifetime(true, expired));
		vi.setSystemTime(Date.now() + 61 * MINUTE);
		act(() => window.dispatchEvent(new Event("focus")));
		expect(expired).toHaveBeenCalledOnce();
	});

	it("blocks expired API requests and locks an expired key session on status restore", async () => {
		beginBrowserSession();
		vi.spyOn(keyVault, "token").mockReturnValue("fixture-key");
		const lock = vi.spyOn(keyVault, "lock");
		const fetcher = vi.fn(async () =>
			Response.json({
				email_login: true,
				passkeys: false,
				signed_in: false,
				version: "fixture",
			})
		);
		vi.stubGlobal("fetch", fetcher);
		vi.setSystemTime(Date.now() + 60 * MINUTE);
		await expect(api.user()).rejects.toMatchObject({ status: 401 });
		expect(fetcher).not.toHaveBeenCalled();
		await expect(api.status()).resolves.toMatchObject({ signed_in: false });
		expect(lock).toHaveBeenCalled();
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it("starts the deadline only when email approval completes", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ pending: true }))
			.mockResolvedValueOnce(Response.json({ done: false }))
			.mockResolvedValueOnce(Response.json({ done: true }));
		vi.stubGlobal("fetch", fetcher);
		await api.emailStart("fixture@example.test");
		await api.emailWait();
		expect(sessionRemaining()).toBeUndefined();
		await api.emailWait();
		expect(sessionRemaining()).toBe(60 * MINUTE);
	});
});
