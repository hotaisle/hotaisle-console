import { isPresent } from "../../../../shared/present";
import { Lcd } from "../../components/lcd";
import { duration, money } from "../../lib/format";
import { dollars, meter } from "./formatting";

import type { TripContext } from "./use-trip";
export function TripReadings({ context }: { context: TripContext }) {
	const { price, ready, steps, current, ranMs } = context;
	const stepFill = isPresent(ranMs) ? 1 - Math.exp(-ranMs / 1000 / 22) : 0.3;
	function resolveValue() {
		if (ready) {
			return (
				<div className="meter-cell in">
					<span className="meter-l">So far</span>
					<span className="meter-v">
						<span className="cur">$</span>
						<Lcd
							className="md"
							label={
								isPresent(price) && isPresent(ranMs)
									? `about ${money((price * ranMs) / 3_600_000)} so far`
									: "cost unknown"
							}
							still
							value={dollars(
								isPresent(price) && isPresent(ranMs)
									? (price * ranMs) / 3_600_000
									: undefined
							)}
						/>
					</span>
				</div>
			);
		}
		return (
			<ol
				aria-label={`Step ${Math.min(current + 1, steps.length)} of ${steps.length}: ${steps[Math.min(current, steps.length - 1)]}`}
				className="track"
				style={{ ["--n" as string]: steps.length }}
			>
				{steps.map((s, i) => (
					<li
						aria-current={i === current ? "step" : undefined}
						className={[i < current && "done", i === current && "now"]
							.filter(Boolean)
							.join(" ")}
						key={s}
						style={i === current ? { ["--f" as string]: stepFill } : undefined}
					>
						<span className="bar" />
						<span className="lbl">{s}</span>
					</li>
				))}
			</ol>
		);
	}
	return (
		<div className="inst">
			<div className="meter-cell">
				<span className="meter-l">{ready ? "Running" : "Elapsed"}</span>
				<span className="meter-v">
					<Lcd
						className="md"
						label={
							isPresent(ranMs)
								? `${ready ? "running for" : "elapsed"} ${duration(ranMs)}`
								: "Launch time unavailable in this browser session"
						}
						still
						value={isPresent(ranMs) ? meter(ranMs) : " -:--:--"}
					/>
				</span>
			</div>
			{resolveValue()}
		</div>
	);
}
