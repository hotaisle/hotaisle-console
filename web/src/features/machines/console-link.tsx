import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { consoleURL } from "./console-url";

/** One-time URLs live only in memory while the operations popup is open. */
export function ConsoleLink({
	team,
	server,
	onOpen,
}: {
	team: string;
	server: string;
	onOpen: () => void;
}) {
	const consoleLink = useQuery({
		gcTime: 0,
		queryFn: async () => {
			const result = await api.bareMetalConsole(team, server);
			return consoleURL(result.url);
		},
		queryKey: ["resource", "bare-metal-console", team, server],
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
		retry: false,
		staleTime: 0,
	});
	if (!consoleLink.data) {
		return null;
	}
	return (
		<a
			className="operation"
			href={consoleLink.data}
			onClick={onOpen}
			rel="noopener noreferrer"
			target="_blank"
		>
			<strong>Console ↗</strong>
			<span>Open the server’s web console in a new window.</span>
		</a>
	);
}
