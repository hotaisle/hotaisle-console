const REPOSITORY = "hotaisle/hotaisle-console";
const COMMIT = /^[a-f0-9]{40}$/u;
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

export async function currentMainCommit() {
	const value = (await githubMetadata("commits/main")) as {
		sha?: string;
	} | null;
	if (!(value?.sha && COMMIT.test(value.sha))) {
		throw new Error("Cannot verify the current main revision.");
	}
	return value.sha;
}
