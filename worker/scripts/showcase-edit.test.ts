import { describe, expect, it } from "vitest";
import { editTiming } from "./showcase-edit";

describe("showcase edit timing", () => {
	it("holds credits without shifting their narration and keeps later speech aligned", () => {
		const edit = editTiming({
			cues: [
				{ end: 21.18, id: "funds", start: 17.34, text: "Credits" },
				{ end: 55.26, id: "image", start: 21.18, text: "Image" },
				{ end: 60, id: "finish", start: 55.26, text: "Finish" },
			],
			startedAt: 1000,
		});
		expect(edit.cues[0].start).toBeCloseTo(23.1);
		expect(edit.cues[0].end).toBeCloseTo(28.86);
		expect(edit.frameTime(21.18)).toBeCloseTo(edit.cues[1].start);
		expect(edit.cues[2].start).toBeCloseTo(62.94);
		expect(edit.cues[2].end).toBeCloseTo(69.6);
	});
	it("rejects missing scene anchors instead of producing a mistimed edit", () => {
		expect(() => editTiming({ cues: [], startedAt: 1000 })).toThrow(
			"needs credits and closing scenes"
		);
	});
	it("retimes footage, narration, and reading pauses to a replacement track", () => {
		const source = {
			cues: [
				{ end: 21.18, id: "funds", start: 17.34, text: "Credits" },
				{ end: 60, id: "finish", start: 55.26, text: "Finish" },
			],
			startedAt: 1000,
		};
		const scale = 125 / 118;
		const edit = editTiming(source, scale);
		expect(edit.cues[0].start).toBeCloseTo(23.1 * scale);
		expect(edit.frameTime(55.26)).toBeCloseTo(edit.cues[1].start);
		expect(edit.cues[1].end).toBeCloseTo(69.6 * scale);
		for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 10]) {
			expect(() => editTiming(source, invalid)).toThrow("tempo scale");
		}
	});
});
