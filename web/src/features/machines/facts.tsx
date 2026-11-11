import type { ReactNode } from "react";

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
	return (
		<dl className="facts">
			{rows.map(([k, v]) => (
				<div key={k}>
					<dt>{k}</dt>
					<dd title={typeof v === "string" ? v : undefined}>{v}</dd>
				</div>
			))}
		</dl>
	);
}
