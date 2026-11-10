import { useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { CopyButton } from "../../components/ui/copy-button";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/error-message";
import { VaultIdentity } from "./vault-identity";

export function ApiKeySignIn({
	onConnected,
}: {
	onConnected: () => Promise<void>;
}) {
	const [error, setError] = useState("");
	const form = useAppForm({
		defaultValues: { confirmation: "", key: "", passphrase: "" },
		onSubmit: async ({ value, formApi }) => {
			setError("");
			try {
				await api.signInWithKey(value.key.trim(), value.passphrase);
				formApi.reset();
				await onConnected();
			} catch (reason) {
				setError(errorMessage(reason));
			} finally {
				formApi.resetField("passphrase");
				formApi.resetField("confirmation");
			}
		},
		validators: {
			onSubmit: ({ value }) => {
				const key = value.key.trim() ? undefined : "Enter your API key.";
				const confirmation =
					value.passphrase === value.confirmation
						? undefined
						: "The passphrases must match.";
				return key || confirmation
					? { fields: { confirmation, key } }
					: undefined;
			},
		},
	});
	return (
		<>
			<h1>Sign in with an API key</h1>
			<p className="lede">
				Connect with your Hot Aisle API key. We'll save it encrypted on this
				device, protected by a passphrase only you know.
			</p>
			<div className="cmd">
				<code>ssh admin.hotaisle.app</code>
				<CopyButton text="ssh admin.hotaisle.app" />
			</div>
			<p className="hint">
				Create a key under your account in the terminal app, then paste it
				below.
			</p>
			<div className="pasterow key-connect-input">
				<form.AppField name="key">
					{(field) => (
						<field.TextField
							autoCapitalize="none"
							autoComplete="off"
							autoCorrect="off"
							id="api-key"
							label="API key"
							required
							spellCheck={false}
							type="password"
						/>
					)}
				</form.AppField>
			</div>
			<Form
				autoComplete="on"
				className="stack"
				id="save-api-key"
				name="save-api-key"
				onSubmit={form.handleSubmit}
			>
				<VaultIdentity />
				<div className="auth-passphrases">
					<form.AppField name="passphrase">
						{(field) => (
							<field.TextField
								autoComplete="new-password"
								id="new-password"
								label="Local unlock passphrase"
								minLength={12}
								required
								type="password"
							/>
						)}
					</form.AppField>
					<form.AppField name="confirmation">
						{(field) => (
							<field.TextField
								autoComplete="new-password"
								id="confirm-password"
								label="Repeat passphrase"
								minLength={12}
								required
								type="password"
							/>
						)}
					</form.AppField>
				</div>
				<p className="hint">
					Use at least 12 characters. You'll need this passphrase after
					reloading. It is never sent to the server and cannot be recovered.
				</p>
				<p className="hint">
					Save your unlock passphrase in your password manager for
					console.hotaisle.app.
				</p>
				<p className="hint">
					While unlocked, your key passes through the console proxy to
					authenticate each Hot Aisle request. The proxy does not save it.
				</p>
				<div className="pasterow">
					<form.AppForm>
						<form.SubmitButton pendingText="Encrypting and connecting…">
							Save key and connect
						</form.SubmitButton>
					</form.AppForm>
				</div>
				<FormError message={error} />
			</Form>
		</>
	);
}
