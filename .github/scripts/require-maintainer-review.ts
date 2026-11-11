import { hasMaintainerApproval } from "./approval-policy";
import { pullNumber, pullRequest, reviews } from "./github-api";

const number = pullNumber(process.env.PULL_REQUEST_NUMBER);
const pr = pullRequest(number);
if (!hasMaintainerApproval(pr, reviews(number))) {
	throw new Error(
		"This PR needs jon-hotaisle or clint-hotaisle approval of its current commit. Outstanding maintainer change requests must be resolved."
	);
}
console.info("Maintainer authorship or current-commit approval verified.");
