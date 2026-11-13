import { onTop, type Plan, type Projection, slabOf, solidSvg } from "./kit";

/** Top-plate hardware from the MI300X tray reference, without reproducing serial labels. */
export function heatsinkHardware(
	plate: Plan,
	z: number,
	projection: Projection
) {
	const { x, y, w, d } = plate;
	const polygon = (points: [number, number][]) =>
		onTop(points, z, projection, true);
	const rect = (rx: number, ry: number, rw: number, rd: number) =>
		polygon([
			[rx, ry],
			[rx + rw, ry],
			[rx + rw, ry + rd],
			[rx, ry + rd],
		]);
	const disc = (cx: number, cy: number, radius: number) =>
		polygon(
			Array.from({ length: 16 }, (_, i) => {
				const angle = (i * Math.PI) / 8;
				return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
			})
		);
	const serviceBand = (right: boolean) => {
		const edge = right ? x + w - 0.3 : x + 0.3;
		const direction = right ? -1 : 1;
		return polygon([
			[edge, y + 3],
			[edge + direction * 1.65, y + 3],
			[edge + direction * 1.65, y + 5.6],
			[edge + direction * 1.2, y + 6.2],
			[edge + direction * 1.2, y + d - 6.2],
			[edge + direction * 1.65, y + d - 5.6],
			[edge + direction * 1.65, y + d - 3],
			[edge, y + d - 3],
		]);
	};
	const tags = [
		[x + 0.5, y + 0.5],
		[x + w - 4.1, y + d - 1.5],
	];
	const barcode = tags
		.flatMap(([tx, ty]) =>
			Array.from({ length: 13 }, (_, i) =>
				rect(tx + 0.2 + i * 0.23, ty + 0.16, i % 3 ? 0.08 : 0.15, 0.48)
			)
		)
		.join("");
	const labelMarks = [false, true]
		.flatMap((right) => {
			const lx = right ? x + w - 1.55 : x + 0.6;
			return Array.from({ length: 14 }, (_, i) =>
				rect(lx, y + 3.35 + i * 0.68, 0.65 + (i % 3) * 0.14, 0.07)
			);
		})
		.join("");
	const screws = [
		[0.1, 0.07],
		[0.9, 0.07],
		[0.1, 0.3],
		[0.9, 0.3],
		[0.1, 0.7],
		[0.9, 0.7],
		[0.1, 0.93],
		[0.9, 0.93],
		[0.35, 0.3],
		[0.65, 0.3],
		[0.35, 0.7],
		[0.65, 0.7],
		[0.17, 0.5],
		[0.83, 0.5],
		[0.5, 0.44],
		[0.5, 0.56],
	].map(([fx, fy]) => [x + w * fx, y + d * fy]);
	const screwHeads = screws.map(([cx, cy]) => disc(cx, cy, 0.28)).join("");
	const screwCenters = screws.map(([cx, cy]) => disc(cx, cy, 0.11)).join("");
	const cutouts = [0.28, 0.5, 0.72]
		.flatMap((fx) =>
			[0.12, 0.88].map((fy) => disc(x + w * fx, y + d * fy, 0.23))
		)
		.join("");
	const warnings = [x + 2.1, x + w - 2.7]
		.map((wx) =>
			polygon([
				[wx, y + d * 0.5 + 0.4],
				[wx + 0.6, y + d * 0.5 + 0.4],
				[wx + 0.3, y + d * 0.5 - 0.15],
			])
		)
		.join("");
	const hardware =
		`<path class="service-label" d="${serviceBand(false)}${serviceBand(true)}${tags.map(([tx, ty]) => rect(tx, ty, 3.5, 0.9)).join("")}"/>` +
		`<path class="label-mark" d="${barcode}${labelMarks}"/>` +
		`<path class="warning-label" d="${warnings}"/>` +
		`<path class="cap-cutout" d="${cutouts}"/>` +
		`<path class="copper-fastener" d="${screwHeads}"/><path class="fastener-center" d="${screwCenters}"/>`;
	const hx = x + w / 2 - 0.34;
	const h0 = y + d * 0.24;
	const length = d * 0.52;
	const handlePart = (hy: number, hd: number, hz: number, height: number) =>
		solidSvg(
			slabOf(
				{ d: hd, r: 0.2, w: 0.68, x: hx, y: hy },
				hz,
				height,
				projection,
				3,
				0.06
			),
			{
				className: "gpu-handle",
				crease: "faint",
				tone: "lo",
			}
		);
	const handle =
		`<path class="handle-shadow" d="${rect(hx + 0.45, h0 + 0.65, 1, length + 0.4)}"/>` +
		handlePart(h0, 0.68, z, 1.4) +
		handlePart(h0 + length - 0.68, 0.68, z, 1.4) +
		handlePart(h0, length, z + 1.4, 0.4);
	return { handle, hardware };
}
