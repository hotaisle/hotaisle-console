import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShortcut } from "../hooks/use-shortcut";
import { setPrefs } from "../lib/prefs";
import { KeyboardControls, KeyboardHelpButton } from "./keyboard-controls";
import { KeyboardScope } from "./ui/keyboard-scope";

const copy = vi.fn();
const size = vi.fn();
const cancel = vi.fn();
function Page({ launch = false }: { launch?: boolean }) {
	useShortcut("C", copy, {
		enabled: !launch,
		meta: { name: "Copy selected SSH command" },
	});
	useShortcut("2", size, { enabled: launch, meta: { name: "Select 2 GPUs" } });
	useShortcut("L", size, {
		enabled: false,
		meta: { name: "Unavailable launch" },
	});
	return (
		<>
			<input aria-label="Email" type="email" />
			<textarea aria-label="Cloud-init" />
			<select aria-label="Image">
				<option>Standard</option>
			</select>
			<div contentEditable>
				<span>Editable text</span>
			</div>
			<KeyboardHelpButton />
		</>
	);
}
function Action() {
	useShortcut("Escape", cancel, { meta: { name: "Cancel operation" } });
	return <button type="button">Action</button>;
}
function question(target: Element | Document = document) {
	fireEvent.keyDown(target, { code: "Slash", key: "?", shiftKey: true });
	fireEvent.keyUp(target, { code: "Slash", key: "?", shiftKey: true });
}
function closeHelp() {
	const dialog = screen.getByRole("dialog", { name: "Keyboard controls" });
	act(() => (dialog as HTMLDialogElement).close());
}
beforeEach(() => {
	setPrefs({ shortcuts: true });
	Object.defineProperties(HTMLDialogElement.prototype, {
		close: {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.open = false;
				this.dispatchEvent(new Event("close"));
			},
		},
		showModal: {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.open = true;
			},
		},
	});
	copy.mockClear();
	size.mockClear();
	cancel.mockClear();
});

describe("contextual keyboard controls", () => {
	it("lists only the current page’s enabled commands and pauses them behind the modal", async () => {
		const rendered = render(
			<KeyboardControls>
				<Page />
			</KeyboardControls>
		);
		question();
		const dialog = within(
			screen.getByRole("dialog", { name: "Keyboard controls" })
		);
		expect(dialog.getByText("Copy selected SSH command")).toBeInTheDocument();
		expect(dialog.queryByText("Select 2 GPUs")).not.toBeInTheDocument();
		expect(dialog.queryByText("Unavailable launch")).not.toBeInTheDocument();
		await userEvent.setup().keyboard("c2");
		expect(copy).not.toHaveBeenCalled();
		expect(size).not.toHaveBeenCalled();
		closeHelp();
		rendered.rerender(
			<KeyboardControls>
				<Page launch />
			</KeyboardControls>
		);
		question();
		const next = within(
			screen.getByRole("dialog", { name: "Keyboard controls" })
		);
		expect(next.getByText("Select 2 GPUs")).toBeInTheDocument();
		expect(
			next.queryByText("Copy selected SSH command")
		).not.toBeInTheDocument();
	});
	it("does not open or run commands while typing in native or editable fields, including nested content and composition", async () => {
		render(
			<KeyboardControls>
				<Page />
			</KeyboardControls>
		);
		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Email"), "?c2");
		expect(screen.getByLabelText("Email")).toHaveValue("?c2");
		for (const target of [
			screen.getByLabelText("Email"),
			screen.getByLabelText("Cloud-init"),
			screen.getByLabelText("Image"),
			screen.getByText("Editable text"),
		]) {
			question(target);
			fireEvent.keyDown(target, { code: "KeyC", key: "c" });
			fireEvent.keyUp(target, { code: "KeyC", key: "c" });
		}
		fireEvent.keyDown(document, {
			code: "Slash",
			isComposing: true,
			key: "?",
			shiftKey: true,
		});
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(copy).not.toHaveBeenCalled();
		expect(size).not.toHaveBeenCalled();
	});
	it("shows the current action section instead of background page commands", () => {
		render(
			<KeyboardControls>
				<Page />
				<KeyboardScope>
					<Action />
				</KeyboardScope>
			</KeyboardControls>
		);
		question();
		const dialog = within(
			screen.getByRole("dialog", { name: "Keyboard controls" })
		);
		expect(dialog.getByText("Cancel operation")).toBeInTheDocument();
		expect(
			dialog.queryByText("Copy selected SSH command")
		).not.toBeInTheDocument();
		expect(cancel).not.toHaveBeenCalled();
	});
	it("can disable single-key shortcuts while retaining the settings help button", async () => {
		render(
			<KeyboardControls>
				<Page />
			</KeyboardControls>
		);
		act(() => setPrefs({ shortcuts: false }));
		question();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Show keyboard controls" }));
		expect(
			screen.getByRole("dialog", { name: "Keyboard controls" })
		).toBeInTheDocument();
		closeHelp();
		act(() => setPrefs({ shortcuts: true }));
	});
	it("closes help on navigation and toggles it with the question-mark shortcut", () => {
		const rendered = render(
			<KeyboardControls contextKey="machines">
				<Page />
			</KeyboardControls>
		);
		question();
		expect(
			screen.getByRole("dialog", { name: "Keyboard controls" })
		).toBeInTheDocument();
		question();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		question();
		rendered.rerender(
			<KeyboardControls contextKey="settings">
				<Page launch />
			</KeyboardControls>
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
