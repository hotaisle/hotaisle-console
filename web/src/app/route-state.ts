import type { Image } from "../lib/prefs";
export type View =
	| "home"
	| "order"
	| "settings"
	| "credits"
	| "image"
	| "run"
	| "history";
export interface ConsoleSearch {
	cloudInit?: string;
	gpus?: number;
	image?: Image;
	page?: number;
	pageSize?: number;
	returnTo?: string;
}
export function safeReturnTo(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	if (value === "/teams" || value.startsWith("/teams/")) {
		return value;
	}
	return undefined;
}
export function validateSearch(search: Record<string, unknown>): ConsoleSearch {
	const count = Number(search.gpus);
	const { image } = search;
	return {
		cloudInit:
			typeof search.cloudInit === "string" &&
			search.cloudInit.startsWith("https://")
				? search.cloudInit
				: undefined,
		gpus: [1, 2, 4, 8].includes(count) ? count : undefined,
		image:
			image === "standard" || image === "vllm" || image === "custom"
				? image
				: undefined,
		page:
			Number.isSafeInteger(Number(search.page)) && Number(search.page) > 0
				? Number(search.page)
				: undefined,
		pageSize:
			Number.isSafeInteger(Number(search.pageSize)) &&
			Number(search.pageSize) > 0 &&
			Number(search.pageSize) <= 100
				? Number(search.pageSize)
				: undefined,
		returnTo: safeReturnTo(search.returnTo),
	};
}
export function viewFromPath(path: string): View {
	if (path.includes("/history/")) {
		return "run";
	}
	const page = path.split("/").at(-1);
	if (page === "keys") {
		return "settings";
	}
	if (page === "launch") {
		return "order";
	}
	if (
		page === "settings" ||
		page === "credits" ||
		page === "image" ||
		page === "history"
	) {
		return page;
	}
	return "home";
}
export function viewPath(team: string, view: View, name?: string) {
	const base = `/teams/${encodeURIComponent(team)}`;
	if (view === "run" && name) {
		return `${base}/history/${encodeURIComponent(name)}`;
	}
	if (view === "home" && name) {
		return `${base}/machines/${encodeURIComponent(name)}`;
	}
	let page: string = view;
	if (view === "home") {
		page = "machines";
	} else if (view === "order") {
		page = "launch";
	}
	return `${base}/${page}`;
}
