import { requireValue } from "../../../../../shared/require-value";

const DECIMAL_ZERO_PATTERN = /\.0$/u;
// Vendored from Anatomy (https://github.com/wheresryan22/anatomy), kit/iso-kit.ts at 1482e84.
// MIT License, Copyright (c) 2026 Ryan. The full license text is in ./LICENSE-anatomy.txt.
/* eslint-disable */
export type Flat = [number, number];
export type Point3 = [number, number, number];
export type Plane = [number, number];
export interface Projection {
	azimuth?: number;
	elevation?: number;
	origin: Flat;
	scale: number;
}
export interface Plan {
	d: number;
	r: number;
	w: number;
	x: number;
	y: number;
}
export interface SolidPaths {
	bevel?: string;
	crease: string;
	fill: string;
	outline: string;
	seamless?: boolean;
	shades: string[];
	top: string;
}
export type Tone = "hi" | "mid" | "lo" | "faint";
export type LineTone = Tone | "lit" | "red" | "green" | "blue";
export const AZIMUTH = 45;
export const ELEVATION = 30;
export const SHADES = 4;
const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
interface Camera {
	cosA: number;
	cosE: number;
	k: number;
	sinA: number;
	sinE: number;
}
export function cameraOf({
	scale,
	azimuth = AZIMUTH,
	elevation = ELEVATION,
}: Projection): Camera {
	const a = azimuth * RADIANS;
	const e = elevation * RADIANS;
	return {
		cosA: Math.cos(a),
		cosE: Math.cos(e),
		k: scale * UNIT,
		sinA: Math.sin(a),
		sinE: Math.sin(e),
	};
}
export function iso([x, y, z]: Point3, projection: Projection): Flat {
	const { origin } = projection;
	const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
	return [
		origin[0] + (x * sinA - y * cosA) * k,
		origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k,
	];
}
export function towardViewer(projection: Projection): Plane {
	const { sinA, cosA } = cameraOf(projection);
	return [cosA, sinA];
}
export function depthOf([x, y, z]: Point3, projection: Projection) {
	const { sinA, cosA, sinE, cosE } = cameraOf(projection);
	return (x * cosA + y * sinA) * cosE + z * sinE;
}
const tenth = (value: number) => {
	const text = (Math.round(value * 10) / 10)
		.toFixed(1)
		.replace(DECIMAL_ZERO_PATTERN, "");
	return text === "-0" ? "0" : text;
};
export function pathOf(points: Flat[], closed = false) {
	if (!points.length) {
		return "";
	}
	return (
		points
			.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`)
			.join("") + (closed ? "Z" : "")
	);
}
export function roundedPlan({ x, y, w, d, r }: Plan, steps = 8): Plane[] {
	const radius = Math.max(0, Math.min(r, w / 2, d / 2));
	const corners: [number, number, number][] = [
		[x + w - radius, y + radius, -90],
		[x + w - radius, y + d - radius, 0],
		[x + radius, y + d - radius, 90],
		[x + radius, y + radius, 180],
	];
	const out: Plane[] = [];
	for (const [cx, cy, start] of corners) {
		const count = radius > 0 ? steps : 0;
		for (let step = 0; step <= count; step += 1) {
			const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
			out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
		}
	}
	return out;
}
function signedArea(points: Plane[] | Flat[]) {
	let area = 0;
	for (let index = 0; index < points.length; index += 1) {
		const [ax, ay] = points[index];
		const [bx, by] = points[(index + 1) % points.length];
		area += ax * by - bx * ay;
	}
	return area / 2;
}
const oriented = (points: Flat[]) =>
	signedArea(points) < 0 ? [...points].reverse() : points;
function convexHull(points: Flat[]): Flat[] {
	const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (sorted.length < 3) {
		return sorted;
	}
	const cross = (o: Flat, a: Flat, b: Flat) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lower: Flat[] = [];
	for (const point of sorted) {
		while (
			lower.length >= 2 &&
			cross(
				requireValue(lower.at(-2), "A hull edge requires two points"),
				requireValue(lower.at(-1), "A hull edge requires two points"),
				point
			) <= 0
		) {
			lower.pop();
		}
		lower.push(point);
	}
	const upper: Flat[] = [];
	for (let index = sorted.length - 1; index >= 0; index -= 1) {
		const point = sorted[index];
		while (
			upper.length >= 2 &&
			cross(
				requireValue(upper.at(-2), "A hull edge requires two points"),
				requireValue(upper.at(-1), "A hull edge requires two points"),
				point
			) <= 0
		) {
			upper.pop();
		}
		upper.push(point);
	}
	return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function runsOf(flags: boolean[], want: boolean) {
	const count = flags.length;
	const runs: number[][] = [];
	const start = flags.findIndex(
		(flag, index) => flag !== flags[(index + count - 1) % count]
	);
	if (start < 0) {
		return flags[0] === want
			? [
					Array.from(
						{
							length: count + 1,
						},
						(_, index) => index % count
					),
				]
			: [];
	}
	let run: number[] | null = null;
	for (let step = 0; step < count; step += 1) {
		const index = (start + step) % count;
		if (flags[index] === want) {
			if (!run) {
				run = [index];
			}
			run.push((index + 1) % count);
		} else if (run) {
			runs.push(run);
			run = null;
		}
	}
	if (run) {
		runs.push(run);
	}
	return runs;
}
export interface ExtrudeOptions {
	bevel?: number;
	convex?: boolean;
}
export function extrude(
	ring: Plane[],
	z: number,
	heightLocal: number,
	projection: Projection,
	options: ExtrudeOptions = {}
): SolidPaths {
	const convex = options.convex ?? true;
	const count = ring.length;
	const counter = signedArea(ring) > 0;
	const [vx, vy] = towardViewer(projection);
	const { sinA, cosA } = cameraOf(projection);
	const normals = ring.map(([ax, ay], index) => {
		const [bx, by] = ring[(index + 1) % count];
		const dx = bx - ax;
		const dy = by - ay;
		const length = Math.hypot(dx, dy) || 1;
		return (
			counter ? [dy / length, -dx / length] : [-dy / length, dx / length]
		) as Plane;
	});
	const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
	const top = ring.map(([x, y]) => iso([x, y, z + heightLocal], projection));
	const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
	const outline: string[] = [];
	const crease: string[] = [];
	for (const run of runsOf(facing, false)) {
		outline.push(pathOf(run.map((index) => top[index])));
	}
	for (const run of runsOf(facing, true)) {
		crease.push(pathOf(run.map((index) => top[index])));
		if (heightLocal > 0) {
			outline.push(pathOf(run.map((index) => bottom[index])));
		}
	}
	if (heightLocal > 0) {
		for (let index = 0; index < count; index += 1) {
			if (facing[(index + count - 1) % count] !== facing[index]) {
				outline.push(pathOf([top[index], bottom[index]]));
			}
		}
	}
	let fill: string;
	if (convex) {
		fill = pathOf(convexHull([...top, ...bottom]), true);
	} else {
		const parts = [pathOf(oriented(top), true), pathOf(oriented(bottom), true)];
		for (let index = 0; index < count; index += 1) {
			if (!facing[index]) {
				continue;
			}
			const next = (index + 1) % count;
			parts.push(
				pathOf(
					oriented([top[index], top[next], bottom[next], bottom[index]]),
					true
				)
			);
		}
		fill = parts.join("");
	}
	const shades = shadeFaces(
		facing,
		normals,
		top,
		bottom,
		heightLocal,
		sinA,
		cosA
	);
	let bevel: string | undefined;
	if (options.bevel && options.bevel > 0) {
		const by = options.bevel;
		const inset = ring.map(([x, y], index) => {
			const [ax, ay] = normals[(index + count - 1) % count];
			const [bx, by2] = normals[index];
			const mx = ax + bx;
			const my = ay + by2;
			const length = Math.hypot(mx, my) || 1;
			return [x - (mx / length) * by, y - (my / length) * by] as Plane;
		});
		const insetTop = inset.map(([x, y]) =>
			iso([x, y, z + heightLocal], projection)
		);
		bevel = runsOf(facing, true)
			.map((run) =>
				pathOf([
					top[run[0]],
					...run.slice(1, -1).map((index) => insetTop[index]),
					top[requireValue(run.at(-1), "A bevel requires an endpoint")],
				])
			)
			.join("");
	}
	return {
		bevel,
		crease: crease.join(""),
		fill,
		outline: outline.join(""),
		shades,
		top: pathOf(oriented(top), true),
	};
}
export const ringOf = (plan: Plan, steps = 8): Plane[] =>
	roundedPlan(plan, steps);
export function slabOf(
	plan: Plan,
	z: number,
	height: number,
	projection: Projection,
	steps = 8,
	bevel = 0
) {
	return extrude(ringOf(plan, steps), z, height, projection, {
		bevel,
		convex: true,
	});
}
export function onTop(
	points: Plane[],
	z: number,
	projection: Projection,
	closed = false
) {
	return pathOf(
		points.map(([x, y]) => iso([x, y, z], projection)),
		closed
	);
}
export const lineOnTop = (
	from: Plane,
	to: Plane,
	z: number,
	projection: Projection
) => onTop([from, to], z, projection);
export const segment = (from: Point3, to: Point3, projection: Projection) =>
	pathOf([iso(from, projection), iso(to, projection)]);
export const pointsAt = (points: Point3[], projection: Projection): Flat[] =>
	points.map((point) => iso(point, projection));
export function boxCorners(
	{ x, y, w, d }: Plan,
	z0: number,
	z1: number
): Point3[] {
	const out: Point3[] = [];
	for (const px of [x, x + w]) {
		for (const py of [y, y + d]) {
			for (const z of [z0, z1]) {
				out.push([px, py, z]);
			}
		}
	}
	return out;
}
export interface Ticks {
	major: string;
	minor: string;
}
export function axisVector(projection: Projection, [dx, dy, dz]: Point3): Flat {
	const origin = iso([0, 0, 0], projection);
	const moved = iso([dx, dy, dz], projection);
	return [moved[0] - origin[0], moved[1] - origin[1]];
}
const thousandth = (value: number) => Math.round(value * 1000) / 1000;
function axesAt(at: Plane, z: number, projection: Projection) {
	const origin = iso([at[0], at[1], z], projection);
	const along = (point: Point3): Flat => {
		const [px, py] = iso(point, projection);
		return [px - origin[0], py - origin[1]];
	};
	return {
		origin,
		x: along([at[0] + 1, at[1], z]),
		y: along([at[0], at[1] + 1, z]),
		z: along([at[0], at[1], z + 1]),
	};
}
const matrixOf = (u: Flat, v: Flat, origin: Flat) =>
	`matrix(${thousandth(u[0])} ${thousandth(u[1])} ${thousandth(v[0])} ${thousandth(v[1])} ${thousandth(origin[0])} ${thousandth(origin[1])})`;
export function sideMatrix(
	at: Plane,
	z: number,
	projection: Projection,
	face: "left" | "right"
) {
	const { origin, x, y, z: up } = axesAt(at, z, projection);
	const down: Flat = [-up[0], -up[1]];
	return face === "left"
		? matrixOf(x, down, origin)
		: matrixOf([-y[0], -y[1]], down, origin);
}
export interface FitOptions {
	azimuth?: number;
	elevation?: number;
	headroom?: number;
	pad?: number;
}
export function fitProjection(
	points: Point3[],
	width: number,
	height: number,
	{
		pad = 24,
		headroom = 0,
		azimuth = AZIMUTH,
		elevation = ELEVATION,
	}: FitOptions = {}
): Projection {
	const unit: Projection = {
		azimuth,
		elevation,
		origin: [0, 0],
		scale: 1,
	};
	const flat = points.map((point) => iso(point, unit));
	const xs = flat.map(([x]) => x);
	const ys = flat.map(([, y]) => y);
	const left = Math.min(...xs);
	const right = Math.max(...xs);
	const up = Math.min(...ys);
	const down = Math.max(...ys);
	const scale = Math.min(
		(width - pad * 2) / (right - left),
		(height - pad * 2 - headroom) / (down - up)
	);
	return {
		azimuth,
		elevation,
		origin: [
			width / 2 - ((left + right) / 2) * scale,
			headroom + (height - headroom) / 2 - ((up + down) / 2) * scale,
		],
		scale,
	};
}
const escapeMarkup = (text: string) =>
	text
		.replace(/&/gu, "&amp;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;")
		.replace(/"/gu, "&quot;");
const attrs = (pairs: Record<string, string | number | undefined | false>) =>
	Object.entries(pairs)
		.filter(([, value]) => value !== undefined && value !== false)
		.map(([key, value]) => ` ${key}="${escapeMarkup(String(value))}"`)
		.join("");
export interface SolidStyle {
	className?: string;
	crease?: Tone | "none";
	flat?: boolean;
	halo?: boolean;
	inner?: string;
	lit?: boolean;
	tone?: Tone;
}
export function solidSvg(
	paths: SolidPaths,
	{
		tone = "hi",
		crease = "faint",
		halo = false,
		lit = false,
		flat = false,
		className,
		inner = "",
	}: SolidStyle = {}
) {
	const parts: string[] = [];
	if (halo) {
		parts.push(`<path class="iso-halo" d="${paths.fill}"/>`);
	}
	parts.push(`<path class="iso-fill" d="${paths.fill}"/>`);
	if (!flat) {
		for (const [shade, d] of paths.shades.entries()) {
			if (d) {
				parts.push(`<path class="iso-shade" data-shade="${shade}" d="${d}"/>`);
			}
		}
		parts.push(`<path class="iso-top" d="${paths.top}"/>`);
	}
	if (crease !== "none" && paths.crease) {
		parts.push(
			`<path class="iso-line iso-crease" data-tone="${crease}" d="${paths.crease}"/>`
		);
	}
	if (crease !== "none" && paths.bevel) {
		parts.push(
			`<path class="iso-line iso-bevel" data-tone="${crease}" d="${paths.bevel}"/>`
		);
	}
	if (inner) {
		parts.push(inner);
	}
	parts.push(
		`<path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/>`
	);
	return `<g${attrs({
		class: className ? `iso-solid ${className}` : "iso-solid",
		"data-lit": lit ? "" : undefined,
		"data-seamless": paths.seamless ? "" : undefined,
	})}>${parts.join("")}</g>`;
}
export interface LineStyle {
	className?: string;
	dashed?: boolean;
	dotted?: boolean;
	flow?: boolean;
	free?: boolean | "start" | "end";
	tone?: LineTone;
}
export function lineSvg(
	d: string,
	{
		tone = "lo",
		dotted = false,
		dashed = false,
		flow = false,
		className,
		free,
	}: LineStyle = {}
) {
	if (!d) {
		return "";
	}
	return `<path${attrs({
		class: className ? `iso-line ${className}` : "iso-line",
		d,
		"data-dashed": dashed ? "" : undefined,
		"data-dotted": dotted ? "" : undefined,
		"data-flow": flow ? "" : undefined,
		"data-free": free === true ? "" : free || undefined,
		"data-tone": tone,
	})}/>`;
}
export function dotsSvg(
	points: Array<Flat | [number, number, number]>,
	{
		size = 0.5,
		tone = "mid",
		pulse = false,
	}: {
		size?: number;
		tone?: Tone;
		pulse?: boolean;
	} = {}
) {
	// Plain dots go into one path (a circle per subpath): hundreds of elements become one, which keeps a
	// moving camera cheap. Faded or pulsing dots need their own element each.
	if (!pulse && points.every((p) => (p.at(2) ?? 1) >= 1)) {
		const r = size;
		const d = points
			.map(
				([x, y]) =>
					`M${tenth(x - r)} ${tenth(y)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
			)
			.join("");
		return d ? `<path class="iso-dots" data-tone="${tone}" d="${d}"/>` : "";
	}
	const dots = points
		.map(
			([x, y, alpha]: number[], index) =>
				`<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${alpha !== undefined && alpha < 1 ? ` fill-opacity="${Math.max(0, alpha).toFixed(2)}"` : ""}${pulse ? ` data-pulse="" style="--pulse-at:${(index * 137) % 1600}ms"` : ""}/>`
		)
		.join("");
	return `<g class="iso-dots" data-tone="${tone}">${dots}</g>`;
}
export type Faded =
	| {
			d: string;
			alpha: number;
	  }
	| [string, number];
