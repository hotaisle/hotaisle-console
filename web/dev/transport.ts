import type { PreviewAPI } from "./api";

export function isPreviewLocation(url: URL) {
	return (
		(url.protocol === "http:" || url.protocol === "https:") &&
		url.hostname === "preview.localhost" &&
		url.pathname.startsWith("/__preview/")
	);
}

/** This origin has separate cookies/storage from the normal dev console. */
interface PreviewBrowser {
	fetch: typeof window.fetch;
	location: Pick<Location, "href">;
	WebSocket: typeof window.WebSocket;
}
export function installPreviewTransport(
	api: PreviewAPI,
	browser: PreviewBrowser = window
) {
	const location = new URL(browser.location.href);
	if (!isPreviewLocation(location)) {
		throw new Error(
			"Open the preview on http://preview.localhost:8787/__preview/."
		);
	}
	const originalFetch = browser.fetch;
	const OriginalSocket = browser.WebSocket;
	browser.fetch = (input, init) => {
		const request =
			input instanceof Request
				? new Request(input, init)
				: new Request(new URL(String(input), location), init);
		if (new URL(request.url).origin !== location.origin) {
			return Promise.resolve(
				Response.json(
					{
						message:
							"External API calls are disabled in the development preview.",
					},
					{ status: 501 }
				)
			);
		}
		return api.fetch(request);
	};
	class BlockedSocket {
		constructor() {
			throw new Error("WebSockets are disabled in the local preview.");
		}
	}
	browser.WebSocket = BlockedSocket as unknown as typeof WebSocket;
	return () => {
		browser.fetch = originalFetch;
		browser.WebSocket = OriginalSocket;
	};
}
