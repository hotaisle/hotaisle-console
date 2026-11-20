import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TEST_NOW } from "../../../../test/clock";
import type { APIToken } from "../../lib/api";
import { TokenDates } from "./token-dates";

const TOKEN: APIToken = {
	label: "Fixture",
	prefix: "fixture-prefix",
	teams: [],
	user_role: "user",
};
const exactFormat = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "long",
});
const relativeFormat = new Intl.RelativeTimeFormat(undefined, {
	numeric: "always",
});

describe("token timestamps", () => {
	it("shows short relative times with exact recorded instants available through native disclosures", () => {
		const created = new Date(TEST_NOW - 2 * 86_400_000).toISOString();
		const updated = new Date(TEST_NOW - 3 * 3_600_000).toISOString();
		const { container } = render(
			<TokenDates token={{ ...TOKEN, created, updated }} />
		);
		expect(screen.getByText(relativeFormat.format(-2, "day"))).toBeVisible();
		expect(screen.getByText(relativeFormat.format(-3, "hour"))).toBeVisible();
		const details = container.querySelectorAll("details");
		for (const [index, value] of [created, updated].entries()) {
			const disclosure = details[index];
			const summary = disclosure.querySelector("summary");
			expect(summary).toHaveAttribute(
				"title",
				exactFormat.format(new Date(value))
			);
			const exact = disclosure.querySelector(".token-timestamp-exact");
			expect(exact).toHaveAttribute("datetime", value);
			expect(exact).not.toBeVisible();
			if (!summary) {
				throw new Error("Missing timestamp disclosure");
			}
			fireEvent.click(summary);
			expect(disclosure).toHaveAttribute("open");
			expect(exact).toBeVisible();
			expect(exact).toHaveTextContent(exactFormat.format(new Date(value)));
		}
	});
	it("keeps the exact date open when pressed inside and dismisses it when pressed outside", () => {
		const outside = vi.fn();
		render(
			<>
				<TokenDates
					token={{ ...TOKEN, created: new Date(TEST_NOW).toISOString() }}
				/>
				<button onClick={outside} type="button">
					Outside action
				</button>
			</>
		);
		const trigger = screen.getByText("Just now");
		const exact = screen.getByText(exactFormat.format(new Date(TEST_NOW)));
		fireEvent.click(trigger);
		expect(exact).toBeVisible();
		fireEvent.pointerDown(exact);
		expect(exact).toBeVisible();
		fireEvent.pointerDown(trigger);
		expect(exact).toBeVisible();
		const action = screen.getByRole("button", { name: "Outside action" });
		fireEvent.pointerDown(action);
		expect(exact).not.toBeVisible();
		fireEvent.click(action);
		expect(outside).toHaveBeenCalledOnce();
	});
	it("dismisses a timestamp when another timestamp is pressed", () => {
		const created = new Date(TEST_NOW - 2 * 86_400_000).toISOString();
		const updated = new Date(TEST_NOW - 3 * 3_600_000).toISOString();
		render(<TokenDates token={{ ...TOKEN, created, updated }} />);
		const createdExact = screen.getByText(
			exactFormat.format(new Date(created))
		);
		const updatedExact = screen.getByText(
			exactFormat.format(new Date(updated))
		);
		fireEvent.click(screen.getByText(relativeFormat.format(-2, "day")));
		expect(createdExact).toBeVisible();
		const updatedTrigger = screen.getByText(relativeFormat.format(-3, "hour"));
		fireEvent.pointerDown(updatedTrigger);
		fireEvent.click(updatedTrigger);
		expect(createdExact).not.toBeVisible();
		expect(updatedExact).toBeVisible();
	});
	it("refreshes relative labels as elapsed time changes and releases its timer on unmount", () => {
		vi.useFakeTimers();
		const { unmount } = render(
			<TokenDates
				token={{ ...TOKEN, created: new Date(TEST_NOW - 59_000).toISOString() }}
			/>
		);
		expect(screen.getByText("Just now")).toBeVisible();
		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		expect(screen.getByText(relativeFormat.format(-1, "minute"))).toBeVisible();
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
	it("omits missing and invalid timestamps without inventing dates", () => {
		const { container, rerender } = render(<TokenDates token={TOKEN} />);
		expect(container).toBeEmptyDOMElement();
		rerender(
			<TokenDates token={{ ...TOKEN, created: "not-a-date", updated: null }} />
		);
		expect(container).toBeEmptyDOMElement();
		rerender(
			<TokenDates
				token={{ ...TOKEN, created: new Date(TEST_NOW).toISOString() }}
			/>
		);
		expect(screen.getByText("Created")).toBeInTheDocument();
		expect(screen.queryByText("Updated")).not.toBeInTheDocument();
	});
	it("shows a valid update even when creation time is absent", () => {
		render(
			<TokenDates
				token={{
					...TOKEN,
					created: null,
					updated: new Date(TEST_NOW - 120_000).toISOString(),
				}}
			/>
		);
		expect(screen.queryByText("Created")).not.toBeInTheDocument();
		expect(screen.getByText("Updated")).toBeInTheDocument();
		expect(screen.getByText(relativeFormat.format(-2, "minute"))).toBeVisible();
	});
});
