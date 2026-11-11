import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPrefs } from "../../lib/prefs";
import { KeyboardControls } from "../keyboard-controls";
import { HoldButton } from "./hold-button";
import { KeyboardScope } from "./keyboard-scope";

vi.mock("../../lib/sound", () => ({
	sound: { drop: vi.fn(), thunk: vi.fn(), tick: vi.fn() },
}));
beforeEach(() => {
	setPrefs({ shortcuts: true });
	vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
async function advance(ms: number) {
	await act(async () => vi.advanceTimersByTimeAsync(ms));
}

describe("TanStack hold controls", () => {
	it("cancels a short global key press and confirms only a sustained press", async () => {
		const confirm = vi.fn();
		render(
			<KeyboardControls>
				<HoldButton hotkey="L" label="Hold to launch" onConfirm={confirm} />
			</KeyboardControls>
		);
		fireEvent.keyDown(document, { code: "KeyL", key: "l" });
		await advance(200);
		fireEvent.keyUp(document, { code: "KeyL", key: "l" });
		await advance(1000);
		expect(confirm).not.toHaveBeenCalled();
		fireEvent.keyDown(document, { code: "KeyL", key: "l" });
		await advance(850);
		expect(confirm).toHaveBeenCalledOnce();
		fireEvent.keyUp(document, { code: "KeyL", key: "l" });
	});
	it.each(["Enter", " "])(
		"supports a focused button’s %s control through TanStack",
		async (key) => {
			const confirm = vi.fn();
			render(<HoldButton label="Hold to end" onConfirm={confirm} />);
			const button = screen.getByRole("button", { name: "Hold to end" });
			button.focus();
			fireEvent.keyDown(button, { code: key === " " ? "Space" : "Enter", key });
			await advance(850);
			expect(confirm).toHaveBeenCalledOnce();
			fireEvent.keyUp(button, { code: key === " " ? "Space" : "Enter", key });
		}
	);
	it("cancels a held background command when another section takes the keyboard", async () => {
		const confirm = vi.fn();
		const button = (
			<HoldButton hotkey="L" label="Hold to launch" onConfirm={confirm} />
		);
		const rendered = render(<KeyboardControls>{button}</KeyboardControls>);
		fireEvent.keyDown(document, { code: "KeyL", key: "l" });
		await advance(200);
		rendered.rerender(
			<KeyboardControls>
				{button}
				<KeyboardScope>
					<button type="button">Cancel</button>
				</KeyboardScope>
			</KeyboardControls>
		);
		await advance(1000);
		expect(confirm).not.toHaveBeenCalled();
		fireEvent.keyUp(document, { code: "KeyL", key: "l" });
	});
});
