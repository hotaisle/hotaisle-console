import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const [, , source, output] = process.argv;
if (!(source && /\.webm$/iu.test(source))) {
	throw new Error(
		"Usage: bun run showcase:export <recording.webm> [output.mp4]"
	);
}
const destination = resolve(output ?? source.replace(/\.webm$/iu, ".mp4"));
execFileSync(
	"ffmpeg",
	[
		"-hide_banner",
		"-n",
		"-i",
		resolve(source),
		"-vf",
		"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1",
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
		"-movflags",
		"+faststart",
		destination,
	],
	{ stdio: "inherit", timeout: 600_000 }
);
console.info(`Exported ${destination}`);
