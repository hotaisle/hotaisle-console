import { type ComponentProps, useCallback, useId } from "react";
import { useFieldContext } from "./form-context";
import { FormError } from "./form-error";

interface TextFieldProps
	extends Omit<
		ComponentProps<"input">,
		"name" | "value" | "onChange" | "onBlur"
	> {
	help?: string;
	hideLabel?: boolean;
	label: string;
}

export function TextField({
	label,
	help,
	hideLabel = false,
	id: suppliedId,
	"aria-describedby": suppliedDescription,
	...props
}: TextFieldProps) {
	const field = useFieldContext<string>();
	const generatedId = useId();
	const id = suppliedId ?? generatedId;
	const error = field.state.meta.isTouched
		? field.state.meta.errors
				.filter((value) => typeof value === "string")
				.join(" ")
		: "";
	const change = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) =>
			field.handleChange(event.currentTarget.value),
		[field]
	);
	const describedBy =
		[suppliedDescription, help ? `${id}-help` : "", error ? `${id}-error` : ""]
			.filter(Boolean)
			.join(" ") || undefined;
	return (
		<div className="form-field">
			<label className={hideLabel ? "visually-hidden" : undefined} htmlFor={id}>
				{label}
			</label>
			<input
				{...props}
				aria-describedby={describedBy}
				aria-invalid={error ? true : undefined}
				id={id}
				name={field.name}
				onBlur={field.handleBlur}
				onChange={change}
				value={field.state.value}
			/>
			{help ? (
				<p className="hint" id={`${id}-help`}>
					{help}
				</p>
			) : null}
			{error ? <FormError id={`${id}-error`} message={error} /> : null}
		</div>
	);
}
