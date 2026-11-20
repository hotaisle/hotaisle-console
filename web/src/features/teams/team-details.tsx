import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { FormError } from "../../components/forms/form-error";
import type { Team } from "../../lib/api";
import { api } from "../../lib/api";
import { AccessShell } from "./access-shell";
import { EditTeamForm } from "./edit-team-form";
import { InviteTeamMemberForm } from "./invite-team-member-form";
import { TeamMembers } from "./team-members";
import "./teams.css";

type TeamSection = "details" | "members" | "invite";
const SECTIONS = [
	{ label: "Details", section: "details", to: "/teams/$team/details" },
	{ label: "Members", section: "members", to: "/teams/$team/members" },
	{ label: "Invite", section: "invite", to: "/teams/$team/invite" },
] as const;

export function TeamDetails({
	team,
	onSaved,
	section,
}: {
	team: Team;
	onSaved: (team: Team) => Promise<void>;
	section: TeamSection;
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
	const memberUpdated = useCallback(async () => {
		await client.cancelQueries({
			exact: true,
			queryKey: ["resource", "team-details", team.handle],
		});
		await onSaved(await api.team(team.handle));
	}, [client, onSaved, team.handle]);
	return (
		<AccessShell section="teams">
			<header className="team-management-heading">
				<h2>{details.data?.name ?? team.name}</h2>
				<p className="team-handle">
					<code>{team.handle}</code>
				</p>
			</header>
			<div>
				<nav aria-label="Team management" className="team-tabs">
					{SECTIONS.map((item) => (
						<Link
							aria-current={section === item.section ? "page" : undefined}
							className="team-tab"
							key={item.section}
							params={{ team: team.handle }}
							to={item.to}
						>
							{item.label}
						</Link>
					))}
				</nav>
				{details.isPending ? <TeamLoadingChrome section={section} /> : null}
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
						onMemberUpdated={memberUpdated}
						onSaved={onSaved}
						section={section}
						team={details.data}
					/>
				) : null}
			</div>
		</AccessShell>
	);
}

function TeamLoadingChrome({ section }: { section: TeamSection }) {
	return (
		<div
			aria-busy="true"
			aria-label={`Loading team ${section}`}
			className="team-management"
			role="progressbar"
		>
			<div aria-hidden="true" className="team-loading">
				{section === "members" ? (
					<div className="team-loading-member" />
				) : (
					<>
						{["first", "second"].map((field) => (
							<div className="team-loading-field" key={field}>
								<div className="team-loading-label" />
								<div className="team-loading-input" />
							</div>
						))}
						<div className="team-loading-button" />
					</>
				)}
			</div>
		</div>
	);
}
function TeamDetailsContent({
	team,
	onSaved,
	onInvited,
	onMemberUpdated,
	section,
}: {
	team: Team;
	onSaved: (team: Team) => Promise<void>;
	onInvited: () => Promise<void>;
	onMemberUpdated: () => Promise<void>;
	section: TeamSection;
}) {
	return (
		<div className="team-management">
			{section === "details" ? (
				<section aria-label="Team details" className="team-details-panel">
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
			) : null}
			{section === "members" ? (
				<TeamMembers onUpdated={onMemberUpdated} team={team} />
			) : null}
			{section === "invite" && team.effective_roles.includes("owner") ? (
				<InviteTeamMemberForm onInvited={onInvited} team={team} />
			) : null}
			{section === "invite" && !team.effective_roles.includes("owner") ? (
				<section aria-label="Invite team member" className="team-details-panel">
					<h2 className="team-section-title">Invite team member</h2>
					<p className="hint">A team owner can invite people to this team.</p>
				</section>
			) : null}
		</div>
	);
}
