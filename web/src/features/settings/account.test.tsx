import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { renderWithQuery } from "../../../test/render";
import type { Status } from "../../lib/api";
import { getPrefs } from "../../lib/prefs";
import { AccountSettings } from "./account";

const PREFS_KEY = "hotaisle-ui:prefs";
const STATUS: Status = {
	email_login: true,
	kind: "email",
	passkeys: false,
	signed_in: true,
	version: "test",
};

function readStoredPrefs() {
	act(() => {
		window.dispatchEvent(new StorageEvent("storage", { key: PREFS_KEY }));
	});
}

afterEach(() => {
	localStorage.removeItem(PREFS_KEY);
	readStoredPrefs();
});

test.each([undefined, "240", 0, false])(
	"defaults the session length to 60 minutes when the stored value is %s",
	(sessionMinutes) => {
		localStorage.setItem(PREFS_KEY, JSON.stringify({ sessionMinutes }));
		readStoredPrefs();
		renderWithQuery(<AccountSettings status={STATUS} />);

		expect(getPrefs().sessionMinutes).toBe(60);
		expect(
			screen.getByRole("combobox", { name: "Session length" })
		).toHaveDisplayValue("60 minutes");
	}
);

test.each([
	["60 minutes", 60],
	["4 hours", 240],
	["12 hours", 720],
	["24 hours", 1440],
	["Infinite", null],
] as const)("immediately persists the %s option", async (name, minutes) => {
	const user = userEvent.setup();
	localStorage.setItem(
		PREFS_KEY,
		JSON.stringify({ sessionMinutes: minutes === 60 ? 240 : 60 })
	);
	readStoredPrefs();
	const { unmount } = renderWithQuery(<AccountSettings status={STATUS} />);
	const select = screen.getByRole("combobox", { name: "Session length" });

	await user.selectOptions(select, screen.getByRole("option", { name }));
	expect(select).toHaveDisplayValue(name);
	expect(getPrefs().sessionMinutes).toBe(minutes);
	expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}")).toMatchObject({
		sessionMinutes: minutes,
	});

	readStoredPrefs();
	unmount();
	renderWithQuery(<AccountSettings status={STATUS} />);
	expect(
		screen.getByRole("combobox", { name: "Session length" })
	).toHaveDisplayValue(name);
});

test("updates the session length when another tab changes it", async () => {
	const user = userEvent.setup();
	renderWithQuery(<AccountSettings status={STATUS} />);
	const select = screen.getByRole("combobox", { name: "Session length" });
	await user.selectOptions(
		select,
		screen.getByRole("option", { name: "4 hours" })
	);

	localStorage.setItem(PREFS_KEY, JSON.stringify({ sessionMinutes: 720 }));
	readStoredPrefs();
	expect(select).toHaveDisplayValue("12 hours");
});
