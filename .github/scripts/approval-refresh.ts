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
			const [latest] = runs.sort((a, b) => b.id - a.id);
			if (latest?.status !== "completed") {
				return;
			}
			if (force) {
				await api.rerun(latest.id);
				return;
			}
			const allowed = hasMaintainerApproval(pr, await api.reviews(pr.number));
			if ((latest.conclusion === "success") !== allowed) {
				await api.rerun(latest.id);
			}
		})
	);
}
