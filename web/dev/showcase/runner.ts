import { type BeatGrid, beatDelay } from "./beats";
import { revealVertically } from "./camera";
import { THEME_BLEND_SECONDS } from "./presentation";
import {
	type Action,
	type Scene,
	SHOWCASE_SECONDS,
	type Target,
} from "./storyboard";

export interface Cue {
	end: number;
	events?: number[];
	id: string;
	start: number;
	text: string;
}
export function pause(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		signal.throwIfAborted();
		const abort = () => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", abort);
			resolve();
		}, ms);
		signal.addEventListener("abort", abort, { once: true });
	});
}
function matches(target: Target): HTMLElement | undefined {
	return [...document.querySelectorAll<HTMLElement>(`#root ${target.selector}`)]
		.filter((element) => element.getClientRects().length > 0)
		.find(
			(element) => !target.text || element.textContent?.includes(target.text)
		);
}
export async function find(target: Target, signal: AbortSignal) {
	const deadline = performance.now() + 25_000;
	const poll = async (): Promise<HTMLElement> => {
		signal.throwIfAborted();
		const element = matches(target);
		if (element && !element.matches(":disabled")) {
			return element;
		}
		await pause(100, signal);
		if (performance.now() >= deadline) {
			throw new Error(
				`Showcase could not find ${target.text ?? target.selector}.`
			);
		}
		return poll();
	};
	return await poll();
}
export async function act(
	action: Action,
	signal: AbortSignal,
	point: (element: HTMLElement) => void | Promise<void>,
	beat?: (lead?: number) => Promise<void>,
	event?: () => void,
	press?: (pressed: boolean) => void
) {
	const element = await find(action, signal);
	await revealVertically(element);
	await pause(150, signal);
	if (action.kind !== "wait") {
		await point(element);
		await pause(80, signal);
	}
	if (action.kind !== "wait" && action.kind !== "type") {
		await beat?.(action.kind === "hold" ? 0.7 : 0);
		event?.();
	}
	if (action.kind === "click") {
		press?.(true);
		try {
			element.click();
			if (action.transition === "theme") {
				await pause(THEME_BLEND_SECONDS * 1000, signal);
			}
		} finally {
			press?.(false);
		}
	} else if (action.kind === "type") {
		await type(element, action.value ?? "", signal);
	} else if (action.kind === "select") {
		if (!(element instanceof HTMLSelectElement)) {
			throw new Error("Showcase select target is not a select.");
		}
		element.value = action.value ?? "";
		element.dispatchEvent(new Event("change", { bubbles: true }));
	} else if (action.kind === "hold") {
		press?.(true);
		element.focus({ preventScroll: true });
		element.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				code: "Enter",
				key: "Enter",
			})
		);
		try {
			await pause(800, signal);
		} finally {
			press?.(false);
			element.dispatchEvent(
				new KeyboardEvent("keyup", {
					bubbles: true,
					code: "Enter",
					key: "Enter",
				})
			);
		}
	}
	await pause(350, signal);
}
async function type(element: HTMLElement, value: string, signal: AbortSignal) {
	if (!(element instanceof HTMLInputElement)) {
		throw new Error("Showcase typing target is not an input.");
	}
	const setter = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value"
	)?.set;
	if (!setter) {
		throw new Error("Native input setter is unavailable.");
	}
	element.focus({ preventScroll: true });
	await [...value].reduce(async (previous, _, index) => {
		await previous;
		const length = index + 1;
		setter.call(element, value.slice(0, length));
		element.dispatchEvent(new Event("input", { bubbles: true }));
		await pause(25, signal);
	}, Promise.resolve());
}
export interface Playback {
	approve: () => void;
	grid?: BeatGrid;
	point: (element: HTMLElement) => void | Promise<void>;
	press?: (pressed: boolean) => void;
	scene: (scene: Scene, index: number) => void | Promise<void>;
	signal: AbortSignal;
	voice: (
		id: string,
		text: string
	) => { duration: number; done: Promise<void> };
}
export async function play(scenes: Scene[], options: Playback): Promise<Cue[]> {
	const timeline: Cue[] = [];
	const started = performance.now();
	const beat = async (lead = 0, beats = 1) => {
		if (options.grid) {
			await pause(
				beatDelay(
					(performance.now() - started) / 1000,
					options.grid,
					lead,
					beats
				) * 1000,
				options.signal
			);
		}
	};
	await scenes.reduce(async (previous, scene, index) => {
		await previous;
		if (scene.at === undefined) {
			await beat(0, 4);
		} else {
			await pause(
				Math.max(
					0,
					(scene.at + (options.grid?.offset ?? 0)) * 1000 -
						(performance.now() - started)
				),
				options.signal
			);
		}
		options.signal.throwIfAborted();
		const start = (performance.now() - started) / 1000;
		const framing = options.scene(scene, index);
		const audio = options.voice(scene.id, scene.narration);
		await framing;
		const events: number[] = [];
		await (scene.actions ?? []).reduce(async (earlier, action) => {
			await earlier;
			if (action.after !== undefined) {
				await pause(
					Math.max(
						0,
						(start + action.after) * 1000 - (performance.now() - started)
					),
					options.signal
				);
			}
			await act(
				action,
				options.signal,
				options.point,
				beat,
				() =>
					events.push(
						(performance.now() - started) / 1000 +
							(action.kind === "hold" ? 0.7 : 0)
					),
				options.press
			);
		}, Promise.resolve());
		if (scene.approve) {
			await pause(250, options.signal);
			await beat();
			options.approve();
		}
		const nextAt = scenes[index + 1]?.at;
		const deadline =
			scene.at === undefined
				? undefined
				: Math.min(
						SHOWCASE_SECONDS,
						(nextAt ?? SHOWCASE_SECONDS) + (options.grid?.offset ?? 0)
					);
		const length =
			deadline === undefined
				? Math.max(scene.seconds ?? 8, audio.duration + 2.5)
				: deadline - start;
		if (
			deadline !== undefined &&
			((performance.now() - started) / 1000 > deadline + 0.25 ||
				audio.duration > length)
		) {
			throw new Error(
				`The ${scene.id} scene exceeded its timed edit slot. Shorten its actions or narration.`
			);
		}
		await pause(
			Math.max(0, length * 1000 - (performance.now() - started - start * 1000)),
			options.signal
		);
		await audio.done;
		timeline.push({
			end: (performance.now() - started) / 1000,
			events,
			id: scene.id,
			start,
			text: scene.narration,
		});
	}, Promise.resolve());
	const last = timeline.at(-1);
	if (scenes.at(-1)?.at !== undefined && last) {
		last.end = SHOWCASE_SECONDS;
	}
	return timeline;
}
export function subtitles(cues: Cue[]) {
	return cues
		.map(
			(cue, index) =>
				`${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`
		)
		.join("\n");
}
function stamp(seconds: number) {
	return new Date(Math.round(seconds * 1000))
		.toISOString()
		.slice(11, 23)
		.replace(".", ",");
}
