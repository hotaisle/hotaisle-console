import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../../lib/api";

export function EmailApproval({
	email,
	onConnected,
}: {
	email: string;
	onConnected: () => Promise<void>;
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
				Open the email on any device and approve the sign-in. This page will
				take you straight to your console.
			</p>
			<p aria-live="polite" className="auth-waiting" role="status">
				{error ? "Sign-in needs your attention" : "Waiting for your approval"}
			</p>
			{error ? (
				<p className="error" role="alert">
					{error.message}
				</p>
			) : null}
		</>
	);
}
