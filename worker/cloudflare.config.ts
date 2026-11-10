import { bindings, defineConfig, exports } from "cf/config";

export default defineConfig({
	accountId: "d90ac67a53e9492aafbd0c3e13ffa25f",
	worker: {
		assets: {
			notFoundHandling: "single-page-application",
			runWorkerFirst: true,
		},
		compatibilityDate: "2026-10-01",
		domains: ["console.hotaisle.app"],
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
