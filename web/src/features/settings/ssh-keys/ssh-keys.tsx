import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Form } from "../../../components/forms/form";
import { useAppForm } from "../../../components/forms/use-app-form";
import { useToast } from "../../../components/ui/toast";
import { APIError, api, type SSHKey } from "../../../lib/api";
import { keyLabel } from "../../../lib/format";
import { sound } from "../../../lib/sound";
import { KeyRow } from "./key-row";
import { SshKeyHelp } from "./ssh-key-help";

function keyError(error: Error) {
	if (error instanceof APIError) {
		if (error.status === 409) {
			return "This public key is already registered with Hot Aisle. If it isn't listed on this account, sign in to the account that owns it or use a different public key.";
		}
		if (error.status === 403) {
			return "Your API key cannot change SSH keys. It needs the owner role.";
		}
	}
	return error.message;
}
export function SshKeys({
	keys,
	refresh,
	queryError,
}: {
	keys?: SSHKey[];
	refresh: () => Promise<void>;
	queryError?: Error;
}) {
	const toast = useToast();
	const [removing, setRemoving] = useState("");
	const reload = useMutation({ mutationFn: refresh });
	const retry = useCallback(() => reload.mutate(), [reload.mutate]);
	const add = useMutation({
		mutationFn: api.addKey,
		onError: async (reason) => {
			if (reason instanceof APIError && reason.status === 409) {
				try {
					await refresh();
				} catch {
					toast("Couldn't refresh your SSH keys. Try again.", "err");
				}
			}
		},
		onSuccess: async () => {
			await refresh();
			sound.tick();
			toast("Added your key.");
		},
	});
	const form = useAppForm({
		defaultValues: { publicKey: "" },
		onSubmit: async ({ value, formApi }) => {
			try {
				await add.mutateAsync(value.publicKey.trim());
				formApi.reset();
			} catch {
				// The mutation error is shown beside the form.
			}
		},
		validators: {
			onSubmit: ({ value }) =>
				value.publicKey.trim()
					? undefined
					: { fields: { publicKey: "Enter a public key." } },
		},
	});
	const removal = useMutation({
		mutationFn: (key: SSHKey) => api.removeKey(key.fingerprint),
		onSuccess: async (_, key) => {
			setRemoving("");
			await refresh();
			toast(`Removed ${keyLabel(key)}.`);
		},
	});
	const cancel = useCallback(() => setRemoving(""), []);
	const remove = useCallback(
		(key: SSHKey) => removal.mutate(key),
		[removal.mutate]
	);
	const error = add.error ?? removal.error ?? queryError ?? reload.error;
	return (
		<section
			aria-labelledby="ssh-keys-title"
			className="settings-ssh stack"
			id="ssh-keys"
		>
			<h2 className="group-h section-heading" id="ssh-keys-title">
				SSH keys
			</h2>
			<div className="group">
				<h3 className="group-h">On your account</h3>
				{keys && keys.length > 0 ? (
					<ul className="rows">
						{keys.map((key) => (
							<KeyRow
								busy={removal.isPending}
								confirming={removing === key.fingerprint}
								key={key.fingerprint}
								onCancel={cancel}
								onConfirm={setRemoving}
								onRemove={remove}
								sshKey={key}
							/>
						))}
					</ul>
				) : null}
				{keys?.length === 0 ? (
					<p className="muted">
						None yet. Add one below; every machine you launch will accept it.
					</p>
				) : null}
				{!keys && queryError ? (
					<p className="muted">Your SSH keys couldn't be loaded.</p>
				) : null}
				{keys || queryError ? null : (
					<p className="muted" role="status">
						Loading SSH keys…
					</p>
				)}
				{queryError ? (
					<button
						className="btn"
						disabled={reload.isPending}
						onClick={retry}
						type="button"
					>
						Try again
					</button>
				) : null}
			</div>
			<div className="group">
				<h3 className="group-h">Add a public key</h3>
				<Form className="pasterow" onSubmit={form.handleSubmit}>
					<form.AppField name="publicKey">
						{(field) => (
							<field.TextField
								autoCapitalize="none"
								autoCorrect="off"
								hideLabel
								label="Public key"
								placeholder="ssh-ed25519 AAAA…"
								required
								spellCheck={false}
							/>
						)}
					</form.AppField>
					<form.AppForm>
						<form.SubmitButton className="btn" pendingText="Adding…">
							Add
						</form.SubmitButton>
					</form.AppForm>
				</Form>
				{error ? (
					<p className="error" role="alert">
						{keyError(error)}
					</p>
				) : null}
				{keys?.length === 0 ? <SshKeyHelp /> : null}
			</div>
		</section>
	);
}
