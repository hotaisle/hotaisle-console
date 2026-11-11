import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"worker/vitest.config.ts",
			"web/vitest.config.ts",
			{
				test: {
					environment: "node",
					include: [".github/scripts/*.test.ts"],
					name: "tooling",
				},
			},
		],
	},
});
