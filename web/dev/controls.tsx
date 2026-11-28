import { useCallback } from "react";
import type { Scenario } from "./scenarios";
import { AUTOPAY_SCENARIOS, initialRoute, SCENARIOS } from "./scenarios";

function scenarioURL(scenario: Scenario) {
	const url = new URL(window.location.href);
	url.searchParams.set("scenario", scenario);
	url.hash = initialRoute(scenario);
	return url.href;
}

function ScenarioLinks({
	items,
	scenario,
}: {
	items: readonly { id: Scenario; label: string }[];
	scenario: Scenario;
}) {
	return items.map((item) => (
		<a
			aria-current={item.id === scenario ? "page" : undefined}
			className={`btn ${item.id === scenario ? "on" : ""}`}
			href={scenarioURL(item.id)}
			key={item.id}
		>
			{item.label}
		</a>
	));
}

export function PreviewControls({ scenario }: { scenario: Scenario }) {
	const consoleURL = new URL("/", window.location.href);
	consoleURL.hostname = "localhost";
	const reset = useCallback(() => {
		window.history.replaceState(null, "", scenarioURL(scenario));
		window.location.reload();
	}, [scenario]);
	return (
		<aside
			aria-label="Development preview controls"
			className="preview-controls"
		>
			<div className="preview-caption">
				<strong>Development preview</strong>
				<span>Simulated machines · no real API calls</span>
				<button className="btn" onClick={reset} type="button">
					Reset preview
				</button>
				<a className="btn" href={consoleURL.href}>
					End preview
				</a>
			</div>
			<nav aria-label="Autopay preview states">
				<strong>Autopay</strong>
				<ScenarioLinks items={AUTOPAY_SCENARIOS} scenario={scenario} />
			</nav>
			<nav aria-label="Other preview states">
				<ScenarioLinks items={SCENARIOS} scenario={scenario} />
			</nav>
			<p>
				Choose Empty, then hold Launch to watch assigned → ready. Cloud-init
				adds a booting step. Reload or Reset restores the selected scenario.
			</p>
		</aside>
	);
}
