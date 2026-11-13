import { type ChangeEvent, type Ref, useCallback, useId } from "react";
import { useFieldContext } from "../../components/forms/form-context";
import { FormError } from "../../components/forms/form-error";
import { PermissionOption } from "../../components/forms/permission-option";
import type { APITokenRequest, Team, TeamRole } from "../../lib/api";
import { TEAM_ROLE_OPTIONS } from "../../lib/team-role-options";

const ROLES: TeamRole[] = TEAM_ROLE_OPTIONS.map((option) => option.value);

export function TokenAccountAccess() {
	const field = useFieldContext<"user" | "owner">();
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			field.handleChange(
				event.currentTarget.value === "owner" ? "owner" : "user"
			);
		},
		[field]
	);
	return (
		<fieldset className="token-permissions">
			<legend>Account access</legend>
			<div className="permission-options">
				<PermissionOption
					checked={field.state.value === "user"}
					description="Read account details."
					label="User"
					name={field.name}
					onChange={change}
					type="radio"
					value="user"
				/>
				<PermissionOption
					checked={field.state.value === "owner"}
					description="Manage your account and API tokens."
					label="Owner"
					name={field.name}
					onChange={change}
					type="radio"
					value="owner"
				/>
			</div>
		</fieldset>
	);
}

export function TokenTeamAccess({
	teams,
	inputRef,
}: {
	teams: Team[];
	inputRef?: Ref<HTMLInputElement>;
}) {
	const field = useFieldContext<NonNullable<APITokenRequest["teams"]>>();
	const id = useId();
	const error = field.state.meta.errors
		.filter((value) => typeof value === "string")
		.join(" ");
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const handle = event.currentTarget.dataset.team;
			const role = ROLES.find((value) => value === event.currentTarget.value);
			if (!(handle && role)) {
				return;
			}
			const current =
				field.state.value.find((item) => item.team === handle)?.roles ?? [];
			const roles = event.currentTarget.checked
				? [...current, role]
				: current.filter((value) => value !== role);
			field.handleChange([
				...field.state.value.filter((item) => item.team !== handle),
				...(roles.length ? [{ roles, team: handle }] : []),
			]);
		},
		[field]
	);
	return (
		<fieldset className="token-permissions">
			<legend>Team permissions</legend>
			{teams.length ? (
				teams.map((team, teamIndex) => {
					const selected =
						field.state.value.find((item) => item.team === team.handle)
							?.roles ?? [];
					return (
						<fieldset className="token-team" key={team.handle}>
							<legend>
								<span className="token-team-heading">
									<strong>{team.name}</strong>{" "}
									<span className="muted mono">{team.handle}</span>
								</span>
							</legend>
							<div className="permission-options">
								{TEAM_ROLE_OPTIONS.filter(
									(option) =>
										team.roles.includes(option.value) ||
										selected.includes(option.value)
								).map((option, optionIndex) => (
									<PermissionOption
										aria-describedby={error ? `${id}-error` : undefined}
										aria-invalid={error ? true : undefined}
										checked={selected.includes(option.value)}
										data-team={team.handle}
										description={option.description}
										key={option.value}
										label={option.label}
										name={`${field.name}.${team.handle}`}
										onBlur={field.handleBlur}
										onChange={change}
										ref={
											teamIndex === 0 && optionIndex === 0
												? inputRef
												: undefined
										}
										type="checkbox"
										value={option.value}
									/>
								))}
							</div>
						</fieldset>
					);
				})
			) : (
				<p className="muted">You are not a member of any teams.</p>
			)}
			{error ? <FormError id={`${id}-error`} message={error} /> : null}
		</fieldset>
	);
}
