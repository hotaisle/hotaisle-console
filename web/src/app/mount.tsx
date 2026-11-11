import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/instrument-sans/index.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../features/stage/iso/iso.css";
import "../styles/main.css";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { ToastHost } from "../components/ui/toast";
import { applyStatusMotion, applyTheme, getPrefs } from "../lib/prefs";
import { createQueryClient } from "./query-client";
import { createAppRouter } from "./router";

export async function mountApp(
	history?: RouterHistory,
	queryClient = createQueryClient()
) {
	const router = createAppRouter(history);
	applyTheme(getPrefs().theme);
	applyStatusMotion(getPrefs().statusMotion);
	const fonts = Promise.all(
		[
			'400 16px "Instrument Sans Variable"',
			'600 16px "Instrument Sans Variable"',
			'400 15px "IBM Plex Mono"',
			"16px DSEG7",
		].map((font) => document.fonts.load(font).catch(() => undefined))
	);
	await Promise.race([
		fonts,
		new Promise((resolve) => setTimeout(resolve, 600)),
	]);
	const root = document.querySelector("#root");
	if (!root) {
		throw new Error("The application container is missing.");
	}
	createRoot(root).render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<ToastHost>
					<RouterProvider router={router} />
				</ToastHost>
			</QueryClientProvider>
		</StrictMode>
	);
}
export function showStartupError(error: unknown) {
	const root = document.querySelector("#root");
	if (root) {
		root.textContent =
			error instanceof Error ? error.message : "The console could not start.";
	}
}
