import { type ChangeEvent, useCallback, useId } from "react";

export function PreferenceToggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	const id = useId();
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) =>
			onChange(event.currentTarget.checked),
		[onChange]
	);
	return (
		<label className="check" htmlFor={id}>
			<input checked={checked} id={id} onChange={change} type="checkbox" />
			<span>{label}</span>
		</label>
	);
}
