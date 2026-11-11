import {
	useLocation,
	useParams,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { machineKey } from "../../../../shared/machine-identity";
import { type View, viewFromPath, viewPath } from "../../app/route-state";
import { transition } from "../../lib/motion";

export type { View } from "../../app/route-state";
export function useNavigation(team: string) {
	const router = useRouter();
	const location = useLocation();
	const params = useParams({ strict: false });
	const search = useSearch({ from: "__root__" });
	const view = viewFromPath(location.pathname);
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
			router.navigate({ search, to: viewPath(team, next, name) }),
		[router, team, search]
	);
	const focusMachine = useCallback(
		(name?: string, replace = false) =>
			router.navigate({ replace, search, to: viewPath(team, "home", name) }),
		[router, team, search]
	);
	const back = useCallback(() => {
		if (router.history.canGoBack()) {
			router.history.back();
		} else {
			router.navigate({ replace: true, search, to: viewPath(team, "home") });
		}
	}, [router, team, search]);
	return {
		back,
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
