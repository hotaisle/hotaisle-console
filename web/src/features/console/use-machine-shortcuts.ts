import { machineKey } from "../../../../shared/machine-identity";
import { useToast } from "../../components/ui/toast";
import { useShortcut } from "../../hooks/use-shortcut";
import type { VM, VMState } from "../../lib/api";
import { sshCommand } from "../../lib/format";
import { phaseOf } from "../machines/state";

export function useMachineShortcuts(
	team: string,
	home: boolean,
	focused: VM | undefined,
	states: Record<string, VMState | undefined>
) {
	const toast = useToast();
	const command =
		focused?.ssh_access &&
		phaseOf(focused, states[machineKey(team, focused)]) === "running"
			? sshCommand(focused.ssh_access)
			: "";
	useShortcut(
		"C",
		() => {
			navigator.clipboard.writeText(command).then(
				() => toast("Copied the SSH command.", "info", command),
				() => toast("Could not copy the SSH command.", "err")
			);
		},
		{
			enabled: home && !!command,
			meta: { name: "Copy this machine’s SSH command" },
		}
	);
}
