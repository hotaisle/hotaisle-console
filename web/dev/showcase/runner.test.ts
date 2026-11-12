import { afterEach, describe, expect, it, vi } from "vitest";
import { find, pause, play, subtitles } from "./runner";
import { STORYBOARD } from "./storyboard";

afterEach(() => {
	vi.useRealTimers();
	document.body.replaceChildren();
});
describe("showcase playback", () => {
	it("cancels a pending wait and never reaches the next scene", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const scene = vi.fn();
		const result = play(
			[
				{ id: "first", narration: "First", seconds: 10 },
				{ id: "second", narration: "Second" },
			],
			{
				approve: vi.fn(),
				point: vi.fn(),
				scene,
				signal: controller.signal,
				voice: () => ({ done: Promise.resolve(), duration: 0 }),
			}
		);
		const rejected = expect(result).rejects.toThrow("Stopped");
		await vi.advanceTimersByTimeAsync(1000);
		controller.abort(new Error("Stopped"));
		await rejected;
		expect(scene).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
	it("fails visibly on missing controls instead of continuing the story", async () => {
		vi.useFakeTimers();
		const result = find(
			{ selector: "button", text: "Missing" },
			new AbortController().signal
		);
		const rejected = expect(result).rejects.toThrow("could not find Missing");
		await vi.advanceTimersByTimeAsync(25_100);
		await rejected;
	});
	it("formats accurate subtitle timestamps", () => {
		expect(
			subtitles([{ end: 65.789, id: "one", start: 1.234, text: "Caption" }])
		).toBe("1\n00:00:01,234 --> 00:01:05,789\nCaption\n");
	});
	it("keeps the timed edit to sixty seconds and begins with sign-in and team creation", async () => {
		vi.useFakeTimers();
		expect(STORYBOARD.slice(0, 3).map((scene) => scene.id)).toEqual([
			"sign-in",
			"approve",
			"create-team",
		]);
		const result = play(
			[
				{ at: 0, id: "sign-in", narration: "Sign in" },
				{ at: 57.6, id: "finish", narration: "Finish" },
			],
			{
				approve: vi.fn(),
				point: vi.fn(),
				scene: vi.fn(),
				signal: new AbortController().signal,
				voice: () => ({ done: Promise.resolve(), duration: 1 }),
			}
		);
		await vi.advanceTimersByTimeAsync(60_100);
		const cues = await result;
		expect(cues.at(-1)?.end).toBe(60);
	});
	it("rejects narration that cannot fit its timed scene", async () => {
		vi.useFakeTimers();
		const result = play([{ at: 57.6, id: "finish", narration: "Too long" }], {
			approve: vi.fn(),
			point: vi.fn(),
			scene: vi.fn(),
			signal: new AbortController().signal,
			voice: () => ({ done: Promise.resolve(), duration: 5 }),
		});
		const rejected = expect(result).rejects.toThrow(
			"exceeded its one-minute edit slot"
		);
		await vi.advanceTimersByTimeAsync(60_000);
		await rejected;
	});
	it("rejects already-cancelled pauses without scheduling work", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		controller.abort(new Error("Cancelled"));
		await expect(pause(100, controller.signal)).rejects.toThrow("Cancelled");
		expect(vi.getTimerCount()).toBe(0);
	});
	it("shows funded checkout choices and cancels before any checkout submission", () => {
		const funds = STORYBOARD.find((scene) => scene.id === "funds");
		expect(funds?.actions).toEqual([
			{ kind: "click", selector: ".top a", text: "Add credits" },
			{ kind: "click", selector: 'button[title="Back (Esc)"]' },
		]);
		expect(
			STORYBOARD.flatMap((scene) => scene.actions ?? []).some((action) =>
				action.text?.includes("Continue to checkout")
			)
		).toBe(false);
	});
});
