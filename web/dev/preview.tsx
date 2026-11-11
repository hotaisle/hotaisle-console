import { createRoot } from "react-dom/client";
import { PreviewAPI } from "./api";
import { PreviewControls } from "./controls";
import { createPreviewHistory } from "./history";
import { initialRoute, scenarioOf } from "./scenarios";
import { installPreviewTransport, isPreviewLocation } from "./transport";
import "./preview.css";

async function startPreview() {
	if (
		import.meta.env.MODE !== "preview" ||
		!isPreviewLocation(new URL(window.location.href))
	) {
		throw new Error(
			"Build with bun run preview, then open http://preview.localhost:8787/__preview/."
		);
	}
	const url = new URL(window.location.href);
	const scenario = scenarioOf(url.searchParams.get("scenario"));
	const api = new PreviewAPI(scenario);
	installPreviewTransport(api);
	if (!url.hash) {
		url.hash = initialRoute(scenario);
		window.history.replaceState(null, "", url);
	}
	// Import application modules only after checking the isolated preview origin.
	const { mountApp } = await import("../src/app/mount");
	const { createQueryClient } = await import("../src/app/query-client");
	const { historyVault } = await import("../src/lib/history-vault");
	const client = createQueryClient();
	historyVault.lock(api.initialRecords());
	await mountApp(createPreviewHistory(), client);
	const controls = document.querySelector("#preview-controls");
	if (!controls) {
		throw new Error("Preview controls are missing.");
	}
	createRoot(controls).render(<PreviewControls scenario={scenario} />);
}

startPreview().catch((reason: unknown) => {
	const root = document.querySelector("#root");
	if (root) {
		root.textContent =
			reason instanceof Error
				? reason.message
				: "Could not start the development preview.";
	}
});
