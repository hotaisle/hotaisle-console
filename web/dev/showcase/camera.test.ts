import { describe, expect, it } from "vitest";
import { cameraFrame } from "./camera";

describe("showcase camera frame", () => {
	it.each([
		[1920, 1080],
		[1280, 720],
		[2560, 1440],
	])("keeps all four edges inside a %s by %s viewport", (width, height) => {
		for (const center of [
			{ x: -200, y: -200 },
			{ x: 0, y: 0 },
			{ x: width / 2, y: height / 2 },
			{ x: width + 200, y: height + 200 },
		]) {
			const frame = cameraFrame(width, height, center);
			expect(frame.x).toBeGreaterThanOrEqual(0);
			expect(frame.y).toBeGreaterThanOrEqual(0);
			expect(frame.x + width * frame.scale).toBeLessThanOrEqual(width);
			expect(frame.y + height * frame.scale).toBeLessThanOrEqual(height);
		}
	});
	it("returns to the full unshifted frame", () => {
		expect(cameraFrame(1920, 1080)).toEqual({ scale: 1, x: 0, y: 0 });
	});
});
