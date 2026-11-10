import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	useLocation,
	useParams,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { Connect } from "../features/auth/connect";
import { HistoryAccess } from "../features/auth/history-access";
import { UnlockKey } from "../features/auth/unlock-key";
import { Console } from "../features/console/console";
import { TeamChoice } from "../features/teams/team-choice";
import {
	ACCOUNT_KEY,
	STATUS_KEY,
	useSessionActions,
	useSessionSync,
} from "../hooks/use-session";
import {
	APIError,
	api,
	type Status,
	type Team,
	type UserAccount,
} from "../lib/api";
import { applyStatusMotion, applyTheme, usePrefs } from "../lib/prefs";
import { Redirect } from "./redirect";
import { safeReturnTo, viewPath } from "./route-state";

const TEAM_KEY = "hotaisle-ui:team";
function savedTeam(): string | undefined {
	try {
		return localStorage.getItem(TEAM_KEY) ?? undefined;
	} catch {
		return undefined;
	}
}

export function LoadingScreen() {
	return (
		<main className="center">
			<span aria-label="Loading" className="loading" role="status" />
		</main>
	);
}

export function ConnectionError({
	message,
	onRetry,
	label = "Try again",
}: {
	message: string;
	onRetry: () => void;
	label?: string;
}) {
	return (
		<main className="center">
			<div className="lone">
				<h1>Can't reach Hot Aisle</h1>
				<p className="lede" role="alert">
					{message}
				</p>
				<button className="btn primary" onClick={onRetry} type="button">
					{label}
				</button>
			</div>
		</main>
	);
}

function AccountView({ status }: { status: Status }) {
	const client = useQueryClient();
	const account = useQuery({
		queryFn: api.user,
		queryKey: ACCOUNT_KEY,
		retry: false,
	});
	const params = useParams({ strict: false });
	const location = useLocation();
	const router = useRouter();
	const search = useSearch({ from: "__root__" });
	const { logout } = useSessionActions();
	const pickTeam = useCallback(
		(next: string) => {
			const navigation = router.navigate({
				params: { team: next },
				to: "/teams/$team/machines",
			});
			try {
				localStorage.setItem(TEAM_KEY, next);
			} catch {
				// Team selection remains available when browser storage is blocked.
			}
			return navigation;
		},
		[router]
	);
	const available = useCallback(
		async (team: Team) => {
			await client.cancelQueries({ queryKey: ACCOUNT_KEY });
			client.setQueryData<UserAccount>(ACCOUNT_KEY, (previous) =>
				previous
					? {
							...previous,
							teams: [
								...previous.teams.filter(
									(existing) => existing.handle !== team.handle
								),
								team,
							],
						}
					: previous
			);
			await pickTeam(team.handle);
		},
		[client, pickTeam]
	);
	const retry = useCallback(async () => {
		await account.refetch({ throwOnError: true });
	}, [account.refetch]);
	const signIn = useCallback(() => {
		logout.mutate();
	}, [logout.mutate]);
	if (account.isPending) {
		return <LoadingScreen />;
	}
	if (account.isError) {
		if (account.error instanceof APIError && account.error.status === 401) {
			return (
				<ConnectionError
					label="Sign in again"
					message={
						logout.error?.message ??
						"Your session has ended. Sign in again to continue."
					}
					onRetry={signIn}
				/>
			);
		}
		return <ConnectionError message={account.error.message} onRetry={retry} />;
	}
	const teams = account.data.teams.filter((team) => !team.invitation);
	const creating = location.pathname === "/teams/new";
	if (
		(location.pathname.startsWith("/sign-in") ||
			location.pathname === "/unlock") &&
		search.returnTo
	) {
		return <Redirect href={search.returnTo} />;
	}
	if (!params.team && location.pathname !== "/teams" && !creating) {
		const preferred =
			teams.find((team) => team.handle === savedTeam()) ?? teams[0];
		if (preferred) {
			return <Redirect href={viewPath(preferred.handle, "home")} />;
		}
		return <Redirect href="/teams" />;
	}
	const selected = creating
		? undefined
		: teams.find((team) => team.handle === params.team);
	if (!selected) {
		return (
			<TeamChoice
				creating={creating}
				email={account.data.user.email}
				onAvailable={available}
				onRefresh={retry}
				requestedTeam={params.team}
				teams={account.data.teams}
			/>
		);
	}
	return (
		<HistoryAccess
			key={`${account.data.user.email}:${account.data.user.created}`}
		>
			<Console
				key={selected.handle}
				onTeam={pickTeam}
				status={status}
				team={selected}
				teams={teams}
			/>
		</HistoryAccess>
	);
}

export function App() {
	useSessionSync();
	const location = useLocation();
	const [prefs] = usePrefs();
	useEffect(() => applyTheme(prefs.theme), [prefs.theme]);
	useEffect(() => applyStatusMotion(prefs.statusMotion), [prefs.statusMotion]);
	const session = useQuery({
		queryFn: api.status,
		queryKey: STATUS_KEY,
		retry: false,
	});
	const { connected } = useSessionActions();
	const retry = useCallback(async () => {
		await session.refetch();
	}, [session.refetch]);
	if (session.isPending) {
		return <LoadingScreen />;
	}
	if (session.isError) {
		return <ConnectionError message={session.error.message} onRetry={retry} />;
	}
	if (!session.data.signed_in) {
		if (location.pathname === "/unlock") {
			return <UnlockKey />;
		}
		if (!location.pathname.startsWith("/sign-in")) {
			const returnTo = safeReturnTo(location.href);
			const entry = session.data.key_stored ? "/unlock" : "/sign-in";
			const destination = returnTo
				? `${entry}?returnTo=${encodeURIComponent(returnTo)}`
				: entry;
			return <Redirect href={destination} />;
		}
		return <Connect onConnected={connected} status={session.data} />;
	}
	return <AccountView status={session.data} />;
}
