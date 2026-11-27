import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { isPresent } from "../../../../shared/present";
import type { View } from "../../app/route-state";
import { viewPath } from "../../app/route-state";
import { Brand } from "../../components/brand";
import type { Balance, Team } from "../../lib/api";
import type { AutoRebillStatus } from "../../lib/auto-rebill";
import { duration, money } from "../../lib/format";
import { autoRebillQuery } from "./use-auto-rebill";
import { useNavigation } from "./use-navigation";

type CrumbView = Exclude<View, "home" | "settings" | "credits">;

const AUTOPAY_BADGES = {
	capped: { label: "Autopay cap reached", tone: "primary" },
	disabled: { label: "Autopay off", tone: "" },
	enabled: { label: "Autopay on", tone: "is-on" },
	payment_failed: { label: "Autopay needs attention", tone: "primary" },
	payment_processing: { label: "Autopay payment processing", tone: "primary" },
	setup_pending: { label: "Autopay setup pending", tone: "primary" },
	stopped: { label: "Autopay disabled", tone: "primary" },
};

function autopayBadgeState(status: AutoRebillStatus | undefined) {
	if (status?.setup_pending) {
		return "setup_pending";
	}
	if (status && !status.enabled && status.problem) {
		return "stopped";
	}
	return status?.state;
}

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
	titles: Record<CrumbView, string>;
}) {
	const { view } = useNavigation(team.handle);
	const runout = balance?.estimated_runout_time
		? Date.parse(balance.estimated_runout_time) - Date.now()
		: undefined;
	const canBuy =
		team.effective_roles.includes("purchaser") ||
		team.effective_roles.includes("owner");
	const { data: autopayStatus } = useQuery({
		...autoRebillQuery(team.handle),
		// The credits panel already polls the same team status.
		enabled: canBuy && view !== "credits",
		refetchInterval: 60_000,
		staleTime: 60_000,
	});
	const badgeState = autopayBadgeState(canBuy ? autopayStatus : undefined);
	const autopay = badgeState && AUTOPAY_BADGES[badgeState];
	const autopayBadge = `autopay-badge ${autopay?.tone ?? ""}`;
	return (
		<header className="top">
			<nav aria-label="Where you are" className="crumbs">
				<Link className="brand" search={{}} to={viewPath(team.handle, "home")}>
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
				{view === "home" || view === "settings" || view === "credits" ? null : (
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
				<span className="header-autopay-status" role="status">
					{autopay !== undefined &&
						(view === "credits" ? (
							<span className={autopayBadge}>{autopay.label}</span>
						) : (
							<Link
								className={`btn ${autopayBadge}`}
								search={{}}
								state={{ creditsFrom: view }}
								to={viewPath(team.handle, "credits")}
							>
								{autopay.label}
							</Link>
						))}
				</span>
			</div>
			{canBuy && view !== "credits" ? (
				<Link
					className="btn primary credits-cta"
					search={{}}
					state={{ creditsFrom: view }}
					to={viewPath(team.handle, "credits")}
				>
					Add credits
				</Link>
			) : null}
			<div className="header-tools">
				<Link
					aria-label="Settings"
					className={`btn icon ${view === "settings" ? "on" : ""}`}
					search={{}}
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
