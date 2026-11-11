import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getPrefs, setPrefs } from "../../lib/prefs";
import { ThemeControl } from "./theme-control";

afterEach(() => {
	setPrefs({ theme: "system" });
	applyTheme("system");
});

describe("theme control", () => {
	it("switches the visible theme with one click and persists across mounts", async () => {
		const user = userEvent.setup();
		const first = render(<ThemeControl />);
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Switch to dark theme" })
		);
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(getPrefs().theme).toBe("dark");
		expect(
			JSON.parse(localStorage.getItem("hotaisle-ui:prefs") ?? "{}").theme
		).toBe("dark");
		first.unmount();
		render(<ThemeControl />);
		expect(
			screen.getByRole("button", { name: "Switch to light theme" })
		).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Switch to light theme" })
		);
		expect(getPrefs().theme).toBe("system");
		expect(document.documentElement.dataset.theme).toBeUndefined();
	});

	it("starts with the opposite of a dark system theme and supports keyboard activation", async () => {
		const query = Object.assign(new EventTarget(), {
			addListener: vi.fn(),
			matches: true,
			media: "(prefers-color-scheme: dark)",
			onchange: null,
			removeListener: vi.fn(),
		});
		vi.mocked(window.matchMedia).mockReturnValue(query);
		const user = userEvent.setup();
		render(<ThemeControl />);
		await user.tab();
		expect(
			screen.getByRole("button", { name: "Switch to light theme" })
		).toHaveFocus();
		await user.keyboard("{Enter}");
		expect(document.documentElement.dataset.theme).toBe("light");
		await user.keyboard(" ");
		expect(document.documentElement.dataset.theme).toBeUndefined();
		expect(getPrefs().theme).toBe("system");
	});

	it("updates with the system without discarding a pinned preference", () => {
		const query = Object.assign(new EventTarget(), {
			addListener: vi.fn(),
			matches: false,
			media: "(prefers-color-scheme: dark)",
			onchange: null,
			removeListener: vi.fn(),
		});
		vi.mocked(window.matchMedia).mockReturnValue(query);
		render(<ThemeControl />);
		act(() => {
			query.matches = true;
			query.dispatchEvent(new Event("change"));
		});
		expect(
			screen.getByRole("button", { name: "Switch to light theme" })
		).toBeInTheDocument();
		act(() => setPrefs({ theme: "light" }));
		act(() => {
			query.matches = false;
			query.dispatchEvent(new Event("change"));
		});
		expect(
			screen.getByRole("button", { name: "Switch to dark theme" })
		).toBeInTheDocument();
		expect(getPrefs().theme).toBe("light");
	});

	it("keeps the icon in sync with changes from another tab", () => {
		render(<ThemeControl />);
		act(() => {
			localStorage.setItem(
				"hotaisle-ui:prefs",
				JSON.stringify({ theme: "dark" })
			);
			window.dispatchEvent(
				new StorageEvent("storage", { key: "hotaisle-ui:prefs" })
			);
		});
		expect(
			screen.getByRole("button", { name: "Switch to light theme" })
		).toBeInTheDocument();
		expect(document.documentElement.dataset.theme).toBe("dark");
		act(() => {
			localStorage.removeItem("hotaisle-ui:prefs");
			window.dispatchEvent(
				new StorageEvent("storage", { key: "hotaisle-ui:prefs" })
			);
		});
		expect(
			screen.getByRole("button", { name: "Switch to dark theme" })
		).toBeInTheDocument();
		expect(document.documentElement.dataset.theme).toBeUndefined();
	});
});