export interface FadeLineStyle {
	className?: string;
	fade?: number | [number, number];
	stops?: number;
	tone?: LineTone;
}
export interface WireStyle {
	dashed?: boolean;
	dotted?: boolean;
	ends?: "both" | "from" | "to" | "none";
	flow?: boolean;
	size?: number;
	tone?: LineTone;
	via?: Flat[];
}
export type Theme = "dark" | "light";
export interface FigureOptions {
	body: string | string[];
	className?: string;
	height: number;
	label: string;
	standalone?: Theme | false;
	width: number;
}
export type KeyMark =
	| "raised"
	| "flat"
	| "lit"
	| "edge"
	| "dim"
	| "dotted"
	| "dashed"
	| "red"
	| "green"
	| "blue";
export interface LegendKey {
	label: string;
	mark: KeyMark;
}
export interface PlateOptions {
	body: string;
	caption?: string;
	fig: string;
	hint?: string;
	keys?: LegendKey[];
	readout?: string;
	title?: string;
}
export interface PageOptions {
	body: string;
	script?: string;
	theme?: Theme;
	title: string;
	width?: number;
}

function shadeFaces(
	facing: boolean[],
	normals: Plane[],
	top: Flat[],
	bottom: Flat[],
	heightLocal: number,
	sinA: number,
	cosA: number
) {
	const count = facing.length;
	const buckets: string[][] = Array.from(
		{
			length: SHADES,
		},
		() => []
	);
	if (heightLocal > 0) {
		const [lx, ly] = [-sinA, cosA];
		for (let index = 0; index < count; index += 1) {
			if (!facing[index]) {
				continue;
			}
			const [nx, ny] = normals[index];
			const lit = (nx * lx + ny * ly + 1) / 2;
			const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
			const next = (index + 1) % count;
			buckets[shade]?.push(
				pathOf(
					oriented([top[index], top[next], bottom[next], bottom[index]]),
					true
				)
			);
		}
	}
	return buckets.map((paths) => paths.join(""));
}
