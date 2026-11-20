import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { FormError } from "../../components/forms/form-error";
import { ButtonLabels } from "../../components/ui/button-labels";
import type { Team } from "../../lib/api";
import { AccessShell } from "./access-shell";
import { CreateTeamForm } from "./create-team-form";
import { TeamInvitation } from "./team-invitation";
import "./teams.css";

export function TeamChoice({
	teams,
	email,
	creating = false,
	onAvailable,
	onCreated,
	onRefresh,
	refreshError,
	requestedTeam,
}: {
	teams: Team[];
	email: string;
	creating?: boolean;
	onAvailable: (team: Team) => Promise<void>;
	onCreated: (team: Team) => Promise<void>;
	onRefresh: () => Promise<void>;
	refreshError?: Error | null;
	requestedTeam?: string;
}) {
	const refresh = useMutation({ mutationFn: onRefresh });
	const reload = useCallback(() => refresh.mutate(), [refresh.mutate]);
	const memberships = teams.filter((team) => !team.invitation);
	const invitations = teams.filter((team) => team.invitation);
	const showCreate = creating || teams.length === 0;
	const onboarding = showCreate && memberships.length === 0;
	return (
		<AccessShell section={onboarding ? "setup" : "teams"}>
			{showCreate && !onboarding ? (
				<h2 className="team-section-title">Create a team</h2>
			) : null}
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
							aria-busy={refresh.isPending}
							className="btn-text"
							disabled={refresh.isPending}
							onClick={reload}
							type="button"
						>
							<ButtonLabels active={refresh.isPending} alternate="Retrying…">
								Retry update
							</ButtonLabels>
						</button>
					}
					message={"Could not update teams. Your current list is still shown."}
				/>
			) : null}
			{showCreate ? (
				<CreateTeamForm onCreated={onCreated} />
			) : (
				<div className="team-sections">
					<Link className="btn primary team-create-link" to="/teams/new">
						Create a team
					</Link>
					{memberships.length > 0 ? (
						<section aria-label="Your teams">
							<ul className="team-list">
								{memberships.map((team) => (
									<li className="team-card" key={team.handle}>
										<div className="team-identity">
											<strong>
												<Link
													params={{ team: team.handle }}
													to="/teams/$team/details"
												>
													{team.name}
												</Link>
											</strong>
											<span className="mono muted">{team.handle}</span>
										</div>
										<ul
											aria-label="Your permissions"
											className="team-role-list"
										>
											{team.roles.map((role) => (
												<li key={role}>{role}</li>
											))}
										</ul>
										<div className="team-card-actions">
											<Link
												aria-label={`Manage team ${team.name}`}
												className="btn"
												params={{ team: team.handle }}
												to="/teams/$team/details"
											>
												Manage team
											</Link>
											<Link
												aria-label={`Open team ${team.name}`}
												className="btn"
												params={{ team: team.handle }}
												to="/teams/$team/machines"
											>
												Open team <span aria-hidden="true">→</span>
											</Link>
										</div>
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
		</AccessShell>
	);
}
