import { useLocation, useSearch } from "@tanstack/react-router";
import { FormError } from "../../components/forms/form-error";
import type { APIToken, Status, Team, UserAccount } from "../../lib/api";
import { AuthShell } from "../auth/auth-shell";
import { CreatedToken } from "./created-token";
import { RevokeToken } from "./revoke-token";
import { TokenForm } from "./token-form";
import { TokenList } from "./token-list";
import { TokenNavigation } from "./token-navigation";
import { TOKEN_PATH, useTokenManagement } from "./use-token-management";
import "../teams/teams.css";
import "./api-tokens.css";

function TokenContent({
	account,
	manager,
	scope,
	tokens,
}: {
	account: UserAccount;
	manager: ReturnType<typeof useTokenManagement>;
	scope?: Team;
	tokens: APIToken[];
}) {
	const location = useLocation();
	const creating = location.pathname === `${TOKEN_PATH}/new`;
	const editing = !creating && location.pathname !== TOKEN_PATH;
	const selected = tokens.find(
		(token) =>
			`${TOKEN_PATH}/${encodeURIComponent(token.prefix)}` === location.pathname
	);
	if (!(creating || editing)) {
		return (
			<TokenList
				canManage={manager.canManage}
				onRevoke={manager.remove}
				prefix={manager.prefix}
				tokens={tokens}
			/>
		);
	}
	return (
		<>
			{manager.canManage && (creating || selected) ? (
				<TokenForm
					key={selected?.prefix ?? scope?.handle ?? "new"}
					onSaved={manager.saved}
					requiredTeam={creating ? scope?.handle : undefined}
					teams={
						creating && scope
							? [scope]
							: account.teams.filter((team) => !team.invitation)
					}
					token={selected}
				/>
			) : null}
			{editing && !selected ? (
				<FormError
					message={"This API token was not found. It may have been revoked."}
				/>
			) : null}
		</>
	);
}
export function APITokens({
	account,
	status,
}: {
	account: UserAccount;
	status: Status;
}) {
	const manager = useTokenManagement(account, status);
	const search = useSearch({ from: "__root__" });
	const scope = account.teams.find(
		(team) => team.handle === search.tokenTeam && !team.invitation
	);
	const validScope = !search.tokenTeam || !!scope;
	const tokens = (manager.tokens.data ?? []).filter(
		(token) =>
			!search.tokenTeam ||
			token.teams.some((team) => team.handle === search.tokenTeam)
	);
	return (
		<AuthShell label="API tokens">
			<TokenNavigation account={account} tokens={tokens} />
			<header className="token-page-heading">
				<h1>API tokens</h1>
			</header>
			{validScope ? null : (
				<FormError
					message={
						"You are not a member of this team. Choose one of your teams to manage its API tokens."
					}
				/>
			)}
			{manager.tokens.isPending ? (
				<p role="status">Loading API tokens…</p>
			) : null}
			{manager.tokens.error ? (
				<FormError
					actions={
						<button
							className="btn primary"
							onClick={manager.retry}
							type="button"
						>
							Try again
						</button>
					}
					message={manager.tokens.error.message}
				/>
			) : null}
			{manager.generated && validScope ? (
				<CreatedToken
					label={manager.generated.label}
					onDismiss={manager.dismiss}
					value={manager.generated.value}
				/>
			) : null}
			{manager.tokens.data && validScope ? (
				<div className="token-management">
					{manager.canManage ? null : (
						<p className="muted">
							Sign in with email or an API token with account owner access to
							create, edit, or revoke tokens.
						</p>
					)}
					<TokenContent
						account={account}
						manager={manager}
						scope={scope}
						tokens={tokens}
					/>
				</div>
			) : null}
			{manager.removing ? (
				<RevokeToken
					current={manager.removing.prefix === manager.prefix}
					onClose={manager.close}
					onRevoked={manager.revoked}
					token={manager.removing}
				/>
			) : null}
		</AuthShell>
	);
}
