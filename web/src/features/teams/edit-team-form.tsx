import { useRef, useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { api, type Team } from "../../lib/api";
import { errorMessage } from "../../lib/error-message";

const encoder = new TextEncoder();
export function EditTeamForm({
	team,
	onSaved,
}: {
	team: Team;
	onSaved: (team: Team) => Promise<void>;
}) {
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);
	const name = useRef<HTMLInputElement>(null);
	const description = useRef<HTMLInputElement>(null);
	const form = useAppForm({
		defaultValues: { description: team.description ?? "", name: team.name },
		onSubmit: async ({ value }) => {
			setError("");
			setSaved(false);
			const patch: { name?: string; description?: string } = {};
			if (value.name.trim() !== team.name) {
				patch.name = value.name.trim();
			}
			if (value.description !== (team.description ?? "")) {
				patch.description = value.description;
			}
			if (Object.keys(patch).length === 0) {
				return;
			}
			try {
				const updated = await api.updateTeam(team.handle, patch);
				await onSaved(updated);
				form.reset({
					description: updated.description ?? "",
					name: updated.name,
				});
				setSaved(true);
			} catch (reason) {
				setError(errorMessage(reason));
			}
		},
		onSubmitInvalid: ({ formApi }) => {
			const target = formApi.getFieldMeta("name")?.errors.length
				? name
				: description;
			target.current?.focus();
		},
		validators: {
			onSubmit: ({ value }) => {
				if (!value.name.trim()) {
					return { fields: { name: "Enter a team name." } };
				}
				if (encoder.encode(value.name.trim()).length > 100) {
					return {
						fields: { name: "Use a shorter team name (100 bytes or fewer)." },
					};
				}
				if (encoder.encode(value.description).length > 200) {
					return {
						fields: {
							description: "Use a shorter description (200 bytes or fewer).",
						},
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
						ref={name}
						required
					/>
				)}
			</form.AppField>
			<form.AppField name="description">
				{(field) => (
					<field.TextField
						autoComplete="off"
						label="Description"
						maxLength={200}
						ref={description}
					/>
				)}
			</form.AppField>
			<p className="hint">
				Team handle: <code>{team.handle}</code>
			</p>
			<FormError message={error} />
			{saved ? <p role="status">Team details saved.</p> : null}
			<form.AppForm>
				<form.SubmitButton pendingText="Saving…">
					Save changes
				</form.SubmitButton>
			</form.AppForm>
		</Form>
	);
}
