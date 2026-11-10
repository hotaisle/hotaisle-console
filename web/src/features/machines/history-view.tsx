import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { Form } from "../../components/forms/form";
import { useAppForm } from "../../components/forms/use-app-form";
import type { Ended } from "../../lib/api";
import { duration, money } from "../../lib/format";
import "./history.css";

export const HISTORY_PAGE_SIZE = 10;
export function historyPage(
	items: Ended[],
	query: string,
	requestedPage: number
) {
	const needle = query.toLocaleLowerCase();
	const filtered = items.filter((item) =>
		[item.name, item.server, item.gpus].some((value) =>
			value?.toLocaleLowerCase().includes(needle)
		)
	);
	const pages = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
	const page = Math.min(Math.max(1, requestedPage), pages);
	return {
		items: filtered.slice(
			(page - 1) * HISTORY_PAGE_SIZE,
			page * HISTORY_PAGE_SIZE
		),
		page,
		pages,
		total: filtered.length,
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
	const query = search.q ?? "";
	const form = useAppForm({
		defaultValues: { query },
		onSubmit: async ({ value }) => {
			await router.navigate({
				params: { team },
				search: {
					...search,
					page: undefined,
					q: value.query.trim() || undefined,
				},
				to: "/teams/$team/history",
			});
		},
	});
	useEffect(() => {
		form.reset({ query });
	}, [form, query]);
	if (error) {
		return <p role="alert">Could not load machine history. {error.message}</p>;
	}
	if (!items) {
		return <p role="status">Loading machine history…</p>;
	}
	const result = historyPage(items, query, search.page ?? 1);
	return (
		<section aria-label="Ended machines" className="history-view">
			<p className="small muted">
				History is encrypted in this browser and unlocks when you sign in to the
				same account. Signing out keeps the encrypted entries. It does not sync
				across devices. Costs are estimates.
			</p>
			<Form className="history-search" onSubmit={form.handleSubmit}>
				<form.AppField name="query">
					{(field) => (
						<field.TextField
							hideLabel
							label="Search machine history"
							maxLength={200}
							placeholder="Search name, server or GPU"
							type="search"
						/>
					)}
				</form.AppField>
				<button className="btn" type="submit">
					Search
				</button>
			</Form>
			{query.length > 0 ? (
				<Link
					className="btn-text"
					params={{ team }}
					search={{ ...search, page: undefined, q: undefined }}
					to="/teams/$team/history"
				>
					Clear search
				</Link>
			) : null}
			<p className="small muted" role="status">
				{result.total
					? `${(result.page - 1) * HISTORY_PAGE_SIZE + 1}–${Math.min(result.page * HISTORY_PAGE_SIZE, result.total)} of ${result.total} ${result.total === 1 ? "run" : "runs"}`
					: "No ended machines found."}
			</p>
			<ul className="history-results">
				{result.items.map((item) => (
					<li key={item.name}>
						<Link
							className="history-run"
							params={{ run: item.name, team }}
							search={search}
							to="/teams/$team/history/$run"
						>
							<span className="history-run-title">
								<strong className="mono">{item.name}</strong>
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
