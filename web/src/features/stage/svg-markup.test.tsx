import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { SvgMarkup } from "./svg-markup";

describe("generated SVG", () => {
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
