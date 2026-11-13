import { describe, expect, it } from "vitest";
import { captionColors, captionHeading, captionMotion } from "./presentation";

describe("showcase caption presentation", () => {
	it("clears captions at their edges without moving the full scene", () => {
		expect(captionMotion(9, 10, 14).opacity).toBe(0);
		expect(captionMotion(10, 10, 14).opacity).toBe(0);
		expect(captionMotion(11, 10, 14)).toEqual({ offset: 0, opacity: 1 });
		expect(captionMotion(14, 10, 14).opacity).toBe(0);
		expect(captionMotion(15, 10, 14).opacity).toBe(0);
	});
	it("keeps readable caption colors across the actual light-theme click", () => {
		const dark = captionColors(5, 10);
		const mid = captionColors(10.4, 10);
		const light = captionColors(11, 10);
		expect(dark.title).toBe("rgb(244 242 236)");
		expect(mid.title).not.toBe(dark.title);
		expect(mid.title).toBe(light.title);
		expect(mid.body).not.toBe(light.body);
		expect(light.title).toBe("rgb(25 25 22)");
		expect(captionColors(100, Number.POSITIVE_INFINITY)).toEqual(dark);
	});
	it("lets brand cards carry the opening and closing lines", () => {
		expect(captionHeading("welcome")).toBeUndefined();
		expect(captionHeading("finish")).toBeUndefined();
		expect(captionHeading("auto-rebill")).toBe("Keep your team funded.");
	});
});
