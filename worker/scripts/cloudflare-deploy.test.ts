import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentMainCommit } from "./cloudflare-ci";

const HEAD = "a".repeat(40);
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("./cloudflare-ci", () => ({
	currentMainCommit: vi.fn(),
	productionCommit: () => "a".repeat(40),
}));
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});
describe("Workers Builds production deployment", () => {
	it("deploys the prebuilt output only for the current main commit", async () => {
		vi.mocked(currentMainCommit).mockResolvedValue(HEAD);
		await import("./cloudflare-deploy");
		expect(execFileSync).toHaveBeenCalledOnce();
		expect(execFileSync).toHaveBeenCalledWith(
			"bun",
			expect.arrayContaining(["cf", "deploy", "--prebuilt", "--tag", HEAD]),
			expect.any(Object)
		);
	});
	it("does not publish an older build after main advances", async () => {
		vi.mocked(currentMainCommit).mockResolvedValue("b".repeat(40));
		await import("./cloudflare-deploy");
		expect(execFileSync).not.toHaveBeenCalled();
	});
	it("does not publish when the current source revision cannot be verified", async () => {
		vi.mocked(currentMainCommit).mockRejectedValue(
			new Error("GitHub unavailable")
		);
		await expect(import("./cloudflare-deploy")).rejects.toThrow(
			"GitHub unavailable"
		);
		expect(execFileSync).not.toHaveBeenCalled();
	});
});
