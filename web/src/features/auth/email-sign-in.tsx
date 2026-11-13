import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { api, type PendingEmailLogin } from "../../lib/api";
import { errorMessage } from "../../lib/error-message";

export function EmailSignIn({
	onSent,
}: {
	onSent: (pending: PendingEmailLogin) => void;
}) {
	const client = useQueryClient();
	const [error, setError] = useState("");
	const form = useAppForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			setError("");
			try {
				const data = await api.emailStart(value.email.trim());
				client.removeQueries({ queryKey: ["auth", "approval"] });
				onSent(data);
			} catch (reason) {
				setError(errorMessage(reason));
			}
		},
	});
	return (
		<>
			<h1>Sign in</h1>
			<p className="lede">
				We'll email you a link. Open it and approve the sign-in, and this page
				signs in by itself.
			</p>
			<Form className="step-b" onSubmit={form.handleSubmit}>
				<div className="pasterow">
					<form.AppField name="email">
						{(field) => (
							<field.TextField
								autoCapitalize="none"
								autoComplete="email"
								autoCorrect="off"
								label="Email address"
								required
								spellCheck={false}
								type="email"
							/>
						)}
					</form.AppField>
					<form.AppForm>
						<form.SubmitButton pendingText="Sending">
							Email me a link
						</form.SubmitButton>
					</form.AppForm>
				</div>
				<FormError message={error} />
			</Form>
		</>
	);
}
