import { useCallback } from "react";
import { minimumReservationMinutes } from "../../../../shared/availability";
import { machineKey } from "../../../../shared/machine-identity";
import type {
	Ended,
	MachineRecord,
	Offer,
	Team,
	VM,
	VMState,
} from "../../lib/api";
import { ReceiptCard } from "../machines/receipt-card";
import { Trip } from "../machines/trip";

export interface PlacedReceipt extends Ended {
	at: number;
}
interface MachineListProps {
	focused?: string;
	launchedNow?: string;
	list: VM[];
	offerFor: (
		count?: number,
		model?: string,
		metal?: boolean
	) => Offer | undefined;
	onChanged: () => void;
	onDismiss: (name: string) => void;
	onEnded: (ended: Ended) => void;
	onFocus: (name: string) => void;
	priceOf: (vm: VM) => number | undefined;
	receipts: PlacedReceipt[];
	records: Record<string, MachineRecord | undefined>;
	serverOf: (name: string) => string | undefined;
	states: Record<string, VMState | undefined>;
	team: Team;
}
function MachineItem({ vm, context }: { vm: VM; context: MachineListProps }) {
	const focus = useCallback(
		() => context.onFocus(machineKey(context.team.handle, vm)),
		[context.onFocus, context.team.handle, vm]
	);
	const offer = context.offerFor(
		vm.gpus?.[0]?.count,
		vm.gpus?.[0]?.model,
		!!vm.metal
	);
	return (
		<Trip
			expanded={context.focused === machineKey(context.team.handle, vm)}
			host={context.serverOf(machineKey(context.team.handle, vm))}
			minimumMin={
				offer?.MinimumReservationMinutes ??
				minimumReservationMinutes(vm, vm.metal)
			}
			morph={context.launchedNow === machineKey(context.team.handle, vm)}
			onChanged={context.onChanged}
			onEnded={context.onEnded}
			onFocus={focus}
			price={context.priceOf(vm)}
			record={context.records[machineKey(context.team.handle, vm)]}
			state={context.states[machineKey(context.team.handle, vm)]}
			team={context.team}
			vm={vm}
		/>
	);
}
function ReceiptItem({
	receipt,
	onDismiss,
}: {
	receipt: Ended;
	onDismiss: (name: string) => void;
}) {
	const done = useCallback(
		() => onDismiss(machineKey(receipt.team, receipt)),
		[onDismiss, receipt]
	);
	return <ReceiptCard onDone={done} r={receipt} />;
}
type Item = { kind: "machine"; vm: VM } | { kind: "receipt"; receipt: Ended };
export function machineOrder(list: VM[], receipts: PlacedReceipt[]): Item[] {
	const pending = [...receipts].sort((a, b) => a.at - b.at);
	const items: Item[] = [];
	for (const vm of list) {
		while (pending[0] && pending[0].at <= items.length) {
			const receipt = pending.shift();
			if (receipt) {
				items.push({ kind: "receipt", receipt });
			}
		}
		items.push({ kind: "machine", vm });
	}
	for (const receipt of pending) {
		items.push({ kind: "receipt", receipt });
	}
	return items;
}
export function MachineList(props: MachineListProps) {
	return (
		<div className="cards">
			{machineOrder(props.list, props.receipts).map((item) =>
				item.kind === "machine" ? (
					<MachineItem
						context={props}
						key={machineKey(props.team.handle, item.vm)}
						vm={item.vm}
					/>
				) : (
					<ReceiptItem
						key={`receipt:${machineKey(item.receipt.team, item.receipt)}`}
						onDismiss={props.onDismiss}
						receipt={item.receipt}
					/>
				)
			)}
		</div>
	);
}
