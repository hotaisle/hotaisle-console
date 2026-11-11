import { describe, expect, it, vi } from "vitest";
import type { PullRequest } from "./approval-policy";
import {
	type PolicyRun,
	type RefreshAPI,
	refreshApprovals,
} from "./approval-refresh";

const CONTRIBUTOR: PullRequest = {
	head: { sha: "a".repeat(40) },
	number: 2,
	user: { id: 42, type: "User" },
};
const MAINTAINER: PullRequest = {
	...CONTRIBUTOR,
	number: 1,
	user: { id: 159_235_294, type: "User" },
};
function run(overrides: Partial<PolicyRun> = {}): PolicyRun {
	return { conclusion: "failure", id: 1, status: "completed", ...overrides };
}
function fixture(overrides: Partial<RefreshAPI> = {}) {
	return {
		openPullRequests: () => Promise.resolve([CONTRIBUTOR]),
		rerun: vi.fn().mockResolvedValue(undefined),
		reviews: vi.fn().mockResolvedValue([]),
		runs: () => Promise.resolve([run()]),
		...overrides,
	};
}
describe("required review workflow refresh", () => {
	it("reruns a failed policy when a maintainer approves its current commit", async () => {
		const api = fixture({
			reviews: () =>
				Promise.resolve([
					{
						commit_id: CONTRIBUTOR.head.sha,
						id: 1,
						state: "APPROVED",
						user: MAINTAINER.user,
					},
				]),
		});
		await refreshApprovals(api);
		expect(api.rerun).toHaveBeenCalledWith(1);
	});
	it("reruns a previously successful policy when approval has been withdrawn", async () => {
		const api = fixture({
			runs: () => Promise.resolve([run({ conclusion: "success" })]),
		});
		await refreshApprovals(api);
		expect(api.rerun).toHaveBeenCalledWith(1);
	});
	it("does not perpetually rerun an unapproved PR or a successful maintainer PR", async () => {
		const api = fixture();
		await refreshApprovals(api);
		expect(api.rerun).not.toHaveBeenCalled();
		const maintainer = fixture({
			openPullRequests: () => Promise.resolve([MAINTAINER]),
			runs: () => Promise.resolve([run({ conclusion: "success" })]),
		});
		await refreshApprovals(maintainer);
		expect(maintainer.rerun).not.toHaveBeenCalled();
	});
	it("refreshes PRs independently even when they share a commit", async () => {
		const api = fixture({
			openPullRequests: () => Promise.resolve([MAINTAINER, CONTRIBUTOR]),
			runs: (pr) =>
				Promise.resolve([run({ conclusion: "success", id: pr.number })]),
		});
		await refreshApprovals(api);
		expect(api.rerun).toHaveBeenCalledExactlyOnceWith(CONTRIBUTOR.number);
	});
	it.each([[], [run({ status: "queued" })], [run({ status: "in_progress" })]])(
		"leaves missing or active policy workflows alone",
		async (...runs) => {
			const api = fixture({ runs: () => Promise.resolve(runs) });
			await refreshApprovals(api, true);
			expect(api.rerun).not.toHaveBeenCalled();
		}
	);
	it("review events force a fresh required check without trusting review payloads", async () => {
		const api = fixture({
			reviews: vi.fn().mockRejectedValue(new Error("GitHub unavailable")),
		});
		await refreshApprovals(api, true);
		expect(api.reviews).not.toHaveBeenCalled();
		expect(api.rerun).toHaveBeenCalledWith(1);
	});
	it("refreshes both ordinary and organization-required runs for the same PR commit", async () => {
		const api = fixture({
			openPullRequests: () => Promise.resolve([MAINTAINER]),
			runs: () =>
				Promise.resolve([
					run({ conclusion: "success", id: 2 }),
					run({ id: 1 }),
				]),
		});
		await refreshApprovals(api);
		expect(api.rerun).toHaveBeenCalledExactlyOnceWith(1);
	});
});
