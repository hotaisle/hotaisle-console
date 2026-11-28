import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { autoRebillStatus } from "../../../test/fixtures/auto-rebill";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import { ConsoleHeader } from "./console-header";

const AUTOPAY_DISABLED = "Autopay disabled";

function renderHeader(role: string) {
	const root = createRootRoute({
		component: () => (
			<ConsoleHeader
				team={{
					effective_roles: [role],
					handle: "lab",
					name: "Lab",
					roles: [role],
				}}
				titles={{
					history: "History",
					image: "Image",
					order: "Launch",
					run: "Run",
				}}
			/>
		),
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/teams/lab/machines"] }),
		routeTree: root.addChildren([
			createRoute({
				getParentRoute: () => root,
				path: "/teams/$team/machines",
			}),
			createRoute({
				getParentRoute: () => root,
				path: "/teams/$team/credits",
			}),
		]),
	});
	renderWithQuery(<RouterProvider router={router} />);
	return router;
}

test("shows the failed Autopay badge before and after opening team credits", async () => {
	vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
	const status = vi
		.spyOn(api, "autoRebill")
		.mockResolvedValue(autoRebillStatus());
	const router = renderHeader("purchaser");
	expect(
		await screen.findByRole("link", { name: "Autopay off" })
	).toBeVisible();

	status.mockResolvedValue(
		autoRebillStatus({
			problem: {
				reason:
					"The automatic payment failed and will not be retried automatically.",
				recovery_action:
					"Configure automatic rebilling again through Stripe Checkout.",
			},
		})
	);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(60_000);
	});
	const badge = await screen.findByRole("link", { name: AUTOPAY_DISABLED });
	expect(screen.getByRole("link", { name: "Add credits" })).toBeInTheDocument();
	fireEvent.click(badge);
	await waitFor(() =>
		expect(router.state.location.pathname).toBe("/teams/lab/credits")
	);
	expect(screen.getByText(AUTOPAY_DISABLED)).toBeVisible();
	expect(
		screen.queryByRole("link", { name: AUTOPAY_DISABLED })
	).not.toBeInTheDocument();

	act(() => {
		router.history.back();
	});
	await screen.findByRole("link", { name: AUTOPAY_DISABLED });

	status.mockResolvedValue(
		autoRebillStatus({ enabled: true, state: "enabled" })
	);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(60_000);
	});
	expect(await screen.findByRole("link", { name: "Autopay on" })).toBeVisible();
});

test("shows pending Stripe setup beside the balance on both pages", async () => {
	vi.spyOn(api, "autoRebill").mockResolvedValue(
		autoRebillStatus({ setup_pending: true })
	);
	const router = renderHeader("purchaser");
	const name = "Autopay setup pending";
	fireEvent.click(await screen.findByRole("link", { name }));
	await waitFor(() =>
		expect(router.state.location.pathname).toBe("/teams/lab/credits")
	);
	expect(screen.getByText(name)).toBeVisible();
	expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
});

test.each([
	["payment_processing", "Autopay payment processing"],
	["payment_failed", "Autopay needs attention"],
] as const)("shows the %s billing status", async (state, name) => {
	vi.spyOn(api, "autoRebill").mockResolvedValue(
		autoRebillStatus({ enabled: true, state })
	);
	renderHeader("purchaser");
	expect(await screen.findByRole("link", { name })).toBeVisible();
});

test("flags a monthly cap that can't cover the next automatic top-up", async () => {
	vi.spyOn(api, "autoRebill").mockResolvedValue(
		autoRebillStatus({
			cap_remaining_this_month_cents: 5000,
			cap_used_this_month_cents: 45_000,
			enabled: true,
			state: "capped",
		})
	);
	renderHeader("purchaser");
	expect(
		await screen.findByRole("link", { name: "Autopay cap reached" })
	).toHaveAttribute("href", "/teams/lab/credits");
	expect(screen.queryByText(AUTOPAY_DISABLED)).not.toBeInTheDocument();
});

test("does not load private billing status for a team operator", async () => {
	const status = vi
		.spyOn(api, "autoRebill")
		.mockResolvedValue(autoRebillStatus());
	renderHeader("operator");
	await screen.findByRole("banner");
	expect(status).not.toHaveBeenCalled();
});
