import { describe, expect, it, vi } from "vitest";
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
