import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { TEST_NOW } from "../test/clock.ts";

export default defineConfig({
	plugins: [react()],
	root: import.meta.dirname,
	test: {
		environment: "jsdom",
		environmentOptions: { jsdom: { pretendToBeVisual: true } },
		fakeTimers: { now: TEST_NOW },
		include: ["src/**/*.test.{ts,tsx}", "dev/**/*.test.{ts,tsx}"],
		name: "components",
		restoreMocks: true,
		setupFiles: ["../test/setup.ts", "./test/setup.ts"],
	},
});
