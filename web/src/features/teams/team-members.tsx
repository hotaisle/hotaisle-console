import { useId } from "react";
import type { Team, TeamMember } from "../../lib/api";
import { InviteTeamMemberForm } from "./invite-team-member-form";

export function TeamMembers({
	team,
	onInvited,
}: {
	team: Team;
	onInvited: () => Promise<void>;
}) {
	const heading = useId();
	return (
		<section aria-labelledby={heading} className="team-members">
			<h2 className="team-section-title" id={heading}>
				Members
			</h2>
			{team.members ? (
				<MemberTable members={team.members} />
			) : (
				<p className="hint">Member information is unavailable.</p>
			)}
			{team.effective_roles.includes("owner") ? (
				<InviteTeamMemberForm onInvited={onInvited} team={team} />
			) : (
				<p className="hint">A team owner can invite people to this team.</p>
			)}
		</section>
	);
}

function MemberTable({ members }: { members: TeamMember[] }) {
	const caption = useId();
	return (
		<section aria-labelledby={caption} className="team-member-table-wrap">
			<table className="team-member-table">
				<caption className="visually-hidden" id={caption}>
					Team members and invitations
				</caption>
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">Email</th>
						<th scope="col">Permissions</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{members.map((member) => (
						<tr key={member.email}>
							<th scope="row">{member.name}</th>
							<td>
								<a href={`mailto:${encodeURIComponent(member.email)}`}>
									{member.email}
								</a>
							</td>
							<td className="team-member-roles">{member.roles.join(", ")}</td>
							<td>{member.invitation ? "Pending" : "Current"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
