import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { CopyButton } from "./copy-button";
import { HoldButton } from "./hold-button";
import { Picker } from "./picker";
import { SegmentedControl } from "./segmented-control";

afterEach(() => {
	vi.useRealTimers();
});

describe("shared controls", () => {
	it("changes a numeric preference through a labeled native radio", async () => {
		const change = vi.fn();
		const options = [
			{ label: "One", value: 1 },
			{ label: "Two", value: 2 },
		];
		render(
			<SegmentedControl
				label="GPUs"
				onChange={change}
				options={options}
				value={1}
			/>
		);
		await userEvent.setup().click(screen.getByRole("radio", { name: "Two" }));
		expect(change).toHaveBeenCalledWith(2);
	});
	it("selects an image using a keyboard-accessible native select", async () => {
		const change = vi.fn();
		const options = [
			{ label: "Standard", value: "standard" },
			{ label: "Custom", value: "custom" },
		];
		render(
			<Picker
				label="Image"
				onChange={change}
				options={options}
				value="standard"
			/>
		);
		await userEvent
			.setup()
			.selectOptions(screen.getByRole("combobox", { name: "Image" }), "custom");
		expect(change).toHaveBeenCalledWith("custom");
	});
	it("does not confirm a short press and confirms one completed hold", () => {
		vi.useFakeTimers();
		const confirm = vi.fn();
		render(<HoldButton label="Hold to end" ms={100} onConfirm={confirm} />);
		const button = screen.getByRole("button", { name: "Hold to end" });
		fireEvent.keyDown(button, { key: "Enter" });
		vi.advanceTimersByTime(32);
		fireEvent.keyUp(button, { key: "Enter" });
		vi.advanceTimersByTime(200);
		expect(confirm).not.toHaveBeenCalled();
		fireEvent.keyDown(button, { key: "Enter" });
		vi.advanceTimersByTime(160);
		expect(confirm).toHaveBeenCalledTimes(1);
		fireEvent.keyDown(button, { key: "Enter", repeat: true });
		vi.advanceTimersByTime(100);
		expect(confirm).toHaveBeenCalledTimes(1);
	});
	it("reports clipboard failure instead of claiming the text was copied", async () => {
		const user = userEvent.setup();
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
			new Error("Permission denied")
		);
		renderWithQuery(<CopyButton text="ssh example" />);
		await user.click(screen.getByRole("button", { name: "Copy" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Copy failed");
		expect(
			screen.queryByRole("button", { name: "Copied" })
		).not.toBeInTheDocument();
	});
	it("resets the copy confirmation and can copy again", async () => {
		vi.useFakeTimers();
		userEvent.setup();
		const write = vi
			.spyOn(navigator.clipboard, "writeText")
			.mockResolvedValue();
		renderWithQuery(<CopyButton text="ssh example" />);
		fireEvent.click(screen.getByRole("button", { name: "Copy" }));
		await act(async () => vi.advanceTimersByTimeAsync(1));
		expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
		await act(async () => vi.advanceTimersByTimeAsync(1999));
		expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
		await act(async () => vi.advanceTimersByTimeAsync(2));
		expect(screen.getByRole("button", { name: "Copy" })).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Copy" }));
		await act(async () => vi.advanceTimersByTimeAsync(1));
		expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
		expect(write).toHaveBeenCalledTimes(2);
	});
});
