import { describe, expect, it } from "vitest";
import { layout, type StageState } from "./model";
import { tagAnchor } from "./tag-anchor";

const scene = {
	anchors: { server: [100, 100] as [number, number] },
	gpuAnchors: {
		"server/6": [40, 50] as [number, number],
		"server/7": [20, 30] as [number, number],
	},
};
function state(): StageState {
	return { machines: [], readout: "", spec: [], specTitle: "" };
}
describe("GPU label anchor", () => {
	it("points above the centroid of assigned GPUs instead of the chassis front", () => {
		const current = layout({
			...state(),
			focus: "vm",
			machines: [{ gpus: 2, host: "server", mode: "ready", name: "vm" }],
		});
		expect(tagAnchor(scene, current, "server")).toEqual([30, 40]);
	});
	it("follows preview GPUs on a server that already holds a machine", () => {
		const current = layout({
			...state(),
			machines: [{ gpus: 1, host: "server", mode: "ready", name: "vm" }],
			preview: 1,
		});
		expect(tagAnchor(scene, current, "server")).toEqual([30, 40]);
	});
	it("falls back to the chassis when there are no active GPU anchors", () => {
		expect(tagAnchor(scene, layout(state()), "server")).toEqual([100, 100]);
	});
});
