import { appendFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./github-api";

vi.mock("node:fs", () => ({ appendFileSync: vi.fn() }));
vi.mock("./github-api", () => ({
	REPOSITORY: "hotaisle/hotaisle-console",
	request: vi.fn(),
}));

const HEAD = "a".repeat(40);
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.stubEnv("GITHUB_EVENT_NAME", "push");
	vi.stubEnv("GITHUB_REF", "refs/heads/main");
	vi.stubEnv("GITHUB_SHA", HEAD);
	vi.stubEnv("GITHUB_OUTPUT", "/fixture/output");
	vi.mocked(request).mockReturnValue(JSON.stringify({ sha: HEAD }));
});
afterEach(() => vi.unstubAllEnvs());

describe("production revision guard", () => {
	it("allows the tested current main revision", async () => {
		await import("./production-revision");
		expect(appendFileSync).toHaveBeenCalledWith(
			"/fixture/output",
			"deploy=true\n"
		);
	});
	it("skips an older workflow after main has advanced", async () => {
		vi.mocked(request).mockReturnValue(JSON.stringify({ sha: "b".repeat(40) }));
		await import("./production-revision");
		expect(appendFileSync).toHaveBeenCalledWith(
			"/fixture/output",
			"deploy=false\n"
		);
	});
	it.each([
		{ event: "pull_request", ref: "refs/pull/1/merge" },
		{ event: "push", ref: "refs/heads/feature" },
		{ event: "push", ref: "refs/tags/main" },
	])("rejects $event on $ref", async ({ event, ref }) => {
		vi.stubEnv("GITHUB_EVENT_NAME", event);
		vi.stubEnv("GITHUB_REF", ref);
		await expect(import("./production-revision")).rejects.toThrow(
			"push to main"
		);
		expect(appendFileSync).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});
	it("fails closed on malformed GitHub metadata", async () => {
		vi.mocked(request).mockReturnValue("{}");
		await expect(import("./production-revision")).rejects.toThrow(
			"Cannot verify"
		);
		expect(appendFileSync).not.toHaveBeenCalled();
	});
	it("fails closed when GitHub cannot confirm the current revision", async () => {
		vi.mocked(request).mockImplementationOnce(() => {
			throw new Error("GitHub unavailable");
		});
		await expect(import("./production-revision")).rejects.toThrow(
			"GitHub unavailable"
		);
		expect(appendFileSync).not.toHaveBeenCalled();
	});
});
