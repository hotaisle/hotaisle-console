import { useCallback, useEffect, useRef, useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { ButtonLabels } from "../../components/ui/button-labels";
import type { TeamMember, TeamRole } from "../../lib/api";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/error-message";
import { TeamRoleFields } from "./team-role-fields";

function sameRoles(left: TeamRole[], right: TeamRole[]) {
	return (
		left.length === right.length && left.every((role) => right.includes(role))
	);
}

const isSubmitting = (state: { isSubmitting: boolean }) => state.isSubmitting;

export function EditMemberPermissions({
	member,
	team,
	lastOwner,
	onUpdated,
}: {
	member: TeamMember;
	team: string;
	lastOwner: boolean;
	onUpdated: () => Promise<void>;
}) {
	const roles = useRef<HTMLInputElement>(null);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);
	const [baseline, setBaseline] = useState(member.roles);
	useEffect(() => {
		setBaseline(member.roles);
	}, [member.roles]);
	const form = useAppForm({
		defaultValues: { roles: baseline },
		onSubmit: async ({ value }) => {
			setError("");
			setSaved(false);
			if (sameRoles(value.roles, baseline)) {
				return;
			}
			try {
				const updated = await api.updateTeamMember(
					team,
					member.email,
					value.roles
				);
				setBaseline(updated.roles);
				form.reset({ roles: updated.roles });
				setSaved(true);
			} catch (reason) {
				setError(errorMessage(reason));
				return;
			}
			try {
				await onUpdated();
			} catch {
				setError(
					"Permissions saved, but team details could not be refreshed. Reload this page to update them."
				);
			}
		},
		onSubmitInvalid: () => roles.current?.focus(),
		validators: {
			onSubmit: ({ value }) => {
				if (value.roles.length === 0) {
					return {
						fields: { roles: "Keep at least one permission for this member." },
					};
				}
				if (lastOwner && !value.roles.includes("owner")) {
					return {
						fields: {
							roles:
								"Assign another current member as an owner before removing this permission.",
						},
					};
				}
			},
		},
	});
	const hasChanges = useCallback(
		(state: { values: { roles: TeamRole[] } }) =>
			!sameRoles(state.values.roles, baseline),
		[baseline]
	);
	const cancel = useCallback(() => {
		form.reset({ roles: baseline });
		setError("");
		setSaved(false);
	}, [form, baseline]);
	return (
		<Form
			aria-label={`Permissions for ${member.email}`}
			className="team-member-form"
			onSubmit={form.handleSubmit}
		>
			<form.Subscribe selector={isSubmitting}>
				{(pending) => (
					<fieldset
						aria-busy={pending}
						className="team-member-fields"
						inert={pending}
					>
						<legend className="visually-hidden">Edit member permissions</legend>
						<form.AppField name="roles">
							{() => <TeamRoleFields compact inputRef={roles} />}
						</form.AppField>
						<form.Subscribe selector={hasChanges}>
							{(changed) => (
								<div className="team-member-actions">
									<form.AppForm>
										<form.SubmitButton
											disabled={!changed}
											pendingText="Saving…"
										>
											<ButtonLabels
												active={saved && !changed}
												alternate="Saved"
											>
												Save
											</ButtonLabels>
										</form.SubmitButton>
									</form.AppForm>
									<button
										className="btn"
										disabled={!changed}
										onClick={cancel}
										type="button"
									>
										Cancel
									</button>
									<span className="visually-hidden" role="status">
										{saved && !changed ? "Permissions saved." : ""}
									</span>
								</div>
							)}
						</form.Subscribe>
					</fieldset>
				)}
			</form.Subscribe>
			<FormError message={error} />
		</Form>
	);
}
