import { execFileSync } from "node:child_process";
import {
	githubMetadata,
	mergedPullRequestURL,
	productionCommit,
} from "./cloudflare-ci";

const sha = productionCommit(process.env);
const prURL = mergedPullRequestURL(
	await githubMetadata(`commits/${sha}/pulls?per_page=100`),
	sha
);
const env = { ...process.env, NODE_ENV: undefined, VITE_BUILD_PR_URL: prURL };

execFileSync("bun", ["install", "--frozen-lockfile"], {
	env: { ...env, NODE_ENV: "development" },
	stdio: "inherit",
	timeout: 300_000,
});
execFileSync("bun", ["run", "check"], {
	env,
	stdio: "inherit",
	timeout: 120_000,
});
execFileSync("bun", ["run", "typecheck"], {
	env,
	stdio: "inherit",
	timeout: 120_000,
});
// Worker asset/CSP tests require the generated frontend, including on a fresh
// build image without a dependency or output cache.
execFileSync("bun", ["run", "build"], {
	env,
	stdio: "inherit",
	timeout: 300_000,
});
execFileSync("bun", ["run", "test"], {
	env,
	stdio: "inherit",
	timeout: 300_000,
});
execFileSync(
	"bun",
	["run", "--cwd", "worker", "cf", "deploy", "--prebuilt", "--dry-run"],
	{
		env,
		stdio: "inherit",
		timeout: 120_000,
	}
);
