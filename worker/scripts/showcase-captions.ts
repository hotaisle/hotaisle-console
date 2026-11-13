import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Clip } from "../../web/dev/showcase/narration";
import {
	CAPTION_ENTER_SECONDS,
	CAPTION_EXIT_SECONDS,
	captionColors,
	captionHeading,
	captionLayout,
	captionMotion,
	THEME_BLEND_SECONDS,
} from "../../web/dev/showcase/presentation";
import type { Cue } from "../../web/dev/showcase/runner";
import type { CanvasTools } from "./showcase-canvas";
import { loadShowcaseTool } from "./showcase-tools";

export function spokenCaptions(cues: Cue[], clips: Record<string, Clip>) {
	return cues.map((cue, index) => ({
		...cue,
		end: Math.min(
			cue.end,
			cues[index + 1]?.start ?? cue.end,
			cue.start + clips[cue.id].duration + 0.25
		),
	}));
}

// Raw CDP footage hides studio captions. Render a transparent full-frame track,
// keeping the exact spoken words while letting the application fill the screen.
export async function captionTrack(
	cues: Cue[],
	width: number,
	directory: string,
	duration = cues.at(-1)?.end ?? 0,
	options: { height?: number; lightAt?: number } = {}
) {
	const { createCanvas } =
		await loadShowcaseTool<CanvasTools>("@napi-rs/canvas");
	const scale = width / 1920;
	const height = options.height ?? Math.round((width * 9) / 16);
	const lightAt = options.lightAt ?? Number.POSITIVE_INFINITY;
	const render = (cue: Cue | undefined, time: number, name: string) => {
		const canvas = createCanvas(width, height);
		const context = canvas.getContext("2d");
		const heading = cue && captionHeading(cue.id);
		if (cue && heading) {
			const motion = captionMotion(time, cue.start, cue.end);
			const colors = captionColors(time, lightAt);
			const layout = captionLayout(cue.id);
			const x = width * layout.x;
			let y = height * layout.y + motion.offset * scale;
			context.globalAlpha = motion.opacity;
			context.textBaseline = "alphabetic";
			context.textAlign = "left";
			const lines = (
				text: string,
				font: string,
				color: string,
				lineHeight: number
			) => {
				context.font = font;
				context.fillStyle = color;
				let line = "";
				for (const word of text.split(" ")) {
					const next = line ? `${line} ${word}` : word;
					if (line && context.measureText(next).width > width * layout.width) {
						context.fillText(line, x, y + lineHeight * 0.8);
						y += lineHeight;
						line = word;
					} else {
						line = next;
					}
				}
				context.fillText(line, x, y + lineHeight * 0.8);
				y += lineHeight;
			};
			lines(heading, `600 ${52 * scale}px Arial`, colors.title, 58 * scale);
			y += 16 * scale;
			lines(cue.text, `${24 * scale}px Arial`, colors.body, 36 * scale);
		}
		const path = join(directory, `${name}.png`);
		writeFileSync(path, canvas.toBuffer("image/png"));
		return path;
	};
	const initial = render(undefined, 0, "caption-blank");
	const entries = [{ path: initial, time: 0 }];
	for (const [index, cue] of cues.entries()) {
		if (!captionHeading(cue.id)) {
			continue;
		}
		const times = new Set([cue.start, cue.start + CAPTION_ENTER_SECONDS]);
		for (let frame = 0; frame <= 10; frame += 1) {
			times.add(cue.start + (frame / 10) * CAPTION_ENTER_SECONDS);
			times.add(cue.end - (frame / 10) * CAPTION_EXIT_SECONDS);
			const themeTime = lightAt + (frame / 10) * THEME_BLEND_SECONDS;
			if (themeTime > cue.start && themeTime < cue.end) {
				times.add(themeTime);
			}
		}
		for (const [frame, time] of [...times].sort((a, b) => a - b).entries()) {
			if (time < cue.start || time > cue.end) {
				continue;
			}
			entries.push({
				path: render(cue, time, `caption-${index}-${frame}`),
				time,
			});
		}
		entries.push({ path: initial, time: cue.end });
	}
	entries.sort((a, b) => a.time - b.time);
	const path = join(directory, "captions.txt");
	const quote = (value: string) => value.replaceAll("'", "'\\''");
	writeFileSync(
		path,
		`${entries
			.map((entry, index) => ({
				...entry,
				duration: (entries[index + 1]?.time ?? duration) - entry.time,
			}))
			.filter((entry) => entry.duration > 0)
			.map(
				(entry) =>
					`file '${quote(entry.path)}'\noption framerate 1000\nduration ${entry.duration}\n`
			)
			.join("")}file '${quote(initial)}'\noption framerate 1000\n`
	);
	return path;
}
