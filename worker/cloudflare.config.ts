import { bindings, defineConfig, exports } from "cf/config";

export default defineConfig({
	accountId: "d90ac67a53e9492aafbd0c3e13ffa25f",
	worker: {
		assets: {
			notFoundHandling: "single-page-application",
			runWorkerFirst: true,
		},
		compatibilityDate: "2026-10-01",
		domains: ["console.hotaisle.app"],
		entrypoint: "./src/index.ts",
		env: {
			API_BASE: bindings.text("https://admin.hotaisle.app/api"),
			API_READ_RATE_LIMITER: bindings.rateLimit({
				namespace: "173240203",
				simple: { limit: 120, period: 60 },
			}),
			API_WRITE_RATE_LIMITER: bindings.rateLimit({
				namespace: "173240204",
				simple: { limit: 30, period: 60 },
			}),
			ASSETS: bindings.assets(),
			AUTH_RATE_LIMITER: bindings.rateLimit({
				namespace: "173240205",
				simple: { limit: 60, period: 60 },
			}),
			EMAIL_LOGIN_EMAIL_RATE_LIMITER: bindings.rateLimit({
				namespace: "173240201",
				simple: { limit: 3, period: 60 },
			}),
			EMAIL_LOGIN_IP_RATE_LIMITER: bindings.rateLimit({
				namespace: "173240202",
				simple: { limit: 10, period: 60 },
			}),
			HISTORY_SECRET: bindings.secret(),
			SESSION_SECRET: bindings.secret(),
		},
		exports: {
			Account: exports.durableObject({ state: "deleted" }),
			Availability: exports.durableObject({ state: "deleted" }),
		},
		limits: { cpuMs: 1000, subrequests: 10 },
		name: "hotaisle-console",
		observability: {
			enabled: true,
			issues: { enabled: true },
			logs: {
				enabled: true,
				headSamplingRate: 1,
				invocationLogs: false,
				persist: true,
			},
			redactQueryString: true,
			traces: { enabled: false },
		},
	},
});
