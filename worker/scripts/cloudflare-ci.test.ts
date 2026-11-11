import { afterEach, describe, expect, it, vi } from "vitest";
import {
	currentMainCommit,
	githubMetadata,
	mergedPullRequestURL,
	productionCommit,
} from "./cloudflare-ci";

const HEAD = "a".repeat(40);
const PR = {
	base: { ref: "main", repo: { full_name: "hotaisle/hotaisle-console" } },
	html_url: "https://github.com/hotaisle/hotaisle-console/pull/1",
	merged_at: "2026-01-01T00:00:00Z",
};
afterEach(() => vi.unstubAllGlobals());

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
	it("validates main's current commit before deployment", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(Response.json({ sha: HEAD }))
		);
		expect(await currentMainCommit()).toBe(HEAD);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
		await expect(currentMainCommit()).rejects.toThrow("Cannot verify");
	});
});
