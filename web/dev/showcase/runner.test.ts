import { afterEach, describe, expect, it, vi } from "vitest";
import { act, find, pause, play, subtitles } from "./runner";
import { SHOWCASE_SECONDS, STORYBOARD } from "./storyboard";

afterEach(() => {
	vi.useRealTimers();
	document.body.replaceChildren();
});
describe("showcase playback", () => {
	it("waits for the visible cursor to arrive before clicking", async () => {
		vi.useFakeTimers();
		document.body.innerHTML =
			'<div id="root"><button type="button">Open</button></div>';
		vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
			new DOMRect(0, 0, 100, 40),
		] as unknown as DOMRectList);
		let arrived: () => void = () => undefined;
		const point = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					arrived = resolve;
				})
		);
		const clicked = vi.fn();
		document.querySelector("button")?.addEventListener("click", clicked);
		const result = act(
			{ kind: "click", selector: "button" },
			new AbortController().signal,
			point
		);
		await vi.advanceTimersByTimeAsync(1000);
		expect(point).toHaveBeenCalledOnce();
		expect(clicked).not.toHaveBeenCalled();
		arrived();
		await vi.advanceTimersByTimeAsync(1000);
		await result;
		expect(clicked).toHaveBeenCalledOnce();
	});

	it("keeps email approval pending until the narrated scene finishes", async () => {
		vi.useFakeTimers();
		const approve = vi.fn();
		const scene = vi.fn();
		const result = play(
			[
				{
					approve: true,
					at: 0,
					id: "approve",
					narration: "Approve the link in your browser.",
				},
				{ at: 4, id: "create-team", narration: "Create your team." },
			],
			{
				approve,
				point: vi.fn(),
				scene,
				signal: new AbortController().signal,
				voice: () => ({ done: Promise.resolve(), duration: 2.3 }),
			}
		);
		await vi.advanceTimersByTimeAsync(3999);
		expect(approve).not.toHaveBeenCalled();
		expect(scene).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(approve).toHaveBeenCalledOnce();
		await vi.advanceTimersToNextTimerAsync();
		expect(scene).toHaveBeenCalledTimes(2);
		expect(approve.mock.invocationCallOrder[0]).toBeLessThan(
			scene.mock.invocationCallOrder[1] ?? 0
		);
		await vi.runAllTimersAsync();
		await result;
	});

	it("enters the destination before showing its caption or speaking", async () => {
		vi.useFakeTimers();
		document.body.innerHTML =
			'<div id="root"><button type="button">Settings</button><h1>History</h1></div>';
		vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
			new DOMRect(0, 0, 100, 40),
		] as unknown as DOMRectList);
		document.querySelector("button")?.addEventListener("click", () => {
			const heading = document.querySelector("h1");
			if (heading) {
				heading.textContent = "Settings";
			}
		});
		const visiblePages: string[] = [];
		const capturePage = () => {
			visiblePages.push(document.querySelector("h1")?.textContent ?? "");
		};
		const result = play(
			[
				{
					at: 0,
					enter: [{ kind: "click", selector: "button" }],
					id: "theme",
					narration: "Choose light or dark.",
				},
			],
			{
				approve: vi.fn(),
				point: vi.fn(),
				scene: capturePage,
				signal: new AbortController().signal,
				voice: () => {
					capturePage();
					return { done: Promise.resolve(), duration: 2 };
				},
			}
		);
		await vi.runAllTimersAsync();
		await result;
		expect(visiblePages).toEqual(["Settings", "Settings"]);
	});

	it("releases the pointer if playback is cancelled during a theme change", async () => {
		vi.useFakeTimers();
		document.body.innerHTML =
			'<div id="root"><button type="button">Light</button></div>';
		vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
			new DOMRect(0, 0, 100, 40),
		] as unknown as DOMRectList);
		const control = new AbortController();
		const press = vi.fn();
		const result = act(
			{ kind: "click", selector: "button", transition: "theme" },
			control.signal,
			vi.fn(),
			undefined,
			undefined,
			press
		);
		const rejected = expect(result).rejects.toThrow("Cancelled");
		await vi.advanceTimersByTimeAsync(300);
		expect(press).toHaveBeenLastCalledWith(true);
		control.abort(new Error("Cancelled"));
		await rejected;
		expect(press).toHaveBeenLastCalledWith(false);
	});
	it("keeps the current screen until its navigation cue", async () => {
		vi.useFakeTimers();
		document.body.innerHTML =
			'<div id="root"><button type="button">Continue</button></div>';
		vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
			new DOMRect(0, 0, 100, 40),
		] as unknown as DOMRectList);
		const clicked = vi.fn();
		document.querySelector("button")?.addEventListener("click", clicked);
		const result = play(
			[
				{
					actions: [{ after: 2, kind: "click", selector: "button" }],
					at: 0,
					id: "first",
					narration: "First",
				},
				{ at: 3, id: "finish", narration: "Finish" },
			],
			{
				approve: vi.fn(),
				point: vi.fn(),
				scene: vi.fn(),
				signal: new AbortController().signal,
				voice: () => ({ done: Promise.resolve(), duration: 0 }),
			}
		);
		await vi.advanceTimersByTimeAsync(1999);
		expect(clicked).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(501);
		expect(clicked).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(SHOWCASE_SECONDS * 1000);
		await result;
	});
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
	it("keeps the timed edit bounded and begins with sign-in and team creation", async () => {
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
		await vi.advanceTimersByTimeAsync(SHOWCASE_SECONDS * 1000 + 100);
		const cues = await result;
		expect(cues.at(-1)?.end).toBe(SHOWCASE_SECONDS);
	});
	it("rejects narration that cannot fit its timed scene", async () => {
		vi.useFakeTimers();
		const result = play(
			[{ at: SHOWCASE_SECONDS - 2.4, id: "finish", narration: "Too long" }],
			{
				approve: vi.fn(),
				point: vi.fn(),
				scene: vi.fn(),
				signal: new AbortController().signal,
				voice: () => ({ done: Promise.resolve(), duration: 5 }),
			}
		);
		const rejected = expect(result).rejects.toThrow(
			"exceeded its timed edit slot"
		);
		await vi.advanceTimersByTimeAsync(SHOWCASE_SECONDS * 1000);
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
		]);
		const rebill = STORYBOARD.find((scene) => scene.id === "auto-rebill");
		expect(rebill?.actions?.at(-2)).toMatchObject({
			kind: "click",
			selector: ".rebill-form button",
			text: "Cancel",
		});
		expect(rebill?.actions?.at(-1)).toMatchObject({
			kind: "click",
			selector: 'button[title="Back (Esc)"]',
		});
		expect(
			STORYBOARD.flatMap((scene) => scene.actions ?? []).some(
				(action) =>
					action.text?.includes("Continue to checkout") ||
					action.text?.includes("Continue to Stripe") ||
					(action.kind === "click" &&
						action.selector.includes('type="submit"') &&
						action.selector.includes("rebill"))
			)
		).toBe(false);
	});
});
