import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it as test, vi } from "vitest";
import { validateSearch } from "../src/app/route-state";
import { HistoryView } from "../src/features/machines/history-view";
import { createPreviewHistory } from "./history";

const items = Array.from({ length: 30 }, (_, index) => ({
	ended_at: "2026-11-10T20:00:00Z",
	gpus: "1× MI300X",
	name: `vm-${index}`,
	server: "fixture-server",
	team: "preview",
}));
function HistoryScreen() {
	return <HistoryView items={items} team="preview" />;
}

test("keeps adaptive pagination in the preview fragment and preserves the fixture query", async () => {
	const previous = window.location.href;
	window.history.replaceState(
		null,
		"",
		"/__preview/?scenario=history#/teams/preview/history?page=2"
	);
	vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(1240);
	vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
		new DOMRect(0, 0, 400, 100)
	);
	const root = createRootRoute({ component: Outlet, validateSearch });
	const route = createRoute({
		component: HistoryScreen,
		getParentRoute: () => root,
		path: "/teams/$team/history",
	});
	const history = createPreviewHistory();
	const router = createRouter({
		history,
		routeTree: root.addChildren([route]),
	});
	try {
		render(<RouterProvider router={router} />);
		await screen.findByText("1–12 of 30 runs");
		await waitFor(() => expect(window.location.hash).toContain("pageSize=12"));
		expect(window.location.search).toBe("?scenario=history");
		expect(router.state.location.search).toMatchObject({
			page: 1,
			pageSize: 12,
		});
	} finally {
		history.destroy();
		window.history.replaceState(null, "", previous);
	}
});
