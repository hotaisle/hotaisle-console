const HEADLINES: Record<string, string> = {
	approve: "Approve in your browser.",
	"auto-rebill": "Keep your team funded.",
	"create-team": "Create your team.",
	defaults: "Make it yours.",
	end: "Release when you're done.",
	funds: "Add credits.",
	history: "Every run, in one place.",
	image: "Pick your compute.",
	launch: "Hold to launch.",
	ready: "Ready to work.",
	"sign-in": "Sign in.",
	theme: "Light or dark.",
};

export function captionHeading(id: string) {
	return HEADLINES[id];
}

// Keep auth captions beside the form and console captions on the empty floor
// below the racks. Coordinates are fractions of the 16:9 capture viewport.
export function captionLayout(id: string) {
	if (["sign-in", "approve", "create-team"].includes(id)) {
		return { width: 0.3, x: 0.6, y: 0.48 };
	}
	return { width: 0.245, x: 0.28, y: 0.74 };
}

export const CAPTION_ENTER_SECONDS = 0.32;
export const CAPTION_EXIT_SECONDS = 0.2;
export const THEME_BLEND_SECONDS = 0.65;

export function captionMotion(time: number, start: number, end: number) {
	const progress = Math.max(
		0,
		Math.min(
			1,
			(time - start) / CAPTION_ENTER_SECONDS,
			(end - time) / CAPTION_EXIT_SECONDS
		)
	);
	return { offset: 12 * (1 - progress) ** 2, opacity: progress };
}

export function captionColors(time: number, lightAt: number) {
	const light = Math.max(
		0,
		Math.min(1, (time - lightAt) / THEME_BLEND_SECONDS)
	);
	const mix = (from: number[], to: number[], progress: number) =>
		`rgb(${from.map((value, index) => Math.round(value + (to[index] - value) * progress)).join(" ")})`;
	// White-to-black interpolation disappears against a crossfading background.
	// Switch contrast at the midpoint, brightening/darkening the supporting line.
	if (light < 0.5) {
		return {
			body: mix([185, 184, 176], [244, 242, 236], light * 2),
			title: "rgb(244 242 236)",
		};
	}
	return {
		body: mix([25, 25, 22], [79, 79, 73], (light - 0.5) * 2),
		title: "rgb(25 25 22)",
	};
}
