import { createBrowserHistory } from "@tanstack/react-router";

/** The outer query selects fixtures; only the fragment belongs to the app router. */
export function createPreviewHistory(browser: Window = window) {
	return createBrowserHistory({
		createHref: (href) =>
			`${browser.location.pathname}${browser.location.search}#${href}`,
		parseLocation: () => {
			const route = new URL(
				browser.location.hash.slice(1) || "/",
				browser.location.origin
			);
			return {
				hash: route.hash,
				href: route.pathname + route.search + route.hash,
				pathname: route.pathname,
				search: route.search,
				state: browser.history.state,
			};
		},
		window: browser,
	});
}
