import { useCallback } from "react";
import type { SSHKey } from "../../../lib/api";
import { keyLabel } from "../../../lib/format";
export function KeyRow({
	sshKey,
	confirming,
	busy,
	onCancel,
	onRemove,
	onConfirm,
}: {
	sshKey: SSHKey;
	confirming: boolean;
	busy: boolean;
	onCancel: () => void;
	onRemove: (key: SSHKey) => void;
	onConfirm: (fingerprint: string) => void;
}) {
	const remove = useCallback(() => onRemove(sshKey), [onRemove, sshKey]);
	const confirm = useCallback(
		() => onConfirm(sshKey.fingerprint),
		[onConfirm, sshKey.fingerprint]
	);
	return (
		<li className={`row-item key ${confirming ? "confirm" : ""}`}>
			{confirming ? (
				<>
					<span className="key-q">
						Remove {keyLabel(sshKey)}? New machines won't accept it, and
						bare-metal servers stop accepting it at once.
					</span>
					<span className="key-acts">
						<button className="btn-text" onClick={onCancel} type="button">
							Keep
						</button>
						<button
							className="btn-text danger"
							disabled={busy}
							onClick={remove}
							type="button"
						>
							Remove
						</button>
					</span>
				</>
			) : (
				<>
					<span className="mono">{keyLabel(sshKey)}</span>
					<span className="muted">{sshKey.type.replace("ssh-", "")}</span>
					<button
						aria-label={`Remove ${keyLabel(sshKey)}`}
						className="btn-text key-x"
						onClick={confirm}
						type="button"
					>
						Remove
					</button>
				</>
			)}
		</li>
	);
}
