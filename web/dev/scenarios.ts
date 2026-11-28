import type { AutoRebillStatus } from "../src/lib/auto-rebill";

export const SCENARIOS = [
	{ id: "empty", label: "Empty" },
	{ id: "no-capacity", label: "No capacity" },
	{ id: "assigned", label: "Assigned" },
	{ id: "setting-up", label: "Cloud-init" },
	{ id: "booting", label: "Booting" },
	{ id: "running", label: "Running" },
	{ id: "multiple", label: "Multiple machines" },
	{ id: "bare-metal", label: "Bare metal" },
	{ id: "same-name", label: "Same-name VM + bare metal" },
	{ id: "ended", label: "Ended" },
	{ id: "history", label: "History (200 runs)" },
	{ id: "api-tokens", label: "API tokens" },
	{ id: "launch-error", label: "Launch failure" },
	{ id: "session-ended", label: "Session ended" },
] as const;

export type PreviewRebillState =
	| Exclude<AutoRebillStatus["state"], "payment_failed">
	| "setup_pending"
	| "failed_top_up";

export const AUTOPAY_SCENARIOS = [
	{ id: "auto-rebill-setup", label: "Setup", state: "disabled" },
	{ id: "auto-rebill-pending", label: "Setup pending", state: "setup_pending" },
	{ id: "auto-rebill", label: "Active", state: "enabled" },
	{
		id: "auto-rebill-processing",
		label: "Payment processing",
		state: "payment_processing",
	},
	{
		id: "auto-rebill-failed",
		label: "Payment failed",
		state: "failed_top_up",
	},
	{ id: "auto-rebill-capped", label: "Cap reached", state: "capped" },
] as const satisfies readonly {
	id: string;
	label: string;
	state: PreviewRebillState;
}[];

export type Scenario =
	| (typeof SCENARIOS)[number]["id"]
	| (typeof AUTOPAY_SCENARIOS)[number]["id"]
	| "sign-in";

export function autopayScenario(value: string | null) {
	return AUTOPAY_SCENARIOS.find((scenario) => scenario.id === value);
}

export function scenarioOf(value: string | null): Scenario {
	return (
		autopayScenario(value)?.id ??
		SCENARIOS.find((scenario) => scenario.id === value)?.id ??
		"running"
	);
}
export function initialRoute(scenario: Scenario) {
	if (scenario === "api-tokens") {
		return "/account/api-tokens/new";
	}
	if (autopayScenario(scenario)) {
		return "/teams/preview/credits";
	}
	if (scenario === "sign-in") {
		return "/sign-in?returnTo=%2Fteams";
	}
	if (scenario === "history") {
		return "/teams/preview/history";
	}
	return scenario === "ended"
		? "/teams/preview/history/preview-previous"
		: "/teams/preview/machines";
}
