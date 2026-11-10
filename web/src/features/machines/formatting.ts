import { isPresent } from "../../../../shared/present";
import type { Ended } from "../../lib/api";
import { duration, gb, money } from "../../lib/format";
import { IMAGES } from "../../lib/prefs";

export const clock = (ms: number) => {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600),
		m = Math.floor((s % 3600) / 60),
		ss = s % 60;
	return h
		? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
		: `${m}:${String(ss).padStart(2, "0")}`;
};

export const meter = (ms: number) => {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600),
		mm = Math.floor((s % 3600) / 60),
		ss = s % 60;
	return `${String(h).padStart(1, " ")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export const dollars = (cents?: number) =>
	isPresent(cents) ? (cents / 100).toFixed(2).padStart(6, " ") : "  -.--";

export const at = (t: string | number) =>
	new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const day = (t: string | number) => {
	const d = new Date(t);
	const today = new Date();
	if (d.toDateString() === today.toDateString()) {
		return at(t);
	}
	return d.toLocaleDateString([], { day: "numeric", month: "short" });
};

export const machineLine = (cores?: number, ram?: number, disk?: number) =>
	cores ? `${cores} cores, ${gb(ram ?? 0)} memory, ${gb(disk ?? 0)} disk` : "–";

export function runFacts(r: Ended): [string, string][] {
	function resolveValue2() {
		if (isPresent(r.cents) && r.price_cents) {
			return [
				[
					"Billed",
					`${duration((r.cents / r.price_cents) * 3_600_000)}${r.minimum_applied ? ", the minimum" : ""}`,
				],
			] as [string, string][];
		}
		return [];
	}
	function resolveValue() {
		if (r.server) {
			if (r.metal) {
				return `${r.server}, the whole server`;
			}
			return r.server;
		}
		return "–";
	}
	return [
		["Server", resolveValue()],
		[
			"Image",
			r.image ? (IMAGES[r.image as keyof typeof IMAGES]?.name ?? r.image) : "–",
		],
		["Rate", r.price_cents ? `${money(r.price_cents)} an hour` : "–"],
		// what was billed: the run, or the minimum if it ended inside it; and what each GPU cost
		...resolveValue2(),
		...(isPresent(r.cents)
			? ([
					["Per GPU", money(r.cents / (Number(r.gpus.split("×")[0]) || 1))],
				] as [string, string][])
			: []),
		["Machine", machineLine(r.cpu_cores, r.ram_capacity, r.disk_capacity)],
		["Ended", day(r.ended_at)],
	];
}
