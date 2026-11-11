import { type ChangeEvent, type ReactNode, useCallback, useId } from "react";
import { sound } from "../../lib/sound";
import "./picker.css";

export interface PickerOption<T extends string | number> {
	hint?: string;
	label: string;
	value: T;
}

export function Picker<T extends string | number>({
	label,
	value,
	options,
	onChange,
	footer,
	fixed,
}: {
	label: string;
	value: T;
	options: PickerOption<T>[];
	onChange: (value: T) => void;
	footer?: ReactNode;
	fixed?: string;
}) {
	const id = useId();
	const hintId = `${id}-hint`;
	const change = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const option = options.find(
				(item) => String(item.value) === event.currentTarget.value
			);
			if (option) {
				sound.tick();
				onChange(option.value);
			}
		},
		[onChange, options]
	);
	const current = options.find((option) => option.value === value);
	return (
		<div className="picker">
			<div className="picker-field">
				<h2 className="section-heading">
					<label htmlFor={id}>{label}</label>
				</h2>
				<select
					aria-describedby={!fixed && current?.hint ? hintId : undefined}
					className="picker-v"
					disabled={Boolean(fixed)}
					id={id}
					name={label.toLowerCase()}
					onChange={change}
					value={fixed ? "fixed" : String(value)}
				>
					{fixed ? (
						<option value="fixed">{fixed}</option>
					) : (
						options.map((option) => (
							<option key={option.value} value={String(option.value)}>
								{option.label}
							</option>
						))
					)}
				</select>
			</div>
			{!fixed && current?.hint && (
				<p className="picker-hint" id={hintId}>
					{current.hint}
				</p>
			)}
			{footer}
		</div>
	);
}
