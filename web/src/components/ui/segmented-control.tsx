import { type ChangeEvent, useCallback, useId } from "react";

export interface SegmentOption<T extends string | number> {
	label: string;
	value: T;
}
export function SegmentedControl<T extends string | number>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: readonly SegmentOption<T>[];
	onChange: (value: T) => void;
}) {
	const group = useId();
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const selected = options.find(
				(option) => String(option.value) === event.currentTarget.value
			);
			if (selected) {
				onChange(selected.value);
			}
		},
		[onChange, options]
	);
	return (
		<fieldset className="seg">
			<legend className="visually-hidden">{label}</legend>
			{options.map((option) => {
				const id = `${group}-${option.value}`;
				return (
					<label
						className={option.value === value ? "on" : ""}
						htmlFor={id}
						key={option.value}
					>
						<input
							checked={option.value === value}
							className="visually-hidden"
							id={id}
							name={group}
							onChange={change}
							type="radio"
							value={String(option.value)}
						/>
						<span>{option.label}</span>
					</label>
				);
			})}
		</fieldset>
	);
}
