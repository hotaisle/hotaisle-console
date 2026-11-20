import type { ChangeEvent, Ref } from "react";
import { useCallback, useId } from "react";
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
		<fieldset className="token-permissions token-account-access">
			<legend>Account access</legend>
			<div className="permission-options">
				<PermissionOption
					checked={field.state.value === "user"}
					description="Does not grant access to team resources."
					label="Read account details"
					name={field.name}
					onChange={change}
					type="radio"
					value="user"
				/>
				<PermissionOption
					checked={field.state.value === "owner"}
					description="Includes creating and revoking your personal tokens."
					label="Manage account and API tokens"
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
			if (
				event.currentTarget.checked &&
				!teams.find((team) => team.handle === handle)?.roles.includes(role)
			) {
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
		[field, teams]
	);
	return (
		<fieldset className="token-permissions">
			<legend>Team permissions</legend>
			<p className="hint" id={`${id}-help`}>
				Select access for each team. Leave a row unchecked for no access.
				Unavailable permissions are not part of your membership.
			</p>
			{teams.length ? (
				teams.map((team, teamIndex) => {
					const selected =
						field.state.value.find((item) => item.team === team.handle)
							?.roles ?? [];
					return (
						<fieldset
							aria-label={`${team.name} ${team.handle}`}
							className="token-team"
							key={team.handle}
						>
							<div className="token-team-heading">
								<strong>{team.name}</strong>
								<span className="muted mono">{team.handle}</span>
							</div>
							{TEAM_ROLE_OPTIONS.map((option, optionIndex) => (
								<PermissionOption
									aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
									aria-invalid={error ? true : undefined}
									checked={selected.includes(option.value)}
									data-team={team.handle}
									description={option.description}
									disabled={
										!(
											team.roles.includes(option.value) ||
											selected.includes(option.value)
										)
									}
									key={option.value}
									label={option.label}
									name={`${field.name}.${team.handle}`}
									onBlur={field.handleBlur}
									onChange={change}
									ref={
										teamIndex === 0 && optionIndex === 0 ? inputRef : undefined
									}
									type="checkbox"
									value={option.value}
								/>
							))}
						</fieldset>
					);
				})
			) : (
				<p className="muted">You are not a member of any teams.</p>
			)}
			<aside aria-label="Permission key" className="team-permission-key">
				<dl>
					{TEAM_ROLE_OPTIONS.map((option) => (
						<div key={option.value}>
							<dt>{option.label}:</dt>
							<dd>{option.description}</dd>
						</div>
					))}
				</dl>
			</aside>
			{error ? <FormError id={`${id}-error`} message={error} /> : null}
		</fieldset>
	);
}
