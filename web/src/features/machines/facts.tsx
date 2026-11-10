export function Facts({ rows }: { rows: [string, string][] }) {
	return (
		<dl className="facts">
			{rows.map(([k, v]) => (
				<div key={k}>
					<dt>{k}</dt>
					<dd title={v}>{v}</dd>
				</div>
			))}
		</dl>
	);
}
