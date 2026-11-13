import { useId, useRef, useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { api, type Team, type TeamRole } from "../../lib/api";
import { errorMessage } from "../../lib/error-message";
import { TeamRoleFields } from "./team-role-fields";

const encoder = new TextEncoder();
const defaults = () => ({ email: "", name: "", roles: ["user"] as TeamRole[] });

export function InviteTeamMemberForm({
	team,
	onInvited,
}: {
	team: Team;
	onInvited: () => Promise<void>;
}) {
	const heading = useId();
	const name = useRef<HTMLInputElement>(null);
	const email = useRef<HTMLInputElement>(null);
	const roles = useRef<HTMLInputElement>(null);
	const [error, setError] = useState("");
	const [sentTo, setSentTo] = useState("");
	const form = useAppForm({
		defaultValues: defaults(),
		onSubmit: async ({ value }) => {
			setError("");
			setSentTo("");
			try {
				await api.inviteTeamMember(team.handle, {
					email: value.email.trim(),
					name: value.name.trim(),
					roles: value.roles,
				});
			} catch (reason) {
				setError(errorMessage(reason));
				return;
			}
			setSentTo(value.email.trim());
			form.reset(defaults());
			// The API returns 204. Reload authoritative members rather than inventing one.
			try {
				await onInvited();
			} catch {
				setError(
					"The invitation was sent, but the member list could not be refreshed. Reload this page to try again."
				);
			}
		},
		onSubmitInvalid: ({ formApi }) => {
			if (formApi.getFieldMeta("name")?.errors.length) {
				name.current?.focus();
			} else if (formApi.getFieldMeta("email")?.errors.length) {
				email.current?.focus();
			} else {
				roles.current?.focus();
			}
		},
		validators: {
			onSubmit: ({ value }) => {
				if (!value.name.trim()) {
					return { fields: { name: "Enter their name." } };
				}
				if (encoder.encode(value.name.trim()).length > 100) {
					return { fields: { name: "Use a name of 100 bytes or fewer." } };
				}
				if (!value.email.trim()) {
					return { fields: { email: "Enter their email address." } };
				}
				if (encoder.encode(value.email.trim()).length > 254) {
					return { fields: { email: "Use an email of 254 bytes or fewer." } };
				}
				if (value.roles.length === 0) {
					return { fields: { roles: "Choose at least one permission." } };
				}
			},
		},
	});
	return (
		<Form
			aria-labelledby={heading}
			className="team-form team-invite-form stack"
			onSubmit={form.handleSubmit}
		>
			<h3 className="team-section-title" id={heading}>
				Invite someone
			</h3>
			<form.AppField name="name">
				{(field) => (
					<field.TextField
						autoComplete="section-team-invite name"
						label="Name"
						maxLength={100}
						ref={name}
						required
					/>
				)}
			</form.AppField>
			<form.AppField name="email">
				{(field) => (
					<field.TextField
						autoCapitalize="none"
						autoComplete="section-team-invite email"
						autoCorrect="off"
						label="Email address"
						maxLength={254}
						ref={email}
						required
						spellCheck={false}
						type="email"
					/>
				)}
			</form.AppField>
			<form.AppField name="roles">
				{() => <TeamRoleFields inputRef={roles} />}
			</form.AppField>
			<FormError message={error} />
			{sentTo ? <p role="status">Invitation sent to {sentTo}.</p> : null}
			<form.AppForm>
				<form.SubmitButton pendingText="Sending email invitation…">
					Send email invitation
				</form.SubmitButton>
			</form.AppForm>
		</Form>
	);
}
