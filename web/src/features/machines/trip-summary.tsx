import { isPresent } from "../../../../shared/present";
import { money } from "../../lib/format";
import { Chips } from "./chips";
import { clock } from "./formatting";

import type { TripContext } from "./use-trip";
export function TripSummary({ context }: { context: TripContext }) {
	const {
		vm,
		cost,
		server,
		onFocus,
		g,
		gpus,
		ready,
		head,
		ranMs,
		mode,
		style,
	} = context;
	const serverName = server || vm.name;
	const _displayLabel =
		ready && isPresent(ranMs) && isPresent(cost)
			? `${clock(ranMs)}, est. ${money(cost)}`
			: head;
	return (
		<button
			aria-label={`${vm.name}: ${gpus}, ${head}. Show details`}
			className="trip-row vt"
			onClick={onFocus}
			style={style}
			type="button"
		>
			<Chips mode={mode} n={g?.count ?? 1} />
			<span className="tr-main">
				<b>{gpus}</b>
				<span className="mono">{serverName}</span>
			</span>
			<span className="tr-end">{_displayLabel}</span>
		</button>
	);
}
