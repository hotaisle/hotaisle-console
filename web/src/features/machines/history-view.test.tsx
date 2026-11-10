import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { validateSearch } from "../../app/route-state";
import type { Ended } from "../../lib/api";
import { HistoryView } from "./history-view";

const ITEMS: Ended[] = Array.from({ length: 203 }, (_, index) => ({
	ended_at: "2026-11-09T12:00:00Z",
	gpus: index % 2 ? "2× MI300X" : "1× MI300X",
	name: `machine-${String(index).padStart(3, "0")}`,
	server: index === 175 ? "training-server" : undefined,
	team: "lab",
}));
function HistoryScreen() {
	return <HistoryView items={ITEMS} team="lab" />;
}
function open(path: string) {
	const root = createRootRoute({ component: Outlet, validateSearch });
	const route = createRoute({
		component: HistoryScreen,
		getParentRoute: () => root,
		path: "/teams/$team/history",
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: [path] }),
		routeTree: root.addChildren([route]),
	});
	render(<RouterProvider router={router} />);
	return router;
}
describe("machine history", () => {
	it("renders ten of hundreds of runs and restores the requested page from the URL", async () => {
		const router = open("/teams/lab/history?page=3");
		await screen.findByText("21–30 of 203 runs");
		expect(screen.getAllByRole("listitem")).toHaveLength(10);
		expect(screen.getByText("machine-020")).toBeInTheDocument();
		expect(screen.queryByText("machine-000")).not.toBeInTheDocument();
		await userEvent.setup().click(screen.getByRole("link", { name: "Next" }));
		await screen.findByText("31–40 of 203 runs");
		expect(router.state.location.search.page).toBe(4);
	});
	it("searches across every page and resets pagination, with shareable search state", async () => {
		const router = open("/teams/lab/history?page=4");
		const user = userEvent.setup();
		await user.type(
			await screen.findByRole("searchbox", { name: "Search machine history" }),
			"training"
		);
		await user.click(screen.getByRole("button", { name: "Search" }));
		await screen.findByText("1–1 of 1 run");
		expect(screen.getByText("machine-175")).toBeInTheDocument();
		expect(router.state.location.search.q).toBe("training");
		expect(router.state.location.search.page).toBeUndefined();
		await user.click(screen.getByRole("link", { name: "Clear search" }));
		await screen.findByText("1–10 of 203 runs");
		await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue(""));
	});
});
