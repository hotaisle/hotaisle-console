type Specs = [string, string][];

export function MachineSpecs({ specs }: { specs: Specs }) {
	return (
		<dl className="machine-specs">
			{specs.map(([label, value]) => (
				<div key={label}>
					<dt>{label}</dt>
					<dd>{value}</dd>
				</div>
			))}
		</dl>
	);
}

export function StageSpecs({ title, specs }: { title: string; specs: Specs }) {
	return (
		<details className="stage-specs">
			<summary>
				<strong>Specifications</strong>
				<span>{title}</span>
				<svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
					<path
						d="m3 5 4 4 4-4"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.5"
					/>
				</svg>
			</summary>
			<div className="stage-specs-body">
				<MachineSpecs specs={specs} />
			</div>
		</details>
	);
}
