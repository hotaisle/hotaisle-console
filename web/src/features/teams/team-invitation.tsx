import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { FormError } from "../../components/forms/form-error";
import { APIError, api, type Team } from "../../lib/api";

export function TeamInvitation({
	team,
	onAccepted,
}: {
	team: Team;
	onAccepted: (team: Team) => Promise<void>;
}) {
	const invitation = useMutation({
		mutationFn: () => api.acceptTeamInvitation(team.handle),
		onSuccess: onAccepted,
	});
	const accept = useCallback(() => invitation.mutate(), [invitation.mutate]);
	const { error } = invitation;
	const message =
		error instanceof APIError && error.status === 403
			? "Your current sign-in cannot accept invitations. Sign in with email or use an API key with account owner access."
			: (error?.message ?? "");
	return (
		<li className="team-invitation">
			<div className="team-row">
				<div className="team-identity">
					<strong>{team.name}</strong>
					<span className="mono muted">{team.handle}</span>
				</div>
				<button
					aria-label={`Accept invitation to ${team.name}`}
					className="btn"
					disabled={invitation.isPending}
					onClick={accept}
					type="button"
				>
					{invitation.isPending ? "Joining…" : "Accept invitation"}
				</button>
			</div>
			<FormError message={message} />
		</li>
	);
}
