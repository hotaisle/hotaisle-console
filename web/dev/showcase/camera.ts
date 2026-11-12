export function cameraFrame(
	width: number,
	height: number,
	center?: { x: number; y: number }
) {
	const scale = center ? 0.985 : 1;
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
	return {
		focus(element?: HTMLElement) {
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
			const frame = cameraFrame(root.clientWidth, root.clientHeight, center);
			root.style.transform = `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})`;
		},
		point(element: HTMLElement) {
			const rect = element.getBoundingClientRect();
			pointer?.style.setProperty("left", `${rect.left + rect.width / 2}px`);
			pointer?.style.setProperty("top", `${rect.top + rect.height / 2}px`);
			pointer?.classList.add("visible");
		},
		reset() {
			root?.style.removeProperty("transform");
			if (root) {
				root.scrollLeft = 0;
			}
			pointer?.classList.remove("visible");
		},
	};
}
export function revealVertically(element: HTMLElement) {
	let parent = element.parentElement;
	while (parent) {
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
			parent.scrollBy({ behavior: "smooth", top: delta });
		}
		parent = parent.parentElement;
	}
}
