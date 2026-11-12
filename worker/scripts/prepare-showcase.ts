import { execFileSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	SHOWCASE_SECONDS,
	STORYBOARD,
} from "../../web/dev/showcase/storyboard";
import { loadShowcaseTool } from "./showcase-tools";

interface SpeechEngine {
	KokoroTTS: {
		from_pretrained: (
			model: string,
			options: { device: string; dtype: string }
		) => Promise<{
			generate: (
				text: string,
				options: { speed: number; voice: string }
			) => Promise<{ save: (path: string) => Promise<void> }>;
		}>;
	};
}

function command(file: string, args: string[]) {
	return execFileSync(file, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 30_000,
	}).trim();
}

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "af_bella";
const transformers = await loadShowcaseTool<{ env: { cacheDir: string } }>(
	"@huggingface/transformers"
);
transformers.env.cacheDir = resolve("tools/showcase/.cache");
const { KokoroTTS } = await loadShowcaseTool<SpeechEngine>("kokoro-js");
const deadline = setTimeout(() => {
	console.error("Neural voice preparation timed out.");
	process.exit(1);
}, 180_000);
deadline.unref();
const temporary = mkdtempSync(join(tmpdir(), "console-showcase-"));
try {
	const engine = await KokoroTTS.from_pretrained(MODEL, {
		device: "cpu",
		dtype: "q8",
	});
	const clips: Record<
		string,
		{
			duration: number;
			model: string;
			src: string;
			text: string;
			voice: string;
		}
	> = {};
	// Queue inference on one shared CPU model instead of overlapping its sessions.
	await STORYBOARD.reduce(async (previous, scene, index) => {
		await previous;
		const source = join(temporary, `${scene.id}.wav`);
		const output = join(temporary, `${scene.id}.mp3`);
		// Expand only acronym pronunciation; captions retain the canonical spelling.
		const spokenText = scene.narration
			.replaceAll("MI300X", "M I three hundred X")
			.replaceAll("vLLM", "V L L M");
		const audio = await engine.generate(spokenText, {
			speed: 1,
			voice: VOICE,
		});
		await audio.save(source);
		command("ffmpeg", [
			"-hide_banner",
			"-loglevel",
			"error",
			"-y",
			"-i",
			source,
			"-codec:a",
			"libmp3lame",
			"-b:a",
			"128k",
			output,
		]);
		const duration = Number(
			command("ffprobe", [
				"-v",
				"error",
				"-show_entries",
				"format=duration",
				"-of",
				"default=noprint_wrappers=1:nokey=1",
				output,
			])
		);
		const available =
			(STORYBOARD[index + 1]?.at ?? SHOWCASE_SECONDS - 0.06) - (scene.at ?? 0);
		if (!Number.isFinite(duration) || duration <= 0 || duration > available) {
			throw new Error(`The ${scene.id} narration exceeds its edit slot.`);
		}
		clips[scene.id] = {
			duration,
			model: MODEL,
			src: `data:audio/mpeg;base64,${readFileSync(output).toString("base64")}`,
			text: scene.narration,
			voice: VOICE,
		};
		console.info(`Prepared ${scene.id}: ${duration.toFixed(2)}s`);
	}, Promise.resolve());
	const destination = resolve("web/dev/showcase/narration.generated.ts");
	const pending = `${destination}.pending`;
	writeFileSync(
		pending,
		`// Generated locally by bun run showcase:prepare; never committed.\nexport default ${JSON.stringify(clips)};\n`
	);
	renameSync(pending, destination);
} finally {
	clearTimeout(deadline);
	rmSync(temporary, { force: true, recursive: true });
}
