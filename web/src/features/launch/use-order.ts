import { useLocation, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { cloudInitVault } from "../../lib/cloud-init-vault";
import { usePrefs } from "../../lib/prefs";
import type { Order } from "./types";

export function useOrder() {
	const [prefs] = usePrefs();
	const cloudInit = useSyncExternalStore(
		cloudInitVault.subscribe,
		cloudInitVault.getSnapshot
	);
	const router = useRouter();
	const location = useLocation();
	const search = useSearch({ from: "__root__" });
	useEffect(() => {
		if (new URLSearchParams(window.location.search).has("cloudInit")) {
			router.navigate({
				replace: true,
				search: { ...search },
				to: location.pathname,
			});
		}
	}, [router, location.pathname, search]);
	const order: Order = {
		count: search.gpus ?? 1,
		customURL: cloudInit.value,
		image: search.image ?? prefs.image,
	};
	const setOrder = useCallback(
		(patch: Partial<Order>) =>
			router.navigate({
				replace: true,
				search: {
					...search,
					gpus: patch.count ?? search.gpus,
					image: patch.image ?? search.image,
				},
				to: location.pathname,
			}),
		[router, location.pathname, search]
	);
	return { order, setOrder };
}
