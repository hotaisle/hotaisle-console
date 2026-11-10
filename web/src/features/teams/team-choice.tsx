import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { FormError } from "../../components/forms/form-error";
import { useSessionActions } from "../../hooks/use-session";
import type { Team } from "../../lib/api";
import { AuthShell } from "../auth/auth-shell";
import { CreateTeamForm } from "./create-team-form";
import { TeamInvitation } from "./team-invitation";
import "./teams.css";

export function TeamChoice({
	teams,
	email,
	creating = false,
	onAvailable,
	onRefresh,
	requestedTeam,
}: {
	teams: Team[];
	email: string;
	creating?: boolean;
	onAvailable: (team: Team) => Promise<void>;
	onRefresh: () => Promise<void>;
	requestedTeam?: string;
}) {
	const { logout } = useSessionActions();
	const refresh = useMutation({ mutationFn: onRefresh });
	const signOut = useCallback(() => logout.mutate(), [logout.mutate]);
	const reload = useCallback(() => refresh.mutate(), [refresh.mutate]);
	const memberships = teams.filter((team) => !team.invitation);
	const invitations = teams.filter((team) => team.invitation);
	const showCreate = creating || teams.length === 0;
	return (
		<AuthShell
			footer={
				<div className="team-footer">
					<span className="muted">Logged in as {email}</span>
					<button
						className="btn-text"
						disabled={refresh.isPending}
						onClick={reload}
						type="button"
					>
						{refresh.isPending ? "Refreshing…" : "Refresh teams"}
					</button>
					<button
						className="btn-text"
						disabled={logout.isPending}
						onClick={signOut}
						type="button"
					>
						Sign out
					</button>
					<FormError
						message={logout.error?.message ?? refresh.error?.message ?? ""}
					/>
				</div>
			}
			label="Teams"
		>
			<h1>{showCreate ? "Create a team" : "Choose a team"}</h1>
			<p className="lede team-intro">
				{showCreate
					? "Teams keep your machines and members together. Create one to get started."
					: "Choose a team to open its machines, or accept an invitation to join one."}
			</p>
			{requestedTeam ? (
				<p className="team-notice" role="status">
					You don't have access to {requestedTeam}. Choose another team or
					accept an invitation below.
				</p>
			) : null}
			{showCreate ? (
				<CreateTeamForm onCreated={onAvailable} />
			) : (
				<div className="team-sections">
					{memberships.length > 0 ? (
						<section aria-label="Your teams">
							<h2 className="group-h">Your teams</h2>
							<ul className="team-list">
								{memberships.map((team) => (
									<li key={team.handle}>
										<Link
											aria-label={`Open team ${team.name}`}
											className="team-row team-link"
											params={{ team: team.handle }}
											to="/teams/$team/machines"
										>
											<div className="team-identity">
												<strong>{team.name}</strong>
												<span className="mono muted">{team.handle}</span>
											</div>
											<span className="team-open">
												Open team <span aria-hidden="true">→</span>
											</span>
										</Link>
									</li>
								))}
							</ul>
						</section>
					) : null}
					{invitations.length > 0 ? (
						<section aria-label="Team invitations">
							<h2 className="group-h">Invitations</h2>
							<ul className="team-list">
								{invitations.map((team) => (
									<TeamInvitation
										key={team.handle}
										onAccepted={onAvailable}
										team={team}
									/>
								))}
							</ul>
						</section>
					) : null}
					<Link className="btn primary team-create-link" to="/teams/new">
						Create a team
					</Link>
				</div>
			)}
			{showCreate && teams.length > 0 ? (
				<Link className="btn-text team-back" to="/teams">
					Back to your teams and invitations
				</Link>
			) : null}
			{invitations.length === 0 ? (
				<p className="hint team-join-hint">
					Joining an existing team? Ask a team owner to invite you at {email}.
				</p>
			) : null}
		</AuthShell>
	);
}
