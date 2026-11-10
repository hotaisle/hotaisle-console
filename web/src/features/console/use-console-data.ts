import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { usePoll } from "../../hooks/use-resource";
import { api, type Ended, type VMState } from "../../lib/api";
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
	const recByName = Object.fromEntries(records.map((r) => [r.name, r]));
	const list = vms.data ?? [];
	const power = useQueries({
		combine: combineStates,
		queries: list.map((vm) => ({
			queryFn: async () => ({
				...(await api.vmState(h, vm.name)),
				name: vm.name,
			}),
			queryKey: ["resource", "vm-state", h, vm.name],
			refetchInterval: fast ? 3000 : 15_000,
			retry: false,
		})),
	});
	const { states } = power;

	useEffect(() => {
		const machines = vms.data;
		if (
			machines &&
			records.some((entry) => !machines.some((vm) => vm.name === entry.name))
		) {
			prune(machines.map((vm) => vm.name));
		}
	}, [vms.data, records, prune]);

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
				.find((v) => v.ssh_access && phaseOf(v, states[v.name]) === "running");
			if (!vm?.ssh_access) {
				return;
			}
			const cmd = `ssh -p ${vm.ssh_access.port} hotaisle@${vm.ssh_access.dns_name || vm.ssh_access.ip_address}`;
			navigator.clipboard.writeText(cmd).then(
				() => toast(`Copied the SSH command for ${vm.name}.`),
				() => toast("Could not copy the SSH command.", "err")
			);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [vms.data, states, toast]);

	// Poll fast while anything is changing; notify when a machine becomes ready.
	useEffect(() => {
		const l = vms.data;
		if (!l) {
			return;
		}
		setFast(
			l.some((vm) => !settled(phaseOf(vm, states[vm.name]))) || !!launchedNow
		);
		for (const vm of l) {
			const ready = phaseOf(vm, states[vm.name]) === "running";
			if (
				ready &&
				wasReady.current[vm.name] === false &&
				notify &&
				"Notification" in window &&
				Notification.permission === "granted"
			) {
				const cmd = vm.ssh_access
					? `ssh -p ${vm.ssh_access.port} hotaisle@${vm.ssh_access.dns_name || vm.ssh_access.ip_address}`
					: "";
				const notification = new Notification(`${vm.name} is ready`, {
					body: cmd,
				});
				window.setTimeout(() => notification.close(), 10_000);
			}
			if (states[vm.name]) {
				wasReady.current[vm.name] = ready;
			}
		}
	}, [vms.data, states, launchedNow, notify]);
	return {
		balance,
		guessHost,
		history,
		keys,
		launchedNow,
		list,
		machinesRef,
		offers,
		recByName,
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
	results: UseQueryResult<VMState & { name: string }, Error>[]
) {
	const states: Record<string, VMState | undefined> = {};
	for (const result of results) {
		if (result.data) {
			states[result.data.name] = result.data;
		}
	}
	return { error: results.find((result) => result.error)?.error, states };
}
