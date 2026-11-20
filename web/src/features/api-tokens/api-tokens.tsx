import { useLocation } from "@tanstack/react-router";
import { FormError } from "../../components/forms/form-error";
import type { APIToken, Status, UserAccount } from "../../lib/api";
import { AccessShell } from "../teams/access-shell";
import { CreatedToken } from "./created-token";
import { RevokeToken } from "./revoke-token";
import { TokenForm } from "./token-form";
import { TokenList } from "./token-list";
import { TokenSkeleton } from "./token-skeleton";
import { TOKEN_PATH, useTokenManagement } from "./use-token-management";
import "../teams/teams.css";
import "./api-tokens.css";

function TokenContent({
	account,
	manager,
	tokens,
}: {
	account: UserAccount;
	manager: ReturnType<typeof useTokenManagement>;
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
					key={selected?.prefix ?? "new"}
					onSaved={manager.saved}
					teams={account.teams.filter((team) => !team.invitation)}
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
	const tokens = manager.tokens.data ?? [];
	return (
		<AccessShell section="tokens">
			{manager.tokens.isPending ? (
				<TokenSkeleton canManage={manager.canManage} />
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
			{manager.generated ? (
				<CreatedToken
					label={manager.generated.label}
					onDismiss={manager.dismiss}
					value={manager.generated.value}
				/>
			) : null}
			{manager.tokens.data ? (
				<div className="token-management">
					{manager.canManage ? null : (
						<p className="muted">
							Sign in with email or an API token with account owner access to
							create, edit, or revoke tokens.
						</p>
					)}
					<TokenContent account={account} manager={manager} tokens={tokens} />
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
		</AccessShell>
	);
}
