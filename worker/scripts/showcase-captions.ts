import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Cue } from "../../web/dev/showcase/runner";
import type { CanvasTools } from "./showcase-canvas";
import { loadShowcaseTool } from "./showcase-tools";

// Re-render the entire caption strip, so revised speech never leaves older text
// or chapter numbers baked into an otherwise reusable browser recording.
export async function captionTrack(
	cues: Cue[],
	width: number,
	directory: string
) {
	const { createCanvas } =
		await loadShowcaseTool<CanvasTools>("@napi-rs/canvas");
	const scale = width / 1920;
	const height = Math.round(104 * scale);
	const render = (text: string, chapter: string, name: string) => {
		const canvas = createCanvas(width, height);
		const context = canvas.getContext("2d");
		context.fillStyle = "#171714";
		context.fillRect(0, 0, width, height);
		context.fillStyle = "#383832";
		context.fillRect(0, 0, width, 1);
		context.textBaseline = "middle";
		context.textAlign = "center";
		context.font = `${27 * scale}px Arial`;
		context.fillStyle = "#f4f2ec";
		context.fillText(text, width / 2, height / 2, width - 280 * scale);
		context.textAlign = "left";
		context.font = `${13 * scale}px monospace`;
		context.fillStyle = "#ff8a47";
		context.fillText(chapter, 28 * scale, height / 2);
		const path = join(directory, `${name}.png`);
		writeFileSync(path, canvas.toBuffer("image/png"));
		return path;
	};
	const initial = render("", "", "caption-blank");
	const entries = [
		{ duration: cues[0].start, path: initial },
		...cues.map((cue, index) => ({
			duration: (cues[index + 1]?.start ?? cue.end) - cue.start,
			path: render(
				cue.text,
				`${index + 1} / ${cues.length}`,
				`caption-${index}`
			),
		})),
	];
	const last = entries.at(-1);
	const path = join(directory, "captions.txt");
	const quote = (value: string) => value.replaceAll("'", "'\\''");
	writeFileSync(
		path,
		`${entries
			.filter((entry) => entry.duration > 0)
			.map(
				(entry) =>
					`file '${quote(entry.path)}'\noption framerate 1000\nduration ${entry.duration}\n`
			)
			.join("")}file '${quote(last?.path ?? initial)}'\noption framerate 1000\n`
	);
	return path;
}
