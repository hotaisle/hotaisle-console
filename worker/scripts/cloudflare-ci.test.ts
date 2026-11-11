import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	commitPullRequestURL,
	currentMainCommit,
	githubMetadata,
	mergedPullRequestURL,
	productionCommit,
} from "./cloudflare-ci";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
	spawnSync: vi.fn(),
}));
const HEAD = "a".repeat(40);
const PR = {
	base: { ref: "main", repo: { full_name: "hotaisle/hotaisle-console" } },
	html_url: "https://github.com/hotaisle/hotaisle-console/pull/1",
	merged_at: "2026-01-01T00:00:00Z",
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetAllMocks();
});

describe("Workers Builds source metadata", () => {
	it("accepts only a valid Cloudflare main-branch source commit", () => {
		expect(
			productionCommit({
				WORKERS_CI: "1",
				WORKERS_CI_BRANCH: "main",
				WORKERS_CI_COMMIT_SHA: HEAD,
			})
		).toBe(HEAD);
		for (const env of [
			{},
			{
				WORKERS_CI: "1",
				WORKERS_CI_BRANCH: "feature",
				WORKERS_CI_COMMIT_SHA: HEAD,
			},
			{
				WORKERS_CI: "1",
				WORKERS_CI_BRANCH: "main",
				WORKERS_CI_COMMIT_SHA: "invalid",
			},
		]) {
			expect(() => productionCommit(env)).toThrow();
		}
	});
	it("accepts the current associated-PR response without merge_commit_sha", () => {
		expect(mergedPullRequestURL([{ ...PR, merged_at: null }, PR], HEAD)).toBe(
			PR.html_url
		);
	});
	it.each([
		{ ...PR, merged_at: null },
		{ ...PR, merged_at: "invalid" },
		{ ...PR, base: { ref: "feature", repo: PR.base.repo } },
		{ ...PR, base: { ref: "main", repo: { full_name: "other/repository" } } },
		{ ...PR, html_url: "https://example.invalid/pull/1" },
	])("rejects unrelated or unmerged PR metadata", (candidate) => {
		expect(() => mergedPullRequestURL([candidate], HEAD)).toThrow();
	});
	it("fails when GitHub returns no associated merged PR", () => {
		expect(() => mergedPullRequestURL([], HEAD)).toThrow();
		expect(() => mergedPullRequestURL({}, HEAD)).toThrow();
		expect(() => mergedPullRequestURL([PR], "invalid")).toThrow();
	});
	it("reads public metadata without sending deployment credentials or following redirects", async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json([PR]));
		vi.stubGlobal("fetch", fetcher);
		expect(await githubMetadata(`commits/${HEAD}/pulls`)).toEqual([PR]);
		const [url, options] = fetcher.mock.calls[0];
		expect(url).toBe(
			`https://api.github.com/repos/hotaisle/hotaisle-console/commits/${HEAD}/pulls`
		);
		expect(options.credentials).toBe("omit");
		expect(options.redirect).toBe("error");
		expect(options.headers).not.toHaveProperty("Authorization");
	});
	it("fails on API errors without including response data in the error", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(new Response("private diagnostic", { status: 429 }))
		);
		await expect(githubMetadata("commits/main")).rejects.toThrow(
			"GitHub build metadata lookup failed (429)."
		);
	});
	it("checks main through credential-free Git without using the REST quota", () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		vi.mocked(spawnSync).mockReturnValue({
			status: 0,
			stdout: `${HEAD}\trefs/heads/main\n`,
		} as ReturnType<typeof spawnSync>);
		expect(currentMainCommit()).toBe(HEAD);
		expect(spawnSync).toHaveBeenCalledWith(
			"git",
			expect.arrayContaining([
				"credential.helper=",
				"http.extraHeader=",
				"http.followRedirects=false",
				"ls-remote",
				"https://github.com/hotaisle/hotaisle-console.git",
				"refs/heads/main",
			]),
			expect.objectContaining({
				env: expect.objectContaining({ GIT_TERMINAL_PROMPT: "0" }),
				timeout: 20_000,
			})
		);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it.each(["", `${HEAD}\trefs/heads/feature`, "invalid\trefs/heads/main"])(
		"rejects an invalid remote main response",
		(output) => {
			vi.mocked(spawnSync).mockReturnValue({
				status: 0,
				stdout: output,
			} as ReturnType<typeof spawnSync>);
			expect(() => currentMainCommit()).toThrow("Cannot verify");
		}
	);
	it("fails closed without exposing Git transport diagnostics", () => {
		vi.mocked(spawnSync).mockReturnValue({
			status: 1,
			stderr: "private transport diagnostic",
			stdout: "",
		} as ReturnType<typeof spawnSync>);
		expect(() => currentMainCommit()).toThrow(
			"Cannot read the current main revision through Git."
		);
	});
});

describe("PR links from merge commit messages", () => {
	it.each([
		["fix(ci): repair a build (#3)\n\nCommit body", 3],
		["Merge pull request #42 from hotaisle/feature\n\nDescription", 42],
		[
			"Rebased change\n\nPull-Request: https://github.com/hotaisle/hotaisle-console/pull/7",
			7,
		],
	])("uses canonical merge metadata", (message, number) => {
		expect(commitPullRequestURL(message)).toBe(
			`https://github.com/hotaisle/hotaisle-console/pull/${number}`
		);
	});
	it.each([
		"fix: refer to #3 in passing",
		"fix: invalid PR (#0)",
		"fix: body reference\n\nThis resembles a PR (#4)",
		"fix: foreign trailer\n\nPull-Request: https://github.com/other/repository/pull/7",
	])("does not treat incidental references as PR provenance", (message) => {
		expect(commitPullRequestURL(message)).toBeUndefined();
	});
});
