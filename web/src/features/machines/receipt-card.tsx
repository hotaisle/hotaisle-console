import { isPresent } from "../../../../shared/present";
import { Lcd } from "../../components/lcd";
import type { Ended } from "../../lib/api";
import { duration, money } from "../../lib/format";
import { vtName } from "../../lib/motion";
import { Chips } from "./chips";
import { Facts } from "./facts";
import { at, dollars, meter, runFacts, runTitle } from "./formatting";
import { Timeline } from "./timeline";

export function ReceiptCard({ r, onDone }: { r: Ended; onDone?: () => void }) {
	const summary = isPresent(r.cents)
		? ""
		: "Launched outside this app, so the run time and cost are unknown.";
	const _displayLabel = r.started_at ? Date.parse(r.started_at) : undefined;
	return (
		<article
			aria-label={`${runTitle(r)} ended`}
			className="trip receipt vt"
			style={{ ["--vt" as string]: vtName("vm", r.name) }}
		>
			<div className="card-head">
				<div className="card-title">
					<h3>
						<Chips mode="ended" n={Number(r.gpus.split("×")[0]) || 1} />
						Ended
					</h3>
					<p>Billing stopped at {at(r.ended_at)}.</p>
				</div>
				<div className="card-what">
					<b>{r.gpus}</b>
				</div>
			</div>
			<div className="inst">
				<div className="meter-cell">
					<span className="meter-l">Ran for</span>
					<span className="meter-v">
						<Lcd
							className="md"
							label={isPresent(r.ran_ms) ? duration(r.ran_ms) : "unknown"}
							still
							value={isPresent(r.ran_ms) ? meter(r.ran_ms) : " -:--:--"}
						/>
					</span>
				</div>
				<div className="meter-cell">
					<span className="meter-l">Total</span>
					<span className="meter-v">
						<span className="cur">$</span>
						<Lcd
							className="md"
							label={isPresent(r.cents) ? money(r.cents) : "unknown"}
							still
							value={dollars(r.cents)}
						/>
					</span>
				</div>
			</div>
			{summary ? <div className="summary">{summary}</div> : null}
			<div className="run">
				<Timeline
					end={Date.parse(r.ended_at)}
					endLabel={`Ended ${at(r.ended_at)}`}
					now={Date.parse(r.ended_at)}
					start={_displayLabel}
				/>
				<Facts rows={runFacts(r)} />
			</div>
			{onDone ? (
				<div className="card-foot">
					<button className="btn" onClick={onDone} type="button">
						Done
					</button>
				</div>
			) : null}
		</article>
	);
}
