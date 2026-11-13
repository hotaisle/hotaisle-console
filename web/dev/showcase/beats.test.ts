import { describe, expect, it } from "vitest";
import { beatDelay } from "./beats";

const grid = { bpm: 125, offset: 0.06 };
describe("showcase beat timing", () => {
	it("lands clicks on the measured beat without moving backwards", () => {
		for (const elapsed of [0, 0.1, 1.23, 45.78, 170.5]) {
			const delay = beatDelay(elapsed, grid);
			const beat = (elapsed + delay - grid.offset) / (60 / grid.bpm);
			expect(beat).toBeCloseTo(Math.round(beat), 8);
			expect(delay).toBeGreaterThanOrEqual(0);
			expect(delay).toBeLessThanOrEqual(60 / grid.bpm);
		}
	});
	it("starts a hold early enough for its confirmation to land on a beat", () => {
		const elapsed = 81.23;
		const delay = beatDelay(elapsed, grid, 0.7);
		const confirmation = elapsed + delay + 0.7;
		const beat = (confirmation - grid.offset) / (60 / grid.bpm);
		expect(beat).toBeCloseTo(Math.round(beat), 8);
	});
	it("starts chapters on four-beat boundaries", () => {
		const elapsed = 10.2;
		const next = elapsed + beatDelay(elapsed, grid, 0, 4);
		const bar = (next - grid.offset) / ((60 / grid.bpm) * 4);
		expect(bar).toBeCloseTo(Math.round(bar), 8);
	});
	it.each([0, Number.NaN, Number.POSITIVE_INFINITY, 300])(
		"rejects invalid tempo %s",
		(bpm) => {
			expect(() => beatDelay(0, { bpm, offset: 0 })).toThrow("finite tempo");
		}
	);
});
