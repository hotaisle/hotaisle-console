import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TokenHelp } from "../api-tokens/token-help";
import { AuthShell } from "../auth/auth-shell";
import "./access-shell.css";

export function AccessShell({
	children,
	section,
}: {
	children: ReactNode;
	section: "teams" | "tokens" | "setup";
}) {
	const label = section === "setup" ? "Create a team" : "Teams & tokens";
	return (
		<AuthShell label={label}>
			<div className="access-management">
				<h1>{label}</h1>
				{section === "setup" ? null : (
					<nav aria-label="Teams and tokens" className="access-tabs">
						<Link
							aria-current={section === "teams" ? "page" : undefined}
							to="/teams"
						>
							Teams
						</Link>
						<Link
							aria-current={section === "tokens" ? "page" : undefined}
							to="/account/api-tokens"
						>
							API tokens
						</Link>
						{section === "tokens" ? <TokenHelp /> : null}
					</nav>
				)}
				{children}
			</div>
		</AuthShell>
	);
}
