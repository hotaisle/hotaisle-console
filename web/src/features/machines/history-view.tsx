import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
	machineAddress,
	machineKey,
	machineKind,
} from "../../../../shared/machine-identity";
import type { ConsoleSearch } from "../../app/route-state";
import type { Ended } from "../../lib/api";
import { duration, money } from "../../lib/format";
import { runTitle } from "./formatting";
import { useHistoryCapacity } from "./use-history-capacity";
import "./history.css";

export const HISTORY_PAGE_SIZE = 10;
export function historyPage(
	items: Ended[],
	requestedPage: number,
	pageSize = HISTORY_PAGE_SIZE
) {
	const pages = Math.max(1, Math.ceil(items.length / pageSize));
	const page = Math.min(Math.max(1, requestedPage), pages);
	return {
		items: items.slice((page - 1) * pageSize, page * pageSize),
		page,
		pageSize,
		pages,
		total: items.length,
	};
}
export function HistoryView({
	items,
	error,
	team,
}: {
	items?: Ended[];
	error?: Error;
	team: string;
}) {
	const search = useSearch({ from: "__root__" });
	const router = useRouter();
	const list = useRef<HTMLUListElement>(null);
	const result = historyPage(
		items ?? [],
		search.page ?? 1,
		search.pageSize ?? HISTORY_PAGE_SIZE
	);
	const capacity = useHistoryCapacity(
		list,
		`${result.page}/${result.pageSize}/${result.items.length}`
	);
	const loaded = items !== undefined;
	// Router navigation settles asynchronously; do not restart the same resize request.
	const requested = useRef<number>(undefined);
	useEffect(() => {
		if (!loaded || error || !capacity || capacity === result.pageSize) {
			requested.current = undefined;
			return;
		}
		if (requested.current === capacity) {
			return;
		}
		requested.current = capacity;
		const first = (result.page - 1) * result.pageSize;
		router.navigate({
			params: { team },
			replace: true,
			search: (previous: ConsoleSearch) => ({
				...previous,
				page: Math.floor(first / capacity) + 1,
				pageSize: capacity,
			}),
			to: "/teams/$team/history",
		});
	}, [capacity, loaded, error, result.page, result.pageSize, router, team]);
	if (error) {
		return <p role="alert">Could not load machine history. {error.message}</p>;
	}
	if (!items) {
		return <p role="status">Loading machine history…</p>;
	}
	return (
		<section aria-label="Ended machines" className="history-view">
			<p className="small muted">
				History is encrypted in this browser and unlocks when you sign in to the
				same account. Signing out keeps the encrypted entries. It does not sync
				across devices. Costs are estimates.
			</p>
			<p className="small muted" role="status">
				{result.total
					? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total} ${result.total === 1 ? "run" : "runs"}`
					: "No ended machines found."}
			</p>
			<ul className="history-results" ref={list}>
				{result.items.map((item) => (
					<li key={machineKey(team, item)}>
						<Link
							className="history-run"
							params={{
								kind: machineKind(item),
								run: machineAddress(item),
								team,
							}}
							search={search}
							to="/teams/$team/history/$kind/$run"
						>
							<span className="history-run-title">
								<strong className="mono">{runTitle(item)}</strong>
								<span>
									{item.cents === undefined
										? "Cost unknown"
										: money(item.cents)}
								</span>
							</span>
							<span className="small muted">
								{item.gpus} ·{" "}
								{item.ran_ms === undefined
									? "Run time unknown"
									: duration(item.ran_ms)}
							</span>
							<time className="small muted" dateTime={item.ended_at}>
								{new Date(item.ended_at).toLocaleString([], {
									day: "numeric",
									hour: "numeric",
									minute: "2-digit",
									month: "short",
									year: "numeric",
								})}
							</time>
						</Link>
					</li>
				))}
			</ul>
			<nav aria-label="History pages" className="history-pages">
				{result.page > 1 ? (
					<Link
						className="btn"
						params={{ team }}
						search={{ ...search, page: result.page - 1 }}
						to="/teams/$team/history"
					>
						Previous
					</Link>
				) : (
					<span />
				)}
				<span className="small muted">
					Page {result.page} of {result.pages}
				</span>
				{result.page < result.pages ? (
					<Link
						className="btn"
						params={{ team }}
						search={{ ...search, page: result.page + 1 }}
						to="/teams/$team/history"
					>
						Next
					</Link>
				) : (
					<span />
				)}
			</nav>
		</section>
	);
}
