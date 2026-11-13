import { useCallback, useId, useRef, useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import {
	type APIToken,
	type APITokenRequest,
	api,
	type Team,
} from "../../lib/api";
import { errorMessage } from "../../lib/error-message";
import { TokenAccountAccess, TokenTeamAccess } from "./token-fields";

function grantSignature(teams: APITokenRequest["teams"] = []) {
	return JSON.stringify(
		teams
			.filter((team) => team.roles.length)
			.map((team) => ({
				roles: [...new Set(team.roles)].sort(),
				team: team.team,
			}))
			.sort((left, right) => left.team.localeCompare(right.team))
	);
}

function tokenHasChanges(value: APITokenRequest, token: APIToken) {
	return (
		value.label.trim() !== token.label.trim() ||
		value.user_role !== token.user_role ||
		grantSignature(value.teams) !==
			grantSignature(
				token.teams.map((team) => ({
					roles: team.roles,
					team: team.handle,
				}))
			)
	);
}

export function TokenForm({
	token,
	teams,
	onSaved,
	requiredTeam,
}: {
	token?: APIToken;
	teams: Team[];
	onSaved: (details: APIToken, value?: string) => Promise<void>;
	requiredTeam?: string;
}) {
	const heading = useId();
	const label = useRef<HTMLInputElement>(null);
	const permission = useRef<HTMLInputElement>(null);
	const [error, setError] = useState("");
	const changed = useCallback(
		(state: { values: APITokenRequest }) =>
			!!state.values.label.trim() &&
			(!token || tokenHasChanges(state.values, token)),
		[token]
	);
	const initialTeams =
		token?.teams.map((team) => ({ roles: team.roles, team: team.handle })) ??
		[];
	const form = useAppForm({
		defaultValues: {
			label: token?.label ?? "",
			teams: initialTeams,
			user_role: token?.user_role ?? "user",
		},
		onSubmit: async ({ value }) => {
			if (token && !tokenHasChanges(value, token)) {
				return;
			}
			setError("");
			const request: APITokenRequest = {
				label: value.label.trim(),
				teams:
					!token || grantSignature(value.teams) !== grantSignature(initialTeams)
						? value.teams
						: undefined,
				user_role: value.user_role,
			};
			try {
				// Keep the one-time secret out of the mutation/query cache and form state.
				const response = token
					? await api.updateAPIToken(token.prefix, request)
					: await api.createAPIToken(request);
				const details: APIToken = {
					label: response.label,
					prefix: response.prefix,
					teams: response.teams,
					user_role: response.user_role,
				};
				const secret =
					"token" in response && typeof response.token === "string"
						? response.token
						: undefined;
				if (!(token || secret)) {
					throw new Error(
						"The API did not return the new token value. Refresh your token list before trying again."
					);
				}
				await onSaved(details, secret);
			} catch (reason) {
				setError(errorMessage(reason));
			}
		},
		onSubmitInvalid: ({ formApi }) => {
			const target = formApi.getFieldMeta("label")?.errors.length
				? label
				: permission;
			target.current?.focus();
		},
		validators: {
			onSubmit: ({ value }) => {
				if (!value.label.trim()) {
					return { fields: { label: "Enter a label for this token." } };
				}
				if (
					requiredTeam &&
					!value.teams.some(
						(team) => team.team === requiredTeam && team.roles.length
					)
				) {
					return {
						fields: { teams: "Choose at least one permission for this team." },
					};
				}
			},
		},
	});
	return (
		<Form
			aria-label={token ? "Edit token" : undefined}
			aria-labelledby={token ? undefined : heading}
			className="team-form token-form stack"
			onSubmit={form.handleSubmit}
		>
			{token ? null : (
				<h2 className="team-section-title" id={heading}>
					Create a token
				</h2>
			)}
			<form.AppField name="label">
				{(field) => (
					<field.TextField
						autoComplete="off"
						label="Label"
						ref={label}
						required
					/>
				)}
			</form.AppField>
			<form.AppField name="user_role">
				{() => <TokenAccountAccess />}
			</form.AppField>
			<form.AppField name="teams">
				{() => <TokenTeamAccess inputRef={permission} teams={teams} />}
			</form.AppField>
			<FormError message={error} />
			<form.AppForm>
				<form.Subscribe selector={changed}>
					{(hasChanges) => (
						<form.SubmitButton
							className="btn primary"
							disabled={!hasChanges}
							pendingText={token ? "Saving…" : "Creating…"}
						>
							{token ? "Save token" : "Create token"}
						</form.SubmitButton>
					)}
				</form.Subscribe>
			</form.AppForm>
		</Form>
	);
}
