import {
	useLocation,
	useMatch,
	useParams,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { machineKey } from "../../../../shared/machine-identity";
import type { View } from "../../app/route-state";
import { viewFromPath, viewPath } from "../../app/route-state";
import { transition } from "../../lib/motion";

export type { View } from "../../app/route-state";

declare module "@tanstack/react-router" {
	interface HistoryState {
		autopayFromCredits?: true;
		creditsFrom?: Exclude<View, "credits">;
	}
}

export function useNavigation(team: string) {
	const router = useRouter();
	const location = useLocation();
	const params = useParams({ strict: false });
	const search = useSearch({ from: "__root__" });
	const view = viewFromPath(location.pathname);
	const editingAutopay = Boolean(
		useMatch({
			from: "/teams/$team/credits/autopay",
			shouldThrow: false,
		})
	);
	const creditsFrom =
		view === "credits" ? location.state.creditsFrom : undefined;
	// A direct credits link can have a duplicate or unrelated entry behind it.
	const canGoBack =
		(editingAutopay
			? location.state.autopayFromCredits
			: view !== "credits" || creditsFrom !== undefined) &&
		router.history.canGoBack();
	const stack: View[] = view === "home" ? ["home"] : ["home", view];
	const go = useCallback(
		(direction: "forward" | "back" | "none", change: () => void) => {
			document.documentElement.dataset.nav = direction;
			transition(change);
		},
		[]
	);
	const push = useCallback(
		(next: View, name?: string) =>
			router.navigate({
				search:
					next === "order" || next === "image"
						? { gpus: search.gpus, image: search.image, offer: search.offer }
						: {},
				state:
					next === "credits" && view !== "credits" ? { creditsFrom: view } : {},
				to: viewPath(team, next, name),
			}),
		[router, team, search, view]
	);
	const focusMachine = useCallback(
		(name?: string, replace = false) =>
			router.navigate({
				replace,
				search: {},
				to: viewPath(team, "home", name),
			}),
		[router, team]
	);
	const back = useCallback(() => {
		if (canGoBack) {
			router.history.back();
		} else {
			router.navigate({
				replace: true,
				search: {},
				to: viewPath(team, editingAutopay ? "credits" : "home"),
			});
		}
	}, [canGoBack, editingAutopay, router, team]);
	const previousView = canGoBack ? creditsFrom : undefined;
	const backView: View = editingAutopay ? "credits" : (previousView ?? "home");
	return {
		back,
		backView,
		editingAutopay,
		focus:
			params.machine && params.kind
				? machineKey(team, {
						metal: params.kind === "bare_metal",
						name: params.machine,
					})
				: params.machine,
		focusMachine,
		go,
		legacy: !params.kind,
		push,
		runName:
			params.run && params.kind
				? machineKey(team, {
						metal: params.kind === "bare_metal",
						name: params.run,
					})
				: params.run,
		search,
		stack,
		view,
	};
}
