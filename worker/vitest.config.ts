import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { TEST_EMAIL_LOGIN_KEY } from "./test/fixtures/email-login-identity.ts";
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
					EMAIL_LOGIN_SIGNING_KEY: TEST_EMAIL_LOGIN_KEY,
					HISTORY_SECRET: "history-test-only-0123456789abcdefghijklmnop",
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
