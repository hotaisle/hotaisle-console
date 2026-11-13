import { type ChangeEvent, type Ref, useCallback, useId } from "react";
import { useFieldContext } from "../../components/forms/form-context";
import type { TeamRole } from "../../lib/api";

const OPTIONS: { value: TeamRole; label: string; description: string }[] = [
	{
		description: "Connect to machines over SSH.",
		label: "User",
		value: "user",
	},
	{
		description: "Launch, rebuild, reboot, and end machines.",
		label: "Operator",
		value: "operator",
	},
	{
		description: "Purchase credits for the team.",
		label: "Purchaser",
		value: "purchaser",
	},
	{
		description: "Manage team details and members.",
		label: "Owner",
		value: "owner",
	},
];

export function TeamRoleFields({
	inputRef,
}: {
	inputRef: Ref<HTMLInputElement>;
}) {
	const field = useFieldContext<TeamRole[]>();
	const id = useId();
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const option = OPTIONS.find(
				(item) => item.value === event.currentTarget.value
			);
			if (!option) {
				return;
			}
			field.handleChange(
				event.currentTarget.checked
					? [...field.state.value, option.value]
					: field.state.value.filter((value) => value !== option.value)
			);
		},
		[field]
	);
	const error = field.state.meta.isTouched
		? field.state.meta.errors
				.filter((value) => typeof value === "string")
				.join(" ")
		: "";
	return (
		<fieldset className="team-permissions">
			<legend>Permissions</legend>
			<div className="team-permission-options">
				{OPTIONS.map((option, index) => (
					<label className="team-permission" key={option.value}>
						<input
							aria-describedby={`${id}-${option.value}-description${error ? ` ${id}-error` : ""}`}
							aria-invalid={error ? true : undefined}
							aria-labelledby={`${id}-${option.value}-label`}
							checked={field.state.value.includes(option.value)}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={change}
							ref={index === 0 ? inputRef : undefined}
							type="checkbox"
							value={option.value}
						/>
						<span>
							<strong id={`${id}-${option.value}-label`}>{option.label}</strong>
							<span id={`${id}-${option.value}-description`}>
								{option.description}
							</span>
						</span>
					</label>
				))}
			</div>
			{error ? (
				<p className="error" id={`${id}-error`} role="alert">
					{error}
				</p>
			) : null}
		</fieldset>
	);
}
