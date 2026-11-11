import { mountApp, showStartupError } from "./app/mount";

if (window.location.hostname === "preview.localhost") {
	showStartupError(
		new Error(
			"The local preview is not available in this build. Run bun run preview and open http://preview.localhost:8787/__preview/."
		)
	);
} else {
	mountApp().catch(showStartupError);
}
