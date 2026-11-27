import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoRebillStatus } from "../../../test/fixtures/auto-rebill";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import { CreditsView } from "./credits-view";

const CHECKOUT_PATTERN = /Continue to Stripe/u;
const AMOUNT_PATTERN = /\$250/u;
const CUSTOM_AMOUNT = /^Custom amount/u;
const SET_UP_AUTOPAY = "Set up autopay";
const OPEN_CHECKOUT = "Open Stripe checkout";
const RESERVATION_DISCLOSURE = /credits don't reserve a machine\.$/iu;
const back = { label: "Back to your machines", onClick: vi.fn() };
beforeEach(() => {
	vi.spyOn(window, "open").mockReturnValue(null);
	vi.spyOn(api, "autoRebill").mockResolvedValue(autoRebillStatus());
});
describe("credits checkout", () => {
	it("shows the current team balance in the header once available", () => {
		const props = {
			back,
			onDone: vi.fn(),
			team: "lab",
			waitingForCapacity: false,
		};
		const { rerender } = renderWithQuery(<CreditsView {...props} />);
		const header = within(screen.getByRole("banner"));
		expect(header.queryByText("Balance")).not.toBeInTheDocument();

		rerender(<CreditsView {...props} balanceCents={0} />);
		expect(header.getByText("Balance")).toHaveTextContent("Balance $0.00");

		rerender(<CreditsView {...props} balanceCents={12_345} />);
		expect(header.getByText("Balance")).toHaveTextContent("Balance $123.45");
	});
	it("keeps the checkout amount and focus while autopay finishes checking", async () => {
		const status = autoRebillStatus();
		let resolveStatus: (value: typeof status) => void = () => undefined;
		vi.mocked(api.autoRebill).mockReturnValue(
			new Promise((resolve) => {
				resolveStatus = resolve;
			})
		);
		renderWithQuery(
			<CreditsView
				back={back}
				onDone={vi.fn()}
				team="lab"
				waitingForCapacity={false}
			/>
		);
		expect(screen.getByText("Checking…")).toBeVisible();
		const amount = screen.getByRole("textbox", { name: CUSTOM_AMOUNT });
		await userEvent.setup().type(amount, "75");

		resolveStatus(status);
		await screen.findByRole("switch", { name: SET_UP_AUTOPAY });
		expect(amount).toHaveFocus();
		expect(
			screen.getByRole("button", { name: "Continue to Stripe · $75" })
		).toBeVisible();
	});
	it("discloses the wait before checkout and updates when capacity changes", () => {
		const props = { back, onDone: vi.fn(), team: "lab" };
		const { rerender } = renderWithQuery(
			<CreditsView {...props} waitingForCapacity />
		);
		const notice = screen.getByRole("status");
		expect(notice).toHaveTextContent("No compute is available now.");
		expect(notice).toHaveTextContent(RESERVATION_DISCLOSURE);
		rerender(<CreditsView {...props} waitingForCapacity={false} />);
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		expect(screen.getByText(RESERVATION_DISCLOSURE)).toBeVisible();
	});
	it("does not create checkout below the minimum amount", async () => {
		const user = userEvent.setup();
		const buy = vi.spyOn(api, "buyCredits");
		const done = vi.fn();
		renderWithQuery(
			<CreditsView
				back={back}
				onDone={done}
				team="lab"
				waitingForCapacity={false}
			/>
		);
		const custom = screen.getByRole("textbox", { name: CUSTOM_AMOUNT });
		await user.type(custom, "19");
		await user.tab();
		expect(custom).toHaveAccessibleDescription("Minimum $20.");
		await user.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		expect(await screen.findByRole("alert")).toHaveTextContent("$20");
		expect(custom).toHaveFocus();
		expect(buy).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
	});
	it("enforces the $25 autopay minimum and clears errors when switching back to one-time credits", async () => {
		const user = userEvent.setup();
		const buy = vi.spyOn(api, "buyCredits").mockResolvedValue({
			checkout_url: "https://checkout.stripe.com/test",
			expires_at: "2030-01-01",
		});
		const setup = vi.spyOn(api, "setupAutoRebill");
		renderWithQuery(
			<CreditsView
				back={back}
				balanceCents={2500}
				onDone={vi.fn()}
				team="lab"
				waitingForCapacity={false}
			/>
		);
		const toggle = await screen.findByRole("switch", {
			name: SET_UP_AUTOPAY,
		});
		const custom = screen.getByRole("textbox", { name: CUSTOM_AMOUNT });
		await user.type(custom, "20.559");
		expect(custom).toHaveValue("20.55");
		await user.keyboard("{Control>}a{/Control}");
		await user.paste("250.123");
		expect(custom).toHaveValue("20.55");
		expect(screen.getByRole("group", { name: "Top-up amount" })).toBeVisible();
		await user.click(toggle);
		expect(screen.getByRole("group", { name: "Autopay amount" })).toBeVisible();
		await user.click(
			screen.getByRole("button", { name: "Set up autopay on Stripe" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent("$25");
		expect(custom).toHaveFocus();
		expect(setup).not.toHaveBeenCalled();

		await user.click(toggle);
		expect(screen.getByRole("group", { name: "Top-up amount" })).toBeVisible();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Continue to Stripe · $20.55" })
		);
		await waitFor(() => expect(buy).toHaveBeenCalledWith("lab", 2055));
	});
	it("shows the same payment warnings for one-time credits and autopay", async () => {
		const user = userEvent.setup();
		renderWithQuery(
			<CreditsView
				back={back}
				onDone={vi.fn()}
				team="lab"
				waitingForCapacity={false}
			/>
		);
		const oneTimeDisclosure = screen.getByText(
			RESERVATION_DISCLOSURE
		).textContent;
		await user.click(
			await screen.findByRole("switch", { name: SET_UP_AUTOPAY })
		);
		const disclosure = screen.getByText(RESERVATION_DISCLOSURE);
		expect(disclosure).toHaveTextContent("4 business days");
		expect(disclosure).toHaveTextContent("Machines can still be deleted");
		expect(disclosure.textContent).toBe(oneTimeDisclosure);
	});
	it.each([
		"https://checkout.stripe.com/test",
		"https://admin.hotaisle.app/r/checkout-fixture",
	])("requests cents and opens the API checkout link %s", async (url) => {
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
			checkout_url: url,
			expires_at: "2030-01-01",
		});
		const done = vi.fn();
		renderWithQuery(
			<CreditsView
				back={back}
				onDone={done}
				team="lab"
				waitingForCapacity={false}
			/>
		);
		await user.click(screen.getByRole("radio", { name: AMOUNT_PATTERN }));
		await user.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		await waitFor(() => expect(buy).toHaveBeenCalledWith("lab", 25_000));
		expect(
			await screen.findByRole("link", { name: OPEN_CHECKOUT })
		).toHaveAttribute("href", url);
		expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
		expect(tab.opener).toBeNull();
		expect(replace).toHaveBeenCalledWith(url);
		expect(screen.getByRole("link", { name: OPEN_CHECKOUT })).toHaveAttribute(
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
		renderWithQuery(
			<CreditsView
				back={back}
				balanceCents={12_345}
				onDone={vi.fn()}
				team="lab"
				waitingForCapacity={false}
			/>
		);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		expect(
			await screen.findByRole("link", { name: OPEN_CHECKOUT })
		).toHaveAttribute("rel", "noopener noreferrer");
		expect(screen.getByRole("banner")).toHaveTextContent("Balance $123.45");
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
		renderWithQuery(
			<CreditsView
				back={back}
				onDone={vi.fn()}
				team="lab"
				waitingForCapacity={false}
			/>
		);
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
		renderWithQuery(
			<CreditsView
				back={back}
				onDone={done}
				team="lab"
				waitingForCapacity={false}
			/>
		);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: CHECKOUT_PATTERN }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Checkout unavailable"
		);
		expect(done).not.toHaveBeenCalled();
	});
});
