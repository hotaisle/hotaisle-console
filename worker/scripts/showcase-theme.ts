import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanvasTools } from "./showcase-canvas";
import type { Frame } from "./showcase-edit";
import { loadShowcaseTool } from "./showcase-tools";

export function themeBlendPlan(
	frames: Frame[],
	start: number,
	duration: number
) {
	const end = start + duration;
	const before = [...frames].reverse().find((frame) => frame.time < start);
	const after = frames.find((frame) => frame.time >= end);
	if (!(before && after)) {
		throw new Error("Theme transition needs complete dark and light frames.");
	}
	return { after, before, end };
}

export async function blendTheme(
	frames: Frame[],
	start: number | undefined,
	duration: number,
	width: number,
	height: number,
	directory: string
) {
	if (start === undefined) {
		return frames;
	}
	const { after, before, end } = themeBlendPlan(frames, start, duration);
	const { createCanvas, loadImage } =
		await loadShowcaseTool<CanvasTools>("@napi-rs/canvas");
	const [dark, light] = await Promise.all([
		loadImage(before.file),
		loadImage(after.file),
	]);
	const transition: Frame[] = [];
	const count = Math.ceil(duration * 30);
	for (let index = 0; index <= count; index += 1) {
		const progress = index / count;
		const canvas = createCanvas(width, height);
		const context = canvas.getContext("2d");
		context.drawImage(dark, 0, 0, width, height);
		context.globalAlpha = progress;
		context.drawImage(light, 0, 0, width, height);
		// The footage concat stream is MJPEG, including the generated artwork.
		const file = join(directory, `theme-${index}.jpg`);
		writeFileSync(file, canvas.toBuffer("image/jpeg"));
		transition.push({ file, time: start + progress * duration });
	}
	return [
		...frames.filter((frame) => frame.time < start),
		...transition,
		...frames.filter((frame) => frame.time > end),
	];
}
