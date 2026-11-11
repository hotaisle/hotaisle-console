import type { PullRequest } from "./approval-policy";
import { type PolicyRun, refreshApprovals } from "./approval-refresh";
import {
	POLICY_WORKFLOW,
	pages,
	REPOSITORY,
	request,
	reviews,
} from "./github-api";

interface WorkflowRun extends PolicyRun {
	event: string;
	head_sha: string;
	path: string;
	pull_requests: { number: number }[];
}

await refreshApprovals(
	{
		openPullRequests: () =>
			Promise.resolve(
				pages<PullRequest[]>(
					`repos/${REPOSITORY}/pulls?state=open&base=main&per_page=100`
				).flat()
			),
		rerun: (id) => {
			if (!Number.isSafeInteger(id) || id <= 0) {
				throw new Error("Invalid policy workflow run.");
			}
			request([
				`repos/${REPOSITORY}/actions/runs/${id}/rerun`,
				"--method",
				"POST",
			]);
			return Promise.resolve();
		},
		reviews: (number) => Promise.resolve(reviews(number)),
		runs: (pr) => {
			const batches = pages<{ workflow_runs: WorkflowRun[] }>(
				`repos/${REPOSITORY}/actions/runs?event=pull_request&head_sha=${encodeURIComponent(pr.head.sha)}&per_page=100`
			);
			return Promise.resolve(
				batches
					.flatMap((batch) => batch.workflow_runs)
					.filter(
						(run) =>
							run.path.split("@")[0].endsWith(POLICY_WORKFLOW) &&
							run.head_sha === pr.head.sha &&
							run.pull_requests.some((item) => item.number === pr.number)
					)
			);
		},
	},
	process.env.FORCE_REFRESH === "true"
);
