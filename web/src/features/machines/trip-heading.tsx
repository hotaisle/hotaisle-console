import { isPresent } from "../../../../shared/present";
import { money } from "../../lib/format";
import { Chips } from "./chips";

import type { TripContext } from "./use-trip";
export function TripHeading({ context }: { context: TripContext }) {
	const { price, busy, g, gpus, head, sub, mode } = context;

	const _displayLabel = busy && busy !== "End" ? `${busy}…` : head;
	return (
		<div className="card-head">
			<div className="card-title">
				<h3>
					<Chips mode={mode} n={g?.count ?? 1} />
					{_displayLabel}
				</h3>
				<p>{sub}</p>
			</div>
			<div className="card-what">
				<b>{gpus}</b>
				{isPresent(price) && <span>{money(price)}/hr</span>}
			</div>
		</div>
	);
}
