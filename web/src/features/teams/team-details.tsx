import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { api, type Team } from "../../lib/api";
import { AuthShell } from "../auth/auth-shell";
import { EditTeamForm } from "./edit-team-form";
import "./teams.css";

export function TeamDetails({
	team,
	onSaved,
}: {
	team: Team;
	onSaved: (team: Team) => Promise<void>;
}) {
	const details = useQuery({
		queryFn: () => api.team(team.handle),
		queryKey: ["resource", "team-details", team.handle],
		refetchOnWindowFocus: false,
		retry: false,
	});
	const retry = useCallback(() => details.refetch(), [details.refetch]);
	return (
		<AuthShell
			footer={
				<Link className="btn-text" to="/teams">
					Back to your teams
				</Link>
			}
			label="Team details"
		>
			<h1>Team details</h1>
			{details.isPending ? <p role="status">Loading team details…</p> : null}
			{details.error ? (
				<div className="stack">
					<p role="alert">{details.error.message}</p>
					<button className="btn" onClick={retry} type="button">
						Try again
					</button>
				</div>
			) : null}
			{details.data ? (
				<TeamDetailsContent onSaved={onSaved} team={details.data} />
			) : null}
		</AuthShell>
	);
}
function TeamDetailsContent({
	team,
	onSaved,
}: {
	team: Team;
	onSaved: (team: Team) => Promise<void>;
}) {
	if (team.effective_roles.includes("owner")) {
		return <EditTeamForm onSaved={onSaved} team={team} />;
	}
	return (
		<div className="stack">
			<p>{team.name}</p>
			<p>{team.description || "No description."}</p>
			<p className="muted">A team owner can edit these details.</p>
		</div>
	);
}
