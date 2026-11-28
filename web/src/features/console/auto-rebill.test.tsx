import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewAPI } from "../../../dev/api";
import { autoRebillStatus } from "../../../test/fixtures/auto-rebill";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import type { TeamUsage } from "./autopay-usage";
import { CreditsView } from "./credits-view";
import { useNavigation } from "./use-navigation";

const SET_UP_AUTOPAY = "Set up autopay";
const AUTOPAY = "Autopay";
const OPEN_SETUP = "Open Stripe setup";
const RESUME_SETUP = "Continue setup on Stripe";
const CHECKOUT_PATTERN = /^Continue to Stripe · /u;
const AMOUNT_250 = /\$250/u;
const PENDING_PAYMENT_CAP = /Pending payments count toward the cap/u;
const FAILED_AUTOPAY = /The automatic payment failed and will not be retried/u;
const CADENCE = /^~/u;
const ADD_CREDITS = "Add credits";
const EDIT_SETTINGS = "Edit settings";
const AUTOPAY_SETTINGS = "Autopay settings";
const TOP_UP_AMOUNT = "Top-up amount ($25 min.)";
const PAYMENT_METHOD = "Update payment on Stripe";
const CREDITS_PATH = "/teams/lab/credits";
const AUTOPAY_PATH = `${CREDITS_PATH}/autopay`;
const LAUNCH_PATH = "/teams/lab/launch?gpus=2";
const BACK_TO_CREDITS = "Back to Add credits";

beforeEach(() => {
	vi.spyOn(window, "open").mockReturnValue(null);
	vi.spyOn(api, "autoRebill").mockResolvedValue(autoRebillStatus());
});
afterEach(() => vi.useRealTimers());

function CreditsPage({
	balanceCents,
	usage,
}: {
	balanceCents?: number;
	usage?: TeamUsage;
}) {
	const { back, editingAutopay } = useNavigation("lab");
	return (
		<CreditsView
			back={{
				label: editingAutopay ? BACK_TO_CREDITS : "Back to your machines",
				onClick: back,
			}}
			balanceCents={balanceCents}
			editingAutopay={editingAutopay}
			onDone={vi.fn()}
			team="lab"
			usage={usage}
			waitingForCapacity={false}
		/>
	);
}

function renderCredits(
	balanceCents?: number,
	initialEntries = [CREDITS_PATH],
	usage?: TeamUsage
) {
	const history = createMemoryHistory({ initialEntries });
	const root = createRootRoute({
		component: () => <CreditsPage balanceCents={balanceCents} usage={usage} />,
	});
	const router = createRouter({
		history,
		routeTree: root.addChildren([
			createRoute({ getParentRoute: () => root, path: "/teams/$team/credits" }),
			createRoute({
				getParentRoute: () => root,
				path: "/teams/$team/credits/autopay",
			}),
			createRoute({ getParentRoute: () => root, path: "/teams/$team/launch" }),
		]),
	});
	return { ...renderWithQuery(<RouterProvider router={router} />), history };
}

