import { minimumReservationMinutes } from "../../shared/availability";
import type { Offer, Specs, VM, VMState } from "../src/lib/api";

export type PreviewPhase = "assigned" | "setting-up" | "booting" | "running";
export interface PreviewMachine {
	bootMs?: number;
	cloudInit: boolean;
	createdAt: number;
	mode: PreviewPhase | "live";
	startedAt: number;
	vm: VM;
}
export function specs(count: number): Specs {
	return {
		cpu_cores: count * 13,
		cpus: { count: 1, manufacturer: "Intel", model: "Xeon Platinum 8470" },
		disk_capacity: count * 6 * 1024 ** 4,
		gpus: [{ count, manufacturer: "AMD", model: "MI300X" }],
		ram_capacity: count * 224 * 1024 ** 3,
	};
}
export function phase(machine: PreviewMachine, now: number): PreviewPhase {
	if (machine.mode !== "live") {
		return machine.mode;
	}
	const age = now - machine.startedAt;
	if (age < 1500) {
		return "assigned";
	}
	return machine.cloudInit && age < (machine.bootMs ?? 8000)
		? "booting"
		: "running";
}
export function machineView(machine: PreviewMachine, now: number): VM {
	const current = phase(machine, now);
	return {
		...machine.vm,
		ssh_access:
			current === "running"
				? {
						dns_name: `${machine.vm.name}.invalid`,
						ip_address: "192.0.2.42",
						port: 22,
					}
				: undefined,
		status:
			current === "setting-up" || current === "booting"
				? "rebuilding"
				: "ready",
	};
}
export function powerView(machine: PreviewMachine, now: number): VMState {
	const states: Record<PreviewPhase, string> = {
		assigned: "starting",
		booting: "starting",
		running: "running",
		"setting-up": "installing",
	};
	return { host: "preview-server-1", state: states[phase(machine, now)] };
}
export function available(machines: Iterable<PreviewMachine>): Offer[] {
	const counts = [...machines].map((machine) => machine.vm.gpus?.[0]?.count);
	return [1, 2, 4].map((count) => ({
		MinimumReservationMinutes: minimumReservationMinutes(specs(count)),
		OnDemandPrice: count * 299,
		Quantity: Math.max(0, 4 - counts.filter((owned) => owned === count).length),
		Specs: specs(count),
	}));
}
export function newMachine(
	name: string,
	count: number,
	mode: PreviewMachine["mode"],
	startedAt: number,
	cloudInit = true
): PreviewMachine {
	return {
		cloudInit,
		createdAt: startedAt,
		mode,
		startedAt,
		vm: {
			...specs(count),
			deployment_id: `deployment-${name}`,
			description: "",
			ip_address: "192.0.2.42",
			name,
			status: "ready",
		},
	};
}
