import { afterEach, describe, expect, it, vi } from "vitest";
import { motionEnabled, transition } from "./motion";
import { setPrefs } from "./prefs";

const originalTransition = Object.getOwnPropertyDescriptor(
	document,
	"startViewTransition"
);

afterEach(() => {
	setPrefs({ statusMotion: "on" });
	if (originalTransition) {
		Object.defineProperty(document, "startViewTransition", originalTransition);
	} else {
		Reflect.deleteProperty(document, "startViewTransition");
	}
});

describe("browser motion preference", () => {
	it.each([
		["on", true, true],
		["on", false, true],
		["off", true, false],
		["off", false, false],
		["system", true, false],
		["system", false, true],
	] as const)(
		"uses %s with device reduction %s as motion %s",
		(preference, reduced, enabled) => {
			vi.mocked(window.matchMedia).mockReturnValue({
				matches: reduced,
			} as MediaQueryList);
			setPrefs({ statusMotion: preference });
			expect(motionEnabled()).toBe(enabled);
			const change = vi.fn();
			const start = vi.fn((callback: () => void) => {
				callback();
				return {
					finished: Promise.resolve(),
					ready: Promise.resolve(),
					updateCallbackDone: Promise.resolve(),
				};
			});
			Object.defineProperty(document, "startViewTransition", {
				configurable: true,
				value: start,
			});
			transition(change);
			expect(change).toHaveBeenCalledOnce();
			expect(start).toHaveBeenCalledTimes(enabled ? 1 : 0);
		}
	);
});
