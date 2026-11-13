import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockNativeDialogs } from "../../../test/native-dialog";
import { FormError } from "../forms/form-error";
import { ErrorNotices } from "./error-notices";
import { Modal } from "./modal";

mockNativeDialogs();

function Example({
	message,
	retry = vi.fn(),
}: {
	message?: string;
	retry?: () => void;
}) {
	return (
		<ErrorNotices>
			<form aria-label="Example">
				<label htmlFor="name">Name</label>
				<input
					aria-describedby={message ? "name-error" : undefined}
					aria-invalid={!!message}
					id="name"
				/>
				<FormError
					actions={
						<button onClick={retry} type="button">
							Try again
						</button>
					}
					id="name-error"
					message={message}
				/>
				<button type="submit">Save</button>
			</form>
		</ErrorNotices>
	);
}

describe("layout-stable error notices", () => {
	it("keeps validation text associated with the input without inserting visible form content", () => {
		const view = render(<Example />);
		const form = screen.getByRole("form");
		const input = screen.getByRole("textbox");
		const save = screen.getByRole("button", { name: "Save" });
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		view.rerender(<Example message="Enter a name." />);
		expect(screen.getByRole("alert")).toHaveTextContent("Enter a name.");
		expect(form).not.toContainElement(screen.getByRole("alert"));
		expect(document.querySelector("#name-error")).toHaveAttribute("hidden");
		expect(input).toHaveAccessibleDescription("Enter a name.");
		expect(input).toBeInvalid();
		expect(screen.getByRole("button", { name: "Save" })).toBe(save);
		fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(input).toHaveFocus();
		expect(input).toBeInvalid();
		expect(input).toHaveAccessibleDescription("Enter a name.");
	});
	it("keeps dismissed errors dismissed during rerenders but shows a repeated failure after retry", () => {
		const retry = vi.fn();
		const view = render(<Example message="Conflict." retry={retry} />);
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(retry).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
		view.rerender(<Example message="Conflict." />);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		view.rerender(<Example />);
		view.rerender(<Example message="Conflict." />);
		expect(screen.getByRole("alert")).toHaveTextContent("Conflict.");
		view.rerender(<Example />);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
	});
	it("retains simultaneous errors until dismissed or resolved without an expiry timer", () => {
		vi.useFakeTimers();
		render(
			<ErrorNotices>
				<FormError message="First failure." />
				<FormError message="Second failure." />
			</ErrorNotices>
		);
		act(() => vi.advanceTimersByTime(120_000));
		expect(screen.getAllByRole("alert")).toHaveLength(2);
		fireEvent.click(
			within(screen.getAllByRole("alert")[0]).getByRole("button", {
				name: "Dismiss error",
			})
		);
		expect(screen.getAllByRole("alert")).toHaveLength(1);
		expect(screen.getByRole("alert")).toHaveTextContent("Second failure.");
	});
	it("keeps dialog failures inside the modal accessibility scope and honors dismissal focus", () => {
		const dismissed = vi.fn();
		const view = render(
			<Modal onClose={vi.fn()} title="Remove key?">
				<button type="button">Keep key</button>
				<FormError />
			</Modal>
		);
		const keep = screen.getByRole("button", { name: "Keep key" });
		const dismiss = () => {
			dismissed();
			keep.focus();
		};
		view.rerender(
			<Modal onClose={vi.fn()} title="Remove key?">
				<button type="button">Keep key</button>
				<FormError message="Removal refused." onDismiss={dismiss} />
			</Modal>
		);
		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"Removal refused."
		);
		expect(dialog.querySelector(".modal")).not.toContainElement(
			screen.getByRole("alert")
		);
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Dismiss error" })
		);
		expect(dismissed).toHaveBeenCalledOnce();
		expect(keep).toHaveFocus();
	});
});
