import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
	spawnSync: vi.fn(),
}));

const HEAD = "a".repeat(40);
// Public fields returned by the 2026-03-10 associated-PR API. That API no
// longer includes merge_commit_sha, even after a squash merge.
const PR = {
	base: { ref: "main", repo: { full_name: "hotaisle/hotaisle-console" } },
	html_url: "https://github.com/hotaisle/hotaisle-console/pull/1",
	merged_at: "2026-01-01T00:00:00Z",
	number: 1,
	state: "closed",
};

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.stubEnv("WORKERS_CI", "1");
	vi.stubEnv("WORKERS_CI_BRANCH", "main");
	vi.stubEnv("WORKERS_CI_COMMIT_SHA", HEAD);
	vi.mocked(execFileSync).mockImplementation((command) =>
		command === "git"
			? "Rebased change without a PR trailer"
			: (undefined as never)
	);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("native build PR metadata", () => {
	it("resolves squash-merge provenance without a REST request", async () => {
		vi.mocked(execFileSync).mockImplementation((command) =>
			command === "git"
				? "fix(ci): restore native builds (#3)"
				: (undefined as never)
		);
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		await import("./cloudflare-build");
		expect(fetcher).not.toHaveBeenCalled();
		expect(execFileSync).toHaveBeenCalledWith(
			"git",
			["show", "-s", "--format=%B", HEAD, "--"],
			expect.any(Object)
		);
		expect(execFileSync).toHaveBeenCalledWith(
			"bun",
			["run", "build"],
			expect.objectContaining({
				env: expect.objectContaining({
					VITE_BUILD_PR_URL:
						"https://github.com/hotaisle/hotaisle-console/pull/3",
				}),
			})
		);
	});
	it("builds using the current API's commit-specific PR association", async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json([PR]));
		vi.stubGlobal("fetch", fetcher);
		await import("./cloudflare-build");
		expect(fetcher).toHaveBeenCalledExactlyOnceWith(
			`https://api.github.com/repos/hotaisle/hotaisle-console/commits/${HEAD}/pulls?per_page=100`,
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-GitHub-Api-Version": "2026-03-10",
				}),
			})
		);
		expect(execFileSync).toHaveBeenCalledWith(
			"bun",
			["run", "build"],
			expect.objectContaining({
				env: expect.objectContaining({ VITE_BUILD_PR_URL: PR.html_url }),
			})
		);
		const commands = vi
			.mocked(execFileSync)
			.mock.calls.map(([, args]) => (args as string[]).join(" "));
		expect(commands.indexOf("run build")).toBeLessThan(
			commands.indexOf("run test")
		);
		expect(commands.indexOf("run test")).toBeLessThan(
			commands.indexOf("run --cwd worker cf deploy --prebuilt --dry-run")
		);
	});
	it("does not build when the associated PR is unmerged or targets another repository", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				Response.json([
					{ ...PR, merged_at: null },
					{
						...PR,
						base: { ref: "main", repo: { full_name: "other/repository" } },
					},
				])
			)
		);
		await expect(import("./cloudflare-build")).rejects.toThrow(
			"No merged Console pull request matches"
		);
		expect(
			vi.mocked(execFileSync).mock.calls.every(([command]) => command === "git")
		).toBe(true);
	});
});
