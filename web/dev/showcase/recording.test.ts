import { afterEach, describe, expect, it, vi } from "vitest";
import { capture } from "./recording";

afterEach(() => vi.unstubAllGlobals());
describe("showcase recording scope", () => {
	it("refuses whole-screen capture and stops its track immediately", async () => {
		const stop = vi.fn();
		const track = { getSettings: () => ({ displaySurface: "monitor" }), stop };
		const screen = { getTracks: () => [track], getVideoTracks: () => [track] };
		const getDisplayMedia = vi.fn().mockResolvedValue(screen);
		vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
		await expect(capture()).rejects.toThrow(
			"only the Showcase studio Chrome tab"
		);
		expect(stop).toHaveBeenCalledOnce();
		expect(getDisplayMedia).toHaveBeenCalledWith({
			audio: false,
			video: { frameRate: 30 },
		});
	});
	it("explains Chrome's focus requirement without attempting to foreground it", async () => {
		const error = new DOMException("Invalid state", "InvalidStateError");
		vi.stubGlobal("navigator", {
			mediaDevices: { getDisplayMedia: vi.fn().mockRejectedValue(error) },
		});
		await expect(capture()).rejects.toThrow(
			"Chrome requires the recording tab to have focus"
		);
	});
});
