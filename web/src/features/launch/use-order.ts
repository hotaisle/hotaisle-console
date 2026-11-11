import { useLocation, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { type ConsoleSearch, validateSearch } from "../../app/route-state";
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
	const legacyCloudInit = Object.hasOwn(location.search, "cloudInit");
	const cleanedLocation = useRef<string>(undefined);
	useEffect(() => {
		if (!legacyCloudInit) {
			cleanedLocation.current = undefined;
			return;
		}
		if (cleanedLocation.current === location.href) {
			return;
		}
		cleanedLocation.current = location.href;
		router.navigate({
			replace: true,
			// Router search can retain unknown keys; spreading it would keep the retired URL.
			search: (previous: ConsoleSearch) => validateSearch({ ...previous }),
			to: location.pathname,
		});
	}, [router, location.href, location.pathname, legacyCloudInit]);
	const order: Order = {
		count: search.gpus ?? 1,
		customURL: cloudInit.value,
		image: search.image ?? prefs.image,
	};
	const setOrder = useCallback(
		(patch: Partial<Order>) =>
			router.navigate({
				replace: true,
				search: (previous: ConsoleSearch) => {
					const clean = validateSearch({ ...previous });
					return {
						...clean,
						gpus: patch.count ?? clean.gpus,
						image: patch.image ?? clean.image,
					};
				},
				to: location.pathname,
			}),
		[router, location.pathname]
	);
	return { order, setOrder };
}
