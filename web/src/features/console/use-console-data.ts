import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	machineAddress,
	machineKey,
} from "../../../../shared/machine-identity";
import { recordsByIdentity } from "../../../../shared/records";
import { useToast } from "../../components/ui/toast";
import { usePoll } from "../../hooks/use-resource";
import { api, type Ended, type VMState } from "../../lib/api";
import { sshCommand } from "../../lib/format";
import { phaseOf, settled } from "../machines/state";
import type { StageMachine } from "../stage/model";
import { useAvailability } from "./use-availability";
import { useSessionRecords } from "./use-session-records";

const INPUT_CONTROL_PATTERN = /^(?:INPUT|TEXTAREA|SELECT)$/u;
export function useConsoleData(h: string, notify: boolean) {
	const toast = useToast();
	const [fast, setFast] = useState(true);
	const vms = usePoll(() => api.vms(h), fast ? 3000 : 15_000, `vms${h}`);
	const offers = useAvailability(h);
	const balance = usePoll(
		() => api.balance(h),
		fast ? 8000 : 20_000,
		`bal${h}`
	);
	const keys = usePoll(() => api.keys(), null, "keys");
	const { records, history, record, rememberEnd, prune } = useSessionRecords(h);

	const [launchedNow, setLaunchedNow] = useState<string>();
	const [receipts, setReceipts] = useState<
		(Ended & {
			at: number;
		})[]
	>([]);

	const wasReady = useRef<Record<string, boolean>>({});
	const guessHost = useRef<Record<string, string>>({});
	const machinesRef = useRef<StageMachine[]>([]);
	const list = vms.data ?? [];
	const recByIdentity = recordsByIdentity(h, records, list);
	const power = useQueries({
		combine: combineStates,
		queries: list.map((vm) => ({
			queryFn: async () => ({
				...(await api.vmState(h, vm)),
				id: machineKey(h, vm),
			}),
			queryKey: ["resource", "vm-state", h, !!vm.metal, machineAddress(vm)],
			refetchInterval: fast ? 3000 : 15_000,
			retry: false,
		})),
	});
	const { states } = power;

	useEffect(() => {
		const machines = vms.data;
		if (!machines) {
			return;
		}
		const alive = new Set(machines.map((vm) => machineKey(h, vm)));
		const indexed = recordsByIdentity(h, records, machines);
		for (const [key, entry] of Object.entries(indexed)) {
			if (entry && alive.has(key)) {
				alive.add(machineKey(h, entry));
			}
		}
		if (records.some((entry) => !alive.has(machineKey(h, entry)))) {
			prune([...alive]);
		}
	}, [vms.data, records, prune, h]);

	// C copies the SSH command of the newest ready machine.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				e.key.toLowerCase() !== "c" ||
				e.metaKey ||
				e.ctrlKey ||
				e.altKey ||
				(e.target instanceof HTMLElement &&
					INPUT_CONTROL_PATTERN.test(e.target.tagName))
			) {
				return;
			}
			const vm = [...(vms.data ?? [])]
				.reverse()
				.find(
					(v) =>
						v.ssh_access && phaseOf(v, states[machineKey(h, v)]) === "running"
				);
			if (!vm?.ssh_access) {
				return;
			}
			const cmd = sshCommand(vm.ssh_access);
			if (!cmd) {
				toast(
					"Connection details are unavailable. Refresh this machine.",
					"err"
				);
				return;
			}
			navigator.clipboard.writeText(cmd).then(
				() => toast("Copied the SSH command.", "info", cmd),
				() => toast("Could not copy the SSH command.", "err")
			);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [vms.data, states, toast, h]);

	// Poll fast while anything is changing; notify when a machine becomes ready.
	useEffect(() => {
		const l = vms.data;
		if (!l) {
			return;
		}
		setFast(
			l.some((vm) => !settled(phaseOf(vm, states[machineKey(h, vm)]))) ||
				!!launchedNow
		);
		for (const vm of l) {
			const ready = phaseOf(vm, states[machineKey(h, vm)]) === "running";
			if (
				ready &&
				wasReady.current[machineKey(h, vm)] === false &&
				notify &&
				"Notification" in window &&
				Notification.permission === "granted"
			) {
				const cmd = vm.ssh_access ? sshCommand(vm.ssh_access) : "";
				const notification = new Notification(`${vm.name} is ready`, {
					body: cmd,
				});
				window.setTimeout(() => notification.close(), 10_000);
			}
			if (states[machineKey(h, vm)]) {
				wasReady.current[machineKey(h, vm)] = ready;
			}
		}
	}, [vms.data, states, launchedNow, notify, h]);
	return {
		balance,
		guessHost,
		history,
		keys,
		launchedNow,
		list,
		machinesRef,
		offers,
		recByIdentity,
		receipts,
		record,
		rememberEnd,
		setLaunchedNow,
		setReceipts,
		states,
		vms,
		wasReady,
	};
}

function combineStates(
	results: UseQueryResult<VMState & { id: string }, Error>[]
) {
	const states: Record<string, VMState | undefined> = {};
	for (const result of results) {
		if (result.data) {
			states[result.data.id] = result.data;
		}
	}
	return { error: results.find((result) => result.error)?.error, states };
}
