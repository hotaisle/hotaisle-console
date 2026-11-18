import { useCallback } from "react";
import { machineKey } from "../../../../shared/machine-identity";
import type { Ended, MachineRecord, Team, VM, VMState } from "../../lib/api";
import { ReceiptCard } from "../machines/receipt-card";
import { Trip } from "../machines/trip";

export interface PlacedReceipt extends Ended {
	at: number;
}
interface MachineListProps {
	focused?: string;
	launchedNow?: string;
	list: VM[];
	onChanged: () => void;
	onDismiss: (name: string) => void;
	onEnded: (ended: Ended) => void;
	onFocus: (name: string) => void;
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
	return (
		<Trip
			expanded={context.focused === machineKey(context.team.handle, vm)}
			host={context.serverOf(machineKey(context.team.handle, vm))}
			morph={context.launchedNow === machineKey(context.team.handle, vm)}
			onChanged={context.onChanged}
			onEnded={context.onEnded}
			onFocus={focus}
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
