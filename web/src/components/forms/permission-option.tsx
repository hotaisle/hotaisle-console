import { type ComponentProps, useId } from "react";

export function PermissionOption({
	label,
	description,
	"aria-describedby": describedBy,
	...props
}: ComponentProps<"input"> & { label: string; description: string }) {
	const id = useId();
	return (
		<label className="permission-option">
			<input
				{...props}
				aria-describedby={[`${id}-description`, describedBy]
					.filter(Boolean)
					.join(" ")}
				aria-labelledby={`${id}-label`}
			/>
			<span>
				<strong id={`${id}-label`}>{label}</strong>
				<span id={`${id}-description`}>{description}</span>
			</span>
		</label>
	);
}
