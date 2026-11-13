import { machineKey } from "../../../../shared/machine-identity";
import { isPresent } from "../../../../shared/present";
import type { Ended, MachineRecord, Offer, VM, VMState } from "../../lib/api";
import { duration, money, specRows } from "../../lib/format";
import type { Order } from "../launch/types";
import { runTitle } from "../machines/formatting";
import { phaseOf, stageModeOf, usesCloudInit } from "../machines/state";
import type { StageMachine, StageState } from "../stage/model";

export interface StageInput {
	focused?: VM;
	focusedReceipt?: Ended;
	list: VM[];
	offerFor: (count?: number, model?: string) => Offer | undefined;
	offers?: Offer[];
	offersError?: Error;
	order: Order;
	orderContext: boolean;
	priceOf: (vm: VM) => number | undefined;
	receipts: Ended[];
	records: Record<string, MachineRecord | undefined>;
	serverOf: (name: string) => string | undefined;
	states: Record<string, VMState | undefined>;
	team: string;
}
function machines(input: StageInput): StageMachine[] {
	return [
		...input.list.map((vm) => {
			const launched = input.records[machineKey(input.team, vm)]?.launched_at;
			const phase = phaseOf(vm, input.states[machineKey(input.team, vm)]);
			return {
				gpus: vm.gpus?.[0]?.count ?? 1,
				host: input.serverOf(machineKey(input.team, vm)),
				id: machineKey(input.team, vm),
				mode: stageModeOf(
					phase,
					vm.metal ||
						usesCloudInit(phase, input.records[machineKey(input.team, vm)])
				),
				name: vm.name,
				since: launched ? Date.parse(launched) : undefined,
			};
		}),
		...input.receipts.map((receipt) => ({
			gpus: Number(receipt.gpus.split("×")[0]) || 1,
			host: receipt.server ?? input.serverOf(machineKey(input.team, receipt)),
			id: machineKey(input.team, receipt),
			mode: "ended" as const,
			name: receipt.name,
		})),
	];
}
function preview(input: StageInput): Omit<StageState, "machines"> {
	const { count } = input.order;
	const offer = input.offerFor(count);
	const spec: [string, string][] = [];
	if (offer) {
		spec.push(...specRows(offer.Specs));
		if (!offer.metal) {
			spec.push(["Share", `${count} of 8 GPUs on one server`]);
		}
		if (isPresent(offer.OnDemandPrice)) {
			spec.push(["Price", `${money(offer.OnDemandPrice)} an hour`]);
		}
	}
	let title = "Loading sizes";
	let readout = `${count} of this server's 8 GPUs ${count === 1 ? "is" : "are"} yours once you launch`;
	if (input.offersError) {
		title = "Sizes unavailable";
		readout = "Couldn't load availability. Refresh to try again.";
	} else if (offer) {
		title = `${count}× ${offer.Specs.gpus?.[0]?.model ?? "MI300X"}`;
	} else if (input.offers !== undefined) {
		title = input.offers.length ? "Size unavailable" : "No machines available";
		readout = input.offers.length
			? "No available machine matches this size. Choose another size or refresh availability."
			: "No machines are available to rent right now. Availability updates automatically.";
	}
	return {
		preview: count,
		readout,
		spec,
		specTitle: title,
	};
}
function machineReadout(
	vm: VM,
	state: VMState | undefined,
	record?: MachineRecord
) {
	const phase = phaseOf(vm, state);
	const mode = stageModeOf(phase, vm.metal || usesCloudInit(phase, record));
	const count = vm.gpus?.[0]?.count ?? 1;
	const server = state?.host ?? (vm.metal ? vm.name : "Server");
	if (mode === "booting") {
		return vm.metal
			? "Installing your server's operating system."
			: "Booting. Running your cloud-init file.";
	}
	if (mode === "claimed") {
		return phase === "unknown"
			? "Checking machine status."
			: "Assigned. Waiting for Hot Aisle to confirm it is ready.";
	}
	if (mode === "ready") {
		return `${server} is ready. ${count} GPU${count > 1 ? "s" : ""} at work`;
	}
	return `${server} is ${phase === "off" ? "powered off" : phase}`;
}
function activeMachine(
	input: StageInput,
	vm: VM
): Omit<StageState, "machines"> {
	const spec = specRows(vm);
	const host = input.serverOf(machineKey(input.team, vm));
	const address = vm.ssh_access?.dns_name || vm.ssh_access?.ip_address;
	if (address) {
		spec.push(["Address", address]);
	}
	const price = input.priceOf(vm);
	if (isPresent(price)) {
		spec.push(["Price", `${money(price)} an hour`]);
	}
	return {
		focus: machineKey(input.team, vm),
		readout: machineReadout(
			vm,
			input.states[machineKey(input.team, vm)],
			input.records[machineKey(input.team, vm)]
		),
		spec,
		specTitle: host ?? (vm.metal ? vm.name : "Server being assigned"),
	};
}
function endedMachine(receipt: Ended): Omit<StageState, "machines"> {
	return {
		focus: machineKey(receipt.team, receipt),
		readout: `Run on ${runTitle(receipt)} ended. Billing stopped.`,
		spec: [
			["GPUs", receipt.gpus],
			[
				"Ran for",
				isPresent(receipt.ran_ms) ? duration(receipt.ran_ms) : "unknown",
			],
			["Total", isPresent(receipt.cents) ? money(receipt.cents) : "unknown"],
		],
		specTitle: runTitle(receipt),
	};
}
export function buildStage(input: StageInput): StageState {
	let detail: Omit<StageState, "machines"> = {
		readout: "Nothing running",
		spec: [],
		specTitle: "MI300X",
	};
	if (input.orderContext) {
		detail = preview(input);
	} else if (input.focused) {
		detail = activeMachine(input, input.focused);
	} else if (input.focusedReceipt) {
		detail = endedMachine(input.focusedReceipt);
	}
	return { ...detail, machines: machines(input) };
}
