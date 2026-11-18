import { isPresent } from "../../../../shared/present";
import { Lcd } from "../../components/lcd";
import { duration, money } from "../../lib/format";
import { dollars, meter } from "./formatting";

import type { TripContext } from "./use-trip";
export function TripReadings({ context }: { context: TripContext }) {
	const { cost, steps, current, ranMs, mode, phase } = context;
	function resolveValue() {
		if (phase !== "building" && phase !== "starting") {
			return (
				<div className="meter-cell in">
					<span className="meter-l">Est. cost</span>
					<span className="meter-v">
						<span className="cur">$</span>
						<Lcd
							className="md"
							label={
								isPresent(cost)
									? `estimated cost ${money(cost)}, including the minimum reservation`
									: "cost unknown"
							}
							still
							value={dollars(cost)}
						/>
					</span>
				</div>
			);
		}
		return (
			<ol
				aria-label={`Step ${Math.min(current + 1, steps.length)} of ${steps.length}: ${steps[Math.min(current, steps.length - 1)]}`}
				className={mode === "booting" ? "track is-active" : "track"}
				style={{ ["--n" as string]: steps.length }}
			>
				{steps.map((s, i) => (
					<li
						aria-current={i === current ? "step" : undefined}
						className={[i < current && "done", i === current && "now"]
							.filter(Boolean)
							.join(" ")}
						key={s}
					>
						<span aria-hidden="true" className="bar" />
						<span className="lbl">{s}</span>
					</li>
				))}
			</ol>
		);
	}
	return (
		<div className="inst">
			<div className="meter-cell">
				<span className="meter-l">Reserved</span>
				<span className="meter-v">
					<Lcd
						className="md"
						label={
							isPresent(ranMs)
								? `reserved for ${duration(ranMs)}`
								: "Reservation start unavailable from the API"
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
