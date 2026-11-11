export interface Identity {
	id: number;
	type: string;
}

export interface PullRequest {
	head: { sha: string };
	number: number;
	user: Identity;
}

export interface Review {
	commit_id: string | null;
	id: number;
	state: string;
	user: Identity | null;
}

// GitHub account IDs remain stable if a maintainer renames their account.
const MAINTAINERS = new Set([
	159_235_294, // jon-hotaisle
	160_780_714, // clint-hotaisle
]);

function isMaintainer(user: Identity | null): user is Identity {
	return user?.type === "User" && MAINTAINERS.has(user.id);
}

export function hasMaintainerApproval(pr: PullRequest, reviews: Review[]) {
	const decisions = new Map<number, Review>();
	for (const review of reviews) {
		if (!isMaintainer(review.user) || review.state === "COMMENTED") {
			continue;
		}
		const { id } = review.user;
		const previous = decisions.get(id);
		if (!previous || review.id > previous.id) {
			decisions.set(id, review);
		}
	}
	const latest = [...decisions.values()];
	if (latest.some((review) => review.state === "CHANGES_REQUESTED")) {
		return false;
	}
	return (
		isMaintainer(pr.user) ||
		latest.some(
			(review) =>
				review.state === "APPROVED" && review.commit_id === pr.head.sha
		)
	);
}
