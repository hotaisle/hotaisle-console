import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/** Measure intrinsic row heights so wrapped names and larger text stay fully visible. */
export function useHistoryCapacity(
	listRef: RefObject<HTMLUListElement | null>,
	pageKey: string
) {
	const [capacity, setCapacity] = useState<number>();
	const measured = useRef({ pageKey, row: 0, width: 0 });
	useLayoutEffect(() => {
		measured.current.pageKey = pageKey;
		const list = listRef.current;
		if (!list) {
			return;
		}
		const body = list.closest<HTMLElement>(".pv-body");
		const view = list.closest<HTMLElement>(".history-view");
		const fitPanel = () => {
			if (!(body && view?.parentElement)) {
				return;
			}
			const padding = getComputedStyle(view.parentElement);
			const inset =
				(Number.parseFloat(padding.paddingTop) || 0) +
				(Number.parseFloat(padding.paddingBottom) || 0) +
				2;
			let available = body.clientHeight;
			if (getComputedStyle(body).overflowY === "visible") {
				const panel = body.closest(".panel");
				const header =
					panel?.querySelector(".pv-head")?.getBoundingClientRect().height ?? 0;
				const footer =
					panel?.querySelector(".panel-build")?.getBoundingClientRect()
						.height ?? 0;
				available = window.innerHeight - header - footer - 32;
			}
			const size = `${Math.max(240, Math.floor(available - inset))}px`;
			if (view.style.blockSize !== size) {
				view.style.blockSize = size;
			}
		};
		const measure = () => {
			if (measured.current.pageKey !== pageKey) {
				return;
			}
			fitPanel();
			const height = list.clientHeight;
			const rows = [...list.children];
			if (!(height && rows.length)) {
				return;
			}
			if (measured.current.width !== list.clientWidth) {
				measured.current = { pageKey, row: 0, width: list.clientWidth };
			}
			// Keep the largest row seen at this width to avoid oscillating when a long
			// name enters or leaves the page after the capacity changes.
			measured.current.row = Math.max(
				measured.current.row,
				...rows.map((row) => row.getBoundingClientRect().height)
			);
			const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
			const size = measured.current.row + gap;
			if (size > 0) {
				setCapacity(
					Math.min(100, Math.max(1, Math.floor((height + gap) / size)))
				);
			}
		};
		measure();
		const observer =
			typeof ResizeObserver === "undefined"
				? undefined
				: new ResizeObserver(measure);
		observer?.observe(list);
		if (body) {
			observer?.observe(body);
		}
		for (const row of list.children) {
			observer?.observe(row);
		}
		window.addEventListener("resize", measure);
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [listRef, pageKey]);
	return capacity;
}
