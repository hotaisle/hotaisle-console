import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { getPrefs, setPrefs } from "../../lib/prefs";
import { AppearanceSettings } from "./appearance";

beforeEach(() => setPrefs({ statusMotion: "on" }));
afterEach(() => setPrefs({ statusMotion: "on" }));

describe("status animation preference", () => {
	it("lets users explicitly enable animations, pause them, or follow the system", async () => {
		const user = userEvent.setup();
		const first = renderWithQuery(<AppearanceSettings />);
		const group = within(
			screen.getByRole("group", { name: "Interface animation" })
		);
		expect(group.getByRole("radio", { name: "On" })).toBeChecked();
		expect(getPrefs().statusMotion).toBe("on");
		expect(
			JSON.parse(localStorage.getItem("hotaisle-ui:prefs") ?? "{}").statusMotion
		).toBe("on");
		first.unmount();
		renderWithQuery(<AppearanceSettings />);
		const remounted = within(
			screen.getByRole("group", { name: "Interface animation" })
		);
		expect(remounted.getByRole("radio", { name: "On" })).toBeChecked();
		await user.click(remounted.getByRole("radio", { name: "Off" }));
		expect(getPrefs().statusMotion).toBe("off");
		expect(document.documentElement).toHaveAttribute(
			"data-status-motion",
			"off"
		);
		await user.click(remounted.getByRole("radio", { name: "System" }));
		expect(getPrefs().statusMotion).toBe("system");
		act(() => {
			window.dispatchEvent(
				new StorageEvent("storage", { key: "hotaisle-ui:prefs" })
			);
		});
		expect(getPrefs().statusMotion).toBe("system");
		expect(document.documentElement).toHaveAttribute(
			"data-status-motion",
			"system"
		);
	});
	it.each([
		[undefined, "on"],
		[true, "on"],
		[false, "off"],
		["system", "on"],
		["on", "on"],
		["off", "off"],
	] as const)("migrates the old %s preference to %s", (legacy, expected) => {
		renderWithQuery(<AppearanceSettings />);
		act(() => {
			localStorage.setItem(
				"hotaisle-ui:prefs",
				JSON.stringify({ statusMotion: legacy })
			);
			window.dispatchEvent(
				new StorageEvent("storage", { key: "hotaisle-ui:prefs" })
			);
		});
		expect(getPrefs().statusMotion).toBe(expected);
		expect(
			within(
				screen.getByRole("group", { name: "Interface animation" })
			).getByRole("radio", { name: expected === "off" ? "Off" : "On" })
		).toBeChecked();
	});
});
