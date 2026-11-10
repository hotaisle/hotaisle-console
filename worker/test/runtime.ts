import {
	env as runtimeEnv,
	exports as runtimeExports,
} from "cloudflare:workers";
import type { Env } from "../src/hotaisle";

interface TestEnv extends Env {
	UPSTREAM: Fetcher;
}
interface WorkerExports {
	default: Fetcher;
}

export const env = runtimeEnv as TestEnv;
export const worker = runtimeExports as WorkerExports;
