import { useCallback, useEffect, useState } from "react";

// Per-browser preferences. Credentials are managed separately by the key vault.
export type Image = "standard" | "vllm" | "custom";
export type Theme = "system" | "light" | "dark";
export type StatusMotion = "system" | "on" | "off";
export interface Prefs {
	image: Image;
	notify: boolean; // desktop notification when a machine is ready
	sound: boolean; // soft key clicks and a chime when a machine is ready
	statusMotion: StatusMotion;
	theme: Theme;
}

const KEY = "hotaisle-ui:prefs";
const DEFAULTS: Prefs = {
	image: "standard",
	notify: false,
	sound: true,
	statusMotion: "system",
	theme: "system",
};

function read(): Prefs {
	try {
		const saved = {
			...DEFAULTS,
			...JSON.parse(localStorage.getItem(KEY) || "{}"),
		} as Omit<Prefs, "statusMotion"> & {
			customURL?: string;
			statusMotion: StatusMotion | boolean;
		};
		saved.customURL = undefined;
		if (saved.theme !== "light" && saved.theme !== "dark") {
			saved.theme = "system";
		}
		// The old checkbox followed the system when enabled.
		if (saved.statusMotion === false) {
			saved.statusMotion = "off";
		} else if (saved.statusMotion !== "on" && saved.statusMotion !== "off") {
			saved.statusMotion = "system";
		}
		return saved as Prefs;
	} catch {
		return DEFAULTS;
	}
}

const listeners = new Set<(p: Prefs) => void>();
let current = read();

if (typeof window !== "undefined") {
	window.addEventListener("storage", (event) => {
		if (event.key !== KEY && event.key !== null) {
			return;
		}
		current = read();
		applyTheme(current.theme);
		applyStatusMotion(current.statusMotion);
		for (const listener of listeners) {
			listener(current);
		}
	});
}

export const getPrefs = () => current;

export function setPrefs(patch: Partial<Prefs>) {
	current = { ...current, ...patch };
	try {
		const previous = JSON.parse(localStorage.getItem(KEY) || "{}");
		const legacy =
			typeof previous.customURL === "string"
				? { customURL: previous.customURL }
				: {};
		localStorage.setItem(KEY, JSON.stringify({ ...current, ...legacy }));
	} catch {
		/* private mode: keep it for this session */
	}
	for (const l of listeners) {
		l(current);
	}
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
	const [p, setP] = useState(current);
	useEffect(() => {
		listeners.add(setP);
		return () => {
			listeners.delete(setP);
		};
	}, []);
	return [p, useCallback(setPrefs, [])];
}

export function applyTheme(t: Theme) {
	const root = document.documentElement;
	const meta = document.querySelector('meta[name="color-scheme"]');
	meta?.setAttribute("content", t === "system" ? "light dark" : t);
	if (t === "system") {
		delete root.dataset.theme;
	} else {
		root.dataset.theme = t;
	}
}

export function applyStatusMotion(preference: StatusMotion) {
	document.documentElement.dataset.statusMotion = preference;
}

export const VLLM_URL =
	"https://raw.githubusercontent.com/hotaisle/cloud-init-templates/master/vllm-docker.yaml";
export const IMAGES: Record<Image, { name: string; note: string }> = {
	custom: {
		name: "Custom cloud-init",
		note: "Runs your user-data file on first boot. Takes a few extra minutes.",
	},
	standard: {
		name: "Standard image",
		note: "Hot Aisle's default VM. Ready as soon as it boots.",
	},
	vllm: {
		name: "vLLM server",
		note: "Hot Aisle's cloud-init template starts vLLM in Docker. Takes a few extra minutes.",
	},
};
