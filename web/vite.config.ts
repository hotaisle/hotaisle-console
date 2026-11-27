import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

process.env.VITE_BUILD_DATE = new Date().toISOString();
const PR_URL =
	/^https:\/\/github\.com\/hotaisle\/hotaisle-console\/pull\/[1-9]\d*$/u;

function ghPRURL(args: string[]) {
	try {
		const url = execFileSync("gh", args, {
			encoding: "utf8",
			env: { ...process.env, GH_PROMPT_DISABLED: "1" },
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 3000,
		}).trim();
		return PR_URL.test(url) ? url : "";
	} catch {
		return "";
	}
}

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
		if (branch && branch !== "main" && branch !== "master") {
			const branchPR = ghPRURL([
				"pr",
				"view",
				branch,
				"-R",
				"hotaisle/hotaisle-console",
				"--json",
				"url",
				"--jq",
				".url",
			]);
			if (branchPR) {
				return branchPR;
			}
		}
		const commit = execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
			timeout: 3000,
		}).trim();
		return ghPRURL([
			"api",
			`repos/hotaisle/hotaisle-console/commits/${commit}/pulls`,
			"--jq",
			'map(select(.base.ref == "main")) | .[0].html_url // ""',
		]);
	} catch {
		return "";
	}
}

function previewRevision(): Plugin {
	let revision: string;
	return {
		name: "hotaisle-preview-revision",
		apply: "build",
		buildStart() {
			revision = randomUUID();
		},
		transformIndexHtml: {
			order: "post",
			handler(_, { path }) {
				if (path.startsWith("/__preview/")) {
					return [
						{
							tag: "meta",
							attrs: { name: "preview-revision", content: revision },
						},
					];
				}
			},
		},
		async writeBundle({ dir }) {
			const published = resolve(
				dir ?? "preview-dist",
				"__preview/revision.txt"
			);
			const temporary = `${published}.${revision}`;
			// Publish only after all HTML and assets are ready to serve.
			await writeFile(temporary, revision);
			await rename(temporary, published);
		},
	};
}

export default defineConfig(({ command, mode }) => {
	const local =
		command === "serve" || mode === "development" || mode === "preview";
	process.env.VITE_BUILD_PR_URL = local ? "" : buildPRURL();
	if (!(local || process.env.VITE_BUILD_PR_URL)) {
		throw new Error(
			"Cannot build without a pull-request URL. Sign in with gh and allow GitHub access, or set VITE_BUILD_PR_URL to this build's https://github.com/hotaisle/hotaisle-console/pull/<number> URL."
		);
	}
	return {
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
								showcase: resolve(
									import.meta.dirname,
									"__preview/showcase.html"
								),
							},
						}
					: undefined,
			sourcemap: false,
		},
		plugins: [
			react(),
			mode === "preview" && previewRevision(),
			{
				name: "build-version",
				generateBundle() {
					if (local) {
						return;
					}
					this.emitFile({
						type: "asset",
						fileName: "version.json",
						source: JSON.stringify({
							builtAt: process.env.VITE_BUILD_DATE,
							prURL: process.env.VITE_BUILD_PR_URL,
						}),
					});
				},
			},
		],
	};
});
