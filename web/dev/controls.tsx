import { initialRoute, SCENARIOS, type Scenario } from "./scenarios";

function scenarioURL(scenario: Scenario) {
	const url = new URL(window.location.href);
	url.searchParams.set("scenario", scenario);
	url.hash = initialRoute(scenario);
	return url.href;
}
function reset() {
	window.location.reload();
}

export function PreviewControls({ scenario }: { scenario: Scenario }) {
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
			</div>
			<nav aria-label="Start from a preview state">
				{SCENARIOS.map((item) => (
					<a
						aria-current={item.id === scenario ? "page" : undefined}
						className={`btn ${item.id === scenario ? "on" : ""}`}
						href={scenarioURL(item.id)}
						key={item.id}
					>
						{item.label}
					</a>
				))}
			</nav>
			<p>
				Choose Empty, then hold Launch to watch assigned → ready. Cloud-init
				adds a booting step. Reload or Reset restores the selected scenario.
			</p>
		</aside>
	);
}
