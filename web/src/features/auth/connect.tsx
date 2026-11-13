import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useRouter, useSearch } from "@tanstack/react-router";
import { type ReactNode, useCallback, useState } from "react";
import { Redirect } from "../../app/redirect";
import { STATUS_KEY } from "../../hooks/use-session";
import type { PendingEmailLogin, Status } from "../../lib/api";
import { ApiKeySignIn } from "./api-key-sign-in";
import { AuthShell } from "./auth-shell";
import { EmailApproval } from "./email-approval";
import { EmailSignIn } from "./email-sign-in";

export function Connect({
	status,
	onConnected,
}: {
	status: Status;
	onConnected: () => Promise<void>;
}) {
	const location = useLocation();
	const router = useRouter();
	const client = useQueryClient();
	const search = useSearch({ from: "__root__" });
	const [sentLogin, setSentLogin] = useState(status.waiting_for_email);
	const pending = status.waiting_for_email ?? sentLogin;
	const chooseEmail = useCallback(
		() => router.navigate({ replace: true, search, to: "/sign-in" }),
		[router, search]
	);
	const chooseApiKey = useCallback(
		() => router.navigate({ search, to: "/sign-in/key" }),
		[router, search]
	);
	const sent = useCallback(
		(login: PendingEmailLogin) => {
			setSentLogin(login);
			client.setQueryData<Status>(STATUS_KEY, (previous) => ({
				...status,
				...previous,
				waiting_for_email: login,
			}));
			router.navigate({ search, to: "/sign-in/check-email" });
		},
		[client, router, search, status]
	);
	const waiting = location.pathname === "/sign-in/check-email";
	const useKey = location.pathname === "/sign-in/key" || !status.email_login;
	if (waiting && !pending) {
		return <Redirect href="/sign-in" />;
	}
	let footer: ReactNode = null;
	if (!(waiting || useKey)) {
		footer = (
			<button className="btn-text" onClick={chooseApiKey} type="button">
				Use an API key instead <span aria-hidden="true">→</span>
			</button>
		);
	} else if (status.email_login) {
		footer = (
			<button className="btn-text" onClick={chooseEmail} type="button">
				{waiting ? "Use a different email" : "Sign in with email"}
			</button>
		);
	}
	return (
		<AuthShell footer={footer}>
			{waiting && pending ? (
				<EmailApproval
					email={pending.email}
					onConnected={onConnected}
					requestCode={pending.request_code}
				/>
			) : null}
			{!waiting && useKey ? <ApiKeySignIn onConnected={onConnected} /> : null}
			{waiting || useKey ? null : <EmailSignIn onSent={sent} />}
		</AuthShell>
	);
}
