import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

process.env.VITE_BUILD_DATE = new Date().toISOString();

export default defineConfig(({ mode }) => ({
	build: {
		assetsInlineLimit: 0,
		emptyOutDir: true,
		outDir: "dist",
		rolldownOptions:
			mode === "preview"
				? {
						input: {
							app: resolve(import.meta.dirname, "index.html"),
							preview: resolve(import.meta.dirname, "__preview/index.html"),
						},
					}
				: undefined,
		sourcemap: false,
	},
	plugins: [react()],
}));
