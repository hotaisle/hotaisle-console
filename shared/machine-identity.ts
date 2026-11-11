export interface MachineRef {
	deployment_id?: string;
	metal?: boolean;
	name: string;
}

export const machineKind = (machine: MachineRef) =>
	machine.metal ? "bare_metal" : "virtual_machines";

/** Both API collections accept the immutable rental assignment ID as their path selector. */
export const machineAddress = (machine: MachineRef) =>
	machine.deployment_id || machine.name;

/** Names are a compatibility fallback for legacy records, not globally unique IDs. */
export const machineKey = (team: string, machine: MachineRef) =>
	JSON.stringify([team, machineKind(machine), machineAddress(machine)]);

export function parseMachineKey(value: string) {
	try {
		const parts: unknown = JSON.parse(value);
		if (
			Array.isArray(parts) &&
			parts.length === 3 &&
			typeof parts[0] === "string" &&
			parts[0] &&
			(parts[1] === "virtual_machines" || parts[1] === "bare_metal") &&
			typeof parts[2] === "string" &&
			parts[2]
		) {
			return {
				metal: parts[1] === "bare_metal",
				name: parts[2],
				team: parts[0],
			};
		}
	} catch {
		// Legacy URLs contain a name, not an encoded identity.
	}
}
