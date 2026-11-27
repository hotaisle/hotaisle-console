import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { ToastHost } from "../../components/ui/toast";
import type { Status } from "../../lib/api";
import { getPrefs } from "../../lib/prefs";
import { AccountSettings } from "./account";

const PREFS_KEY = "hotaisle-ui:prefs";
const SAVE_FAILURE = /Session length not saved/u;
const STATUS: Status = {
	email_login: true,
	kind: "email",
	passkeys: false,
	signed_in: true,
	version: "test",
};

function renderAccount(status = STATUS) {
	return renderWithQuery(
		<ToastHost>
			<AccountSettings status={status} />
		</ToastHost>
	);
}

function readStoredPrefs() {
	act(() => {
		window.dispatchEvent(new StorageEvent("storage", { key: PREFS_KEY }));
	});
}

afterEach(() => {
	localStorage.removeItem(PREFS_KEY);
	readStoredPrefs();
});

test.each([undefined, "default", "240", 0, false])(
	"shows Infinite for email sign-in when the stored session length is %s",
	(sessionMinutes) => {
		localStorage.setItem(PREFS_KEY, JSON.stringify({ sessionMinutes }));
		readStoredPrefs();
		renderAccount();

		const select = screen.getByRole("combobox", { name: "Session length" });
		expect(select).toHaveDisplayValue("Infinite");
		expect(
			screen.queryByRole("option", { name: "Default" })
		).not.toBeInTheDocument();
	}
);

test("shows the one-hour lock for an API key without a saved session length", () => {
	renderAccount({ ...STATUS, kind: "key" });

	expect(
		screen.getByRole("combobox", { name: "Session length" })
	).toHaveDisplayValue("60 minutes");
});

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
	const { unmount } = renderAccount();
	const select = screen.getByRole("combobox", { name: "Session length" });

	await user.selectOptions(select, screen.getByRole("option", { name }));
	expect(select).toHaveDisplayValue(name);
	expect(
		screen.getByText(`Session length saved: ${name}.`)
	).toBeInTheDocument();
	expect(getPrefs().sessionMinutes).toBe(minutes);
	expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}")).toMatchObject({
		sessionMinutes: minutes,
	});

	readStoredPrefs();
	unmount();
	renderAccount();
	expect(
		screen.getByRole("combobox", { name: "Session length" })
	).toHaveDisplayValue(name);
});

test("reports a failed save without changing the session length and allows retry", async () => {
	const user = userEvent.setup();
	localStorage.setItem(PREFS_KEY, JSON.stringify({ sessionMinutes: 240 }));
	readStoredPrefs();
	renderAccount();
	const select = screen.getByRole("combobox", { name: "Session length" });
	const option = screen.getByRole("option", { name: "60 minutes" });
	const write = vi
		.spyOn(Storage.prototype, "setItem")
		.mockImplementationOnce(() => {
			throw new DOMException("Storage is full", "QuotaExceededError");
		});
	try {
		await user.selectOptions(select, option);
	} finally {
		write.mockRestore();
	}

	expect(select).toHaveDisplayValue("4 hours");
	expect(select).toHaveAccessibleDescription(SAVE_FAILURE);
	expect(getPrefs().sessionMinutes).toBe(240);
	expect(
		screen.getByText("Couldn't save the session length to browser storage.")
	).toBeVisible();

	await user.selectOptions(select, option);
	expect(select).toHaveDisplayValue("60 minutes");
	expect(select).not.toHaveAccessibleDescription(SAVE_FAILURE);
	expect(
		screen.getByText("Session length saved: 60 minutes.")
	).toBeInTheDocument();
});

test("updates the session length when another tab changes it", async () => {
	const user = userEvent.setup();
	renderAccount();
	const select = screen.getByRole("combobox", { name: "Session length" });
	await user.selectOptions(
		select,
		screen.getByRole("option", { name: "4 hours" })
	);

	localStorage.setItem(PREFS_KEY, JSON.stringify({ sessionMinutes: 720 }));
	readStoredPrefs();
	expect(select).toHaveDisplayValue("12 hours");
	expect(
		screen.queryByText("Session length saved: 4 hours.")
	).not.toBeInTheDocument();
});
