import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { FormError } from "../../components/forms/form-error";
import { api } from "../../lib/api";

export function EmailApproval({
	email,
	onConnected,
	requestCode,
}: {
	email: string;
	onConnected: () => Promise<void>;
	requestCode: string;
}) {
	const approval = useQuery({
		gcTime: 0,
		queryFn: api.emailWait,
		queryKey: ["auth", "approval", email],
		refetchInterval: (query) =>
			query.state.data?.done || query.state.error ? false : 300,
		retry: false,
	});
	const completion = useMutation({ mutationFn: onConnected });
	const { mutate, isIdle } = completion;
	useEffect(() => {
		if (approval.data?.done && isIdle) {
			mutate();
		}
	}, [approval.data?.done, isIdle, mutate]);
	const error = approval.error ?? completion.error;
	return (
		<>
			<h1>Check your email</h1>
			<p className="lede">Your sign-in link is on its way to</p>
			<p className="auth-address">{email}</p>
			<p className="lede">
				Open the email on any device. Before approving, check that the code on
				the approval page matches this one.
			</p>
			<section
				aria-labelledby="request-code-label"
				className="auth-request-code"
			>
				<p id="request-code-label">Sign-in code</p>
				<strong>{requestCode}</strong>
			</section>
			<p className="hint">Only approve if both codes match.</p>
			<p aria-live="polite" className="auth-waiting" role="status">
				{error ? "Sign-in needs your attention" : "Waiting for your approval"}
			</p>
			{error ? <FormError message={error.message} /> : null}
		</>
	);
}
