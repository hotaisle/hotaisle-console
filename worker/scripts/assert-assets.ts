import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const previewFilename = /^preview[-.]/u;
const auditDocument =
	/\.md$|^(?:coverage-ledger|findings|run-metadata)\.json$|^security-audit(?:[-.].*)?$/iu;
const textAsset = /\.(?:html|js|css)$/u;
const previewContent =
	/preview@example\.invalid|Development preview|Simulated machines/u;
const root = resolve(import.meta.dirname, "../../web/dist");
if (existsSync(resolve(root, "__preview"))) {
	throw new Error(
		"Development preview assets cannot be packaged for deployment. Run bun run build:web first, or use bun run build."
	);
}
function checkDirectory(directory: string) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = resolve(directory, entry.name);
		if (entry.name.toLowerCase() === "docs" || auditDocument.test(entry.name)) {
			throw new Error(
				"Documentation and security audit files cannot be packaged as public assets."
			);
		}
		if (entry.isDirectory()) {
			checkDirectory(path);
			continue;
		}
		if (previewFilename.test(entry.name)) {
			throw new Error(
				"A development preview asset is present in the production build."
			);
		}
		if (
			textAsset.test(entry.name) &&
			previewContent.test(readFileSync(path, "utf8"))
		) {
			throw new Error(
				"Development preview code is present in the production build."
			);
		}
	}
}
checkDirectory(root);
