import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { validateSearch } from "../../app/route-state";
import type { Ended } from "../../lib/api";
import { HistoryView } from "./history-view";

const ITEMS: Ended[] = Array.from({ length: 203 }, (_, index) => ({
	ended_at: "2026-11-09T12:00:00Z",
	gpus: index % 2 ? "2× MI300X" : "1× MI300X",
	name: `machine-${String(index).padStart(3, "0")}`,
	server: `server-${String(index).padStart(3, "0")}`,
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
	it("settles on a measured page size without repeated navigation", async () => {
		vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(1240);
		vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 400, 100)
		);
		const router = open("/teams/lab/history?page=2");
		await screen.findByText("1–12 of 203 runs");
		expect(router.state.location.search).toMatchObject({
			page: 1,
			pageSize: 12,
		});
	});
	it("keeps the measured page size in deep links and page navigation", async () => {
		const router = open("/teams/lab/history?page=3&pageSize=4");
		await screen.findByText("9–12 of 203 runs");
		expect(screen.getAllByRole("listitem")).toHaveLength(4);
		await userEvent.setup().click(screen.getByRole("link", { name: "Next" }));
		await screen.findByText("13–16 of 203 runs");
		expect(router.state.location.search).toMatchObject({
			page: 4,
			pageSize: 4,
		});
	});
	it("renders ten of hundreds of runs and restores the requested page from the URL", async () => {
		const router = open("/teams/lab/history?page=3");
		await screen.findByText("21–30 of 203 runs");
		expect(screen.getAllByRole("listitem")).toHaveLength(10);
		expect(screen.getByText("server-020")).toBeInTheDocument();
		expect(screen.getByText("server-020").closest("a")).toHaveAttribute(
			"href",
			"/teams/lab/history/virtual_machines/machine-020?page=3"
		);
		expect(screen.queryByText("machine-020")).not.toBeInTheDocument();
		expect(screen.queryByText("server-000")).not.toBeInTheDocument();
		await userEvent.setup().click(screen.getByRole("link", { name: "Next" }));
		await screen.findByText("31–40 of 203 runs");
		expect(router.state.location.search.page).toBe(4);
	});
	it("ignores retired search filters in old history links", async () => {
		const router = open("/teams/lab/history?q=missing-run&page=2");
		await screen.findByText("11–20 of 203 runs");
		expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
		await userEvent.setup().click(screen.getByRole("link", { name: "Next" }));
		await screen.findByText("21–30 of 203 runs");
		expect(router.state.location.search.page).toBe(3);
	});
});
