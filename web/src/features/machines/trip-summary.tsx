import { isPresent } from "../../../../shared/present";
import { money } from "../../lib/format";
import { Chips } from "./chips";
import { clock } from "./formatting";

import type { TripContext } from "./use-trip";
export function TripSummary({ context }: { context: TripContext }) {
	const {
		vm,
		price,
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
	function resolveValue() {
		if (vm.metal) {
			return <span className="on-host">, the whole server</span>;
		}
		if (server) {
			return <span className="on-host"> on {server}</span>;
		}
		return null;
	}
	const _displayLabel =
		ready && isPresent(ranMs) && isPresent(price)
			? `${clock(ranMs)}, ${money((price * ranMs) / 3_600_000)}`
			: gpus;
	return (
		<button
			aria-label={`${vm.name}: ${head}. Show details`}
			className="trip-row vt"
			onClick={onFocus}
			style={style}
			type="button"
		>
			<Chips mode={mode} n={g?.count ?? 1} />
			<span className="tr-main">
				<b>{head}</b>
				<span className="mono">
					{vm.name}
					{resolveValue()}
				</span>
			</span>
			<span className="tr-end">{_displayLabel}</span>
		</button>
	);
}
