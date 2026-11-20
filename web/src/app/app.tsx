import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	isNotFound,
	useLocation,
	useRouter,
	useRouterState,
	useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FormError } from "../components/forms/form-error";
import { APITokens } from "../features/api-tokens/api-tokens";
import { Connect } from "../features/auth/connect";
import { HistoryAccess } from "../features/auth/history-access";
import { UnlockKey } from "../features/auth/unlock-key";
import { Console } from "../features/console/console";
import { TeamChoice } from "../features/teams/team-choice";
import { TeamDetails } from "../features/teams/team-details";
import {
	ACCOUNT_KEY,
	currentSessionEpoch,
	STATUS_KEY,
	useSessionActions,
	useSessionSync,
} from "../hooks/use-session";
import { useSessionLifetime } from "../hooks/use-session-lifetime";
import type { Status, Team, UserAccount } from "../lib/api";
import { APIError, api } from "../lib/api";
import { applyStatusMotion, applyTheme, usePrefs } from "../lib/prefs";
import { browserSessionExpired } from "../lib/session-lifetime";
import { NotFound } from "./not-found";
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
				<FormError message={message} />
				<button className="btn primary" onClick={onRetry} type="button">
					{label}
				</button>
			</div>
		</main>
	);
}

function isAccountAuthError(error: Error | null) {
	return error instanceof APIError && [401, 403].includes(error.status);
}
function isTeamSection(
	value: string
): value is "details" | "members" | "invite" {
	return value === "details" || value === "members" || value === "invite";
}
function AccountView({
	status,
	onSessionEnded,
}: {
	status: Status;
	onSessionEnded: () => void;
}) {
	const client = useQueryClient();
	// Keep path and params on the same committed match during navigation.
	const location = useRouterState({
		select: (state): { params: { team?: string }; pathname: string } => {
			const match = state.matches.at(-1);
			return {
				params: { team: match?.params.team },
				pathname: match?.pathname ?? "/",
			};
		},
		structuralSharing: true,
	});
	const account = useQuery({
		queryFn: api.user,
		queryKey: ACCOUNT_KEY,
		refetchInterval: location.pathname === "/teams" ? 30_000 : false,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
		retry: false,
	});
	const { params } = location;
	const router = useRouter();
	const search = useSearch({ from: "__root__" });
	const initiatingEpoch = currentSessionEpoch();
	const initiatingEmail = account.data?.user.email;
	const initiatingCreated = account.data?.user.created;
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
		async (team: Team, openTeam = true) => {
			if (currentSessionEpoch() !== initiatingEpoch) {
				return;
			}
			await client.cancelQueries({ queryKey: ACCOUNT_KEY });
			const current = client.getQueryData<UserAccount>(ACCOUNT_KEY);
			if (
				currentSessionEpoch() !== initiatingEpoch ||
				!client.getQueryData<Status>(STATUS_KEY)?.signed_in ||
				current?.user.email !== initiatingEmail ||
				current?.user.created !== initiatingCreated
			) {
				return;
			}
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
			if (openTeam) {
				await pickTeam(team.handle);
			} else {
				await router.navigate({ to: "/teams" });
			}
		},
		[
			client,
			pickTeam,
			router,
			initiatingEpoch,
			initiatingEmail,
			initiatingCreated,
		]
	);
	const created = useCallback(
		(team: Team) =>
			available(
				team,
				!account.data?.teams.some((existing) => !existing.invitation)
			),
		[available, account.data?.teams]
	);
	const retry = useCallback(async () => {
		await account.refetch({ throwOnError: true });
	}, [account.refetch]);
	const teamSaved = useCallback(
		async (team: Team) => {
			const detailsKey = ["resource", "team-details", team.handle];
			await Promise.all([
				client.cancelQueries({ queryKey: ACCOUNT_KEY }),
				client.cancelQueries({ queryKey: detailsKey }),
			]);
			const current = client.getQueryData<UserAccount>(ACCOUNT_KEY);
			if (
				!(client.getQueryData<Status>(STATUS_KEY)?.signed_in && current) ||
				current.user.email !== account.data?.user.email ||
				current.user.created !== account.data?.user.created
			) {
				return;
			}
			client.setQueryData<UserAccount>(ACCOUNT_KEY, (previous) =>
				previous
					? {
							...previous,
							teams: previous.teams.map((existing) =>
								existing.handle === team.handle ? team : existing
							),
						}
					: previous
			);
			client.setQueryData(detailsKey, team);
		},
		[client, account.data?.user.email, account.data?.user.created]
	);
	useEffect(() => {
		if (account.isError && isAccountAuthError(account.error)) {
			onSessionEnded();
		}
	}, [account.isError, account.error, onSessionEnded]);
	if (account.isPending) {
		return <LoadingScreen />;
	}
	if (account.isError) {
		if (isAccountAuthError(account.error)) {
			return <LoadingScreen />;
		}
		if (!account.data) {
			return (
				<ConnectionError message={account.error.message} onRetry={retry} />
			);
		}
	}
	const teams = account.data.teams.filter((team) => !team.invitation);
	if (location.pathname.startsWith("/account/api-tokens")) {
		return (
			<APITokens
				account={account.data}
				key={`${account.data.user.email}:${account.data.user.created}`}
				status={status}
			/>
		);
	}
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
				onCreated={created}
				onRefresh={retry}
				refreshError={account.error}
				requestedTeam={params.team}
				teams={account.data.teams}
			/>
		);
	}
	const [, , , teamSection] = location.pathname.split("/");
	if (isTeamSection(teamSection)) {
		return (
			<TeamDetails onSaved={teamSaved} section={teamSection} team={selected} />
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
	const missing = useRouterState({
		select: (state) =>
			state.matches.some(
				(match) => match.status === "notFound" || isNotFound(match.error)
			),
	});
	const location = useLocation();
	const [prefs] = usePrefs();
	useEffect(() => applyTheme(prefs.theme), [prefs.theme]);
	useEffect(() => applyStatusMotion(prefs.statusMotion), [prefs.statusMotion]);
	const session = useQuery({
		queryFn: api.status,
		queryKey: STATUS_KEY,
		retry: false,
	});
	const { connected, logout } = useSessionActions();
	const [sessionEnded, setSessionEnded] = useState(browserSessionExpired);
	const sessionExpired = useCallback(() => {
		setSessionEnded(true);
		logout.mutate();
	}, [logout.mutate]);
	useSessionLifetime(session.data?.signed_in === true, sessionExpired);
	useEffect(() => {
		if (session.data?.signed_in && !browserSessionExpired()) {
			setSessionEnded(false);
		}
	}, [session.data?.signed_in]);
	const retry = useCallback(async () => {
		await session.refetch();
	}, [session.refetch]);
	if (missing) {
		return <NotFound />;
	}
	if (session.isPending) {
		return <LoadingScreen />;
	}
	if (session.isError) {
		return <ConnectionError message={session.error.message} onRetry={retry} />;
	}
	if (!session.data.signed_in) {
		if (
			location.pathname !== "/unlock" &&
			!location.pathname.startsWith("/sign-in")
		) {
			const returnTo = safeReturnTo(location.href);
			const entry = session.data.key_stored ? "/unlock" : "/sign-in";
			const destination = returnTo
				? `${entry}?returnTo=${encodeURIComponent(returnTo)}`
				: entry;
			return <Redirect href={destination} />;
		}
		return (
			<>
				<FormError
					message={
						sessionEnded
							? "Your session has ended. Sign in again to continue."
							: undefined
					}
				/>
				{location.pathname === "/unlock" ? (
					<UnlockKey />
				) : (
					<Connect onConnected={connected} status={session.data} />
				)}
			</>
		);
	}
	return <AccountView onSessionEnded={sessionExpired} status={session.data} />;
}
