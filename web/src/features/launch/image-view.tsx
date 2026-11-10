import { Form } from "../../components/forms/form";
import { useAppForm } from "../../components/forms/use-app-form";

export const HTTPS_URL_PATTERN = /^https:\/\/\S+$/u;

export function ImageView({
	value,
	onSave,
}: {
	value: string;
	onSave: (url: string) => void;
}) {
	const form = useAppForm({
		defaultValues: { url: value },
		onSubmit: ({ value: data }) => onSave(data.url.trim()),
	});
	return (
		<Form className="stack" onSubmit={form.handleSubmit}>
			<p className="muted">
				It runs on first boot. Hot Aisle fetches it from this link, so it must
				be public over https.
			</p>
			<form.AppField name="url">
				{(field) => (
					<field.TextField
						autoCapitalize="none"
						autoComplete="url"
						autoCorrect="off"
						className="url"
						label="Cloud-init URL"
						pattern={HTTPS_URL_PATTERN.source}
						placeholder="https://example.com/user-data.yaml"
						required
						spellCheck={false}
						type="url"
					/>
				)}
			</form.AppField>
			<form.AppForm>
				<form.SubmitButton className="btn primary big" pendingText="Saving…">
					Use this file
				</form.SubmitButton>
			</form.AppForm>
		</Form>
	);
}
