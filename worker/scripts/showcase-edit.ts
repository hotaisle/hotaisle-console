import type { Cue } from "../../web/dev/showcase/runner";
import { WELCOME } from "../../web/dev/showcase/storyboard";

export const BRAND_HOLD_SECONDS = 0.96;
export const BROWSER_INTRO_SECONDS = 4.8;
export const INTRO_SECONDS = BRAND_HOLD_SECONDS + BROWSER_INTRO_SECONDS;
export const WELCOME_START_SECONDS = BRAND_HOLD_SECONDS + 0.48;
export const CREDITS_HOLD_SECONDS = 1.92;
export const CLOSING_HOLD_SECONDS = 1.92;
export const CONSOLE_URL = "https://console.hotaisle.app";

export interface Frame {
	file: string;
	time: number;
}
export interface Timing {
	cues: Cue[];
	startedAt: number;
}

// Setup frames may use another theme or contain studio controls. Never reuse one
// as the opening still: hold the first actual playback frame back to time zero.
export function walkthroughFrames(frames: Frame[], timing: Timing): Frame[] {
	const start = timing.startedAt / 1000;
	const end = start + (timing.cues.at(-1)?.end ?? 0);
	const selected = frames.filter(
		(frame) => frame.time >= start && frame.time < end
	);
	const [first] = selected;
	return first && first.time > start
		? [{ ...first, time: start }, ...selected]
		: selected;
}

// Post-production pauses shift footage and speech together. Music stays continuous.
export function editTiming(source: Timing, tempoScale = 1) {
	if (!Number.isFinite(tempoScale) || tempoScale < 0.75 || tempoScale > 1.5) {
		throw new Error("The showcase tempo scale must be between 0.75 and 1.5.");
	}
	const funds = source.cues.find((cue) => cue.id === "funds");
	const finish = source.cues.at(-1);
	if (!funds || finish?.id !== "finish") {
		throw new Error("The showcase needs credits and closing scenes.");
	}
	const holdAt = funds.start + 0.96;
	const frameTime = (seconds: number) =>
		(seconds + INTRO_SECONDS + (seconds >= holdAt ? CREDITS_HOLD_SECONDS : 0)) *
		tempoScale;
	const cues = source.cues.map((cue) => ({
		...cue,
		end:
			frameTime(cue.end) +
			(cue.id === "finish" ? CLOSING_HOLD_SECONDS * tempoScale : 0),
		start: frameTime(cue.start),
	}));
	return {
		cues: [
			{
				end: INTRO_SECONDS * tempoScale,
				id: WELCOME.id,
				start: WELCOME_START_SECONDS * tempoScale,
				text: WELCOME.narration,
			},
			...cues,
		],
		frameTime,
		holdAt,
	};
}
