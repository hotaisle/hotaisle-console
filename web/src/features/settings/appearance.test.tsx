import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { getPrefs, setPrefs } from "../../lib/prefs";
import { AppearanceSettings } from "./appearance";

afterEach(() => setPrefs({ statusMotion: "system" }));

describe("status animation preference", () => {
	it("lets users explicitly enable animations, pause them, or follow the system", async () => {
		const user = userEvent.setup();
		const first = renderWithQuery(<AppearanceSettings />);
		const group = within(
			screen.getByRole("group", { name: "Status animation" })
		);
		expect(group.getByRole("radio", { name: "System" })).toBeChecked();
		await user.click(group.getByRole("radio", { name: "On" }));
		expect(getPrefs().statusMotion).toBe("on");
		expect(
			JSON.parse(localStorage.getItem("hotaisle-ui:prefs") ?? "{}").statusMotion
		).toBe("on");
		first.unmount();
		renderWithQuery(<AppearanceSettings />);
		const remounted = within(
			screen.getByRole("group", { name: "Status animation" })
		);
		expect(remounted.getByRole("radio", { name: "On" })).toBeChecked();
		await user.click(remounted.getByRole("radio", { name: "Off" }));
		expect(getPrefs().statusMotion).toBe("off");
		await user.click(remounted.getByRole("radio", { name: "System" }));
		expect(getPrefs().statusMotion).toBe("system");
	});
	it.each([
		[true, "system"],
		[false, "off"],
	] as const)(
		"preserves the old %s checkbox behavior as %s",
		(legacy, expected) => {
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
					screen.getByRole("group", { name: "Status animation" })
				).getByRole("radio", { name: expected === "off" ? "Off" : "System" })
			).toBeChecked();
		}
	);
});
