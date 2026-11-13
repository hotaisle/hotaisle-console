import { describe, expect, it } from "vitest";
import { editTiming, walkthroughFrames } from "./showcase-edit";

describe("showcase edit timing", () => {
	it("adds the credits pause after the actual navigation click", () => {
		const edit = editTiming({
			cues: [
				{
					end: 18.24,
					events: [15.42],
					id: "funds",
					start: 14.46,
					text: "Credits",
				},
				{ end: 68.64, id: "finish", start: 63.84, text: "Finish" },
			],
			startedAt: 1000,
		});
		expect(edit.holdAt).toBeGreaterThan(15.42);
		expect(edit.frameTime(15.42)).toBeCloseTo(15.42 + 5.76);
		expect(edit.frameTime(15.8)).toBeCloseTo(15.8 + 5.76 + 1.92);
	});
	it("excludes pre-playback setup frames from the intro and playback", () => {
		const frames = walkthroughFrames(
			[
				{ file: "setup-light.jpg", time: 99.9 },
				{ file: "playback-dark.jpg", time: 100.2 },
				{ file: "playing.jpg", time: 110 },
				{ file: "finished.jpg", time: 160 },
			],
			{
				cues: [{ end: 60, id: "finish", start: 55, text: "Finish" }],
				startedAt: 100_000,
			}
		);
		expect(frames).toEqual([
			{ file: "playback-dark.jpg", time: 100 },
			{ file: "playback-dark.jpg", time: 100.2 },
			{ file: "playing.jpg", time: 110 },
		]);
	});
	it("holds credits without shifting their narration and keeps later speech aligned", () => {
		const edit = editTiming({
			cues: [
				{ end: 21.18, id: "funds", start: 17.34, text: "Credits" },
				{ end: 55.26, id: "image", start: 21.18, text: "Image" },
				{ end: 60, id: "finish", start: 55.26, text: "Finish" },
			],
			startedAt: 1000,
		});
		expect(edit.cues[0]).toMatchObject({
			id: "welcome",
			text: "Hello and welcome to Hot Aisle Console.",
		});
		expect(edit.cues[0].start).toBeCloseTo(1.44);
		expect(edit.cues[1].start).toBeCloseTo(23.1);
		expect(edit.cues[1].end).toBeCloseTo(28.86);
		expect(edit.frameTime(21.18)).toBeCloseTo(edit.cues[2].start);
		expect(edit.cues[3].start).toBeCloseTo(62.94);
		expect(edit.cues[3].end).toBeCloseTo(69.6);
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
		expect(edit.cues[0].start).toBeCloseTo(1.44 * scale);
		expect(edit.cues[1].start).toBeCloseTo(23.1 * scale);
		expect(edit.frameTime(55.26)).toBeCloseTo(edit.cues[2].start);
		expect(edit.cues[2].end).toBeCloseTo(69.6 * scale);
		for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 10]) {
			expect(() => editTiming(source, invalid)).toThrow("tempo scale");
		}
	});
});
