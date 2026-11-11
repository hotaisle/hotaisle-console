import { execFileSync } from "node:child_process";
import { currentMainCommit, productionCommit } from "./cloudflare-ci";

const sha = productionCommit(process.env);
if ((await currentMainCommit()) === sha) {
	execFileSync(
		"bun",
		[
			"run",
			"--cwd",
			"worker",
			"cf",
			"deploy",
			"--prebuilt",
			"--tag",
			sha,
			"--message",
			`Deploy ${sha} from Workers Builds`,
		],
		{
			stdio: "inherit",
			timeout: 300_000,
		}
	);
} else {
	console.info(
		"Skipping deployment because a newer main revision is available."
	);
}
