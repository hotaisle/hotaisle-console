import { useRouter, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	type MachineRef,
	machineKey,
} from "../../../../shared/machine-identity";
import { viewPath } from "../../app/route-state";
import type { Ended, VM } from "../../lib/api";
import type { useNavigation } from "./use-navigation";

export function resolveMachineSelection<T extends MachineRef>(
	team: string,
	items: T[],
	selected?: string,
	legacy = false
) {
	const matches = items.filter((item) =>
		legacy ? item.name === selected : machineKey(team, item) === selected
	);
	const ambiguous =
		new Set(matches.map((item) => machineKey(team, item))).size > 1;
	return { ambiguous, item: ambiguous ? undefined : matches[0] };
}

export function useMachineSelection(
	team: string,
	list: VM[],
	receipts: Ended[],
	history: Ended[],
	navigation: Pick<
		ReturnType<typeof useNavigation>,
		"focus" | "runName" | "legacy" | "view" | "focusMachine"
	>,
	loading: boolean
) {
	const { focus, runName, legacy, view, focusMachine } = navigation;
	const router = useRouter();
	const search = useSearch({ from: "__root__" });
	const selected = resolveMachineSelection<VM | Ended>(
		team,
		[...list, ...receipts],
		focus,
		legacy
	);
	const historical = resolveMachineSelection(team, history, runName, legacy);
	const run = historical.item;
	const viewingRun = view === "run";
	let focused: VM | undefined;
	let focusedReceipt: Ended | undefined = run;
	if (!viewingRun) {
		const item = focus ? selected.item : (list.at(-1) ?? receipts[0]);
		focused = list.find((vm) => vm === item);
		focusedReceipt = receipts.find((receipt) => receipt === item);
	}
	let selectionError: string | undefined;
	if (focus && !loading) {
		if (selected.ambiguous) {
			selectionError =
				"This link matches more than one machine. Choose a machine from the list.";
		} else if (!selected.item) {
			selectionError = "This machine is not available in the selected team.";
		}
	}
	const selectedKey = selected.item
		? machineKey(team, selected.item)
		: undefined;
	const runKey = run ? machineKey(team, run) : undefined;
	useEffect(() => {
		if (legacy && selectedKey && !viewingRun) {
			focusMachine(selectedKey, true);
		}
	}, [legacy, selectedKey, viewingRun, focusMachine]);
	useEffect(() => {
		if (legacy && runKey && viewingRun) {
			router.navigate({
				replace: true,
				search,
				to: viewPath(team, "run", runKey),
			});
		}
	}, [legacy, runKey, viewingRun, router, search, team]);
	return {
		focused,
		focusedKey: focused ? machineKey(team, focused) : undefined,
		focusedReceipt,
		run,
		runError: historical.ambiguous
			? new Error(
					"This legacy link matches more than one run. Choose a run from machine history."
				)
			: undefined,
		selectionError,
	};
}
