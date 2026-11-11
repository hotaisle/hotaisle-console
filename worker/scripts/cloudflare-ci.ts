import { execFileSync, spawnSync } from "node:child_process";

const REPOSITORY = "hotaisle/hotaisle-console";
const COMMIT = /^[a-f0-9]{40}$/u;
const SQUASH_PR = / \(#(?<number>[1-9]\d*)\)$/u;
const MERGE_PR = /^Merge pull request #(?<number>[1-9]\d*) from /u;
const PR_TRAILER = /^Pull-Request: (?<url>\S+)$/mu;
const MAIN_REF = /^(?<sha>[a-f0-9]{40})\trefs\/heads\/main$/u;
const PR_URL =
	/^https:\/\/github\.com\/hotaisle\/hotaisle-console\/pull\/[1-9]\d*$/u;

export function productionCommit(env: Record<string, string | undefined>) {
	if (env.WORKERS_CI !== "1" || env.WORKERS_CI_BRANCH !== "main") {
		throw new Error("Cloudflare production builds require the main branch.");
	}
	const sha = env.WORKERS_CI_COMMIT_SHA ?? "";
	if (!COMMIT.test(sha)) {
		throw new Error("Cloudflare did not provide a valid source commit.");
	}
	return sha;
}

interface PullRequest {
	base?: { ref?: string; repo?: { full_name?: string } };
	html_url?: string;
	merged_at?: string | null;
}

export function mergedPullRequestURL(value: unknown, sha: string) {
	if (!(Array.isArray(value) && COMMIT.test(sha))) {
		throw new Error("Cannot verify this build's merged pull request.");
	}
	// /commits/{sha}/pulls establishes the commit association. API version
	// 2026-03-10 omits merge_commit_sha from these PR objects.
	const pr = (value as (PullRequest | null)[]).find(
		(item) =>
			item?.base?.ref === "main" &&
			item.base.repo?.full_name === REPOSITORY &&
			typeof item.merged_at === "string" &&
			Number.isFinite(Date.parse(item.merged_at)) &&
			typeof item.html_url === "string" &&
			PR_URL.test(item.html_url)
	);
	if (!pr?.html_url) {
		throw new Error(
			"No merged Console pull request matches this build's commit."
		);
	}
	return pr.html_url;
}

export function commitPullRequestURL(message: string) {
	const [subject] = message.split("\n", 1);
	const number =
		SQUASH_PR.exec(subject)?.groups?.number ??
		MERGE_PR.exec(subject)?.groups?.number;
	if (number) {
		return `https://github.com/${REPOSITORY}/pull/${number}`;
	}
	const trailer = PR_TRAILER.exec(message)?.groups?.url;
	return trailer && PR_URL.test(trailer) ? trailer : undefined;
}

export async function sourcePullRequestURL(sha: string) {
	if (!COMMIT.test(sha)) {
		throw new Error("Cannot verify this build's source commit.");
	}
	const message = execFileSync(
		"git",
		["show", "-s", "--format=%B", sha, "--"],
		{
			encoding: "utf8",
			stdio: "pipe",
			timeout: 5000,
		}
	);
	const url = commitPullRequestURL(message);
	if (url) {
		return url;
	}
	// Rebased commits without a PR trailer need the public association lookup.
	return mergedPullRequestURL(
		await githubMetadata(`commits/${sha}/pulls?per_page=100`),
		sha
	);
}

// The Console is public. Public build metadata needs no GitHub credential in
// Cloudflare; never forward the Cloudflare deployment token to this endpoint.
export async function githubMetadata(path: string) {
	const response = await fetch(
		`https://api.github.com/repos/${REPOSITORY}/${path}`,
		{
			credentials: "omit",
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "hotaisle-console-build",
				"X-GitHub-Api-Version": "2026-03-10",
			},
			redirect: "error",
			signal: AbortSignal.timeout(20_000),
		}
	);
	if (!response.ok) {
		throw new Error(
			`GitHub build metadata lookup failed (${response.status}).`
		);
	}
	return response.json() as Promise<unknown>;
}

export function currentMainCommit() {
	const result = spawnSync(
		"git",
		[
			"-c",
			"credential.helper=",
			"-c",
			"http.extraHeader=",
			"-c",
			"http.followRedirects=false",
			"ls-remote",
			"--exit-code",
			`https://github.com/${REPOSITORY}.git`,
			"refs/heads/main",
		],
		{
			encoding: "utf8",
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
			stdio: "pipe",
			timeout: 20_000,
		}
	);
	if (result.status !== 0) {
		throw new Error("Cannot read the current main revision through Git.");
	}
	const sha = MAIN_REF.exec(result.stdout.trim())?.groups?.sha;
	if (!sha) {
		throw new Error("Cannot verify the current main revision.");
	}
	return sha;
}
