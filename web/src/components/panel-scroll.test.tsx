import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelScroll } from "./panel-scroll";

afterEach(() => vi.unstubAllGlobals());
describe("panel scroll hints", () => {
	it("tracks both scroll edges and cleans up the fallback observer", () => {
		vi.stubGlobal("CSS", { supports: () => false });
		let notify: IntersectionObserverCallback = () => undefined;
		const observe = vi.fn();
		const disconnect = vi.fn();
		class Observer {
			observe = observe;
			disconnect = disconnect;
			constructor(callback: IntersectionObserverCallback) {
				notify = callback;
			}
		}
		vi.stubGlobal("IntersectionObserver", Observer);
		const { container, unmount } = render(
			<PanelScroll>
				<p>All machine details</p>
			</PanelScroll>
		);
		expect(screen.getByText("All machine details")).toBeVisible();
		const [top, bottom] = observe.mock.calls.map((call) => call[0] as Element);
		const entry = (target: Element, isIntersecting: boolean) =>
			({ isIntersecting, target }) as IntersectionObserverEntry;
		act(() =>
			notify(
				[entry(top, true), entry(bottom, false)],
				{} as IntersectionObserver
			)
		);
		expect(container.querySelector(".panel-scroll")).toHaveAttribute(
			"data-below",
			"true"
		);
		expect(container.querySelector(".panel-scroll")).toHaveAttribute(
			"data-above",
			"false"
		);
		act(() =>
			notify(
				[entry(top, false), entry(bottom, true)],
				{} as IntersectionObserver
			)
		);
		expect(container.querySelector(".panel-scroll")).toHaveAttribute(
			"data-below",
			"false"
		);
		expect(container.querySelector(".panel-scroll")).toHaveAttribute(
			"data-above",
			"true"
		);
		unmount();
		expect(disconnect).toHaveBeenCalledOnce();
	});
});
