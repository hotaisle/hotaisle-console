import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewAPI } from "./api";
import { installPreviewTransport, isPreviewLocation } from "./transport";

afterEach(() => vi.useRealTimers());
function previewBrowser(href = "http://preview.localhost:8787/__preview/") {
	return {
		fetch: vi.fn<typeof fetch>(),
		location: { href },
		WebSocket: vi.fn() as unknown as typeof WebSocket,
	};
}
describe("preview isolation", () => {
	it("requires the dedicated local preview origin and path", () => {
		expect(
			isPreviewLocation(new URL("http://preview.localhost:8787/__preview/"))
		).toBe(true);
		for (const url of [
			"https://console.hotaisle.app/__preview/",
			"http://localhost:8787/__preview/",
			"http://preview.localhost:8787/teams/preview/machines",
		]) {
			expect(isPreviewLocation(new URL(url))).toBe(false);
			expect(() =>
				installPreviewTransport(new PreviewAPI("empty"), previewBrowser(url))
			).toThrow("preview.localhost");
		}
	});
	it("serves fixture requests and blocks external traffic without native fetch", async () => {
		const browser = previewBrowser();
		const nativeFetch = browser.fetch;
		const cleanup = installPreviewTransport(new PreviewAPI("empty"), browser);
		try {
			expect((await browser.fetch("/auth/status")).status).toBe(200);
			expect(
				(await browser.fetch("https://admin.hotaisle.app/api/user/")).status
			).toBe(501);
			expect(nativeFetch).not.toHaveBeenCalled();
		} finally {
			cleanup();
		}
		expect(browser.fetch).toBe(nativeFetch);
	});
	it("blocks sockets instead of opening native connections", () => {
		const browser = previewBrowser();
		const original = browser.WebSocket;
		const cleanup = installPreviewTransport(new PreviewAPI("empty"), browser);
		try {
			expect(
				() =>
					new browser.WebSocket("ws://preview.localhost:8787/live/availability")
			).toThrow("disabled");
			expect(original).not.toHaveBeenCalled();
		} finally {
			cleanup();
		}
		expect(browser.WebSocket).toBe(original);
	});
});