describe("autopay controls", () => {
	it("starts in one-time checkout and validates the cap before requesting setup", async () => {
		const setup = vi.spyOn(api, "setupAutoRebill");
		const user = userEvent.setup();
		renderCredits(undefined, [CREDITS_PATH], { hourly_rate: 0 });
		const toggle = await screen.findByRole("switch", { name: SET_UP_AUTOPAY });
		expect(toggle).not.toBeChecked();
		expect(
			screen.getByRole("button", { name: "Continue to Stripe · $100" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Set up autopay on Stripe" })
		).not.toBeInTheDocument();

		await user.click(toggle);
		expect(
			screen.queryByRole("button", { name: CHECKOUT_PATTERN })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Set up autopay on Stripe" })
		).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.queryByText(CADENCE)).not.toBeInTheDocument();

		const cap = screen.getByRole("textbox", { name: "Monthly cap ($)" });
		await user.clear(cap);
		await user.type(cap, "25");
		await user.click(
			screen.getByRole("button", { name: "Set up autopay on Stripe" })
		);
		expect(cap).toHaveAccessibleDescription("Must cover one top-up.");
		expect(cap).toHaveFocus();
		expect(cap).toHaveAttribute("aria-invalid", "true");
		expect(setup).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
	});
	it("shows a failed top-up as off and allows a fresh setup", async () => {
		const preview = new PreviewAPI("auto-rebill-failed");
		const response = await preview.fetch(
			new Request(
				"http://preview.localhost:8787/api/teams/preview/auto-rebill/"
			)
		);
		const status = await response.json();
		expect(status).toMatchObject({
			cap_used_this_month_cents: 10_000,
			monthly_cap_cents: 0,
			rebill_amount_cents: 0,
			state: "disabled",
			threshold_cents: 0,
		});
		expect(status).not.toHaveProperty("payment_method");
		vi.mocked(api.autoRebill).mockResolvedValue(status);

		const user = userEvent.setup();
		renderCredits();
		const toggle = await screen.findByRole("switch", { name: SET_UP_AUTOPAY });
		const autopay = screen.getByRole("region", { name: AUTOPAY });
		expect(toggle).not.toBeChecked();
		expect(within(autopay).getByText(FAILED_AUTOPAY)).toBeVisible();
		expect(
			within(autopay).getByText("Stripe Checkout", { exact: false })
		).toBeVisible();
		expect(screen.queryByRole("link", { name: EDIT_SETTINGS })).toBeNull();
		expect(screen.queryByRole("button", { name: PAYMENT_METHOD })).toBeNull();
		expect(
			screen.getByRole("button", { name: CHECKOUT_PATTERN })
		).toBeVisible();

		await user.click(toggle);
		expect(
			screen.getByRole("button", { name: "Set up autopay on Stripe" })
		).toBeVisible();
	});
	it.each([
		"https://checkout.stripe.com/setup",
		"https://admin.hotaisle.app/r/rebill-fixture",
	])(
		"opens setup checkout %s and shows the submitted amounts without claiming activation",
		async (url) => {
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
			const user = userEvent.setup();
			const { client } = renderCredits();
			await user.click(
				await screen.findByRole("switch", { name: SET_UP_AUTOPAY })
			);
			await user.click(screen.getByRole("radio", { name: AMOUNT_250 }));
			vi.mocked(api.autoRebill).mockResolvedValue(
				autoRebillStatus({
					can_disable: true,
					cap_remaining_this_month_cents: 0,
					monthly_cap_cents: 0,
					rebill_amount_cents: 0,
					setup_pending: true,
					threshold_cents: 0,
				})
			);
			await user.click(
				screen.getByRole("button", { name: "Set up autopay on Stripe" })
			);
			await waitFor(() =>
				expect(setup).toHaveBeenCalledWith("lab", {
					monthly_cap_cents: 50_000,
					rebill_amount_cents: 25_000,
					threshold_cents: 5000,
				})
			);
			const openSetup = await screen.findByRole("link", { name: OPEN_SETUP });
			expect(openSetup).toHaveAttribute("target", "_blank");
			expect(openSetup).toHaveAttribute("href", url);
			expect(openSetup).toHaveAttribute("rel", "noopener noreferrer");
			expect(
				screen.getByText("Setup pending", { exact: true })
			).toBeInTheDocument();
			expect(screen.getByText("$250.00")).toBeInTheDocument();
			expect(screen.getByText("Monthly cap (UTC)")).toBeVisible();
			expect(screen.queryByText(PENDING_PAYMENT_CAP)).not.toBeInTheDocument();
			expect(screen.queryByText("On", { exact: true })).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: CHECKOUT_PATTERN })
			).not.toBeInTheDocument();
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
			expect(
				await screen.findByText("On", { exact: true })
			).toBeInTheDocument();
			expect(screen.queryByText("$250.00")).not.toBeInTheDocument();
			expect(
				screen.queryByRole("link", { name: OPEN_SETUP })
			).not.toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Continue to Stripe · $100" })
			).toBeInTheDocument();
		}
	);
	it("shows the submitted amounts after reload even though autopay is not active", async () => {
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({
				can_disable: true,
				cap_remaining_this_month_cents: 0,
				cap_reserved_this_month_cents: 2500,
				cap_used_this_month_cents: 3700,
				monthly_cap_cents: 0,
				pending_settings: {
					monthly_cap_cents: 75_000,
					rebill_amount_cents: 13_729,
					threshold_cents: 5300,
				},
				rebill_amount_cents: 0,
				setup_pending: true,
				threshold_cents: 0,
			})
		);
		renderCredits(20_000, [CREDITS_PATH], {
			hourly_rate: 250,
			minimum_balance: 300,
		});
		const autopay = within(
			await screen.findByRole("region", { name: AUTOPAY })
		);
		await autopay.findByText("Setup pending");
		for (const value of ["$53.00", "$137.29", "$750.00", "$688.00"]) {
			expect(autopay.getByText(value)).toBeInTheDocument();
		}
		expect(autopay.getByText("Warning:").parentElement).toHaveTextContent(
			"~20 hours left"
		);
		expect(autopay.getByText("~2 days 6 hours")).toBeVisible();
		expect(autopay.getByText(PENDING_PAYMENT_CAP)).toBeVisible();
		expect(autopay.getByRole("button", { name: "Cancel setup" })).toBeVisible();
		expect(
			autopay.queryByRole("button", { name: RESUME_SETUP })
		).not.toBeInTheDocument();
		expect(autopay.queryByRole("switch")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Continue to Stripe · $100" })
		).toBeVisible();
	});
	it("warns below 24 hours at the trigger, not at exactly 24 hours", async () => {
		const user = userEvent.setup();
		renderCredits(30_000, [CREDITS_PATH], {
			hourly_rate: 200,
			minimum_balance: 200,
		});
		await user.click(
			await screen.findByRole("switch", { name: SET_UP_AUTOPAY })
		);
		expect(screen.getByText("~1 day left at trigger")).toBeVisible();
		expect(screen.queryByText("Warning:")).not.toBeInTheDocument();

		const trigger = screen.getByRole("textbox", { name: "Top up below ($)" });
		await user.clear(trigger);
		await user.type(trigger, "49.99");
		expect(screen.getByText("Warning:").parentElement).toHaveTextContent(
			"~23 hours left"
		);
	});
	it("opens the original pending setup without restarting or activating autopay", async () => {
		const url = "https://checkout.stripe.com/setup/test";
		const tab = {
			closed: false,
			location: { replace: vi.fn() },
			opener: window,
		};
		vi.mocked(window.open).mockReturnValue(tab as unknown as Window);
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({
				can_disable: true,
				can_resume_setup: true,
				setup_pending: true,
			})
		);
		const start = vi.spyOn(api, "setupAutoRebill");
		const resume = vi.spyOn(api, "resumeAutoRebillSetup").mockResolvedValue({
			checkout_url: url,
			expires_at: "2030-01-01",
		});
		const user = userEvent.setup();
		renderCredits();
		await user.click(await screen.findByRole("button", { name: RESUME_SETUP }));
		await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith(url));
		expect(resume).toHaveBeenCalledExactlyOnceWith("lab");
		expect(start).not.toHaveBeenCalled();
		expect(screen.getByText("Setup pending")).toBeVisible();
		expect(screen.getByRole("button", { name: "Cancel setup" })).toBeVisible();
		expect(
			screen.getByRole("button", { name: CHECKOUT_PATTERN })
		).toBeVisible();
	});
	it("shows an error and removes resume when Stripe setup closes before the click", async () => {
		const tab = {
			close: vi.fn(),
			closed: false,
			location: { replace: vi.fn() },
		};
		vi.mocked(window.open).mockReturnValue(tab as unknown as Window);
		const status = autoRebillStatus({
			can_disable: true,
			can_resume_setup: true,
			setup_pending: true,
		});
		vi.mocked(api.autoRebill).mockResolvedValue(status);
		const message = "Automatic rebill setup is no longer open on Stripe.";
		vi.spyOn(api, "resumeAutoRebillSetup").mockImplementation(() => {
			vi.mocked(api.autoRebill).mockResolvedValue({
				...status,
				can_resume_setup: false,
			});
			return Promise.reject(new Error(message));
		});
		const user = userEvent.setup();
		renderCredits();
		await user.click(await screen.findByRole("button", { name: RESUME_SETUP }));
		expect(await screen.findByRole("alert")).toHaveTextContent(message);
		expect(tab.close).toHaveBeenCalledOnce();
		expect(tab.location.replace).not.toHaveBeenCalled();
		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: RESUME_SETUP })
			).not.toBeInTheDocument();
		});
		expect(screen.getByRole("button", { name: "Cancel setup" })).toBeVisible();
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
		const user = userEvent.setup();
		renderCredits();
		await user.click(
			await screen.findByRole("switch", { name: SET_UP_AUTOPAY })
		);
		await user.click(
			screen.getByRole("button", { name: "Set up autopay on Stripe" })
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
		renderCredits();
		await screen.findByText("On", { exact: true });
		expect(screen.queryByRole("switch")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: EDIT_SETTINGS })
		).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: PAYMENT_METHOD })).toBeNull();
		expect(
			screen.getByText("A team purchaser can manage autopay.", {
				exact: false,
			})
		).toBeInTheDocument();
	});
	it.each([BACK_TO_CREDITS, "Cancel", "Browser Back"])(
		"%s returns to Add credits and discards the edit draft",
		async (action) => {
			vi.mocked(api.autoRebill).mockResolvedValue(
				autoRebillStatus({
					can_update_settings: true,
					enabled: true,
					rebill_amount_cents: 12_529,
					state: "enabled",
				})
			);
			const update = vi.spyOn(api, "updateAutoRebill");
			const user = userEvent.setup();
			const { history } = renderCredits();
			await user.click(
				await screen.findByRole("link", { name: EDIT_SETTINGS })
			);
			await screen.findByRole("heading", { level: 1, name: AUTOPAY_SETTINGS });
			expect(history.location.pathname).toBe(AUTOPAY_PATH);
			const amount = screen.getByRole("textbox", { name: TOP_UP_AMOUNT });
			await user.clear(amount);
			await user.type(amount, "150");
			if (action === "Browser Back") {
				await act(async () => history.back());
			} else {
				await user.click(screen.getByRole("button", { name: action }));
			}

			expect(
				await screen.findByRole("heading", { level: 1, name: ADD_CREDITS })
			).toBeVisible();
			expect(
				screen.getByRole("button", { name: CHECKOUT_PATTERN })
			).toBeVisible();
			expect(history.location.pathname).toBe(CREDITS_PATH);
			expect(update).not.toHaveBeenCalled();
			await act(async () => history.forward());
			expect(
				await screen.findByRole("textbox", { name: TOP_UP_AMOUNT })
			).toHaveValue("125.29");
		}
	);
	it("opens a bookmarked editor and returns to Add credits rather than an unrelated prior URL", async () => {
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({
				can_update_settings: true,
				enabled: true,
				state: "enabled",
			})
		);
		const { history } = renderCredits(undefined, [LAUNCH_PATH, AUTOPAY_PATH]);
		expect(
			await screen.findByRole("textbox", { name: TOP_UP_AMOUNT })
		).toHaveValue("100");
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: BACK_TO_CREDITS }));
		await screen.findByRole("heading", { name: ADD_CREDITS });
		expect(history.location.pathname).toBe(CREDITS_PATH);
		await act(async () => history.back());
		expect(history.location.href).toBe(LAUNCH_PATH);
	});
	it("does not navigate a second time if Browser Back leaves an in-flight save", async () => {
		const enabled = autoRebillStatus({
			can_update_settings: true,
			enabled: true,
			state: "enabled",
		});
		vi.mocked(api.autoRebill).mockResolvedValue(enabled);
		let finishSave: () => void = () => {
			throw new Error("Save request did not start");
		};
		const pending = new Promise<void>((resolve) => {
			finishSave = resolve;
		});
		const update = vi.spyOn(api, "updateAutoRebill").mockReturnValue(pending);
		const user = userEvent.setup();
		const { history } = renderCredits(undefined, [LAUNCH_PATH, CREDITS_PATH]);
		await user.click(await screen.findByRole("link", { name: EDIT_SETTINGS }));
		const amount = await screen.findByRole("textbox", {
			name: TOP_UP_AMOUNT,
		});
		await user.clear(amount);
		await user.type(amount, "125");
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		expect(update).toHaveBeenCalledOnce();

		await act(async () => history.back());
		await screen.findByRole("heading", { name: ADD_CREDITS });
		vi.mocked(api.autoRebill).mockResolvedValue({
			...enabled,
			rebill_amount_cents: 12_500,
		});
		finishSave();
		await screen.findByText("Autopay settings saved.");
		expect(history.location.pathname).toBe(CREDITS_PATH);
	});
	it("saves edited cents and hides one-time checkout while editing; a failed disable remains a failure", async () => {
		const enabled = autoRebillStatus({
			can_disable: true,
			can_update_settings: true,
			enabled: true,
			payment_method: { display: "Visa •••• 4242", type: "card" },
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
		renderCredits();
		await screen.findByText("On", { exact: true });
		expect(screen.getByText("Visa •••• 4242")).toBeInTheDocument();
		await user.click(screen.getByRole("link", { name: EDIT_SETTINGS }));
		await screen.findByRole("heading", { name: AUTOPAY_SETTINGS });
		expect(screen.queryByRole("switch", { name: AUTOPAY })).toBeNull();
		expect(screen.getByText("On", { exact: true })).toBeVisible();
		expect(
			screen.queryByRole("button", { name: CHECKOUT_PATTERN })
		).not.toBeInTheDocument();
		const amount = screen.getByRole("textbox", {
			name: TOP_UP_AMOUNT,
		});
		await user.clear(amount);
		await user.type(amount, "21.444");
		expect(amount).toHaveValue("21.44");
		expect(amount).toHaveAttribute("aria-invalid", "false");
		await user.keyboard("{Enter}");
		expect(amount).toHaveFocus();
		expect(amount).toHaveAttribute("aria-invalid", "true");
		expect(amount).toHaveAccessibleDescription("Minimum $25.");
		expect(update).not.toHaveBeenCalled();
		await user.clear(amount);
		await user.type(amount, "125.29");
		expect(amount).toHaveAttribute("aria-invalid", "false");
		expect(amount).not.toHaveAccessibleDescription();
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		const autopay = screen.getByRole("region", { name: AUTOPAY });
		const feedback = within(autopay).getByRole("status");
		expect(
			await within(feedback).findByText("Autopay settings saved.")
		).toBeVisible();
		expect(
			screen.getByRole("heading", { level: 1, name: ADD_CREDITS })
		).toBeVisible();
		expect(update).toHaveBeenCalledWith("lab", {
			monthly_cap_cents: 50_000,
			rebill_amount_cents: 12_529,
			threshold_cents: 5000,
		});
		expect(screen.getByText("$125.29")).toBeInTheDocument();
		const toggle = screen.getByRole("switch", { name: AUTOPAY });
		expect(toggle).toBeChecked();
		await user.click(toggle);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Payment is still processing"
		);
		expect(screen.getByText("On", { exact: true })).toBeInTheDocument();
		expect(toggle).toBeChecked();
		expect(toggle).toHaveFocus();
		expect(
			screen.queryByText("Autopay turned off.", { exact: false })
		).not.toBeInTheDocument();
	});
	it.each([
		{ cents: 13_729, custom: "137.29", preset: undefined },
		{ cents: 25_000, custom: "", preset: "250" },
	])("restores saved $cents cents", async ({ cents, custom, preset }) => {
		const settings = {
			monthly_cap_cents: 75_050,
			rebill_amount_cents: cents,
			threshold_cents: 5300,
		};
		vi.mocked(api.autoRebill).mockResolvedValue(
			autoRebillStatus({
				...settings,
				can_disable: true,
				enabled: true,
				state: "enabled",
			})
		);
		vi.spyOn(api, "disableAutoRebill").mockImplementation(() => {
			vi.mocked(api.autoRebill).mockResolvedValue(
				autoRebillStatus({
					cap_remaining_this_month_cents: 0,
					monthly_cap_cents: 0,
					rebill_amount_cents: 0,
					threshold_cents: 0,
				})
			);
			return Promise.resolve();
		});
		const setup = vi
			.spyOn(api, "setupAutoRebill")
			.mockRejectedValue(new Error("Stripe unavailable"));
		const user = userEvent.setup();
		renderCredits();
		const toggle = await screen.findByRole("switch", { name: AUTOPAY });
		await user.click(screen.getByRole("radio", { name: "$500" }));
		await user.click(toggle);
		const off = await screen.findByRole("switch", { name: SET_UP_AUTOPAY });
		await user.click(off);
		expect(
			screen.getByRole("textbox", { name: "Top up below ($)" })
		).toHaveValue("53");
		expect(
			screen.getByRole("textbox", { name: "Monthly cap ($)" })
		).toHaveValue("750.50");
		expect(
			screen.getByRole("textbox", { name: "Custom amount ($25 min.)" })
		).toHaveValue(custom);
		expect(
			screen.queryByRole("radio", { checked: true })?.getAttribute("value")
		).toBe(preset);
		expect(setup).not.toHaveBeenCalled();

		await user.click(screen.getByRole("switch", { name: SET_UP_AUTOPAY }));
		expect(screen.getByRole("radio", { name: "$500" })).toBeChecked();
		await user.click(screen.getByRole("switch", { name: SET_UP_AUTOPAY }));
		await user.click(
			screen.getByRole("button", { name: "Set up autopay on Stripe" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Stripe unavailable"
		);
		expect(setup).toHaveBeenCalledExactlyOnceWith("lab", settings);
	});
	it("opens Stripe directly with the latest saved amounts and updates the displayed method after confirmation", async () => {
		const original = autoRebillStatus({
			can_disable: true,
			can_update_settings: true,
			enabled: true,
			payment_method: { display: "Visa ending 4242", type: "card" },
			state: "enabled",
		});
		const latest = {
			monthly_cap_cents: 75_000,
			rebill_amount_cents: 13_729,
			threshold_cents: 5300,
		};
		vi.mocked(api.autoRebill).mockResolvedValue(original);
		const url = "https://checkout.stripe.com/setup";
		const replace = vi.fn();
		vi.mocked(window.open).mockReturnValue({
			closed: false,
			location: { replace },
		} as unknown as Window);
		const setup = vi.spyOn(api, "setupAutoRebill").mockImplementation(() => {
			vi.mocked(api.autoRebill).mockResolvedValue({
				...original,
				setup_pending: true,
			});
			return Promise.resolve({ checkout_url: url, expires_at: "2030-01-01" });
		});
		const user = userEvent.setup();
		const { client } = renderCredits();
		const button = await screen.findByRole("button", { name: PAYMENT_METHOD });
		vi.mocked(api.autoRebill).mockResolvedValueOnce({ ...original, ...latest });
		await user.click(button);

		const open = await screen.findByRole("link", { name: OPEN_SETUP });
		expect(open).toHaveAttribute("href", url);
		expect(setup).toHaveBeenCalledExactlyOnceWith("lab", latest);
		await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith(url));
		expect(screen.getByText("Setup pending", { exact: true })).toBeVisible();
		expect(screen.getByText("$137.29")).toBeVisible();
		expect(screen.getByText("Visa ending 4242")).toBeVisible();
		expect(screen.queryByRole("textbox", { name: TOP_UP_AMOUNT })).toBeNull();
		expect(screen.queryByRole("button", { name: CHECKOUT_PATTERN })).toBeNull();

		vi.mocked(api.autoRebill).mockResolvedValue({
			...original,
			...latest,
			payment_method: { display: "Mastercard ending 8888", type: "card" },
		});
		await act(() =>
			client.invalidateQueries({ queryKey: ["auto-rebill", "lab"] })
		);
		expect(await screen.findByText("Mastercard ending 8888")).toBeVisible();
		expect(screen.queryByRole("link", { name: OPEN_SETUP })).toBeNull();
		expect(
			screen.getByRole("button", { name: CHECKOUT_PATTERN })
		).toBeVisible();
	});
	it("does not create a Stripe session if the refreshed status no longer permits replacement", async () => {
		const original = autoRebillStatus({ enabled: true, state: "enabled" });
		vi.mocked(api.autoRebill).mockResolvedValue(original);
		const close = vi.fn();
		vi.mocked(window.open).mockReturnValue({ close } as unknown as Window);
		const setup = vi.spyOn(api, "setupAutoRebill").mockResolvedValue({
			checkout_url: "https://checkout.stripe.com/setup",
			expires_at: "2030-01-01",
		});
		const user = userEvent.setup();
		renderCredits();
		const button = await screen.findByRole("button", { name: PAYMENT_METHOD });
		vi.mocked(api.autoRebill).mockResolvedValue({
			...original,
			can_configure: false,
		});
		await user.click(button);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Autopay no longer allows a payment method change."
		);
		expect(setup).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledOnce();
		expect(screen.queryByRole("button", { name: PAYMENT_METHOD })).toBeNull();
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
		let finishDisable: () => void = () => {
			throw new Error("Disable request did not start");
		};
		const pending = new Promise<void>((resolve) => {
			finishDisable = resolve;
		});
		const disable = vi
			.spyOn(api, "disableAutoRebill")
			.mockImplementation(async () => {
				await pending;
				vi.mocked(api.autoRebill).mockResolvedValue(
					autoRebillStatus({
						can_configure: false,
						cap_remaining_this_month_cents: 40_000,
						cap_reserved_this_month_cents: 10_000,
						enabled: false,
						state: "payment_processing",
					})
				);
			});
		const user = userEvent.setup();
		renderCredits();
		const toggle = await screen.findByRole("switch", { name: AUTOPAY });
		toggle.focus();
		await user.keyboard("[Space]");
		expect(toggle).toBeChecked();
		expect(toggle).toHaveFocus();
		await user.keyboard("[Space]");
		expect(disable).toHaveBeenCalledExactlyOnceWith("lab");
		finishDisable();
		expect(
			await screen.findByText(
				"Future top-ups are off; this payment is still processing.",
				{ exact: false }
			)
		).toBeInTheDocument();
		expect(
			screen.getByText("Pending payment", { exact: true })
		).toBeInTheDocument();
		expect(toggle).not.toBeInTheDocument();
	});
	it("polls status every ten seconds while mounted and stops on unmount", async () => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
		const { unmount } = renderCredits();
		await screen.findByRole("switch", { name: SET_UP_AUTOPAY });
		const before = vi.mocked(api.autoRebill).mock.calls.length;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		await waitFor(() =>
			expect(api.autoRebill).toHaveBeenCalledTimes(before + 1)
		);
		unmount();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000);
		});
		expect(api.autoRebill).toHaveBeenCalledTimes(before + 1);
	});
});
