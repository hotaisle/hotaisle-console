import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const [, , source, title, sourceURL] = process.argv;
if (!source) {
	throw new Error("Usage: bun run showcase:music <audio-file>");
}
const sampleRate = 11_025;
const hop = 128;
const raw = execFileSync(
	"ffmpeg",
	[
		"-hide_banner",
		"-loglevel",
		"error",
		"-i",
		resolve(source),
		"-t",
		"210",
		"-af",
		"highpass=f=35,lowpass=f=180",
		"-ac",
		"1",
		"-ar",
		String(sampleRate),
		"-f",
		"f32le",
		"pipe:1",
	],
	{ maxBuffer: 32_000_000, timeout: 30_000 }
);
const samples = new Float32Array(
	raw.buffer,
	raw.byteOffset,
	raw.byteLength / 4
);
const energy = Array.from(
	{ length: Math.floor(samples.length / hop) },
	(_, frame) => {
		let sum = 0;
		for (let index = frame * hop; index < (frame + 1) * hop; index += 1) {
			sum += samples[index] ** 2;
		}
		return Math.sqrt(sum / hop);
	}
);
const onset = energy.map((value, index) =>
	Math.max(0, value - (energy[index - 2] ?? value))
);
const frameRate = sampleRate / hop;
function score(bpm: number, offset: number) {
	const interval = 60 / bpm;
	let sum = 0;
	let count = 0;
	for (
		let second = offset + interval * 16;
		second < Math.min(180, samples.length / sampleRate);
		second += interval
	) {
		const center = Math.round(second * frameRate);
		sum += Math.max(...onset.slice(Math.max(0, center - 1), center + 2));
		count += 1;
	}
	return sum / count;
}
const candidates = Array.from({ length: 481 }, (_, index) => {
	const bpm = 100 + index * 0.125;
	let best = { bpm, offset: 0, score: 0 };
	for (let offset = 0; offset < 60 / bpm; offset += 0.01) {
		const value = score(bpm, offset);
		if (value > best.score) {
			best = { bpm, offset, score: value };
		}
	}
	return best;
}).sort((a, b) => b.score - a.score);
const [best] = candidates;
if (!(Number.isFinite(best.score) && best.score > 0)) {
	throw new Error(
		"No stable beat was found; supply a measured tempo manually."
	);
}
const plan = {
	bpm: best.bpm,
	offset: Number(best.offset.toFixed(3)),
	source: sourceURL ?? "",
	title: title ?? basename(source),
};
writeFileSync(
	resolve("web/dev/showcase/music.generated.ts"),
	`// Local beat grid; audio is never bundled.\nexport default ${JSON.stringify(plan)};\n`
);
console.info(
	JSON.stringify({ candidates: candidates.slice(0, 8), plan }, null, 2)
);
