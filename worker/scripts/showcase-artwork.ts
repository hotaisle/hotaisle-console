import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CanvasTools } from "./showcase-canvas";
import {
	BRAND_HOLD_SECONDS,
	BROWSER_INTRO_SECONDS,
	CONSOLE_URL,
	type Frame,
} from "./showcase-edit";
import { loadShowcaseTool } from "./showcase-tools";

export async function showcaseArtwork(
	width: number,
	height: number,
	firstFrame: string,
	lastFrame: string,
	closingAt: number,
	directory: string,
	outputBase: string,
	tempoScale = 1
) {
	const { createCanvas, loadImage } =
		await loadShowcaseTool<CanvasTools>("@napi-rs/canvas");
	const [signIn, settings] = await Promise.all([
		loadImage(firstFrame),
		loadImage(lastFrame),
	]);
	const icon = (body: string) =>
		loadImage(
			Buffer.from(
				`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b7b8bb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
			)
		);
	const [back, forward, reload, search, menu] = await Promise.all([
		icon('<path d="M19 12H5m7-7-7 7 7 7"/>'),
		icon('<path d="M5 12h14m-7-7 7 7-7 7"/>'),
		icon('<path d="M20 4v6h-6m6 0a8 8 0 1 0-1.8 7"/>'),
		icon('<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>'),
		icon(
			'<g fill="#b7b8bb" stroke="none"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></g>'
		),
	]);
	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d");
	context.scale(width / 1920, height / 1080);
	context.textBaseline = "middle";
	context.font = "600 78px Arial";
	const brandWidth = context.measureText("Hot Aisle").width;
	context.font = "78px Arial";
	const consoleWidth = context.measureText("Console").width;
	const left = (1920 - 138 - brandWidth - 28 - consoleWidth) / 2;
	const logo = readFileSync(resolve("web/public/favicon.svg"), "utf8").replace(
		"<svg ",
		`<svg x="${left}" y="392" width="108" height="108" `
	);
	const closingSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1920 1080">
<title>Hot Aisle Console — enterprise compute at your fingertips</title>
<rect width="1920" height="1080" fill="#11110f"/>
${logo}
<text x="${left + 138}" y="472" font-family="Arial, sans-serif" font-size="78" font-weight="600" fill="#eeeee8">Hot Aisle</text>
<text x="${left + 138 + brandWidth + 28}" y="472" font-family="Arial, sans-serif" font-size="78" fill="#eeeee8">Console</text>
<a href="${CONSOLE_URL}" target="_blank" rel="noopener noreferrer"><text x="960" y="592" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#ff8a47">console.hotaisle.app</text></a>
</svg>`;
	writeFileSync(`${outputBase}-closing.svg`, closingSVG);
	const closing = await loadImage(Buffer.from(closingSVG));
	context.drawImage(closing, 0, 0, 1920, 1080);
	writeFileSync(`${outputBase}-closing.png`, canvas.toBuffer("image/png"));

	const pill = (x: number, y: number, w: number, h: number, fill: string) => {
		context.fillStyle = fill;
		context.beginPath();
		context.roundRect(x, y, w, h, h / 2);
		context.fill();
	};
	const frame = (name: string, time: number): Frame => {
		const file = join(directory, `${name}.jpg`);
		writeFileSync(file, canvas.toBuffer("image/jpeg"));
		return { file, time };
	};
	// A fully visible logo card is the very first encoded frame and poster.
	const opening = frame("opening-brand", 0);
	const address = "console.hotaisle.app";
	// A browser-title animation is composited locally; it never navigates to a
	// real account or records another browser/profile's tabs or address history.
	const intro = Array.from(
		{ length: Math.round(BROWSER_INTRO_SECONDS * 30) },
		(_, i) => {
			const t = i / 30;
			const loaded = t >= 2.88;
			const reveal = Math.min(1, Math.max(0, (t - 3.12) / 0.64));
			const eased = reveal * reveal * (3 - 2 * reveal);
			const toolbar = 140 * (1 - eased);
			context.globalAlpha = 1;
			context.fillStyle = "#202124";
			context.fillRect(0, 0, 1920, 1080);
			if (loaded) {
				context.drawImage(signIn, 0, toolbar, 1920, 1080 - toolbar);
			}
			context.fillStyle = "#292a2d";
			context.fillRect(0, toolbar - 140, 1920, 140);
			pill(28, toolbar - 128, 332, 48, "#3c3d40");
			context.fillStyle = "#ececec";
			context.textAlign = "left";
			context.font = "20px Arial";
			context.fillText(
				loaded ? "Hot Aisle Console" : "New Tab",
				54,
				toolbar - 104
			);
			context.fillStyle = "#b7b8bb";
			context.font = "28px Arial";
			context.fillText("+", 388, toolbar - 104);
			context.drawImage(back, 24, toolbar - 51, 28, 28);
			context.drawImage(forward, 72, toolbar - 51, 28, 28);
			context.drawImage(reload, 120, toolbar - 51, 28, 28);
			pill(184, toolbar - 64, 1640, 52, loaded ? "#202124" : "#38393d");
			context.font = "25px Arial";
			context.fillStyle = "#d8d9dc";
			context.drawImage(search, 204, toolbar - 51, 28, 28);
			const count = Math.min(
				address.length,
				Math.max(0, Math.floor(((t - 0.48) / 1.92) * address.length))
			);
			const typed = address.slice(0, count);
			context.fillStyle = "#f1f2f4";
			context.fillText(typed, 255, toolbar - 37);
			if (!loaded && t >= 0.32 && Math.floor(t * 3) % 2 === 0) {
				context.fillRect(
					258 + context.measureText(typed).width,
					toolbar - 52,
					2,
					30
				);
			}
			context.drawImage(menu, 1860, toolbar - 51, 28, 28);
			if (t < 0.48) {
				context.globalAlpha = 1 - t / 0.48;
				context.drawImage(closing, 0, 0, 1920, 1080);
				context.globalAlpha = 1;
			}
			return frame(
				`intro-${String(i).padStart(4, "0")}`,
				(BRAND_HOLD_SECONDS + t) * tempoScale
			);
		}
	);
	const outro = Array.from({ length: 13 }, (_, i) => {
		context.globalAlpha = 1;
		context.drawImage(settings, 0, 0, 1920, 1080);
		context.globalAlpha = i / 12;
		context.drawImage(closing, 0, 0, 1920, 1080);
		context.globalAlpha = 1;
		return frame(
			`closing-${String(i).padStart(4, "0")}`,
			closingAt + (i / 30) * tempoScale
		);
	});
	return { intro: [opening, ...intro], outro };
}
