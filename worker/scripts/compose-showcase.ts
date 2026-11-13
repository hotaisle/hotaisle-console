import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Clip, narrationClip } from "../../web/dev/showcase/narration";
import { subtitles } from "../../web/dev/showcase/runner";
import {
	SHOWCASE_GRID,
	STORYBOARD,
	WELCOME,
} from "../../web/dev/showcase/storyboard";
import { showcaseArtwork } from "./showcase-artwork";
import { captionTrack, spokenCaptions } from "./showcase-captions";
import {
	editTiming,
	type Frame,
	INTRO_SECONDS,
	type Timing,
	walkthroughFrames,
} from "./showcase-edit";

const FRAME_FILE = /^frame-\d+\.jpg$/u;
const AUDIO_DATA = /^data:audio\/mpeg;base64,/u;

const [, , manifestPath, timingPath, outputPath, musicPath, musicBPM] =
	process.argv;
if (!(manifestPath && timingPath && outputPath)) {
	throw new Error(
		"Usage: bun run showcase:compose <frames.json> <timing.json> <output.mp4> [music-file] [music-bpm]"
	);
}
const frames = JSON.parse(readFileSync(manifestPath, "utf8")) as Frame[];
const sourceTiming = JSON.parse(readFileSync(timingPath, "utf8")) as Timing;
const tempoScale = musicBPM ? SHOWCASE_GRID.bpm / Number(musicBPM) : 1;
const edit = editTiming(sourceTiming, tempoScale);
const timing = { ...sourceTiming, cues: edit.cues };
const duration = timing.cues.at(-1)?.end;
if (!(Number.isFinite(timing.startedAt) && duration && frames.length)) {
	throw new Error(
		"The recording needs timestamped frames and a completed walkthrough timeline."
	);
}
const start = timing.startedAt / 1000;
const directory = dirname(resolve(manifestPath));
const selected = walkthroughFrames(frames, sourceTiming);
if (!selected.length) {
	throw new Error("No frames overlap this walkthrough.");
}
const temporary = mkdtempSync(join(tmpdir(), "console-compose-"));
try {
	for (const frame of selected) {
		if (!FRAME_FILE.test(frame.file)) {
			throw new Error("Unexpected capture filename.");
		}
	}
	const narrationPath = resolve("web/dev/showcase/narration.generated.ts");
	const { default: clips } = await import(narrationPath);
	const audioInputs = timing.cues.map((cue) => {
		const scene =
			cue.id === WELCOME.id
				? WELCOME
				: STORYBOARD.find((item) => item.id === cue.id);
		if (!scene || cue.text !== scene.narration) {
			throw new Error(`The ${cue.id} timing needs the current narration text.`);
		}
		const clip = narrationClip(clips as Record<string, Clip>, cue.id, cue.text);
		if (!(clip && AUDIO_DATA.test(clip.src))) {
			throw new Error(`Missing voiceover: ${cue.id}`);
		}
		if (clip.duration > cue.end - cue.start) {
			throw new Error(`The ${cue.id} narration exceeds its edit slot.`);
		}
		const path = join(temporary, `${cue.id}.mp3`);
		writeFileSync(path, Buffer.from(clip.src.split(",")[1], "base64"));
		return path;
	});
	const dimensions = JSON.parse(
		execFileSync(
			"ffprobe",
			[
				"-v",
				"error",
				"-select_streams",
				"v:0",
				"-show_entries",
				"stream=width,height",
				"-of",
				"json",
				join(directory, selected[0].file),
			],
			{ encoding: "utf8", timeout: 10_000 }
		)
	) as { streams: { width: number; height: number }[] };
	const { width, height } = dimensions.streams[0];
	if (!Number.isInteger(width) || width < 640 || width > 7680 || !height) {
		throw new Error("The capture needs a supported video width.");
	}
	const sourceFinish = sourceTiming.cues.at(-1)?.start ?? 0;
	const closingAt = timing.cues.at(-1)?.start ?? 0;
	const reversed = [...selected].reverse();
	const ending = reversed.find((frame) => frame.time - start <= sourceFinish);
	const hold = reversed.find((frame) => frame.time - start <= edit.holdAt);
	if (!(ending && hold)) {
		throw new Error("The capture is missing credits or closing footage.");
	}
	const outputBase = resolve(outputPath).replace(/\.mp4$/u, "");
	const artwork = await showcaseArtwork(
		width,
		height,
		join(directory, selected[0].file),
		join(directory, ending.file),
		closingAt,
		temporary,
		outputBase,
		tempoScale
	);
	const editedFrames = [
		...artwork.intro,
		...selected
			.filter((frame) => frame.time - start < sourceFinish)
			.map((frame) => ({
				file: join(directory, frame.file),
				time: edit.frameTime(frame.time - start),
			})),
		{
			file: join(directory, hold.file),
			time: (INTRO_SECONDS + edit.holdAt) * tempoScale,
		},
		...artwork.outro,
	].sort((a, b) => a.time - b.time);
	const quote = (path: string) => path.replaceAll("'", "'\\''");
	const concatPath = join(temporary, "frames.txt");
	writeFileSync(
		concatPath,
		`${editedFrames
			.map((frame, index) => {
				const next = editedFrames[index + 1]?.time ?? duration;
				return `file '${quote(frame.file)}'\noption framerate 1000\nduration ${Math.max(0.001, next - frame.time)}\n`;
			})
			.join(
				""
			)}file '${quote(editedFrames.at(-1)?.file ?? "")}'\noption framerate 1000\n`
	);
	const captionCues = spokenCaptions(timing.cues, clips);
	const captionsPath = await captionTrack(
		captionCues,
		width,
		temporary,
		duration
	);
	const captionsIndex = audioInputs.length + (musicPath ? 2 : 1);
	const filters = timing.cues.map(
		(cue, index) =>
			`[${index + 1}:a]adelay=${Math.round(cue.start * 1000)}:all=1[a${index}]`
	);
	filters.push(
		`[0:v]fps=30,tpad=stop_mode=clone:stop_duration=${duration},trim=duration=${duration}[footage]`
	);
	filters.push(
		`[footage][${captionsIndex}:v]overlay=x=0:y=main_h-overlay_h:eof_action=repeat:enable='gte(t,${timing.cues[0].start})'[video]`
	);
	filters.push(
		`${timing.cues.map((_, index) => `[a${index}]`).join("")}amix=inputs=${timing.cues.length}:normalize=0,apad,atrim=duration=${duration}[narration]`
	);
	let audioOutput = "[narration]";
	if (musicPath) {
		const musicIndex = audioInputs.length + 1;
		filters.push(
			"[narration]aformat=sample_rates=48000:channel_layouts=stereo,asplit[voice][sidechain]",
			`[${musicIndex}:a]atrim=duration=${duration},asetpts=PTS-STARTPTS,loudnorm=I=-20:TP=-2:LRA=9,volume=0.55,afade=t=in:d=1,afade=t=out:st=${Math.max(0, duration - 3)}:d=3[music]`,
			// Keep half the original music so narration can duck it by at most 6 dB.
			"[music][sidechain]sidechaincompress=threshold=0.025:ratio=8:attack=15:release=300:mix=0.5[ducked]",
			"[voice][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95[mix]"
		);
		audioOutput = "[mix]";
	}
	execFileSync(
		"ffmpeg",
		[
			"-hide_banner",
			"-loglevel",
			"warning",
			"-n",
			"-f",
			"concat",
			"-safe",
			"0",
			"-i",
			concatPath,
			...audioInputs.flatMap((path) => ["-i", path]),
			...(musicPath ? ["-i", resolve(musicPath)] : []),
			"-f",
			"concat",
			"-safe",
			"0",
			"-i",
			captionsPath,
			"-filter_complex",
			filters.join(";"),
			"-map",
			"[video]",
			"-map",
			audioOutput,
			"-map_metadata",
			"-1",
			"-map_chapters",
			"-1",
			"-t",
			String(duration),
			"-r",
			"30",
			"-c:v",
			"libx264",
			"-preset",
			"medium",
			"-crf",
			"18",
			"-pix_fmt",
			"yuv420p",
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			"-ar",
			"48000",
			"-ac",
			"2",
			"-movflags",
			"+faststart",
			resolve(outputPath),
		],
		{ stdio: "inherit", timeout: 600_000 }
	);
	writeFileSync(`${outputBase}.srt`, subtitles(captionCues));
	writeFileSync(
		`${outputBase}.timing.json`,
		JSON.stringify(
			{
				cues: captionCues,
				duration,
				musicBPM: musicBPM ? Number(musicBPM) : 125,
				sourceStartedAt: timing.startedAt,
			},
			null,
			2
		)
	);
} finally {
	rmSync(temporary, { force: true, recursive: true });
}
