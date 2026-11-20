import { useId } from "react";
import type { Team, TeamMember } from "../../lib/api";
import { TEAM_ROLE_OPTIONS } from "../../lib/team-role-options";
import { EditMemberPermissions } from "./edit-member-permissions";

export function TeamMembers({
	team,
	onUpdated,
}: {
	team: Team;
	onUpdated: () => Promise<void>;
}) {
	const heading = useId();
	return (
		<section aria-labelledby={heading} className="team-members">
			<h2 className="team-section-title" id={heading}>
				Members
			</h2>
			{team.members ? (
				<div className="team-member-list">
					{team.members.map((member) => (
						<MemberCard
							key={member.email}
							member={member}
							onUpdated={onUpdated}
							team={team}
						/>
					))}
					{team.members.length === 0 ? (
						<p className="hint">No team members to show.</p>
					) : null}
				</div>
			) : (
				<p className="hint">Member information is unavailable.</p>
			)}
			<aside aria-label="Permission key" className="team-permission-key">
				<dl>
					{TEAM_ROLE_OPTIONS.map((role) => (
						<div key={role.value}>
							<dt>{role.label}:</dt>
							<dd>{role.description}</dd>
						</div>
					))}
				</dl>
			</aside>
		</section>
	);
}

function MemberCard({
	member,
	team,
	onUpdated,
}: {
	member: TeamMember;
	team: Team;
	onUpdated: () => Promise<void>;
}) {
	const heading = useId();
	const editable = team.effective_roles.includes("owner") && !member.invitation;
	const lastOwner =
		member.roles.includes("owner") &&
		!team.members?.some(
			(other) =>
				other.email !== member.email &&
				!other.invitation &&
				other.roles.includes("owner")
		);
	const currentStatus = lastOwner ? "Current owner" : "Current member";
	const status = member.invitation ? "Pending invitation" : currentStatus;
	return (
		<section aria-labelledby={heading} className="team-member-card">
			<header className="team-member-heading">
				<div className="team-member-identity">
					<h3 id={heading}>{member.name || member.email}</h3>
					{member.name && member.name !== member.email ? (
						<a href={`mailto:${encodeURIComponent(member.email)}`}>
							{member.email}
						</a>
					) : null}
				</div>
				<span className="team-member-status">{status}</span>
			</header>
			{editable ? (
				<EditMemberPermissions
					lastOwner={lastOwner}
					member={member}
					onUpdated={onUpdated}
					team={team.handle}
				/>
			) : (
				<div className="team-member-readonly">
					<p className="team-member-roles">{member.roles.join(", ")}</p>
					<p className="hint">
						{member.invitation
							? "Permissions can be edited after the invitation is accepted."
							: "A team owner can edit permissions."}
					</p>
				</div>
			)}
		</section>
	);
}
