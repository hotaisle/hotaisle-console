import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { AutoRebillSettings } from "../../lib/auto-rebill";
import { checkoutURL, prepareCheckoutWindow } from "./checkout-window";

type Change =
	| { kind: "setup" | "update"; settings: AutoRebillSettings }
	| { kind: "disable" };
interface ChangeResult {
	kind: Change["kind"];
	statusUpdateCount?: number;
	url?: string;
}

export function useAutoRebill(team: string) {
	const client = useQueryClient();
	const queryKey = useMemo(() => ["auto-rebill", team], [team]);
	const status = useQuery({
		queryFn: () => api.autoRebill(team),
		queryKey,
		refetchInterval: 10_000,
		refetchOnWindowFocus: "always",
		retry: false,
	});
	const [mode, setMode] = useState<"setup" | "edit" | null>(null);
	const change = useMutation({
		mutationFn: async (value: Change): Promise<ChangeResult> => {
			await client.cancelQueries({ exact: true, queryKey });
			if (value.kind === "disable") {
				await api.disableAutoRebill(team);
				return { kind: value.kind };
			}
			if (value.kind === "update") {
				await api.updateAutoRebill(team, value.settings);
				return { kind: value.kind };
			}
			const session = await api.setupAutoRebill(team, value.settings);
			const statusUpdateCount =
				client.getQueryState(queryKey)?.dataUpdateCount ?? 0;
			return {
				kind: value.kind,
				statusUpdateCount,
				url: checkoutURL(session.checkout_url),
			};
		},
		onSuccess: async () => {
			setMode(null);
			await client.invalidateQueries({ exact: true, queryKey });
		},
	});
	const save = useCallback(
		async (settings: AutoRebillSettings) => {
			const tab = mode === "setup" ? prepareCheckoutWindow() : null;
			try {
				const result = await change.mutateAsync({
					kind: mode === "setup" ? "setup" : "update",
					settings,
				});
				if (result.url && tab && !tab.closed) {
					tab.location.replace(result.url);
				}
			} catch {
				tab?.close();
				// API and checkout validation errors remain visible; this never implies activation.
			}
		},
		[change, mode]
	);
	const disable = useCallback(
		() => change.mutate({ kind: "disable" }),
		[change]
	);
	const edit = useCallback(() => {
		change.reset();
		setMode("edit");
	}, [change]);
	const setup = useCallback(() => {
		change.reset();
		setMode("setup");
	}, [change]);
	const cancel = useCallback(() => {
		change.reset();
		setMode(null);
	}, [change]);
	const refresh = useCallback(() => {
		status.refetch();
	}, [status]);
	const setupConfirmed =
		change.data?.kind === "setup" &&
		!status.isFetching &&
		status.data?.enabled &&
		!status.data.setup_pending &&
		(client.getQueryState(queryKey)?.dataUpdateCount ?? 0) >
			(change.data.statusUpdateCount ?? 0);
	return {
		cancel,
		change,
		disable,
		edit,
		mode,
		refresh,
		save,
		setup,
		setupConfirmed,
		status,
	};
}
