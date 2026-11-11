import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

process.env.VITE_BUILD_DATE = new Date().toISOString();
const PR_URL =
	/^https:\/\/github\.com\/hotaisle\/hotaisle-console\/pull\/[1-9]\d*$/u;

function buildPRURL() {
	const supplied = process.env.VITE_BUILD_PR_URL?.trim();
	if (supplied) {
		return PR_URL.test(supplied) ? supplied : "";
	}
	try {
		const branch = execFileSync("git", ["branch", "--show-current"], {
			encoding: "utf8",
			timeout: 3000,
		}).trim();
		if (!branch || branch === "main" || branch === "master") {
			return "";
		}
		const url = execFileSync(
			"gh",
			[
				"pr",
				"view",
				branch,
				"-R",
				"hotaisle/hotaisle-console",
				"--json",
				"url",
				"--jq",
				".url",
			],
			{
				encoding: "utf8",
				env: { ...process.env, GH_PROMPT_DISABLED: "1" },
				stdio: ["ignore", "pipe", "ignore"],
				timeout: 3000,
			}
		).trim();
		return PR_URL.test(url) ? url : "";
	} catch {
		return "";
	}
}

process.env.VITE_BUILD_PR_URL = buildPRURL();

export default defineConfig(({ mode }) => ({
	build: {
		assetsInlineLimit: 0,
		emptyOutDir: true,
		outDir: mode === "preview" ? "preview-dist" : "dist",
		rolldownOptions:
			mode === "preview"
				? {
						input: {
							app: resolve(import.meta.dirname, "index.html"),
							console: resolve(import.meta.dirname, "__preview/console.html"),
							preview: resolve(import.meta.dirname, "__preview/index.html"),
						},
					}
				: undefined,
		sourcemap: false,
	},
	plugins: [react()],
}));
