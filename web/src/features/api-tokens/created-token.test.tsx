import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreatedToken } from "./created-token";

describe("new token receipt", () => {
	it("shows the label and copies the one-time secret while keeping both button labels mounted", async () => {
		vi.useFakeTimers();
		const copy = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
		const dismiss = vi.fn();
		render(
			<CreatedToken
				label="Deployment"
				onDismiss={dismiss}
				value="fixture-secret"
			/>
		);
		expect(screen.getByLabelText("API token: Deployment")).toHaveValue(
			"fixture-secret"
		);
		const button = screen.getByRole("button", { name: "Copy token" });
		const keep = screen.getByRole("button", { name: "I saved it" });
		await act(async () => fireEvent.click(button));
		expect(copy).toHaveBeenCalledExactlyOnceWith("fixture-secret");
		expect(screen.getByRole("button", { name: "Copied" })).toBe(button);
		expect(button.querySelector('[aria-hidden="true"]')).toHaveTextContent(
			"Copy token"
		);
		expect(screen.getByRole("button", { name: "I saved it" })).toBe(keep);
		act(() => vi.advanceTimersByTime(2000));
		expect(screen.getByRole("button", { name: "Copy token" })).toBe(button);
		expect(button.querySelector('[aria-hidden="true"]')).toHaveTextContent(
			"Copied"
		);
		fireEvent.click(keep);
		expect(dismiss).toHaveBeenCalledOnce();
	});
});
