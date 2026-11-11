import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type SetStateAction, useCallback, useMemo } from "react";

/** Server state scoped by resource and team; local writes cancel older in-flight polls. */
export function usePoll<T>(
	request: (() => Promise<T>) | null,
	interval: number | null,
	key: string
) {
	const client = useQueryClient();
	const query = useQuery<T, Error>({
		enabled: request !== null,
		queryFn: request ?? undefined,
		queryKey: ["resource", key],
		refetchInterval: interval ?? false,
		refetchIntervalInBackground: false,
		retry: false,
	});
	const { refetch } = query;
	const refresh = useCallback(async () => {
		await refetch();
	}, [refetch]);
	const setData = useCallback(
		async (next: SetStateAction<T | undefined>) => {
			const queryKey = ["resource", key];
			await client.cancelQueries({ exact: true, queryKey });
			client.setQueryData<T | undefined>(queryKey, next);
		},
		[client, key]
	);
	return useMemo(
		() => ({
			data: query.data,
			error: query.error ?? undefined,
			refresh,
			setData,
		}),
		[query.data, query.error, refresh, setData]
	);
}
