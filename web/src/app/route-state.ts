import { machineKind, parseMachineKey } from "../../../shared/machine-identity";
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
		try {
			const url = new URL(value, "https://console.invalid");
			url.searchParams.delete("cloudInit");
			return `${url.pathname}${url.search}${url.hash}`;
		} catch {
			return undefined;
		}
	}
	return undefined;
}
export function validateSearch(search: Record<string, unknown>): ConsoleSearch {
	const count = Number(search.gpus);
	const { image } = search;
	return {
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
	const [, , , page, resource] = path.split("/");
	if (page === "history" && resource) {
		return "run";
	}
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
	const identity = name ? parseMachineKey(name) : undefined;
	if (
		identity &&
		identity.team === team &&
		(view === "run" || view === "home")
	) {
		return `${base}/${view === "run" ? "history" : "machines"}/${machineKind(identity)}/${encodeURIComponent(identity.name)}`;
	}
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
