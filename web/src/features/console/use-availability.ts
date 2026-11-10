import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../../lib/api";

/** Poll from the browser; no server-side account data, rooms, or socket tickets. */
export function useAvailability(team: string) {
	const query = useQuery({
		queryFn: () => api.offers(team),
		queryKey: ["availability", team],
		refetchInterval: 10_000,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
		retry: false,
	});
	const { refetch } = query;
	const refresh = useCallback(async () => {
		await refetch();
	}, [refetch]);
	return { data: query.data, error: query.error ?? undefined, refresh };
}
