import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { APIToken } from "../../lib/api";
import { TokenDates } from "./token-dates";

const TIME = /:\d{2}:\d{2}/u;
const TIMEZONE = /UTC|GMT|[A-Z]{3,4}$/u;

const TOKEN: APIToken = {
	label: "Fixture",
	prefix: "fixture-prefix",
	teams: [],
	user_role: "user",
};

describe("token timestamps", () => {
	it("shows both recorded instants as localized dates and times with a timezone", () => {
		const { container } = render(
			<TokenDates
				token={{
					...TOKEN,
					created: "2026-11-01T08:15:30Z",
					updated: "2026-11-02T20:45:50Z",
				}}
			/>
		);
		expect(screen.getByText("Created")).toBeInTheDocument();
		expect(screen.getByText("Updated")).toBeInTheDocument();
		const dates = container.querySelectorAll("time");
		expect(dates[0]).toHaveAttribute("datetime", "2026-11-01T08:15:30.000Z");
		expect(dates[1]).toHaveAttribute("datetime", "2026-11-02T20:45:50.000Z");
		for (const date of dates) {
			expect(date.textContent).toContain("2026");
			expect(date.textContent).toMatch(TIME);
			expect(date.textContent).toMatch(TIMEZONE);
		}
	});
	it("omits missing and invalid timestamps without inventing dates", () => {
		const { container, rerender } = render(<TokenDates token={TOKEN} />);
		expect(container).toBeEmptyDOMElement();
		rerender(
			<TokenDates token={{ ...TOKEN, created: "not-a-date", updated: null }} />
		);
		expect(container).toBeEmptyDOMElement();
		rerender(
			<TokenDates token={{ ...TOKEN, created: "2026-11-01T08:15:30Z" }} />
		);
		expect(screen.getByText("Created")).toBeInTheDocument();
		expect(screen.queryByText("Updated")).not.toBeInTheDocument();
	});
	it("hides null timestamps while the API rollout is in progress", () => {
		const { container, rerender } = render(
			<TokenDates token={{ ...TOKEN, created: null, updated: null }} />
		);
		expect(container).toBeEmptyDOMElement();
		rerender(
			<TokenDates
				token={{ ...TOKEN, created: null, updated: "2026-11-02T20:45:50Z" }}
			/>
		);
		expect(screen.queryByText("Created")).not.toBeInTheDocument();
		expect(screen.getByText("Updated")).toBeInTheDocument();
	});
});
