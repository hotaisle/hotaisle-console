import { useCallback, useSyncExternalStore } from "react";
import {
	type Ended,
	historyOf,
	listMachines,
	type MachineUpdate,
} from "../../../../shared/records";
import { historyVault } from "../../lib/history-vault";

export function useSessionRecords(team: string) {
	const { records } = useSyncExternalStore(
		historyVault.subscribe,
		historyVault.getSnapshot
	);
	const record = useCallback(
		(entry: Omit<MachineUpdate, "team">) =>
			historyVault.record({ ...entry, team }),
		[team]
	);
	const rememberEnd = useCallback(
		(entry: Ended) => {
			if (entry.team !== team) {
				throw new Error("A receipt must belong to the selected team.");
			}
			historyVault.rememberEnd(entry);
		},
		[team]
	);
	const prune = useCallback(
		(names: string[]) => historyVault.prune(team, names),
		[team]
	);
	return {
		history: historyOf(records, team),
		prune,
		record,
		records: listMachines(records, team),
		rememberEnd,
	};
}
