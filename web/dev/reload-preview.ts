import { isPreviewLocation } from "./transport";

const revision = document.querySelector<HTMLMetaElement>(
	'meta[name="preview-revision"]'
)?.content;
if (revision && isPreviewLocation(new URL(window.location.href))) {
	// Only the build check uses the real fetch; the app's requests stay simulated.
	const fetchAsset = window.fetch.bind(window);
	const checkForBuild = async () => {
		try {
			const response = await fetchAsset("/__preview/revision.txt", {
				credentials: "omit",
				priority: "low",
			});
			if (response.ok && (await response.text()) !== revision) {
				window.location.reload();
				return;
			}
		} catch {
			// The local server can be briefly unavailable during a restart.
		}
		window.setTimeout(checkForBuild, 1000);
	};
	window.setTimeout(checkForBuild, 1000);
}
