export const SCENARIOS = [
	{ id: "empty", label: "Empty" },
	{ id: "assigned", label: "Assigned" },
	{ id: "setting-up", label: "Cloud-init" },
	{ id: "booting", label: "Booting" },
	{ id: "running", label: "Running" },
	{ id: "multiple", label: "Multiple machines" },
	{ id: "bare-metal", label: "Bare metal" },
	{ id: "same-name", label: "Same-name VM + bare metal" },
	{ id: "ended", label: "Ended" },
	{ id: "history", label: "History (200 runs)" },
	{ id: "launch-error", label: "Launch failure" },
] as const;

export type Scenario = (typeof SCENARIOS)[number]["id"];
export function scenarioOf(value: string | null): Scenario {
	return SCENARIOS.find((scenario) => scenario.id === value)?.id ?? "running";
}
export function initialRoute(scenario: Scenario) {
	if (scenario === "history") {
		return "/teams/preview/history";
	}
	return scenario === "ended"
		? "/teams/preview/history/preview-previous"
		: "/teams/preview/machines";
}
