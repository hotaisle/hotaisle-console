import { useCallback } from "react";
import { sshPortOption, validSSHName, validSSHPort } from "../../lib/format";
import type { TripContext } from "./use-trip";

export function ConnectionActions({ context }: { context: TripContext }) {
	const { ssh, host, vm, record, copy } = context;
	const config = useCallback(() => {
		if (ssh && host && validSSHPort(ssh.port) && validSSHName(vm.name)) {
			copy(
				`Host ${vm.name}\n  HostName ${host}${ssh.port === 22 ? "" : `\n  Port ${ssh.port}`}\n  User hotaisle\n`,
				"the SSH config entry"
			);
		}
	}, [ssh, host, vm.name, copy]);
	const forward = useCallback(() => {
		if (ssh && host && validSSHPort(ssh.port)) {
			copy(
				`ssh -N -L 8000:127.0.0.1:8000${sshPortOption(ssh.port)} hotaisle@${host}`,
				"the vLLM port forward"
			);
		}
	}, [ssh, host, copy]);
	return (
		<div className="modal-actions">
			<button
				className="btn"
				disabled={
					!(ssh && host && validSSHPort(ssh.port) && validSSHName(vm.name))
				}
				onClick={config}
				type="button"
			>
				Copy SSH config
			</button>
			{record?.image === "vllm" ? (
				<button
					className="btn"
					disabled={!(ssh && host && validSSHPort(ssh.port))}
					onClick={forward}
					type="button"
				>
					Copy vLLM port forward
				</button>
			) : null}
		</div>
	);
}
