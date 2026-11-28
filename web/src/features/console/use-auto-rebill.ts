import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { currentSessionEpoch } from "../../hooks/use-session";
import { api } from "../../lib/api";
import type {
	AutoRebillSettings,
	AutoRebillStatus,
} from "../../lib/auto-rebill";
import { checkoutURL, prepareCheckoutWindow } from "./checkout-window";

type SetupChange =
	| { kind: "setup"; settings: AutoRebillSettings }
	| { kind: "change-method" }
	| { kind: "resume-setup" };
type Change =
	| SetupChange
	| { kind: "update"; settings: AutoRebillSettings }
	| { kind: "disable" };
type ChangeResult =
	| {
			kind: "setup";
			settings: AutoRebillSettings;
			statusUpdateCount: number;
			url: string;
	  }
	| { kind: "resume-setup"; url: string }
	| { kind: "update" | "disable" };
export interface AutoRebillControls {
	change: UseMutationResult<ChangeResult, Error, Change>;
	changePaymentMethod?: () => void;
	disable: () => void;
	previousSettings?: AutoRebillSettings;
	refresh: () => void;
	resumeSetup: () => void;
	save: (settings: AutoRebillSettings) => Promise<boolean>;
	setupConfirmed: boolean;
	startSetup: (settings: AutoRebillSettings) => Promise<boolean>;
	status: UseQueryResult<AutoRebillStatus, Error>;
}

function canChangePaymentMethod(data: AutoRebillStatus | undefined) {
	return data?.enabled && data.can_configure && !data.setup_pending;
}

function paymentMethodSettings(data: AutoRebillStatus): AutoRebillSettings {
	if (!canChangePaymentMethod(data)) {
		throw new Error("Autopay no longer allows a payment method change.");
	}
	return settingsFromStatus(data);
}

function settingsFromStatus(data: AutoRebillStatus): AutoRebillSettings {
	return {
		monthly_cap_cents: data.monthly_cap_cents,
		rebill_amount_cents: data.rebill_amount_cents,
		threshold_cents: data.threshold_cents,
	};
}

export function autoRebillQuery(team: string) {
	return queryOptions({
		queryFn: () => api.autoRebill(team),
		queryKey: ["auto-rebill", team],
		retry: false,
	});
}

export function useAutoRebill(team: string): AutoRebillControls {
	const client = useQueryClient();
	const statusQuery = autoRebillQuery(team);
	const { queryKey } = statusQuery;
	const previousSettingsKey = ["auto-rebill", team, "previous-settings"];
	const status = useQuery({
		...statusQuery,
		refetchInterval: 10_000,
		refetchOnWindowFocus: "always",
	});
	const change = useMutation({
		mutationFn: async (value: Change): Promise<ChangeResult> => {
			const epoch = currentSessionEpoch();
			await client.cancelQueries({ exact: true, queryKey });
			if (value.kind === "disable") {
				const current = client.getQueryData<AutoRebillStatus>(queryKey);
				await api.disableAutoRebill(team);
				if (current?.enabled && currentSessionEpoch() === epoch) {
					// Turning Autopay off clears the saved amounts on the server.
					client.setQueryData(previousSettingsKey, settingsFromStatus(current));
				}
				return { kind: value.kind };
			}
			if (value.kind === "update") {
				await api.updateAutoRebill(team, value.settings);
				return { kind: value.kind };
			}
			if (value.kind === "resume-setup") {
				const session = await api.resumeAutoRebillSetup(team);
				return { kind: value.kind, url: checkoutURL(session.checkout_url) };
			}
			const settings =
				value.kind === "setup"
					? value.settings
					: paymentMethodSettings(
							await client.fetchQuery({ ...statusQuery, staleTime: 0 })
						);
			const session = await api.setupAutoRebill(team, settings);
			const statusUpdateCount =
				client.getQueryState(queryKey)?.dataUpdateCount ?? 0;
			return {
				kind: "setup",
				settings,
				statusUpdateCount,
				url: checkoutURL(session.checkout_url),
			};
		},
		onSettled: (_result, error, value) => {
			if (value.kind === "resume-setup") {
				// Refresh stale pending state if setup closed before the purchaser clicked.
				if (error) {
					void client.invalidateQueries({ exact: true, queryKey });
				}
				return;
			}
			if (!error) {
				return client.invalidateQueries({ exact: true, queryKey });
			}
		},
	});
	const launchSetup = useCallback(
		async (request: SetupChange) => {
			const epoch = currentSessionEpoch();
			const tab = prepareCheckoutWindow();
			try {
				const result = await change.mutateAsync(request);
				if (epoch !== currentSessionEpoch()) {
					tab?.close();
					return false;
				}
				if (result.kind === "setup" || result.kind === "resume-setup") {
					if (tab && !tab.closed) {
						tab.location.replace(result.url);
					} else if (result.kind === "resume-setup" && !tab) {
						window.location.assign(result.url);
					}
				}
				return true;
			} catch {
				tab?.close();
				// API and checkout validation errors remain visible; this never implies activation.
				return false;
			}
		},
		[change]
	);
	const startSetup = useCallback(
		(settings: AutoRebillSettings) => launchSetup({ kind: "setup", settings }),
		[launchSetup]
	);
	const changePaymentMethod = useCallback(() => {
		void launchSetup({ kind: "change-method" });
	}, [launchSetup]);
	const resumeSetup = useCallback(() => {
		void launchSetup({ kind: "resume-setup" });
	}, [launchSetup]);
	const save = useCallback(
		async (settings: AutoRebillSettings) => {
			try {
				await change.mutateAsync({ kind: "update", settings });
				return true;
			} catch {
				return false;
			}
		},
		[change]
	);
	const disable = useCallback(
		() => change.mutate({ kind: "disable" }),
		[change]
	);
	const refresh = useCallback(() => {
		status.refetch();
	}, [status]);
	const setupConfirmed = Boolean(
		change.data?.kind === "setup" &&
			!status.isFetching &&
			status.data?.enabled &&
			!status.data.setup_pending &&
			(client.getQueryState(queryKey)?.dataUpdateCount ?? 0) >
				change.data.statusUpdateCount
	);
	return {
		change,
		changePaymentMethod: canChangePaymentMethod(status.data)
			? changePaymentMethod
			: undefined,
		disable,
		previousSettings:
			client.getQueryData<AutoRebillSettings>(previousSettingsKey),
		refresh,
		resumeSetup,
		save,
		startSetup,
		setupConfirmed,
		status,
	};
}
