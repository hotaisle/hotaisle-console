import { useStore } from "@tanstack/react-form";
import type { ComponentProps } from "react";
import { useCallback, useId } from "react";
import { useFieldContext } from "./form-context";
import { FormError } from "./form-error";

interface TextFieldProps
	extends Omit<
		ComponentProps<"input">,
		"name" | "value" | "onChange" | "onBlur"
	> {
	acceptValue?: (value: string) => boolean;
	fieldFeedback?: boolean;
	help?: string;
	hideLabel?: boolean;
	label: string;
}

export function TextField({
	acceptValue,
	fieldFeedback = false,
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
	const submitted = useStore(
		field.form.store,
		(state) => fieldFeedback && state.submissionAttempts > 0
	);
	const { errors, isBlurred, isDirty, isTouched } = field.state.meta;
	const showError = fieldFeedback
		? submitted || (isBlurred && isDirty)
		: isTouched;
	const error = showError
		? errors.filter((value) => typeof value === "string").join(" ")
		: "";
	const change = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const { value } = event.currentTarget;
			if (!acceptValue || acceptValue(value)) {
				field.handleChange(value);
			}
		},
		[acceptValue, field]
	);
	const describedBy =
		[suppliedDescription, help ? `${id}-help` : "", error ? `${id}-error` : ""]
			.filter(Boolean)
			.join(" ") || undefined;
	const input = (
		<input
			{...props}
			aria-describedby={describedBy}
			aria-invalid={Boolean(error) || (fieldFeedback ? false : undefined)}
			id={id}
			name={field.name}
			onBlur={field.handleBlur}
			onChange={change}
			value={field.state.value}
		/>
	);
	return (
		<div className="form-field">
			<label className={hideLabel ? "visually-hidden" : undefined} htmlFor={id}>
				{label}
			</label>
			{fieldFeedback ? (
				<div className="field-feedback">
					{input}
					{error ? (
						<span
							className="field-feedback-error"
							id={`${id}-error`}
							role="alert"
						>
							{error}
						</span>
					) : null}
				</div>
			) : (
				input
			)}
			{help ? (
				<p className="hint" id={`${id}-help`}>
					{help}
				</p>
			) : null}
			{!fieldFeedback && error ? (
				<FormError id={`${id}-error`} message={error} />
			) : null}
		</div>
	);
}
