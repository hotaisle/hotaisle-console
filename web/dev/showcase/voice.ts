import { type Clip, narrationClip } from "./narration";

// Optional local generation keeps neural speech tooling and media out of production.
const modules = import.meta.glob<{ default: Record<string, Clip> }>(
	"./narration.generated.ts",
	{ eager: true }
);
export const clips = Object.values(modules)[0]?.default ?? {};
export function createVoice(enabled: boolean) {
	const context = new AudioContext();
	const destination = context.createMediaStreamDestination();
	let active: HTMLAudioElement | undefined;
	let cancel: (() => void) | undefined;
	return {
		async close() {
			active?.pause();
			cancel?.();
			for (const track of destination.stream.getTracks()) {
				track.stop();
			}
			await context.close();
		},
		play(id: string, text: string) {
			const clip = enabled ? narrationClip(clips, id, text) : undefined;
			if (!clip) {
				return { done: Promise.resolve(), duration: 0 };
			}
			active = new Audio(clip.src);
			const audio = active;
			context.createMediaElementSource(audio).connect(destination);
			// Route narration only into the recording, never the desktop speakers.
			const done = new Promise<void>((resolve, reject) => {
				cancel = resolve;
				audio.addEventListener("ended", () => resolve(), { once: true });
				audio.addEventListener(
					"error",
					() => reject(new Error("Narration could not be played.")),
					{ once: true }
				);
				audio.play().catch(reject);
			});
			return { done, duration: clip.duration };
		},
		resume: () => context.resume(),
		track: destination.stream.getAudioTracks()[0],
	};
}
