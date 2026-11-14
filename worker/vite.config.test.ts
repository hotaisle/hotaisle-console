import { resolve } from "node:path";
import { type CloudflareConfig, cloudflare } from "@cloudflare/vite-plugin";
import { describe, expect, it, vi } from "vitest";
import workerConfig from "./cloudflare.config";
import config from "./vite.config";

vi.mock("@cloudflare/vite-plugin", () => ({ cloudflare: vi.fn(() => []) }));

const REACT_PLUGIN = /^vite:react/u;
const loaded: CloudflareConfig = {
	containers: [],
	worker: { compatibilityDate: "2026-10-01", name: "fixture-worker" },
};

function configure(command: "serve" | "build", isPreview = false) {
	if (typeof config !== "function") {
		throw new Error("Expected a Vite configuration function");
	}
	const result = config({ command, isPreview, mode: "development" });
	const options = vi.mocked(cloudflare).mock.calls.at(-1)?.[0];
	if (!options?.config) {
		throw new Error("Expected a Worker configuration customizer");
	}
	return { options, result, worker: options.config(loaded).worker };
}

describe("development frontend serving", () => {
	it("serves frontend source with React refresh instead of the built bundle", () => {
		const { result } = configure("serve");
		expect(result.root).toBe(resolve(import.meta.dirname, "../web"));
		expect(result.publicDir).toBe("public");
		expect(result.envDir).toBe(resolve(import.meta.dirname, ".."));
		expect(result.plugins?.flat()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: expect.stringMatching(REACT_PLUGIN),
				}),
				expect.objectContaining({ name: "hotaisle-local-preview" }),
			])
		);
	});
	it("preserves Worker bindings and guards while Vite serves frontend assets", () => {
		const { worker } = configure("serve");
		expect(worker.entrypoint).toBe(
			resolve(import.meta.dirname, "src/index.ts")
		);
		expect(worker.env).toEqual(workerConfig.worker.env);
		expect(worker.exports).toEqual(workerConfig.worker.exports);
		expect(worker.observability).toEqual(workerConfig.worker.observability);
		expect(worker.assets?.runWorkerFirst).toEqual(
			expect.arrayContaining([
				"/api/*",
				"/auth/*",
				"/records/*",
				"/live/*",
				"/__preview*",
			])
		);
	});
	it.each([
		{ command: "build", isPreview: false },
		{ command: "serve", isPreview: true },
	] as const)(
		"keeps prebuilt assets for $command (preview=$isPreview)",
		(env) => {
			const { options, result } = configure(env.command, env.isPreview);
			expect(result.root).toBeUndefined();
			expect(result.publicDir).toBe("../web/dist");
			expect(options.config?.(loaded)).toBe(loaded);
		}
	);
});
