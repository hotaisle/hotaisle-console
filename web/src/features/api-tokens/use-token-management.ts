import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ACCOUNT_KEY,
	currentSessionEpoch,
	useSessionActions,
} from "../../hooks/use-session";
import {
	type APIToken,
	api,
	type Status,
	type UserAccount,
} from "../../lib/api";

export const TOKEN_PATH = "/account/api-tokens";
export function useTokenManagement(account: UserAccount, status: Status) {
	const client = useQueryClient();
	const router = useRouter();
	const location = useLocation();
	const search = useSearch({ from: "__root__" });
	const { logout } = useSessionActions();
	const epoch = currentSessionEpoch();
	const queryKey = useMemo(
		() => ["resource", "api-tokens", account.user.email, account.user.created],
		[account.user.email, account.user.created]
	);
	const tokens = useQuery({
		queryFn: api.apiTokens,
		queryKey,
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
		retry: false,
	});
	const [generated, setGenerated] = useState<
		| {
				value: string;
				label: string;
				team?: string;
		  }
		| undefined
	>(undefined);
	const previousTeam = useRef(search.tokenTeam);
	const [removing, setRemoving] = useState<APIToken>();
	const prefix = api.activeTokenPrefix();
	const canManage =
		status.kind === "email" ||
		tokens.data?.some(
			(token) => token.prefix === prefix && token.user_role === "owner"
		) ||
		false;
	useEffect(() => {
		if (
			location.pathname !== TOKEN_PATH ||
			previousTeam.current !== search.tokenTeam
		) {
			setGenerated(undefined);
		}
		previousTeam.current = search.tokenTeam;
	}, [location.pathname, search.tokenTeam]);
	const sameAccount = useCallback(() => {
		const current = client.getQueryData<UserAccount>(ACCOUNT_KEY);
		return (
			currentSessionEpoch() === epoch &&
			current?.user.email === account.user.email &&
			current.user.created === account.user.created
		);
	}, [client, epoch, account.user.email, account.user.created]);
	const saved = useCallback(
		async (details: APIToken, secret?: string) => {
			await client.cancelQueries({ queryKey });
			if (!sameAccount()) {
				throw new Error(
					"Your account changed. Sign in again before managing tokens."
				);
			}
			client.setQueryData<APIToken[]>(queryKey, (previous) => [
				...(previous ?? []).filter((token) => token.prefix !== details.prefix),
				details,
			]);
			setGenerated(
				secret
					? { label: details.label, team: search.tokenTeam, value: secret }
					: undefined
			);
			await client.invalidateQueries({ queryKey });
			if (sameAccount()) {
				await router.navigate({ search, to: TOKEN_PATH });
			}
		},
		[client, queryKey, router, search, sameAccount]
	);
	const revoked = useCallback(
		async (removedPrefix: string) => {
			if (!sameAccount()) {
				return;
			}
			if (removedPrefix === prefix) {
				await logout.mutateAsync();
				return;
			}
			await client.cancelQueries({ queryKey });
			if (!sameAccount()) {
				return;
			}
			client.setQueryData<APIToken[]>(
				queryKey,
				(previous) =>
					previous?.filter((token) => token.prefix !== removedPrefix) ?? []
			);
			setRemoving(undefined);
			await client.invalidateQueries({ queryKey });
		},
		[client, logout.mutateAsync, prefix, queryKey, sameAccount]
	);
	const retry = useCallback(() => tokens.refetch(), [tokens.refetch]);
	const dismiss = useCallback(() => setGenerated(undefined), []);
	const close = useCallback(() => setRemoving(undefined), []);
	return {
		canManage,
		close,
		dismiss,
		generated:
			generated && generated.team === search.tokenTeam ? generated : undefined,
		prefix,
		remove: setRemoving,
		removing,
		retry,
		revoked,
		saved,
		tokens,
	};
}
