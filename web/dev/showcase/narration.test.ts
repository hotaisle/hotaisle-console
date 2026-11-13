import { describe, expect, it } from "vitest";
import { narrationClip } from "./narration";

describe("showcase narration", () => {
	const clip = { duration: 2, src: "local-audio", text: "Approve the link." };
	it("rejects a stale recording after the caption changes", () => {
		expect(() =>
			narrationClip({ approve: clip }, "approve", "Approve in your browser.")
		).toThrow("Narration no longer matches the captions");
	});
	it("plays only clips generated from the current caption text", () => {
		expect(narrationClip({ approve: clip }, "approve", clip.text)).toBe(clip);
	});
	it("allows caption-only playback when no recording exists", () => {
		expect(narrationClip({}, "approve", clip.text)).toBeUndefined();
	});
});
