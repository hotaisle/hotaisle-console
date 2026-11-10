import { useMutation } from "@tanstack/react-query";
import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { useSessionActions } from "../../hooks/use-session";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/error-message";
import { AuthShell } from "./auth-shell";
import { VaultIdentity } from "./vault-identity";

export function UnlockKey() {
	const [error, setError] = useState("");
	const { connected } = useSessionActions();
	const router = useRouter();
	const search = useSearch({ from: "__root__" });
	const form = useAppForm({
		defaultValues: { passphrase: "" },
		onSubmit: async ({ value, formApi }) => {
			setError("");
			try {
				await api.unlockKey(value.passphrase);
				formApi.reset();
				await connected();
			} catch (reason) {
				setError(errorMessage(reason));
			} finally {
				formApi.reset();
			}
		},
	});
	const forget = useMutation({
		mutationFn: async () => {
			api.forgetKey();
			await connected();
			await router.navigate({ search, to: "/sign-in/key" });
		},
	});
	const remove = useCallback(() => forget.mutate(), [forget.mutate]);
	return (
		<AuthShell
			footer={
				<Link className="btn-text" search={search} to="/sign-in">
					Sign in another way
				</Link>
			}
		>
			<h1>Unlock saved key</h1>
			<p className="lede">
				Your API key is saved in this browser. Enter your local passphrase to
				unlock it for this session.
			</p>
			<Form
				autoComplete="on"
				className="stack"
				id="unlock-api-key"
				name="unlock-api-key"
				onSubmit={form.handleSubmit}
			>
				<VaultIdentity />
				<div className="pasterow">
					<form.AppField name="passphrase">
						{(field) => (
							<field.TextField
								autoComplete="current-password"
								id="current-password"
								label="Unlock passphrase"
								required
								type="password"
							/>
						)}
					</form.AppField>
					<form.AppForm>
						<form.SubmitButton pendingText="Unlocking…">
							Unlock
						</form.SubmitButton>
					</form.AppForm>
				</div>
				<FormError message={error || forget.error?.message || ""} />
			</Form>
			<p className="hint">
				Forgot the passphrase? Remove the saved copy, then enter your API key
				again.
			</p>
			<button
				className="btn-text"
				disabled={forget.isPending}
				onClick={remove}
				type="button"
			>
				Forget saved key
			</button>
		</AuthShell>
	);
}
