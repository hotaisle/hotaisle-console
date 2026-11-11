import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import { CreditsView } from "./credits-view";

const CHECKOUT_PATTERN = /Continue to checkout/u;
const AMOUNT_PATTERN = /\$250/u;
beforeEach(() => {
	vi.spyOn(window, "open").mockReturnValue(null);
});
describe("credits checkout", () => {
	it("does not create checkout below the minimum amount", async () => {
		const user = userEvent.setup();
		const buy = vi.spyOn(api, "buyCredits");
		const done = vi.fn();
		renderWithQuery(<CreditsView gpuHour={200} onDone={done} team="lab" />);
		await user.type(screen.getByRole("spinbutton", { name: "Other" }), "19");
		await user.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		expect(buy).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
	});
	it("requests cents for the selected amount and exposes a real checkout link", async () => {
		const replace = vi.fn();
		const tab = {
			close: vi.fn(),
			closed: false,
			location: { replace },
			opener: window,
		};
		vi.mocked(window.open).mockReturnValue(tab as unknown as Window);
		const user = userEvent.setup();
		const buy = vi.spyOn(api, "buyCredits").mockResolvedValue({
			checkout_url: "https://checkout.stripe.com/test",
			expires_at: "2030-01-01",
		});
		const done = vi.fn();
		renderWithQuery(<CreditsView gpuHour={200} onDone={done} team="lab" />);
		await user.click(screen.getByRole("radio", { name: AMOUNT_PATTERN }));
		await user.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		await waitFor(() => expect(buy).toHaveBeenCalledWith("lab", 25_000));
		expect(
			await screen.findByRole("link", { name: "Open checkout" })
		).toHaveAttribute("href", "https://checkout.stripe.com/test");
		expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
		expect(tab.opener).toBeNull();
		expect(replace).toHaveBeenCalledWith("https://checkout.stripe.com/test");
		expect(screen.getByRole("link", { name: "Open checkout" })).toHaveAttribute(
			"target",
			"_blank"
		);
		expect(done).not.toHaveBeenCalled();
	});
	it("keeps the checkout link usable when automatic tab opening is blocked", async () => {
		vi.spyOn(api, "buyCredits").mockResolvedValue({
			checkout_url: "https://checkout.stripe.com/test",
			expires_at: "2030-01-01",
		});
		renderWithQuery(<CreditsView gpuHour={200} onDone={vi.fn()} team="lab" />);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		expect(
			await screen.findByRole("link", { name: "Open checkout" })
		).toHaveAttribute("rel", "noopener noreferrer");
	});
	it("closes the reserved tab and rejects an unexpected checkout destination", async () => {
		const tab = {
			close: vi.fn(),
			closed: false,
			location: { replace: vi.fn() },
			opener: window,
		};
		vi.mocked(window.open).mockReturnValue(tab as unknown as Window);
		vi.spyOn(api, "buyCredits").mockResolvedValue({
			checkout_url: "https://checkout.stripe.com.evil.test/pay",
			expires_at: "2030-01-01",
		});
		renderWithQuery(<CreditsView gpuHour={200} onDone={vi.fn()} team="lab" />);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"invalid Stripe checkout link"
		);
		expect(tab.close).toHaveBeenCalledOnce();
		expect(tab.location.replace).not.toHaveBeenCalled();
	});
	it("keeps a checkout failure visible without reporting a successful payment", async () => {
		vi.spyOn(api, "buyCredits").mockRejectedValue(
			new Error("Checkout unavailable")
		);
		const done = vi.fn();
		renderWithQuery(<CreditsView gpuHour={200} onDone={done} team="lab" />);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Checkout unavailable"
		);
		expect(done).not.toHaveBeenCalled();
	});
});
