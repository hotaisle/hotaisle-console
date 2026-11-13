import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { FormError } from "../../components/forms/form-error";
import { api, type Team } from "../../lib/api";
import { AuthShell } from "../auth/auth-shell";
import { EditTeamForm } from "./edit-team-form";
import { TeamMembers } from "./team-members";
import "./teams.css";

export function TeamDetails({
	team,
	onSaved,
}: {
	team: Team;
	onSaved: (team: Team) => Promise<void>;
}) {
	const client = useQueryClient();
	const details = useQuery({
		queryFn: () => api.team(team.handle),
		queryKey: ["resource", "team-details", team.handle],
		refetchInterval: 10_000,
		refetchOnWindowFocus: true,
		retry: false,
	});
	const retry = useCallback(() => details.refetch(), [details.refetch]);
	const invited = useCallback(async () => {
		const queryKey = ["resource", "team-details", team.handle];
		await client.cancelQueries({ exact: true, queryKey });
		await client.invalidateQueries({ exact: true, queryKey });
	}, [client, team.handle]);
	return (
		<AuthShell
			footer={
				<Link className="btn-text" to="/teams">
					Back to your teams
				</Link>
			}
			label="Manage team"
		>
			<header className="team-management-heading">
				<h1>{details.data?.name ?? team.name}</h1>
				<p className="team-handle">
					Team handle: <code>{team.handle}</code>
				</p>
			</header>
			{details.isPending ? <p role="status">Loading team details…</p> : null}
			{details.error ? (
				<FormError
					actions={
						<button className="btn" onClick={retry} type="button">
							Try again
						</button>
					}
					message={details.error.message}
				/>
			) : null}
			{details.data ? (
				<TeamDetailsContent
					key={details.data.handle}
					onInvited={invited}
					onSaved={onSaved}
					team={details.data}
				/>
			) : null}
		</AuthShell>
	);
}
function TeamDetailsContent({
	team,
	onSaved,
	onInvited,
}: {
	team: Team;
	onSaved: (team: Team) => Promise<void>;
	onInvited: () => Promise<void>;
}) {
	return (
		<div className="team-management">
			<section aria-label="Team details">
				<h2 className="team-section-title">Team details</h2>
				{team.effective_roles.includes("owner") ? (
					<EditTeamForm onSaved={onSaved} team={team} />
				) : (
					<div className="stack">
						<p>{team.name}</p>
						<p>{team.description || "No description."}</p>
						<p className="muted">A team owner can edit these details.</p>
					</div>
				)}
			</section>
			<TeamMembers onInvited={onInvited} team={team} />
		</div>
	);
}
