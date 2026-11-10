import type { Hall } from "./iso/hall";
import type { layout } from "./model";

/** Point the server label at its assigned GPUs, not the chassis front. */
export function tagAnchor(
	scene: Pick<Hall, "anchors" | "gpuAnchors">,
	current: ReturnType<typeof layout>,
	host: string
) {
	const points: [number, number][] = [];
	for (const [id, owner] of current.owned) {
		if (
			id.startsWith(`${host}/`) &&
			owner.machine.mode !== "ended" &&
			scene.gpuAnchors[id]
		) {
			points.push(scene.gpuAnchors[id]);
		}
	}
	if (host === current.focusHost) {
		for (const slot of current.previewSlots) {
			const point = scene.gpuAnchors[`${host}/${slot}`];
			if (point) {
				points.push(point);
			}
		}
	}
	if (!points.length) {
		return scene.anchors[host];
	}
	return points.reduce(
		([x, y], point) => [
			x + point[0] / points.length,
			y + point[1] / points.length,
		],
		[0, 0]
	) as [number, number];
}
