import { describe, expect, it } from "vitest";
import {
	hasMaintainerApproval,
	type Identity,
	type PullRequest,
	type Review,
} from "./approval-policy";

const JON: Identity = { id: 159_235_294, type: "User" };
const CLINT: Identity = { id: 160_780_714, type: "User" };
const CONTRIBUTOR: Identity = { id: 42, type: "User" };
const HEAD = "a".repeat(40);
const PREVIOUS = "b".repeat(40);
function pull(user = CONTRIBUTOR, number = 1): PullRequest {
	return { head: { sha: HEAD }, number, user };
}
function review(overrides: Partial<Review> = {}): Review {
	return {
		commit_id: HEAD,
		id: 1,
		state: "APPROVED",
		user: JON,
		...overrides,
	};
}

describe("maintainer review policy", () => {
	it.each([JON, CLINT])(
		"allows maintainer $id to author without approval",
		(user) => {
			expect(hasMaintainerApproval(pull(user), [])).toBe(true);
		}
	);
	it("does not grant authorship exemptions to other users or bot accounts", () => {
		expect(hasMaintainerApproval(pull(), [])).toBe(false);
		expect(hasMaintainerApproval(pull({ ...JON, type: "Bot" }), [])).toBe(
			false
		);
	});
	it.each([JON, CLINT])("accepts current-commit approval from $id", (user) => {
		expect(hasMaintainerApproval(pull(), [review({ user })])).toBe(true);
	});
	it("rejects other reviewers, missing users, and approval of a previous commit", () => {
		for (const candidate of [
			review({ user: CONTRIBUTOR }),
			review({ user: null }),
			review({ commit_id: PREVIOUS }),
		]) {
			expect(hasMaintainerApproval(pull(), [candidate])).toBe(false);
		}
	});
	it("comments do not erase a review decision", () => {
		expect(
			hasMaintainerApproval(pull(), [
				review(),
				review({ id: 2, state: "COMMENTED" }),
			])
		).toBe(true);
	});
	it("dismissal removes approval and the latest decision wins regardless of API ordering", () => {
		expect(
			hasMaintainerApproval(pull(), [review({ state: "DISMISSED" })])
		).toBe(false);
		expect(
			hasMaintainerApproval(pull(), [
				review({ id: 2, state: "CHANGES_REQUESTED" }),
				review(),
			])
		).toBe(false);
		expect(
			hasMaintainerApproval(pull(), [
				review({ id: 3 }),
				review({ id: 2, state: "CHANGES_REQUESTED" }),
			])
		).toBe(true);
	});
	it("respects outstanding maintainer change requests even for maintainer-authored PRs", () => {
		const blocked = review({ state: "CHANGES_REQUESTED", user: CLINT });
		expect(hasMaintainerApproval(pull(), [review(), blocked])).toBe(false);
		expect(hasMaintainerApproval(pull(JON), [blocked])).toBe(false);
	});
});
