import { Link } from "@tanstack/react-router";
import { isPresent } from "../../../../shared/present";
import { type View, viewPath } from "../../app/route-state";
import { Brand } from "../../components/brand";
import type { Balance, Team } from "../../lib/api";
import { duration, money } from "../../lib/format";
import { useNavigation } from "./use-navigation";

function balanceLabel(balance?: Balance, runout?: number) {
	if (!balance) {
		return " ";
	}
	if (balance.hourly_rate <= 0) {
		return "Balance";
	}
	return `${money(balance.hourly_rate)}/hr, lasts ${isPresent(runout) ? duration(runout) : "…"}`;
}
export function ConsoleHeader({
	team,
	balance,
	titles,
}: {
	team: Team;
	balance?: Balance;
	titles: Record<View, string>;
}) {
	const { view, search } = useNavigation(team.handle);
	const runout = balance?.estimated_runout_time
		? Date.parse(balance.estimated_runout_time) - Date.now()
		: undefined;
	const canBuy =
		team.effective_roles.includes("purchaser") ||
		team.effective_roles.includes("owner");
	return (
		<header className="top">
			<nav aria-label="Where you are" className="crumbs">
				<Link
					className="brand"
					search={search}
					to={viewPath(team.handle, "home")}
				>
					<Brand />
				</Link>
				<Link
					aria-label={`Selected team: ${team.name}. Change team`}
					className="selected-team"
					to="/teams"
				>
					<span>{team.name}</span>
					<span className="selected-team-handle">{team.handle}</span>
					<svg
						aria-hidden="true"
						className="team-chevron"
						height="12"
						viewBox="0 0 12 12"
						width="12"
					>
						<path
							d="m2.5 4.25 3.5 3.5 3.5-3.5"
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.5"
						/>
					</svg>
				</Link>
				{view === "home" ? null : (
					<span className="crumb">
						<span aria-hidden="true" className="sep">
							›
						</span>
						<span aria-current="page">{titles[view]}</span>
					</span>
				)}
			</nav>
			<span className="grow" />
			<div
				className={`money ${isPresent(runout) && runout < 6 * 3_600_000 ? "low" : ""}`}
			>
				<span className="money-amt">
					{balance ? money(balance.available_balance) : " "}
				</span>
				<span className="money-sub">{balanceLabel(balance, runout)}</span>
			</div>
			{canBuy ? (
				<Link
					className={`btn ${view === "credits" ? "on" : ""}`}
					search={search}
					to={viewPath(team.handle, "credits")}
				>
					Add credits
				</Link>
			) : null}
			<div className="header-tools">
				<Link
					aria-label="Settings"
					className={`btn icon ${view === "settings" ? "on" : ""}`}
					search={search}
					title="Settings"
					to={viewPath(team.handle, "settings")}
				>
					<svg aria-hidden="true" height="18" viewBox="0 0 20 20" width="18">
						<path
							d="M3 5.25h8.6a2.5 2.5 0 0 1 4.8 0H17v1.5h-.6a2.5 2.5 0 0 1-4.8 0H3zm11 .75a1 1 0 1 0 0 .01zM3 13.25h.6a2.5 2.5 0 0 1 4.8 0H17v1.5H8.4a2.5 2.5 0 0 1-4.8 0H3zm3 .75a1 1 0 1 0 0 .01z"
							fill="currentColor"
						/>
					</svg>
				</Link>
			</div>
		</header>
	);
}
