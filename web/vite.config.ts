import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

process.env.VITE_BUILD_DATE = new Date().toISOString();

export default defineConfig({
	plugins: [react()],
	build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0, sourcemap: false },
});
