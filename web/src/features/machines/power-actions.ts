import type { PowerAction } from "../../lib/api";

export interface PowerOperation {
	action: PowerAction;
	description: string;
	label: string;
	warning: string;
}

export const VM_POWER_OPERATIONS: readonly PowerOperation[] = [
	{
		action: "start",
		description: "Start a stopped virtual machine.",
		label: "Start VM",
		warning:
			"Start this virtual machine? Billing continues until you delete it.",
	},
	{
		action: "reboot",
		description: "Shut down the guest OS cleanly, then restart.",
		label: "Graceful reboot",
		warning:
			"This interrupts running jobs while the VM restarts. Billing continues.",
	},
	{
		action: "hard-reset",
		description: "Immediately reset the VM's hardware.",
		label: "Hard reset",
		warning:
			"This resets the VM without a clean shutdown. Unsaved data may be lost and disk writes may be corrupted. Billing continues.",
	},
];

export const METAL_POWER_OPERATIONS: readonly PowerOperation[] = [
	{
		action: "start",
		description: "Turn on a powered-off server.",
		label: "Power on",
		warning: "Power on this server? Billing continues until you release it.",
	},
	{
		action: "shutdown",
		description: "Ask the operating system to shut down cleanly.",
		label: "Graceful shutdown",
		warning:
			"This shuts down the server and interrupts running jobs. It remains assigned to your team and billing continues until you release it.",
	},
	{
		action: "stop",
		description: "Immediately power off the server.",
		label: "Force shutdown",
		warning:
			"This cuts power without a clean shutdown. Unsaved data may be lost and disk writes may be corrupted. Billing continues until you release the server.",
	},
	{
		action: "reboot",
		description: "Restart without fully powering off.",
		label: "Warm reboot",
		warning:
			"This restarts the server and interrupts running jobs. Billing continues.",
	},
	{
		action: "hard-reset",
		description: "Power off the server, then restart it.",
		label: "Cold reboot",
		warning:
			"This power cycles the server and interrupts running jobs. Unsaved data may be lost. Billing continues.",
	},
	{
		action: "ac-reset",
		description: "Reset AC power. The server must already be off.",
		label: "AC reset",
		warning:
			"The server must be powered off first. Its management controller will be unavailable for several minutes during the reset. Billing continues.",
	},
];
