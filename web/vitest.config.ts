import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	root: import.meta.dirname,
	test: {
		environment: "jsdom",
		environmentOptions: { jsdom: { pretendToBeVisual: true } },
		include: ["src/**/*.test.{ts,tsx}", "dev/**/*.test.{ts,tsx}"],
		name: "components",
		restoreMocks: true,
		setupFiles: ["./test/setup.ts"],
	},
});
