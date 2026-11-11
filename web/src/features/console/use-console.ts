import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { machineKey } from "../../../../shared/machine-identity";
import { isPresent } from "../../../../shared/present";
import { useShortcut } from "../../hooks/use-shortcut";
import type { Ended, Status, Team, VM } from "../../lib/api";
import { usePrefs } from "../../lib/prefs";
import { signal } from "../../lib/signal";
import { sizesOf } from "../launch/offers";
import type { LaunchMeta } from "../launch/types";
import { useOrder } from "../launch/use-order";
import { NEW, placeNew } from "../stage/model";
import { buildStage } from "./stage-state";
import { useConsoleData } from "./use-console-data";
import { useMachineSelection } from "./use-machine-selection";
import { useMachineShortcuts } from "./use-machine-shortcuts";
import { useNavigation } from "./use-navigation";

export function useConsole({
	status,
	teams,
	team,
	onTeam,
}: {
	status: Status;
	teams: Team[];
	team: Team;
	onTeam: (h: string) => void;
}) {
	const h = team.handle;
	const [prefs] = usePrefs();
	const {
		vms,
		offers,
		balance,
		keys,
		record,
		rememberEnd,
		history,
		states,
		launchedNow,
		setLaunchedNow,
		receipts,
		setReceipts,
		wasReady,
		guessHost,
		machinesRef,
		recByIdentity,
		list,
	} = useConsoleData(h, prefs.notify);

	const { stack, view, go, push, back, focusMachine, focus, runName, legacy } =
		useNavigation(h);
	useShortcut("Escape", back, {
		enabled: view !== "home",
		meta: { name: "Go back" },
	});
	const { focused, focusedReceipt, focusedKey, run, runError, selectionError } =
		useMachineSelection(
			h,
			list,
			receipts,
			history,
			{ focus, focusMachine, legacy, runName, view },
			vms.data === undefined
		);
	const rootIsOrder = list.length === 0 && receipts.length === 0 && !focus;
	useMachineShortcuts(h, view === "home", focused, states);
	// ---------------------------------------------------------------- the order, kept while you look at keys or settings
	const { order, setOrder } = useOrder();
	// an earlier run, opened from the history to look back at it

	const hold = useMemo(() => signal(0), []);

	// ---------------------------------------------------------------- the panel: one view at a time, pushed and popped

	const refreshAll = useCallback(async () => {
		await Promise.all([vms.refresh(), balance.refresh(), offers.refresh()]);
	}, [vms, balance, offers]);

	// The order card becomes the new machine's card.
	const onLaunched = useCallback(
		async (vm: VM, meta: LaunchMeta) => {
			wasReady.current[machineKey(h, vm)] = false;
			// Until the API names its server, draw the new machine where it was previewed: next to your others.
			const guess = placeNew(machinesRef.current, vm.gpus?.[0]?.count ?? 1);
			if (guess !== NEW) {
				guessHost.current[machineKey(h, vm)] = guess;
			}
			record({
				deployment_id: vm.deployment_id,
				gpus: `${vm.gpus?.[0]?.count ?? 1}× ${vm.gpus?.[0]?.model ?? "MI300X"}`,
				image: meta.image,
				launched: true,
				metal: !!vm.metal,
				name: vm.name,
				price_cents: meta.price,
				user_data_url: meta.user_data_url,
			});
			await vms.setData((l) => [
				...(l ?? []).filter((x) => machineKey(h, x) !== machineKey(h, vm)),
				vm,
			]);
			go("none", () => {
				setLaunchedNow(machineKey(h, vm));
				focusMachine(machineKey(h, vm));
				hold.set(0);
			});
			window.setTimeout(() => setLaunchedNow(undefined), 900);
			refreshAll();
		},
		[
			h,
			wasReady,
			machinesRef,
			guessHost,
			record,
			go,
			vms,
			setLaunchedNow,
			focusMachine,
			hold,
			refreshAll,
		]
	);
	// Ending a machine turns its card into a receipt, and the receipt joins the history.
	const onEnded = useCallback(
		async (e: Ended) => {
			// the receipt takes the ended card's place in the list, so nothing around it moves
			const at = (vms.data ?? []).findIndex(
				(x) => machineKey(h, x) === machineKey(h, e)
			);
			await vms.setData((l) =>
				(l ?? []).filter((x) => machineKey(h, x) !== machineKey(h, e))
			);
			go("none", () => {
				setReceipts((rs) => [
					...rs.filter((x) => machineKey(h, x) !== machineKey(h, e)),
					{
						...e,
						at: at < 0 ? 0 : at + rs.length,
					},
				]);
			});
			rememberEnd(e);
			refreshAll();
		},
		[vms, go, setReceipts, rememberEnd, refreshAll, h]
	);
	const dismiss = useCallback(
		(name: string) =>
			go("none", () => {
				setReceipts((rs) => rs.filter((x) => machineKey(h, x) !== name));
				if (focus === name) {
					focusMachine(undefined, true);
				}
			}),
		[go, setReceipts, focus, focusMachine, h]
	);

	const b = balance.data;
	const gpusAtWork = list.reduce((n, v) => n + (v.gpus?.[0]?.count ?? 0), 0);
	const loaded =
		(vms.data !== undefined || vms.error) &&
		(offers.data !== undefined || offers.error);
	const sizes = sizesOf(offers.data);
	const offerFor = useCallback(
		(n?: number, model?: string, metal?: boolean) =>
			sizes.find(
				(o) =>
					o.Specs.gpus?.[0]?.count === n &&
					(!model || o.Specs.gpus?.[0]?.model === model) &&
					(metal === undefined || !!o.metal === metal)
			),
		[sizes]
	);
	const priceOf = useCallback(
		(vm: VM) =>
			recByIdentity[machineKey(h, vm)]?.price_cents ||
			offerFor(vm.gpus?.[0]?.count, vm.gpus?.[0]?.model, !!vm.metal)
				?.OnDemandPrice,
		[recByIdentity, offerFor, h]
	);

	// ---------------------------------------------------------------- what the drawing shows
	// Every machine on the server the API says it runs on. Ended ones keep theirs while their GPUs cool.
	const hostOf = useRef<Record<string, string>>({});
	for (const vm of list) {
		const host = states[machineKey(h, vm)]?.host;
		if (host) {
			hostOf.current[machineKey(h, vm)] = host;
		}
	}
	const serverOf = useCallback(
		(name: string) => hostOf.current[name] ?? guessHost.current[name],
		[guessHost]
	);
	const viewingRun = view === "run";
	const orderContext = !viewingRun && (rootIsOrder || stack.includes("order"));
	const stage = buildStage({
		focused,
		focusedReceipt,
		list: viewingRun ? [] : list,
		offerFor,
		offers: offers.data,
		offersError: offers.error,
		order,
		orderContext,
		priceOf,
		receipts: viewingRun ? [run].filter(isPresent) : receipts,
		records: recByIdentity,
		serverOf,
		states,
		team: h,
	});
	machinesRef.current = stage.machines;

	// Clicking one of your servers in the drawing brings its machine into focus.
	useEffect(() => {
		const onFocus = (e: Event) => {
			const name = (e as CustomEvent<string>).detail;
			go(stack.length > 1 ? "back" : "none", () => {
				focusMachine(name);
			});
		};
		window.addEventListener("stage-focus", onFocus);
		return () => window.removeEventListener("stage-focus", onFocus);
	}, [go, stack.length, focusMachine]);
	// The page arrives once, in one sequence; after that, things move only when you act.
	const [entering, setEntering] = useState(true);
	useEffect(() => {
		if (!loaded) {
			return;
		}
		const id = window.setTimeout(() => setEntering(false), 1600);
		return () => window.clearTimeout(id);
	}, [loaded]);

	return {
		b,
		back,
		balance,
		dismiss,
		entering,
		focused,
		focusedKey,
		focusMachine,
		gpusAtWork,
		h,
		history,
		hold,
		keys,
		launchedNow,
		list,
		loaded,
		offerFor,
		offers,
		onEnded,
		onLaunched,
		onTeam,
		order,
		priceOf,
		push,
		recByIdentity,
		receipts,
		refreshAll,
		rootIsOrder,
		run,
		runError,
		selectionError,
		serverOf,
		setOrder,
		sizes,
		stack,
		stage,
		states,
		status,
		team,
		teams,
		view,
		vms,
	};
}
export type ConsoleContext = ReturnType<typeof useConsole>;
