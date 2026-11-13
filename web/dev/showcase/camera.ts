export function cameraFrame(
	width: number,
	height: number,
	center?: { x: number; y: number },
	focusScale = 0.985
) {
	const scale = center ? Math.max(0.975, Math.min(1, focusScale)) : 1;
	const gutterX = width * (1 - scale);
	const gutterY = height * (1 - scale);
	const clamp = (value: number) => Math.max(0, Math.min(1, value));
	return {
		scale,
		x: center ? gutterX * (1 - clamp(center.x / width)) : 0,
		y: center ? gutterY * (1 - clamp(center.y / height)) : 0,
	};
}
export function createCamera(enabled: boolean) {
	const root = document.querySelector<HTMLElement>("#root");
	const pointer = document.querySelector<HTMLElement>(".showcase-pointer");
	const ring = pointer?.querySelector<HTMLElement>(".showcase-click-ring");
	let hovered: HTMLElement | undefined;
	return {
		focus(element?: HTMLElement, scale?: number) {
			if (!root) {
				return;
			}
			root.scrollLeft = 0;
			if (!enabled) {
				return;
			}
			const rect = element?.getBoundingClientRect();
			const center = rect
				? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
				: undefined;
			const frame = cameraFrame(
				root.clientWidth,
				root.clientHeight,
				center,
				scale
			);
			root.style.transform = `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})`;
		},
		async point(element: HTMLElement) {
			const rect = element.getBoundingClientRect();
			hovered?.removeAttribute("data-showcase-hover");
			hovered = element;
			element.setAttribute("data-showcase-hover", "");
			pointer?.style.setProperty(
				"translate",
				`${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`
			);
			pointer?.classList.add("visible");
			await Promise.allSettled(
				pointer?.getAnimations().map((animation) => animation.finished) ?? []
			);
		},
		press(pressed: boolean) {
			pointer?.classList.toggle("pressed", pressed);
			if (pressed && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
				ring?.animate?.(
					[
						{ opacity: 0.55, scale: 0.45 },
						{ opacity: 0, scale: 1.3 },
					],
					{ duration: 450, easing: "ease-out" }
				);
			}
		},
		reset() {
			root?.style.removeProperty("transform");
			if (root) {
				root.scrollLeft = 0;
			}
			pointer?.classList.remove("visible");
			pointer?.classList.remove("pressed");
			pointer?.style.removeProperty("translate");
			hovered?.removeAttribute("data-showcase-hover");
			for (const animation of ring?.getAnimations() ?? []) {
				animation.cancel();
			}
		},
	};
}
export async function revealVertically(
	element: HTMLElement,
	parent = element.parentElement
): Promise<void> {
	if (parent) {
		if (
			parent.scrollHeight > parent.clientHeight &&
			["auto", "scroll"].includes(getComputedStyle(parent).overflowY)
		) {
			const bounds = parent.getBoundingClientRect();
			const target = element.getBoundingClientRect();
			const delta =
				target.top < bounds.top
					? target.top - bounds.top
					: Math.max(0, target.bottom - bounds.bottom);
			if (delta !== 0) {
				const top = parent.scrollTop + delta;
				const scrolling: unknown = parent.scrollTo({ behavior: "smooth", top });
				if (scrolling instanceof Promise) {
					await scrolling;
				} else {
					// Older engines lack scroll promises. Settle immediately before clicking.
					parent.scrollTo({ behavior: "instant", top });
				}
			}
		}
		await revealVertically(element, parent.parentElement);
	}
}
