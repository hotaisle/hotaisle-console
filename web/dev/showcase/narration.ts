export interface Clip {
	duration: number;
	src: string;
	text: string;
}
export function narrationClip(
	clips: Record<string, Clip>,
	id: string,
	text: string
) {
	const clip = clips[id];
	if (clip && clip.text !== text) {
		throw new Error(
			"Narration no longer matches the captions. Run bun run showcase:prepare."
		);
	}
	return clip;
}
