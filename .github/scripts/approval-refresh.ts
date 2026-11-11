import {
	hasMaintainerApproval,
	type PullRequest,
	type Review,
} from "./approval-policy";

export interface PolicyRun {
	conclusion: string | null;
	id: number;
	status: string;
}

export interface RefreshAPI {
	openPullRequests: () => Promise<PullRequest[]>;
	rerun: (id: number) => Promise<void>;
	reviews: (number: number) => Promise<Review[]>;
	runs: (pr: PullRequest) => Promise<PolicyRun[]>;
}

export async function refreshApprovals(api: RefreshAPI, force = false) {
	const pulls = await api.openPullRequests();
	await Promise.all(
		pulls.map(async (pr) => {
			const runs = await api.runs(pr);
			const completed = runs.filter((run) => run.status === "completed");
			if (!completed.length) {
				return;
			}
			if (force) {
				await Promise.all(completed.map((run) => api.rerun(run.id)));
				return;
			}
			const allowed = hasMaintainerApproval(pr, await api.reviews(pr.number));
			await Promise.all(
				completed
					.filter((run) => (run.conclusion === "success") !== allowed)
					.map((run) => api.rerun(run.id))
			);
		})
	);
}
