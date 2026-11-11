import { useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { APIError, api, type Team } from "../../lib/api";
import { errorMessage } from "../../lib/error-message";

const encoder = new TextEncoder();
const HANDLE_PATTERN = "[a-z0-9](?:[a-z0-9_\\-]{0,98}[a-z0-9])?";
export function CreateTeamForm({
	onCreated,
}: {
	onCreated: (team: Team) => Promise<void>;
}) {
	const [error, setError] = useState("");
	const form = useAppForm({
		defaultValues: { handle: "", name: "" },
		onSubmit: async ({ value }) => {
			setError("");
			try {
				const team = await api.createTeam({
					handle: value.handle,
					name: value.name.trim(),
				});
				await onCreated(team);
			} catch (reason) {
				setError(
					reason instanceof APIError && reason.status === 403
						? "Your current sign-in cannot create teams. Sign in with email or use an API key with account owner access."
						: errorMessage(reason)
				);
			}
		},
		validators: {
			onSubmit: ({ value }) => {
				if (!value.name.trim()) {
					return { fields: { name: "Enter a team name." } };
				}
				if (encoder.encode(value.name.trim()).length > 100) {
					return {
						fields: { name: "This name is too long. Use a shorter name." },
					};
				}
			},
		},
	});
	return (
		<Form className="team-form stack" onSubmit={form.handleSubmit}>
			<form.AppField name="name">
				{(field) => (
					<field.TextField
						autoComplete="organization"
						label="Team name"
						maxLength={100}
						required
					/>
				)}
			</form.AppField>
			<form.AppField name="handle">
				{(field) => (
					<field.TextField
						autoCapitalize="none"
						autoComplete="off"
						autoCorrect="off"
						help="A unique handle for your team. Use lowercase letters, numbers, hyphens, or underscores; start and end with a letter or number."
						label="Team handle"
						maxLength={100}
						pattern={HANDLE_PATTERN}
						required
						spellCheck={false}
					/>
				)}
			</form.AppField>
			<FormError message={error} />
			<form.AppForm>
				<form.SubmitButton pendingText="Creating team…">
					Create team
				</form.SubmitButton>
			</form.AppForm>
		</Form>
	);
}
