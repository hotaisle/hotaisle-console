import { defineConfig } from "vitest/config";
import { TEST_NOW } from "./test/clock.ts";

export default defineConfig({
	test: {
		projects: [
			"worker/vitest.config.ts",
			"web/vitest.config.ts",
			{
				test: {
					environment: "node",
					fakeTimers: { now: TEST_NOW },
					include: [
						".github/scripts/*.test.ts",
						"worker/scripts/*.test.ts",
						"web/vite.config.test.ts",
					],
					name: "tooling",
					setupFiles: ["./test/setup.ts"],
				},
			},
		],
	},
});
