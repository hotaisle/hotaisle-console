import { Link, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import type { APIToken } from "../../lib/api";

function TokenRow({
	token,
	current,
	canManage,
	onRevoke,
}: {
	token: APIToken;
	current: boolean;
	canManage: boolean;
	onRevoke: (token: APIToken) => void;
}) {
	const search = useSearch({ from: "__root__" });
	const revoke = useCallback(() => onRevoke(token), [onRevoke, token]);
	return (
		<li className="token-row">
			<div className="token-identity">
				<strong>{token.label || "Unlabelled token"}</strong>
				<code>{token.prefix}</code>
				{current ? <span className="small">Current sign-in</span> : null}
			</div>
			<div className="token-access">
				<span>Account: {token.user_role}</span>
				{token.teams.length ? (
					token.teams.map((team) => (
						<span key={team.handle}>
							{team.name || team.handle}: {team.roles.join(", ")}
						</span>
					))
				) : (
					<span className="muted">No team access</span>
				)}
			</div>
			{canManage ? (
				<div className="token-actions">
					<Link
						className="btn"
						params={{ prefix: token.prefix }}
						search={search}
						to="/account/api-tokens/$prefix"
					>
						Edit
					</Link>
					<button className="btn primary" onClick={revoke} type="button">
						Revoke
					</button>
				</div>
			) : null}
		</li>
	);
}
export function TokenList({
	tokens,
	prefix,
	canManage,
	onRevoke,
}: {
	tokens: APIToken[];
	prefix?: string;
	canManage: boolean;
	onRevoke: (token: APIToken) => void;
}) {
	const search = useSearch({ from: "__root__" });
	return (
		<>
			{canManage ? (
				<Link
					className="btn token-create"
					search={search}
					to="/account/api-tokens/new"
				>
					Create API token
				</Link>
			) : null}
			{tokens.length ? (
				<ul aria-label="Your API tokens" className="token-list">
					{tokens.map((token) => (
						<TokenRow
							canManage={canManage}
							current={token.prefix === prefix}
							key={token.prefix}
							onRevoke={onRevoke}
							token={token}
						/>
					))}
				</ul>
			) : (
				<p className="muted">No API tokens yet.</p>
			)}
		</>
	);
}
