import { useLocation, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { usePrefs } from "../../lib/prefs";
import type { Order } from "./types";

export function useOrder() {
	const [prefs] = usePrefs();
	const router = useRouter();
	const location = useLocation();
	const search = useSearch({ from: "__root__" });
	const order: Order = {
		count: search.gpus ?? 1,
		customURL: search.cloudInit ?? prefs.customURL,
		image: search.image ?? prefs.image,
	};
	const setOrder = useCallback(
		(patch: Partial<Order>) =>
			router.navigate({
				replace: true,
				search: {
					...search,
					cloudInit: patch.customURL ?? search.cloudInit,
					gpus: patch.count ?? search.gpus,
					image: patch.image ?? search.image,
				},
				to: location.pathname,
			}),
		[router, location.pathname, search]
	);
	return { order, setOrder };
}
