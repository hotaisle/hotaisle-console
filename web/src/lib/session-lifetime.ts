import { keyVault } from "./key-vault";
import { getPrefs, resolveSessionMinutes } from "./prefs";

const KEY = "hotaisle-console:session-lifetime";
export const SESSION_EXPIRED_EVENT = "hotaisle-console:session-expired";
interface SessionLifetime {
	ended: boolean;
	startedAt: number;
}
let fallback: SessionLifetime | undefined;
let memoryOnly = false;

function read(): SessionLifetime | undefined {
	if (import.meta.env.MODE === "preview" || memoryOnly) {
		return fallback;
	}
	let stored: string | null;
	try {
		stored = localStorage.getItem(KEY);
	} catch {
		return fallback;
	}
	if (stored === null) {
		return undefined;
	}
	try {
		const value: unknown = JSON.parse(stored);
		if (
			typeof value === "object" &&
			value !== null &&
			"startedAt" in value &&
			typeof value.startedAt === "number" &&
			Number.isFinite(value.startedAt) &&
			value.startedAt >= 0 &&
			"ended" in value &&
			typeof value.ended === "boolean"
		) {
			return value as SessionLifetime;
		}
		return { ended: true, startedAt: 0 };
	} catch {
		return { ended: true, startedAt: 0 };
	}
}

function write(value: SessionLifetime) {
	fallback = value;
	if (import.meta.env.MODE === "preview") {
		return;
	}
	try {
		localStorage.setItem(KEY, JSON.stringify(value));
		memoryOnly = false;
	} catch {
		// Storage restrictions leave the deadline in memory for this page only.
		memoryOnly = true;
	}
}

export function beginBrowserSession() {
	write({ ended: false, startedAt: Date.now() });
}

export function resumeBrowserSession() {
	// Adopt existing sign-ins once; reloads and status polls must not extend them.
	if (!read()) {
		beginBrowserSession();
	}
}

export function endBrowserSession() {
	write({ ended: true, startedAt: read()?.startedAt ?? Date.now() });
}

export function sessionRemaining(
	minutes = getPrefs().sessionMinutes
): number | undefined {
	const session = read();
	if (!session) {
		return undefined;
	}
	if (session.ended) {
		return 0;
	}
	const duration = resolveSessionMinutes(
		minutes,
		keyVault.token() !== undefined
	);
	return duration === null
		? undefined
		: session.startedAt + duration * 60_000 - Date.now();
}

export function browserSessionExpired() {
	const remaining = sessionRemaining();
	return remaining !== undefined && remaining <= 0;
}
