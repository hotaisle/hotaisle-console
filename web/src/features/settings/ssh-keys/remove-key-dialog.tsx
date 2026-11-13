import { useId, useRef } from "react";
import { FormError } from "../../../components/forms/form-error";
import { Modal } from "../../../components/ui/modal";
import type { SSHKey } from "../../../lib/api";
import { keyLabel } from "../../../lib/format";

export function RemoveKeyDialog({
	sshKey,
	busy,
	error,
	onClose,
	onRemove,
}: {
	sshKey: SSHKey;
	busy: boolean;
	error?: string;
	onClose: () => void;
	onRemove: () => void;
}) {
	const keep = useRef<HTMLButtonElement>(null);
	const descriptionId = useId();
	return (
		<Modal
			busy={busy}
			descriptionId={descriptionId}
			initialFocus={keep}
			onClose={onClose}
			title="Remove SSH key?"
		>
			<div className="remove-key-details">
				<strong>{keyLabel(sshKey)}</strong>
				<code>{sshKey.fingerprint}</code>
			</div>
			<p className="muted" id={descriptionId}>
				New machines won't accept this key. Bare-metal servers stop accepting it
				immediately.
			</p>
			{error ? <FormError message={error} /> : null}

			<form className="modal-actions" method="dialog">
				<button className="btn" disabled={busy} ref={keep} type="submit">
					Keep key
				</button>
				<button
					className="btn destructive"
					disabled={busy}
					onClick={onRemove}
					type="button"
				>
					{busy ? "Removing…" : "Remove key"}
				</button>
			</form>
		</Modal>
	);
}
