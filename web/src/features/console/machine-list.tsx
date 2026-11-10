import { useCallback } from "react";
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
	offerFor: (count?: number, model?: string) => Offer | undefined;
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
		() => context.onFocus(vm.name),
		[context.onFocus, vm.name]
	);
	const offer = context.offerFor(vm.gpus?.[0]?.count, vm.gpus?.[0]?.model);
	return (
		<Trip
			expanded={context.focused === vm.name}
			host={context.serverOf(vm.name)}
			minimumMin={offer?.MinimumReservationMinutes ?? 30}
			morph={context.launchedNow === vm.name}
			onChanged={context.onChanged}
			onEnded={context.onEnded}
			onFocus={focus}
			price={context.priceOf(vm)}
			record={context.records[vm.name]}
			state={context.states[vm.name]}
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
		() => onDismiss(receipt.name),
		[onDismiss, receipt.name]
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
						key={item.vm.deployment_id || item.vm.name}
						vm={item.vm}
					/>
				) : (
					<ReceiptItem
						key={`receipt:${item.receipt.name}`}
						onDismiss={props.onDismiss}
						receipt={item.receipt}
					/>
				)
			)}
		</div>
	);
}
