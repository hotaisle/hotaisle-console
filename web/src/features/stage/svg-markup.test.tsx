import { render } from "@testing-library/react";
import { createRef, type RefObject, StrictMode, useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { SvgMarkup } from "./svg-markup";

function AnimatedDrawing({
	elementRef,
	onAnimate,
	visible,
}: {
	elementRef: RefObject<SVGSVGElement | null>;
	onAnimate: (tray: Element) => void;
	visible: boolean;
}) {
	useLayoutEffect(() => {
		if (!visible) {
			return;
		}
		const tray = elementRef.current?.querySelector("[data-tray]");
		if (tray) {
			onAnimate(tray);
			tray.setAttribute("transform", "translate(20 20)");
		}
	}, [elementRef, onAnimate, visible]);
	return visible ? (
		<SvgMarkup
			elementRef={elementRef}
			markup={
				'<g data-tray="server" transform="translate(0 0)"><path d="M0 0L1 1"/></g>'
			}
		/>
	) : null;
}

describe("generated SVG", () => {
	it("preserves animated nodes when Strict Mode replays a newly mounted drawing's effects", () => {
		const ref = createRef<SVGSVGElement>();
		const animated = vi.fn();
		const { container, rerender } = render(
			<StrictMode>
				<AnimatedDrawing
					elementRef={ref}
					onAnimate={animated}
					visible={false}
				/>
			</StrictMode>
		);
		rerender(
			<StrictMode>
				<AnimatedDrawing elementRef={ref} onAnimate={animated} visible />
			</StrictMode>
		);
		const tray = container.querySelector("[data-tray]");
		expect(animated).toHaveBeenCalledOnce();
		expect(tray).toBe(animated.mock.calls[0][0]);
		expect(tray).toHaveAttribute("transform", "translate(20 20)");
	});
	it("replaces the drawing when its source markup changes", () => {
		const ref = createRef<SVGSVGElement>();
		const { container, rerender } = render(
			<SvgMarkup elementRef={ref} markup='<g data-tray="first"/>' />
		);
		const first = container.querySelector("[data-tray]");
		rerender(<SvgMarkup elementRef={ref} markup='<g data-tray="second"/>' />);
		expect(first).not.toBeInTheDocument();
		expect(container.querySelector("[data-tray]")).toHaveAttribute(
			"data-tray",
			"second"
		);
	});
	it("preserves SVG namespaces and drawing metadata while stripping executable content", () => {
		const ref = createRef<SVGSVGElement>();
		const markup =
			'<g data-gpu="server/0"><path d="M0 0L1 1" onclick="alert(1)"/></g><script>alert(1)</script>';
		const { container } = render(
			<SvgMarkup aria-hidden="true" elementRef={ref} markup={markup} />
		);
		const path = container.querySelector("path");
		expect(path?.namespaceURI).toBe("http://www.w3.org/2000/svg");
		expect(container.querySelector("[data-gpu]")).not.toBeNull();
		expect(path?.hasAttribute("onclick")).toBe(false);
		expect(container.querySelector("script")).toBeNull();
	});
});
