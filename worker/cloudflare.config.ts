import { bindings, defineConfig, exports } from "cf/config";

export default defineConfig({
	worker: {
		assets: {
			notFoundHandling: "single-page-application",
			runWorkerFirst: true,
		},
		compatibilityDate: "2026-10-01",
		entrypoint: "./src/index.ts",
		env: {
			API_BASE: bindings.text("https://admin.hotaisle.app/api"),
			ASSETS: bindings.assets(),
			HISTORY_SECRET: bindings.secret(),
			SESSION_SECRET: bindings.secret(),
		},
		exports: {
			Account: exports.durableObject({ state: "deleted" }),
			Availability: exports.durableObject({ state: "deleted" }),
		},
		name: "hotaisle-console",
		observability: { enabled: false },
	},
});
