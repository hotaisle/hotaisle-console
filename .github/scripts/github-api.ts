import { execFileSync } from "node:child_process";
import type { PullRequest, Review } from "./approval-policy";

export const REPOSITORY = "hotaisle/hotaisle-console";
export const POLICY_WORKFLOW =
	".github/workflows/required-maintainer-review.yml";

export function request(args: string[]) {
	if (process.env.GITHUB_REPOSITORY !== REPOSITORY) {
		throw new Error(
			"The approval policy is restricted to hotaisle/hotaisle-console."
		);
	}
	return execFileSync(
		"gh",
		[
			"api",
			"--hostname",
			"github.com",
			"-H",
			"X-GitHub-Api-Version: 2026-03-10",
			...args,
		],
		{
			encoding: "utf8",
			maxBuffer: 16 * 1024 * 1024,
			timeout: 30_000,
		}
	);
}

export function pages<T>(path: string): T[] {
	return JSON.parse(request([path, "--paginate", "--slurp"])) as T[];
}

export function pullNumber(value: string | undefined) {
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number <= 0) {
		throw new Error("A valid pull request number is required.");
	}
	return number;
}

export function pullRequest(number: number): PullRequest {
	return JSON.parse(
		request([`repos/${REPOSITORY}/pulls/${number}`])
	) as PullRequest;
}

export function reviews(number: number): Review[] {
	return pages<Review[]>(
		`repos/${REPOSITORY}/pulls/${number}/reviews?per_page=100`
	).flat();
}
