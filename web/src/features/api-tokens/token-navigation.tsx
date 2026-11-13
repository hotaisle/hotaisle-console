import { Link, useLocation, useSearch } from "@tanstack/react-router";
import type { APIToken, UserAccount } from "../../lib/api";
import { TOKEN_PATH } from "./use-token-management";

export function TokenNavigation({
	account,
	tokens,
}: {
	account: UserAccount;
	tokens: APIToken[];
}) {
	const location = useLocation();
	const search = useSearch({ from: "__root__" });
	const teams = account.teams.filter((membership) => !membership.invitation);
	const scope = teams.find(
		(membership) => membership.handle === search.tokenTeam
	);
	const team = search.tokenTeam
		? scope
		: (teams.find((item) =>
				search.returnTo?.startsWith(
					`/teams/${encodeURIComponent(item.handle)}/`
				)
			) ?? teams[0]);
	const list = location.pathname === TOKEN_PATH;
	const token = tokens.find(
		(item) =>
			`${TOKEN_PATH}/${encodeURIComponent(item.prefix)}` === location.pathname
	);
	const current =
		location.pathname === `${TOKEN_PATH}/new`
			? "Create token"
			: token?.label || "Token";
	return (
		<div className="account-navigation">
			<nav aria-label="Breadcrumbs" className="account-breadcrumbs">
				<ol>
					<li>
						<Link activeOptions={{ exact: true }} to="/teams">
							Your teams
						</Link>
					</li>
					{scope ? (
						<li>
							<Link
								activeOptions={{ exact: true }}
								params={{ team: scope.handle }}
								to="/teams/$team/machines"
							>
								{scope.name}
							</Link>
						</li>
					) : null}
					<li>
						<Link
							activeOptions={{ exact: true }}
							aria-current={list ? "page" : undefined}
							search={search}
							to={TOKEN_PATH}
						>
							API tokens
						</Link>
					</li>
					{list ? null : (
						<li>
							<Link
								activeOptions={{ exact: true }}
								aria-current="page"
								search={search}
								to={location.pathname}
							>
								{current}
							</Link>
						</li>
					)}
				</ol>
			</nav>
			{team ? (
				<Link
					className="account-console-link"
					params={{ team: team.handle }}
					to="/teams/$team/machines"
				>
					Team console <span aria-hidden="true">→</span>
				</Link>
			) : null}
		</div>
	);
}
