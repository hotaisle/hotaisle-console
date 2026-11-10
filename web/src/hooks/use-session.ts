import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { api, type Status } from "../lib/api";
import { historyVault } from "../lib/history-vault";
import { keyVault } from "../lib/key-vault";

export const STATUS_KEY = ["auth", "status"];
export const ACCOUNT_KEY = ["auth", "account"];
const CHANNEL = "hotaisle-console:session-lock";
const TAB_ID = crypto.randomUUID();

function lockOtherTabs() {
	if (typeof BroadcastChannel === "undefined") {
		return;
	}
	const channel = new BroadcastChannel(CHANNEL);
	channel.postMessage({ sender: TAB_ID, type: "lock" });
	channel.close();
}

export function useSessionSync() {
	const client = useQueryClient();
	useEffect(() => {
		if (typeof BroadcastChannel === "undefined") {
			return;
		}
		const channel = new BroadcastChannel(CHANNEL);
		channel.onmessage = (event: MessageEvent<unknown>) => {
			const message = event.data;
			if (
				!(
					typeof message === "object" &&
					message !== null &&
					"type" in message &&
					message.type === "lock" &&
					"sender" in message &&
					typeof message.sender === "string" &&
					message.sender !== TAB_ID
				)
			) {
				return;
			}
			historyVault.lock();
			keyVault.lock();
			client.cancelQueries();
			client.setQueryData<Status>(STATUS_KEY, (status) =>
				status ? { ...status, signed_in: false } : status
			);
			client.removeQueries({
				predicate: (query) =>
					query.queryKey[0] !== "auth" || query.queryKey[1] !== "status",
			});
		};
		return () => channel.close();
	}, [client]);
}

export function useSessionActions() {
	const client = useQueryClient();
	const connected = useCallback(async () => {
		historyVault.lock();
		lockOtherTabs();
		client.removeQueries({
			predicate: (query) =>
				query.queryKey[0] !== "auth" || query.queryKey[1] !== "status",
		});
		await client.invalidateQueries({ queryKey: STATUS_KEY });
	}, [client]);
	const logout = useMutation({
		mutationFn: api.signOut,
		onMutate: () => {
			historyVault.lock();
			lockOtherTabs();
		},
		onSuccess: () => {
			client.setQueryData<Status>(STATUS_KEY, (previous) => ({
				email_login: previous?.email_login ?? true,
				key_stored: previous?.key_stored ?? false,
				passkeys: previous?.passkeys ?? false,
				signed_in: false,
				version: previous?.version ?? "dev",
			}));
			client.removeQueries({
				predicate: (query) =>
					query.queryKey[0] !== "auth" || query.queryKey[1] !== "status",
			});
		},
	});
	return { connected, logout };
}
