import {
	useLocation,
	useParams,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { type View, viewFromPath, viewPath } from "../../app/route-state";
import { transition } from "../../lib/motion";

const INPUT_CONTROL_PATTERN = /^(?:INPUT|TEXTAREA|SELECT)$/u;

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
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (
				event.key !== "Escape" ||
				event.defaultPrevented ||
				document.querySelector(".menu,.sheet,dialog[open]")
			) {
				return;
			}
			if (
				event.target instanceof HTMLElement &&
				(event.target.isContentEditable ||
					INPUT_CONTROL_PATTERN.test(event.target.tagName))
			) {
				return;
			}
			if (view !== "home") {
				back();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [back, view]);
	return {
		back,
		focus: params.machine,
		focusMachine,
		go,
		push,
		runName: params.run,
		search,
		stack,
		view,
	};
}
