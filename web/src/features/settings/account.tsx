import { useCallback } from "react";
import { FormError } from "../../components/forms/form-error";
import { useSessionActions } from "../../hooks/use-session";
import type { Status } from "../../lib/api";

export function AccountSettings({ status }: { status: Status }) {
	const { logout } = useSessionActions();
	const signOut = useCallback(() => logout.mutate(), [logout.mutate]);
	const method =
		status.kind === "email"
			? "Signed in with an emailed link."
			: "Signed in with an API key.";
	return (
		<section className="group">
			<p className="muted small">{method}</p>
			{logout.error ? <FormError message={logout.error.message} /> : null}
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
