import { describe, expect, it } from "vitest";
import { spokenCaptions } from "./showcase-captions";

describe("spoken captions", () => {
	it("clears finished speech instead of holding words across the next screen", () => {
		const cues = [
			{ end: 18, id: "create", start: 10, text: "Create a team." },
			{ end: 24, id: "funds", start: 18, text: "Add credits." },
		];
		const clips = {
			create: { duration: 4.1, src: "fixture", text: cues[0].text },
			funds: { duration: 2.7, src: "fixture", text: cues[1].text },
		};
		const captions = spokenCaptions(cues, clips);
		expect(captions[0].end).toBeCloseTo(14.35);
		expect(captions[1].end).toBeCloseTo(20.95);
		expect(cues[0].end).toBe(18);
	});
	it("never overlaps the next narration even with a short gap", () => {
		const cues = [
			{ end: 2, id: "one", start: 0, text: "One" },
			{ end: 5, id: "two", start: 2, text: "Two" },
		];
		const clips = {
			one: { duration: 2, src: "fixture", text: "One" },
			two: { duration: 2, src: "fixture", text: "Two" },
		};
		expect(spokenCaptions(cues, clips)[0].end).toBe(2);
	});
});
