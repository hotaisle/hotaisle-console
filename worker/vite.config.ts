import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { localPreview } from "../web/dev/serve-preview.ts";
import frontendConfig from "../web/vite.config.ts";
import workerConfig from "./cloudflare.config.ts";

export default defineConfig((environment) => {
	const development = environment.command === "serve" && !environment.isPreview;
	const frontend = development ? frontendConfig(environment) : {};
	return {
		...frontend,
		envDir: resolve(import.meta.dirname, ".."),
		plugins: [
			...(frontend.plugins ?? []),
			localPreview(),
			cloudflare({
				config: (loaded) =>
					development
						? {
								...loaded,
								...workerConfig,
								worker: {
									...loaded.worker,
									...workerConfig.worker,
									assets: {
										...workerConfig.worker.assets,
										// Vite serves source HTML/modules; backend requests still use the Worker.
										runWorkerFirst: [
											"/api/*",
											"/auth/*",
											"/records/*",
											"/live/*",
											"/__preview*",
										],
									},
									entrypoint: resolve(import.meta.dirname, "src/index.ts"),
								},
							}
						: loaded,
				types: { generate: false },
			}),
		],
		publicDir: development ? "public" : "../web/dist",
		root: development ? resolve(import.meta.dirname, "../web") : undefined,
		server: { host: "127.0.0.1", port: 8787, strictPort: true },
	};
});
