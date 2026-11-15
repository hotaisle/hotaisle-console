import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(import.meta.dirname, "base.css"), "utf8");
const COLORS = /--(?<name>[a-z\d-]+):\s*(?<color>#[a-f\d]{6});/gu;

function palette(selector: string) {
	const start = css.indexOf(`${selector} {`);
	if (start < 0) {
		throw new Error(`Missing theme: ${selector}`);
	}
	const block = css.slice(start, css.indexOf("}", start));
	return new Map(
		[...block.matchAll(COLORS)].map(({ groups }) => {
			if (!groups) {
				throw new Error("Color declaration did not contain named captures");
			}
			return [groups.name, groups.color] as const;
		})
	);
}

function color(colors: Map<string, string>, name: string) {
	const value = colors.get(name);
	if (!value) {
		throw new Error(`Missing color: ${name}`);
	}
	return value;
}

// WCAG relative luminance and contrast use linearized sRGB channels.
function luminance(hex: string) {
	const channels = [1, 3, 5].map((start) => {
		const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
		return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
	const values = [luminance(first), luminance(second)];
	return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

const root = palette(":root");
const surfaces = ["page", "panel", "card", "card-2"];

describe("button color accessibility", () => {
	it.each([
		"primary",
		"primary-hover",
		"primary-active",
		"danger",
		"danger-hover",
		"danger-active",
	])("keeps %s labels at 4.5:1 or better", (state) => {
		expect(
			contrast(color(root, "button-on-fill"), color(root, `button-${state}`))
		).toBeGreaterThanOrEqual(4.5);
	});

	it.each([
		["light", ":root"],
		["explicit dark", ':root[data-theme="dark"]'],
		["system dark", ':root:not([data-theme="light"])'],
	])("keeps neutral and destructive actions legible in %s", (_, selector) => {
		const theme = palette(selector);
		for (const surface of surfaces) {
			const background = color(theme, surface);
			expect(contrast(color(theme, "ink"), background)).toBeGreaterThanOrEqual(
				4.5
			);
			expect(
				contrast(color(theme, "ink-2"), background)
			).toBeGreaterThanOrEqual(4.5);
			expect(contrast(color(theme, "bad"), background)).toBeGreaterThanOrEqual(
				4.5
			);
			expect(
				contrast(color(theme, "button-outline"), background)
			).toBeGreaterThanOrEqual(3);
		}
	});
});
