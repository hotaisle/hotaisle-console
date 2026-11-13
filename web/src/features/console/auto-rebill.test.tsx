import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autoRebillStatus } from "../../../test/fixtures/auto-rebill";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import { AutoRebill } from "./auto-rebill";

beforeEach(() => {
	vi.spyOn(window, "open").mockReturnValue(null);
	vi.spyOn(api, "autoRebill").mockResolvedValue(autoRebillStatus());
});
afterEach(() => vi.useRealTimers());

async function openRebill() {
	const user = userEvent.setup();
	const view = renderWithQuery(<AutoRebill team="lab" />);
	await user.click(screen.getByText("Automatic rebill", { exact: true }));
	await screen.findByText("Off", { exact: true });
	return { user, ...view };
}

describe("automatic rebill controls", () => {
	it("loads only when expanded and validates cap against amount before requesting setup", async () => {
		const setup = vi.spyOn(api, "setupAutoRebill");
		const user = userEvent.setup();
		renderWithQuery(<AutoRebill team="lab" />);
		expect(api.autoRebill).not.toHaveBeenCalled();
		await user.click(screen.getByText("Automatic rebill", { exact: true }));
		await user.click(
			await screen.findByRole("button", { name: "Set up automatic rebill" })
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		const cap = screen.getByRole("spinbutton", { name: "Monthly cap (USD)" });
		await user.clear(cap);
		await user.type(cap, "25");
		await user.click(
			screen.getByRole("button", { name: "Continue to Stripe" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"cap that covers at least one top-up"
		);
		expect(cap).toHaveFocus();
		expect(cap).toHaveAttribute("aria-invalid", "true");
		expect(setup).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
	});
	it.each([
		"https://checkout.stripe.com/setup",
		"https://admin.hotaisle.app/r/rebill-fixture",
	])("opens setup checkout %s without claiming activation", async (url) => {
		const replace = vi.fn();
		const tab = {
			close: vi.fn(),
			closed: false,
			location: { replace },
			opener: window,
		};
		vi.mocked(window.open).mockReturnValue(tab as unknown as Window);
		const setup = vi.spyOn(api, "setupAutoRebill").mockResolvedValue({
			checkout_url: url,
			expires_at: "2030-01-01",
		});
		const { user, client } = await openRebill();
		await user.click(
			screen.getByRole("button", { name: "Set up automatic rebill" })
		);
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({ can_disable: true, setup_pending: true })
		);
		await user.click(
			screen.getByRole("button", { name: "Continue to Stripe" })
		);
		await waitFor(() =>
			expect(setup).toHaveBeenCalledWith("lab", {
				monthly_cap_cents: 50_000,
				rebill_amount_cents: 10_000,
				threshold_cents: 5000,
			})
		);
		expect(
			await screen.findByRole("link", { name: "Open setup checkout" })
		).toHaveAttribute("target", "_blank");
		expect(
			screen.getByRole("link", { name: "Open setup checkout" })
		).toHaveAttribute("href", url);
		expect(
			screen.getByRole("link", { name: "Open setup checkout" })
		).toHaveAttribute("rel", "noopener noreferrer");
		expect(
			screen.getByText("Setup pending", { exact: true })
		).toBeInTheDocument();
		expect(screen.queryByText("On", { exact: true })).not.toBeInTheDocument();
		await waitFor(() => expect(replace).toHaveBeenCalledWith(url));
		expect(tab.opener).toBeNull();
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({
				can_disable: true,
				can_update_settings: true,
				enabled: true,
				state: "enabled",
			})
		);
		await act(() =>
			client.invalidateQueries({ queryKey: ["auto-rebill", "lab"] })
		);
		expect(await screen.findByText("On", { exact: true })).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Open setup checkout" })
		).not.toBeInTheDocument();
	});
	it("rejects an untrusted checkout link and closes the reserved tab", async () => {
		const tab = {
			close: vi.fn(),
			closed: false,
			location: { replace: vi.fn() },
			opener: window,
		};
		vi.mocked(window.open).mockReturnValue(tab as unknown as Window);
		vi.spyOn(api, "setupAutoRebill").mockResolvedValue({
			checkout_url: "https://checkout.stripe.com.evil.test/setup",
			expires_at: "2030-01-01",
		});
		const { user } = await openRebill();
		await user.click(
			screen.getByRole("button", { name: "Set up automatic rebill" })
		);
		await user.click(
			screen.getByRole("button", { name: "Continue to Stripe" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"invalid Stripe checkout link"
		);
		expect(tab.close).toHaveBeenCalledOnce();
		expect(tab.location.replace).not.toHaveBeenCalled();
	});
	it("uses authoritative permissions rather than offering actions to a read-only owner", async () => {
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({
				can_configure: false,
				can_disable: false,
				can_update_settings: false,
				enabled: true,
				state: "enabled",
			})
		);
		const user = userEvent.setup();
		renderWithQuery(<AutoRebill team="lab" />);
		await user.click(screen.getByText("Automatic rebill", { exact: true }));
		await screen.findByText("On", { exact: true });
		expect(
			screen.queryByRole("button", { name: "Edit rebill settings" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Change payment method" })
		).not.toBeInTheDocument();
		expect(
			screen.getByText("A team purchaser can manage automatic rebill.", {
				exact: false,
			})
		).toBeInTheDocument();
	});
	it("saves edited cents, then refreshes status; a failed disable remains a failure", async () => {
		const enabled = autoRebillStatus({
			can_disable: true,
			can_update_settings: true,
			enabled: true,
			state: "enabled",
		});
		vi.mocked(api.autoRebill).mockResolvedValue(enabled);
		const update = vi
			.spyOn(api, "updateAutoRebill")
			.mockImplementation((_team, settings) => {
				vi.mocked(api.autoRebill).mockResolvedValue({
					...enabled,
					...settings,
				});
				return Promise.resolve();
			});
		vi.spyOn(api, "disableAutoRebill").mockRejectedValue(
			new Error("Payment is still processing")
		);
		const user = userEvent.setup();
		renderWithQuery(<AutoRebill team="lab" />);
		await user.click(screen.getByText("Automatic rebill", { exact: true }));
		await user.click(
			await screen.findByRole("button", { name: "Edit rebill settings" })
		);
		const amount = screen.getByRole("spinbutton", {
			name: "Top-up amount (USD)",
		});
		await user.clear(amount);
		await user.type(amount, "125.29");
		await user.click(
			screen.getByRole("button", { name: "Save rebill settings" })
		);
		expect(
			await screen.findByText("Automatic rebill settings saved.")
		).toBeInTheDocument();
		expect(update).toHaveBeenCalledWith("lab", {
			monthly_cap_cents: 50_000,
			rebill_amount_cents: 12_529,
			threshold_cents: 5000,
		});
		expect(screen.getByText("$125.29")).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Turn off auto-rebill" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Payment is still processing"
		);
		expect(screen.getByText("On", { exact: true })).toBeInTheDocument();
		expect(
			screen.queryByText("Automatic rebill turned off.", { exact: false })
		).not.toBeInTheDocument();
	});
	it("disables future top-ups but keeps a pending payment and cap reservation visible", async () => {
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({
				can_configure: false,
				can_disable: true,
				cap_remaining_this_month_cents: 40_000,
				cap_reserved_this_month_cents: 10_000,
				enabled: true,
				state: "payment_processing",
			})
		);
		const disable = vi
			.spyOn(api, "disableAutoRebill")
			.mockImplementation(() => {
				vi.mocked(api.autoRebill).mockResolvedValue(
					autoRebillStatus({
						can_configure: false,
						cap_remaining_this_month_cents: 40_000,
						cap_reserved_this_month_cents: 10_000,
						enabled: false,
						state: "payment_processing",
					})
				);
				return Promise.resolve();
			});
		const user = userEvent.setup();
		renderWithQuery(<AutoRebill team="lab" />);
		await user.click(screen.getByText("Automatic rebill", { exact: true }));
		await user.click(
			await screen.findByRole("button", { name: "Turn off auto-rebill" })
		);
		await waitFor(() => expect(disable).toHaveBeenCalledWith("lab"));
		expect(
			await screen.findByText(
				"Future top-ups are off; this payment is still processing.",
				{ exact: false }
			)
		).toBeInTheDocument();
		expect(
			screen.getByText("Pending payment", { exact: true })
		).toBeInTheDocument();
	});
	it("polls status every ten seconds only while expanded", async () => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
		const { user } = await openRebill();
		const before = vi.mocked(api.autoRebill).mock.calls.length;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		await waitFor(() =>
			expect(api.autoRebill).toHaveBeenCalledTimes(before + 1)
		);
		await user.click(screen.getByText("Automatic rebill", { exact: true }));
		await waitFor(() =>
			expect(screen.queryByText("Off", { exact: true })).not.toBeInTheDocument()
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000);
		});
		expect(api.autoRebill).toHaveBeenCalledTimes(before + 1);
	});
});
