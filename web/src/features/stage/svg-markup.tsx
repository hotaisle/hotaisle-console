import DOMPurify from "dompurify";
import { type RefObject, type SVGProps, useLayoutEffect } from "react";

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
	useLayoutEffect(() => {
		const element = elementRef.current;
		if (!element) {
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
		element.replaceChildren(...Array.from(svg.childNodes));
	}, [markup, elementRef]);
	return <svg {...props} ref={elementRef} />;
}
