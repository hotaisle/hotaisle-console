import DOMPurify from "dompurify";
import { type RefObject, type SVGProps, useLayoutEffect, useRef } from "react";

interface SvgMarkupProps
	extends Omit<
		SVGProps<SVGSVGElement>,
		"children" | "dangerouslySetInnerHTML" | "ref"
	> {
	elementRef: RefObject<SVGSVGElement | null>;
	markup: string;
}

/** Mounts generated drawings as sanitized SVG nodes in the SVG namespace. */
export function SvgMarkup({ markup, elementRef, ...props }: SvgMarkupProps) {
	const mounted = useRef<{ element: SVGSVGElement; markup: string } | null>(
		null
	);
	useLayoutEffect(() => {
		const element = elementRef.current;
		if (
			!element ||
			(mounted.current?.element === element &&
				mounted.current.markup === markup)
		) {
			return;
		}
		const fragment = DOMPurify.sanitize(
			`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
			{
				RETURN_DOM_FRAGMENT: true,
				USE_PROFILES: { svg: true, svgFilters: true },
			}
		);
		const svg = fragment.querySelector("svg");
		if (!svg) {
			throw new Error("The drawing could not be parsed as SVG.");
		}
		// Animation controllers retain these nodes across Strict Mode effect replays.
		element.replaceChildren(...Array.from(svg.childNodes));
		mounted.current = { element, markup };
	}, [markup, elementRef]);
	return <svg {...props} ref={elementRef} />;
}
