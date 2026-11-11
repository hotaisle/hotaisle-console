import { useCallback } from "react";
import type { SSHKey } from "../../../lib/api";
import { keyLabel } from "../../../lib/format";
export function KeyRow({
	sshKey,
	busy,
	onConfirm,
}: {
	sshKey: SSHKey;
	busy: boolean;
	onConfirm: (fingerprint: string) => void;
}) {
	const confirm = useCallback(
		() => onConfirm(sshKey.fingerprint),
		[onConfirm, sshKey.fingerprint]
	);
	return (
		<li className="row-item key">
			<span className="mono">{keyLabel(sshKey)}</span>
			<span className="muted">{sshKey.type.replace("ssh-", "")}</span>
			<button
				aria-label={`Remove ${keyLabel(sshKey)}`}
				className="btn-text key-x"
				disabled={busy}
				onClick={confirm}
				type="button"
			>
				Remove
			</button>
		</li>
	);
}
