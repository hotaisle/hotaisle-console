import type { Cue } from "../../web/dev/showcase/runner";

export const BRAND_HOLD_SECONDS = 1.92;
export const BROWSER_INTRO_SECONDS = 3.84;
export const INTRO_SECONDS = BRAND_HOLD_SECONDS + BROWSER_INTRO_SECONDS;
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
	return { cues, frameTime, holdAt };
}
