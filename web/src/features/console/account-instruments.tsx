import { isPresent } from "../../../../shared/present";
import { Lcd } from "../../components/lcd";
import type { Balance } from "../../lib/api";
import { duration, money } from "../../lib/format";
import { dollars } from "../machines/formatting";

function lasts(ms: number) {
	const minutes = Math.max(0, Math.floor(ms / 60_000));
	return (
		Math.min(9999, Math.floor(minutes / 60)) +
		":" +
		String(minutes % 60).padStart(2, "0")
	).padStart(7, " ");
}
export function AccountInstruments({
	balance: b,
	gpus: gpusAtWork,
}: {
	balance?: Balance;
	gpus: number;
}) {
	const runout = b?.estimated_runout_time
		? new Date(b.estimated_runout_time).getTime() - Date.now()
		: undefined;
	function resolveValue() {
		if (b && b.hourly_rate > 0 && isPresent(runout)) {
			return (
				<>
					<Lcd
						className="sm"
						label={`about ${duration(runout)}`}
						value={lasts(runout)}
					/>
					<span className="unit">h</span>
				</>
			);
		}
		return (
			<>
				<span className="cur">$</span>
				<Lcd
					className="sm"
					label={b ? money(b.available_balance) : "unknown"}
					value={dollars(b?.available_balance)}
				/>
			</>
		);
	}
	return (
		<fieldset className="cluster">
			<legend className="visually-hidden">Account</legend>
			<div className="meter-cell">
				<span className="meter-l">GPUs at work</span>
				<span className="meter-v">
					<Lcd
						className="sm"
						label={`${gpusAtWork} GPUs at work`}
						value={String(gpusAtWork).padStart(2, " ")}
					/>
				</span>
			</div>
			<div className="meter-cell">
				<span className="meter-l">Per hour</span>
				<span className="meter-v">
					<span className="cur">$</span>
					<Lcd
						className="sm"
						label={b ? `${money(b.hourly_rate)} an hour` : "unknown"}
						value={dollars(b?.hourly_rate)}
					/>
				</span>
			</div>
			<div className="meter-cell">
				<span className="meter-l">
					{b && b.hourly_rate > 0 && isPresent(runout)
						? "Balance lasts"
						: "Balance"}
				</span>
				<span className="meter-v">{resolveValue()}</span>
			</div>
		</fieldset>
	);
}
