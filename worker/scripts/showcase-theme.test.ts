import { describe, expect, it } from "vitest";
import { themeBlendPlan } from "./showcase-theme";

describe("whole-frame theme transition", () => {
	it("blends complete states instead of partially updated colors", () => {
		const plan = themeBlendPlan(
			[
				{ file: "dark.jpg", time: 10 },
				{ file: "changing.jpg", time: 10.4 },
				{ file: "light.jpg", time: 11 },
			],
			10.2,
			0.65
		);
		expect(plan.before.file).toBe("dark.jpg");
		expect(plan.after.file).toBe("light.jpg");
		expect(plan.end).toBeCloseTo(10.85);
	});
	it("rejects incomplete footage instead of blending a missing scene", () => {
		expect(() =>
			themeBlendPlan([{ file: "dark.jpg", time: 10 }], 10.2, 0.65)
		).toThrow("complete dark and light frames");
	});
});
