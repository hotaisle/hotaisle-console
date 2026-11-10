import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	envDir: "..",
	plugins: [
		cloudflare({
			types: { generate: false },
		}),
	],
	publicDir: "../web/dist",
	server: { host: "127.0.0.1", port: 8787, strictPort: true },
});
