import { appendFileSync } from "node:fs";
import { REPOSITORY, request } from "./github-api";

const COMMIT_SHA = /^[a-f0-9]{40}$/u;
if (
	process.env.GITHUB_EVENT_NAME !== "push" ||
	process.env.GITHUB_REF !== "refs/heads/main"
) {
	throw new Error("Production deployment requires a push to main.");
}
const current = JSON.parse(request([`repos/${REPOSITORY}/commits/main`])) as {
	sha: string;
};
if (
	!(
		COMMIT_SHA.test(current.sha) &&
		COMMIT_SHA.test(process.env.GITHUB_SHA ?? "")
	)
) {
	throw new Error("Cannot verify the production revision.");
}
const output = process.env.GITHUB_OUTPUT;
if (!output) {
	throw new Error("GitHub Actions output is unavailable.");
}
const deploy = current.sha === process.env.GITHUB_SHA;
appendFileSync(output, `deploy=${deploy}\n`);
console.info(
	deploy
		? "Deploying the tested current main revision."
		: "Skipping deployment because a newer main revision is available."
);
