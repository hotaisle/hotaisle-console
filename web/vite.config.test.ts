import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

beforeEach(() => {
	vi.resetModules();
	vi.mocked(execFileSync).mockReset();
	vi.mocked(execFileSync).mockImplementation(() => {
		throw new Error("GitHub and Git metadata are unavailable");
	});
	vi.stubEnv("VITE_BUILD_PR_URL", "");
});

afterEach(() => vi.unstubAllEnvs());

async function configure(mode: string, command: "build" | "serve" = "build") {
	const { default: config } = await import("./vite.config");
	if (typeof config !== "function") {
		throw new Error("Expected a Vite configuration function");
	}
	return config({ command, mode });
}

describe("build provenance", () => {
	it.each(["development", "preview"])(
		"builds %s without looking up GitHub metadata",
		async (mode) => {
			const config = await configure(mode);
			expect(config.build?.outDir).toBe(
				mode === "preview" ? "preview-dist" : "dist"
			);
			expect(execFileSync).not.toHaveBeenCalled();
			expect(process.env.VITE_BUILD_PR_URL).toBe("");
		}
	);
	it("serves locally without looking up GitHub metadata", async () => {
		await configure("development", "serve");
		expect(execFileSync).not.toHaveBeenCalled();
	});
	it("keeps production builds blocked when provenance is unavailable", async () => {
		await expect(configure("production")).rejects.toThrow(
			"Cannot build without a pull-request URL"
		);
	});
	it("accepts a verified PR URL for an offline production build", async () => {
		const url = "https://github.com/hotaisle/hotaisle-console/pull/1";
		vi.stubEnv("VITE_BUILD_PR_URL", url);
		await configure("production");
		expect(process.env.VITE_BUILD_PR_URL).toBe(url);
		expect(execFileSync).not.toHaveBeenCalled();
	});
	it("rejects an invalid production PR URL", async () => {
		vi.stubEnv("VITE_BUILD_PR_URL", "https://example.invalid/pull/1");
		await expect(configure("production")).rejects.toThrow(
			"Cannot build without a pull-request URL"
		);
	});
});
