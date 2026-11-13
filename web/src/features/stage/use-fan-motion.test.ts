import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrefs, setPrefs } from "../../lib/prefs";
import { useFanMotion } from "./use-fan-motion";

afterEach(() => {
	act(() => setPrefs({ statusMotion: "system" }));
	vi.unstubAllGlobals();
});

function motionPreference(reduced: boolean) {
	const listeners = new Set<() => void>();
	const query = {
		addEventListener: (_: string, listener: () => void) =>
			listeners.add(listener),
		matches: reduced,
		removeEventListener: (_: string, listener: () => void) =>
			listeners.delete(listener),
	};
	vi.stubGlobal("matchMedia", () => query);
	return {
		change(value: boolean) {
			query.matches = value;
			for (const listener of listeners) {
				listener();
			}
		},
		listeners,
	};
}

describe("cooling fan motion", () => {
	it("keeps fans spinning when reduced motion changes without remounting", () => {
		act(() => setPrefs({ statusMotion: "system" }));
		const media = motionPreference(true);
		const { result, unmount } = renderHook(useFanMotion);
		expect(result.current.moving).toBe(true);
		act(() => media.change(false));
		expect(result.current.moving).toBe(true);
		act(() => media.change(true));
		expect(result.current.moving).toBe(true);
		unmount();
		expect(media.listeners.size).toBe(0);
	});

	it("keeps a manual fan pause independent of explicit On and Off settings", () => {
		motionPreference(true);
		act(() => setPrefs({ statusMotion: "on" }));
		const { result } = renderHook(useFanMotion);
		expect(result.current.moving).toBe(true);
		act(() => result.current.toggle());
		expect(result.current.moving).toBe(false);
		expect(getPrefs().statusMotion).toBe("on");
		act(() => setPrefs({ statusMotion: "off" }));
		expect(result.current.moving).toBe(false);
		act(() => result.current.toggle());
		expect(result.current.moving).toBe(true);
	});

	it("starts fans with motion Off and allows pausing without changing preferences", () => {
		motionPreference(true);
		act(() => setPrefs({ statusMotion: "off" }));
		const { result } = renderHook(useFanMotion);
		expect(result.current.moving).toBe(true);
		act(() => result.current.toggle());
		expect(result.current.moving).toBe(false);
		expect(getPrefs().statusMotion).toBe("off");
	});
});
