import { createRoot } from "react-dom/client";
import { PreviewAPI } from "../api";
import { createPreviewHistory } from "../history";
import { installPreviewTransport, isPreviewLocation } from "../transport";
import { Studio } from "./studio";
import "./showcase.css";

async function start() {
	if (
		import.meta.env.MODE !== "preview" ||
		!isPreviewLocation(new URL(location.href))
	) {
		throw new Error(
			"The showcase is available only on the isolated local preview origin."
		);
	}
	const api = new PreviewAPI("sign-in");
	installPreviewTransport(api);
	const url = new URL(location.href);
	url.hash = "/sign-in?returnTo=%2Fteams";
	window.history.replaceState(null, "", url);
	const { mountApp } = await import("../../src/app/mount");
	const { createQueryClient } = await import("../../src/app/query-client");
	const { historyVault } = await import("../../src/lib/history-vault");
	historyVault.lock(api.initialRecords());
	await mountApp(createPreviewHistory(), createQueryClient());
	const studio = document.querySelector("#showcase-studio");
	if (!studio) {
		throw new Error("Showcase studio is missing.");
	}
	createRoot(studio).render(<Studio api={api} />);
}
start().catch((reason: unknown) => {
	const root = document.querySelector("#root");
	if (root) {
		root.textContent =
			reason instanceof Error ? reason.message : "Showcase failed to start.";
	}
});
