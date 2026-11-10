import { isPresent } from "../../../../shared/present";
import type { Ended, MachineRecord, Offer, VM, VMState } from "../../lib/api";
import { duration, money, specRows } from "../../lib/format";
import type { Order } from "../launch/types";
import { phaseOf, stageModeOf } from "../machines/state";
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
}
function machines(input: StageInput): StageMachine[] {
	return [
		...input.list.map((vm) => {
			const launched = input.records[vm.name]?.launched_at;
			return {
				gpus: vm.gpus?.[0]?.count ?? 1,
				host: input.serverOf(vm.name),
				mode: stageModeOf(phaseOf(vm, input.states[vm.name])),
				name: vm.name,
				since: launched ? Date.parse(launched) : undefined,
			};
		}),
		...input.receipts.map((receipt) => ({
			gpus: Number(receipt.gpus.split("×")[0]) || 1,
			host: input.serverOf(receipt.name),
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
		spec.push(...specRows(offer.Specs), [
			"Share",
			`${count} of 8 GPUs on one server`,
		]);
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
function machineReadout(vm: VM, states: StageInput["states"]) {
	const phase = phaseOf(vm, states[vm.name]);
	const mode = stageModeOf(phase);
	const count = vm.gpus?.[0]?.count ?? 1;
	if (mode === "booting") {
		return `${phase === "building" ? "Setting up" : "Booting"}. Your GPUs are warming up`;
	}
	if (mode === "ready") {
		return `${vm.name} is ready. ${count} GPU${count > 1 ? "s" : ""} at work`;
	}
	return `${vm.name} is ${phase === "off" ? "powered off" : phase}`;
}
function activeMachine(
	input: StageInput,
	vm: VM
): Omit<StageState, "machines"> {
	const spec = specRows(vm);
	const host = input.serverOf(vm.name);
	if (host) {
		const neighbours = input.list
			.filter(
				(other) => other.name !== vm.name && input.serverOf(other.name) === host
			)
			.map((other) => other.name);
		spec.push([
			"Server",
			neighbours.length
				? `${host}, shared with ${neighbours.join(", ")}`
				: host,
		]);
	}
	const address = vm.ssh_access?.dns_name || vm.ssh_access?.ip_address;
	if (address) {
		spec.push(["Address", address]);
	}
	const price = input.priceOf(vm);
	if (isPresent(price)) {
		spec.push(["Price", `${money(price)} an hour`]);
	}
	return {
		focus: vm.name,
		readout: machineReadout(vm, input.states),
		spec,
		specTitle: vm.name,
	};
}
function endedMachine(receipt: Ended): Omit<StageState, "machines"> {
	return {
		focus: receipt.name,
		readout: `${receipt.name} has ended. Its GPUs are cooling down`,
		spec: [
			["GPUs", receipt.gpus],
			[
				"Ran for",
				isPresent(receipt.ran_ms) ? duration(receipt.ran_ms) : "unknown",
			],
			[
				"Total, about",
				isPresent(receipt.cents) ? money(receipt.cents) : "unknown",
			],
		],
		specTitle: receipt.name,
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
