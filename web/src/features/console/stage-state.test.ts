import { describe, expect, it, vi } from "vitest";
import type { Ended } from "../../lib/api";
import { buildStage, type StageInput } from "./stage-state";

function input(): StageInput {
	return {
		list: [],
		offerFor: vi.fn(),
		offers: [],
		order: { count: 1, customURL: "", image: "standard" },
		orderContext: true,
		priceOf: vi.fn(),
		receipts: [],
		records: {},
		serverOf: vi.fn(),
		states: {},
	};
}
describe("machine preview availability", () => {
	it("reports a completed empty catalog without claiming sizes are loading", () => {
		expect(buildStage(input()).specTitle).toBe("No machines available");
	});
	it("distinguishes loading from a failed inventory request", () => {
		expect(buildStage({ ...input(), offers: undefined }).specTitle).toBe(
			"Loading sizes"
		);
		const failed = buildStage({
			...input(),
			offersError: new Error("Unavailable"),
		});
		expect(failed.specTitle).toBe("Sizes unavailable");
		expect(failed.readout).toContain("Refresh");
	});
});

describe("history drawing", () => {
	it("uses the recorded server and receipt instead of current availability or a reassigned host", () => {
		const receipt: Ended = {
			cents: 500,
			ended_at: "2026-11-10T20:00:00Z",
			gpus: "2× MI300X",
			name: "internal-vm-id",
			ran_ms: 3_600_000,
			server: "original-server",
			team: "lab",
		};
		const historical: StageInput = {
			focusedReceipt: receipt,
			list: [],
			offerFor: () => undefined,
			order: { count: 1, customURL: "", image: "standard" },
			orderContext: false,
			priceOf: () => undefined,
			receipts: [receipt],
			records: {},
			serverOf: () => "newly-assigned-server",
			states: {},
		};
		const drawing = buildStage(historical);
		expect(drawing.specTitle).toBe("original-server");
		expect(drawing.preview).toBeUndefined();
		expect(drawing.spec).toContainEqual(["Total", "$5.00"]);
		expect(drawing.machines[0]).toMatchObject({
			host: "original-server",
			mode: "ended",
		});
		expect(drawing.readout).not.toContain(receipt.name);
	});
});
