import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { fakeHotAisle } from "./test/fixtures/upstream.ts";

const fake = fakeHotAisle();

export default defineConfig({
	envDir: "..",
	plugins: [
		cloudflareTest({
			config: "./cloudflare.config.ts",
			miniflare: {
				assets: { binding: "ASSETS", directory: "../web/dist" },
				bindings: {
					API_BASE: "https://api.test/api",
					SESSION_SECRET: "test-only-secret-0123456789abcdefghijklmnop",
				},
				serviceBindings: {
					UPSTREAM: async (req) => {
						const response = await fake.fetch(req);
						const body =
							response.status === 202 || response.status === 204
								? null
								: await response.arrayBuffer();
						return new Response(body, {
							headers: Object.fromEntries(response.headers),
							status: response.status,
						});
					},
				},
			},
			remoteBindings: false,
		}),
	],
	root: import.meta.dirname,
	test: { include: ["test/**/*.test.ts"], name: "worker" },
});
