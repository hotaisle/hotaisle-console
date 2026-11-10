import { at } from "./formatting";

export function Timeline({
	start,
	end,
	now,
	endLabel,
}: {
	start?: number;
	end?: number;
	now: number;
	endLabel: string;
}) {
	if (!start) {
		return null;
	}
	const f =
		end && end > start
			? Math.min(1, Math.max(0, (now - start) / (end - start)))
			: 1;
	return (
		<div className="tl">
			<div className={`tl-bar ${end ? "" : "open"}`}>
				<span style={{ ["--f" as string]: f }} />
			</div>
			<div className="tl-l">
				<span>Launched {at(start)}</span>
				<span>{endLabel}</span>
			</div>
		</div>
	);
}
