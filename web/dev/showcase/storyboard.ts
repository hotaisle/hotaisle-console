export interface Target {
	selector: string;
	text?: string;
}
export type Action = Target & {
	/** Earliest action time in seconds from this scene's start. */
	after?: number;
	kind: "click" | "type" | "select" | "hold" | "wait";
	value?: string;
	transition?: "theme";
};
export interface Scene {
	actions?: Action[];
	approve?: boolean;
	at?: number;
	/** Navigation that must finish before this scene's captions and voice begin. */
	enter?: Action[];
	focus?: Target;
	id: string;
	narration: string;
	seconds?: number;
}
export const SHOWCASE_SECONDS = 81.6;
export const SHOWCASE_GRID = { bpm: 125, offset: 0.06 };
export const WELCOME = {
	id: "welcome",
	narration: "Hello and welcome to Hot Aisle Console.",
};

const TEAMMATE =
	'.team-member-card:has(a[href="mailto:riley%40example.invalid"])';

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
		at: 4.8,
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
		at: 8.64,
		id: "create-team",
		narration: "Create your team. Keep its compute and members together.",
	},
	{
		actions: [{ kind: "click", selector: ".top a", text: "Add credits" }],
		at: 13.44,
		id: "funds",
		narration: "Add credits whenever you need them.",
	},
	{
		actions: [
			{ kind: "click", selector: ".autopay-toggle" },
			{ kind: "wait", selector: ".autopay-fields" },
			{
				after: 6.3,
				kind: "click",
				selector: ".autopay-toggle",
			},
			{ after: 7.2, kind: "click", selector: 'button[title="Back (Esc)"]' },
		],
		at: 19.2,
		id: "auto-rebill",
		narration:
			"Enable autopay right in checkout with a balance trigger, top-up amount, and monthly cap.",
	},
	{
		actions: [
			{ kind: "click", selector: "label.opt", text: "2× MI300X" },
			{ kind: "select", selector: 'select[name="image"]', value: "vllm" },
		],
		at: 27.84,
		focus: { selector: ".options" },
		id: "image",
		narration: "Pick two MI300X GPUs and the vLLM image.",
	},
	{
		actions: [{ kind: "hold", selector: "#launch" }],
		at: 33.6,
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
			{ kind: "click", selector: ".card-foot button", text: "End" },
			{ kind: "hold", selector: ".sheet .hold" },
		],
		at: 43.2,
		id: "end",
		narration: "Hold to release it and stop billing.",
	},
	{
		actions: [
			{ kind: "click", selector: "a.history-link" },
			{ kind: "click", selector: "a.history-run" },
		],
		at: 47.04,
		id: "history",
		narration: "Review the run in machine history.",
	},
	{
		actions: [
			{ kind: "click", selector: ".team-tabs a", text: "Members" },
			{
				kind: "click",
				selector: `${TEAMMATE} input[value="user"]:not(:checked)`,
			},
			{ kind: "click", selector: `${TEAMMATE} button[type="submit"]` },
			{
				kind: "wait",
				selector: `${TEAMMATE} .team-member-actions [role="status"]`,
				text: "Permissions saved.",
			},
		],
		at: 50.88,
		enter: [
			{ kind: "click", selector: '.top a[aria-label$="Change team"]' },
			{ kind: "click", selector: ".team-card-actions a", text: "Manage team" },
		],
		id: "members",
		narration: "Team owners set member permissions.",
	},
	{
		actions: [
			{
				kind: "type",
				selector: '.token-form input[name="label"]',
				value: "Research SSH",
			},
			{
				after: 2.1,
				kind: "click",
				selector: '.token-team input[data-team="preview"][value="user"]',
			},
			{
				after: 4.6,
				kind: "click",
				selector: '.token-form button[type="submit"]',
			},
			{
				kind: "wait",
				selector: ".created-token h2",
				text: "Save your API token",
			},
			{ kind: "click", selector: ".access-tabs a", text: "Teams" },
			{ kind: "click", selector: ".team-card-actions a", text: "Open team" },
		],
		at: 56.64,
		enter: [
			{ kind: "click", selector: ".access-tabs a", text: "API tokens" },
			{ kind: "click", selector: "a.token-create", text: "Create API token" },
		],
		id: "api-tokens",
		narration: "Create an API token. Give it SSH access to this team only.",
	},
	{
		actions: [
			{
				kind: "click",
				selector: ".settings label",
				text: "Light",
				transition: "theme",
			},
		],
		at: 66.24,
		enter: [
			{ kind: "click", selector: 'a[aria-label="Settings"]' },
			{ kind: "wait", selector: ".settings label", text: "Light" },
		],
		id: "theme",
		narration: "Make the console yours. Choose light or dark.",
	},
	{
		actions: [{ kind: "select", selector: "#def-image", value: "vllm" }],
		at: 72.48,
		id: "defaults",
		narration: "Set a default image for your next machine.",
	},
	{
		at: 76.8,
		id: "finish",
		narration: "Hot Aisle Console, enterprise compute at your fingertips.",
	},
];
