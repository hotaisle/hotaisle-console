import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useCallback } from "react";
import { useSessionActions } from "../../hooks/use-session";
import type { Status, Team } from "../../lib/api";

export function AccountSettings({
	status,
	teams,
	team,
	onTeam,
}: {
	status: Status;
	teams: Team[];
	team: Team;
	onTeam: (handle: string) => void;
}) {
	const { logout } = useSessionActions();
	const changeTeam = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) =>
			onTeam(event.currentTarget.value),
		[onTeam]
	);
	const signOut = useCallback(() => logout.mutate(), [logout.mutate]);
	const method =
		status.kind === "email"
			? "Signed in with an emailed link."
			: "Signed in with an API key.";
	return (
		<section className="group">
			<h2 className="group-h section-heading">Account</h2>
			<Link
				className="btn-text more"
				params={{ team: team.handle }}
				to="/teams/$team/details"
			>
				Manage team
			</Link>
			{teams.length > 1 ? (
				<div className="field">
					<label className="field-l" htmlFor="team">
						Team
					</label>
					<select id="team" onChange={changeTeam} value={team.handle}>
						{teams.map((option) => (
							<option key={option.handle} value={option.handle}>
								{option.name}
							</option>
						))}
					</select>
				</div>
			) : null}
			<p className="muted small">{method}</p>
			{logout.error ? (
				<p className="error" role="alert">
					{logout.error.message}
				</p>
			) : null}
			<button
				className="btn"
				disabled={logout.isPending}
				onClick={signOut}
				type="button"
			>
				Sign out
			</button>
		</section>
	);
}
