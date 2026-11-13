import { createRequire } from "node:module";
import { resolve } from "node:path";

// Isolate native media tooling from the app's dependencies and production builds.
const requireTool = createRequire(resolve("tools/showcase/package.json"));
export async function loadShowcaseTool<T>(name: string): Promise<T> {
	let path: string;
	try {
		path = requireTool.resolve(name);
	} catch (cause) {
		throw new Error(
			"Install optional media tools first: bun install --cwd tools/showcase --frozen-lockfile",
			{ cause }
		);
	}
	return (await import(path)) as T;
}
