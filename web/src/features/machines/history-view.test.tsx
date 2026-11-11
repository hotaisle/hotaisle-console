import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	useRouterState,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
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
/** Exercise route-driven re-renders with the derived props passed by the console. */
function DerivedHistoryScreen() {
	useRouterState();
	return <HistoryView items={[...ITEMS]} team="lab" />;
}
function open(path: string, component = HistoryScreen) {
	const root = createRootRoute({ component: Outlet, validateSearch });
	const route = createRoute({
		component,
		getParentRoute: () => root,
		path: "/teams/$team/history",
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: [path] }),
		routeTree: root.addChildren([route]),
	});
	const navigate = router.navigate.bind(router);
	// Bound the regression so a navigation storm fails instead of freezing the runner.
	vi.spyOn(router, "navigate").mockImplementation((options) => {
		if (vi.mocked(router.navigate).mock.calls.length > 20) {
			throw new Error("History kept navigating.");
		}
		return navigate(options);
	});
	render(<RouterProvider router={router} />);
	return router;
}
describe("machine history", () => {
	it("settles when route changes produce a fresh history array", async () => {
		vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(1240);
		vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 400, 100)
		);
		const router = open("/teams/lab/history", DerivedHistoryScreen);
		await screen.findByText("1–12 of 203 runs");
		expect(router.state.location.search).toMatchObject({
			page: 1,
			pageSize: 12,
		});
		expect(router.navigate).toHaveBeenCalledOnce();
	});
	it("allows later resize changes and preserves the visible run position", async () => {
		let height = 1240;
		vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(
			() => height
		);
		vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 400, 100)
		);
		const router = open(
			"/teams/lab/history?page=3&pageSize=12",
			DerivedHistoryScreen
		);
		await screen.findByText("25–36 of 203 runs");
		act(() => {
			height = 640;
			window.dispatchEvent(new Event("resize"));
		});
		await screen.findByText("25–30 of 203 runs");
		expect(router.state.location.search).toMatchObject({
			page: 5,
			pageSize: 6,
		});
		act(() => {
			height = 1240;
			window.dispatchEvent(new Event("resize"));
		});
		await screen.findByText("25–36 of 203 runs");
		expect(router.state.location.search).toMatchObject({
			page: 3,
			pageSize: 12,
		});
		expect(router.navigate).toHaveBeenCalledTimes(2);
	});
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
