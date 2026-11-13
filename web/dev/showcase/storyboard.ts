export interface Target {
	selector: string;
	text?: string;
}
export type Action = Target & {
	/** Earliest action time in seconds from this scene's start. */
	after?: number;
	kind: "click" | "type" | "select" | "hold" | "wait";
	value?: string;
};
export interface Scene {
	actions?: Action[];
	approve?: boolean;
	at?: number;
	focus?: Target;
	id: string;
	narration: string;
	seconds?: number;
}
export const SHOWCASE_SECONDS = 68.64;
export const SHOWCASE_GRID = { bpm: 125, offset: 0.06 };
export const WELCOME = {
	id: "welcome",
	narration: "Hello and welcome to Hot Aisle Console.",
};

// The edit follows 125 BPM bars. Actions wait for the next measured beat.
export const STORYBOARD: Scene[] = [
	{
		actions: [
			{
				kind: "type",
				selector: 'input[type="email"]',
				value: "preview@example.invalid",
			},
			{ kind: "click", selector: "button", text: "Email me a link" },
		],
		at: 0,
		focus: { selector: ".auth-content" },
		id: "sign-in",
		narration: "Sign in with your email.",
	},
	{
		actions: [{ kind: "wait", selector: "h1", text: "Check your email" }],
		approve: true,
		at: 5.76,
		id: "approve",
		narration: "Approve the link in your browser.",
	},
	{
		actions: [
			{ kind: "type", selector: 'input[name="name"]', value: "Research team" },
			{ kind: "type", selector: 'input[name="handle"]', value: "preview" },
			{
				after: 3.52,
				kind: "click",
				selector: '.team-form button[type="submit"]',
			},
		],
		at: 9.6,
		id: "create-team",
		narration: "Create your team. Keep its compute and members together.",
	},
	{
		actions: [{ kind: "click", selector: ".top a", text: "Add credits" }],
		at: 14.4,
		id: "funds",
		narration: "Add credits whenever you need them.",
	},
	{
		actions: [
			{ kind: "click", selector: ".auto-rebill > summary" },
			{
				kind: "click",
				selector: ".auto-rebill button",
				text: "Set up automatic rebill",
			},
			{ kind: "wait", selector: ".rebill-form" },
			{
				after: 6.3,
				kind: "click",
				selector: ".rebill-form button",
				text: "Cancel",
			},
			{ after: 7.2, kind: "click", selector: 'button[title="Back (Esc)"]' },
		],
		at: 18.24,
		id: "auto-rebill",
		narration:
			"Set up automatic rebill with a balance trigger, a top-up amount, and a monthly cap.",
	},
	{
		actions: [
			{ kind: "click", selector: "label.opt", text: "2× MI300X" },
			{ kind: "select", selector: 'select[name="image"]', value: "vllm" },
		],
		at: 26.88,
		focus: { selector: ".options" },
		id: "image",
		narration: "Pick two MI300X GPUs and the vLLM image.",
	},
	{
		actions: [{ kind: "hold", selector: "#launch" }],
		at: 32.64,
		id: "launch",
		narration: "Hold to launch. Status updates automatically.",
	},
	{
		actions: [{ kind: "wait", selector: ".connection .ssh" }],
		at: 38.4,
		id: "ready",
		narration: "Connect over SSH. Follow running time and cost.",
	},
	{
		actions: [
			{ kind: "click", selector: ".card-foot button.end" },
			{ kind: "hold", selector: ".sheet .hold" },
		],
		at: 44.16,
		id: "end",
		narration: "Hold to release it and stop billing.",
	},
	{
		actions: [
			{ kind: "click", selector: "a.history-link" },
			{ kind: "click", selector: "a.history-run" },
		],
		at: 48,
		id: "history",
		narration: "Review the run in machine history.",
	},
	{
		actions: [
			{ kind: "click", selector: 'a[aria-label="Settings"]' },
			{ kind: "click", selector: ".settings label", text: "Light" },
		],
		at: 51.84,
		id: "theme",
		narration: "Make the console yours. Choose light or dark.",
	},
	{
		actions: [{ kind: "select", selector: "#def-image", value: "vllm" }],
		at: 57.6,
		id: "defaults",
		narration: "Set a default image for your next machine.",
	},
	{
		at: 63.84,
		id: "finish",
		narration: "Hot Aisle Console, enterprise compute at your fingertips.",
	},
];
