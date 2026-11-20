import type { ChangeEvent, Ref } from "react";
import { useCallback, useId } from "react";
import { useFieldContext } from "../../components/forms/form-context";
import { FormError } from "../../components/forms/form-error";
import { PermissionOption } from "../../components/forms/permission-option";
import type { TeamRole } from "../../lib/api";
import { TEAM_ROLE_OPTIONS } from "../../lib/team-role-options";

export function TeamRoleFields({
	compact = false,
	inputRef,
}: {
	compact?: boolean;
	inputRef: Ref<HTMLInputElement>;
}) {
	const field = useFieldContext<TeamRole[]>();
	const id = useId();
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const option = TEAM_ROLE_OPTIONS.find(
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
		<fieldset className="team-permissions" data-compact={compact || undefined}>
			<legend className={compact ? "visually-hidden" : undefined}>
				Permissions
			</legend>
			<div className="permission-options">
				{TEAM_ROLE_OPTIONS.map((option, index) => (
					<PermissionOption
						aria-describedby={error ? `${id}-error` : undefined}
						aria-invalid={error ? true : undefined}
						checked={field.state.value.includes(option.value)}
						description={option.description}
						key={option.value}
						label={option.label}
						name={field.name}
						onBlur={field.handleBlur}
						onChange={change}
						ref={index === 0 ? inputRef : undefined}
						title={compact ? option.description : undefined}
						type="checkbox"
						value={option.value}
					/>
				))}
			</div>
			{error ? <FormError id={`${id}-error`} message={error} /> : null}
		</fieldset>
	);
}
