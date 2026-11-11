import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHistoryCapacity } from "./use-history-capacity";

describe("history capacity", () => {
	it("fits the container height and accounts for wrapped rows without oscillating", () => {
		let height = 1296;
		let rowHeight = 100;
		let resize = () => undefined;
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: () => undefined) {
					resize = callback;
				}
				observe = vi.fn();
				disconnect = vi.fn();
			}
		);
		const list = document.createElement("ul");
		const row = document.createElement("li");
		list.append(row);
		list.style.rowGap = "8px";
		Object.defineProperties(list, {
			clientHeight: { get: () => height },
			clientWidth: { get: () => 400 },
		});
		vi.spyOn(row, "getBoundingClientRect").mockImplementation(
			() => new DOMRect(0, 0, 400, rowHeight)
		);
		const ref = { current: list };
		const { result } = renderHook(() => useHistoryCapacity(ref, "page"));
		expect(result.current).toBe(12);
		height = 648;
		act(() => resize());
		expect(result.current).toBe(6);
		rowHeight = 120;
		act(() => resize());
		expect(result.current).toBe(5);
		rowHeight = 100;
		act(() => resize());
		expect(result.current).toBe(5);
	});
});
