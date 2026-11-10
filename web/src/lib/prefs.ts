import { useCallback, useEffect, useState } from "react";

// Per-browser preferences. Credentials are managed separately by the key vault.
export type Image = "standard" | "vllm" | "custom";
export type Theme = "system" | "light" | "dark";
export interface Prefs {
	customURL: string;
	image: Image;
	notify: boolean; // desktop notification when a machine is ready
	sound: boolean; // soft key clicks and a chime when a machine is ready
	theme: Theme;
}

const KEY = "hotaisle-ui:prefs";
const DEFAULTS: Prefs = {
	customURL: "",
	image: "standard",
	notify: false,
	sound: true,
	theme: "system",
};

function read(): Prefs {
	try {
		const saved = {
			...DEFAULTS,
			...JSON.parse(localStorage.getItem(KEY) || "{}"),
		};
		if (saved.theme !== "light" && saved.theme !== "dark") {
			saved.theme = "system";
		}
		return saved;
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
		for (const listener of listeners) {
			listener(current);
		}
	});
}

export const getPrefs = () => current;

export function setPrefs(patch: Partial<Prefs>) {
	current = { ...current, ...patch };
	try {
		localStorage.setItem(KEY, JSON.stringify(current));
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

export const VLLM_URL =
	"https://raw.githubusercontent.com/hotaisle/cloud-init-templates/master/vllm-docker.yaml";
export const IMAGES: Record<Image, { name: string; note: string }> = {
	custom: {
		name: "My cloud-init",
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
