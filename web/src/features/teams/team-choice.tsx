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
	refreshError,
	requestedTeam,
}: {
	teams: Team[];
	email: string;
	creating?: boolean;
	onAvailable: (team: Team) => Promise<void>;
	onRefresh: () => Promise<void>;
	refreshError?: Error | null;
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
						disabled={logout.isPending}
						onClick={signOut}
						type="button"
					>
						Sign out
					</button>
					<FormError message={logout.error?.message ?? ""} />
				</div>
			}
			label="Teams"
		>
			<h1>{showCreate ? "Create a team" : "Choose a team"}</h1>
			{showCreate ? (
				<p className="lede team-intro">
					Teams keep your machines and members together. Create one to get
					started.
				</p>
			) : null}
			{requestedTeam ? (
				<p className="team-notice" role="status">
					You don't have access to {requestedTeam}. Choose another team or
					accept an invitation below.
				</p>
			) : null}
			{refreshError || refresh.error ? (
				<FormError
					actions={
						<button
							className="btn-text"
							disabled={refresh.isPending}
							onClick={reload}
							type="button"
						>
							{refresh.isPending ? "Retrying…" : "Retry update"}
						</button>
					}
					message={"Could not update teams. Your current list is still shown."}
				/>
			) : null}
			{showCreate ? (
				<CreateTeamForm onCreated={onAvailable} />
			) : (
				<div className="team-sections">
					{memberships.length > 0 ? (
						<section aria-label="Your teams">
							<h2 className="team-section-title">Open an existing team</h2>
							<ul className="team-list">
								{memberships.map((team) => (
									<li className="team-card" key={team.handle}>
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
										<footer className="team-card-actions">
											{team.effective_roles.includes("owner") ? (
												<Link
													aria-label={`Manage team ${team.name}`}
													className="team-edit-link btn-text"
													params={{ team: team.handle }}
													to="/teams/$team/details"
												>
													Manage team
												</Link>
											) : null}
											<Link
												aria-label={`API tokens for ${team.name}`}
												className="team-edit-link btn-text"
												search={{
													returnTo: `/teams/${encodeURIComponent(team.handle)}/machines`,
													tokenTeam: team.handle,
												}}
												to="/account/api-tokens"
											>
												API tokens
											</Link>
										</footer>
									</li>
								))}
							</ul>
						</section>
					) : null}
					{invitations.length > 0 ? (
						<section aria-label="Team invitations">
							<h2 className="team-section-title">Invitations</h2>
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
					<div aria-hidden="true" className="team-choice-divider">
						or
					</div>
					<section
						aria-label="Create a new team"
						className="team-create-option"
					>
						<div>
							<h2 className="team-section-title">Create a new team</h2>
							<p>Start a team for a new project or group.</p>
						</div>
						<Link className="btn primary team-create-link" to="/teams/new">
							Create a team
						</Link>
					</section>
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
