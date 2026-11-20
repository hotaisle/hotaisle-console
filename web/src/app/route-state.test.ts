import { describe, expect, it } from "vitest";
import { safeReturnTo, validateSearch } from "./route-state";

describe("cloud-init URL navigation", () => {
	it("drops legacy plaintext cloud-init parameters from protected links", () => {
		expect(
			safeReturnTo(
				"/teams/lab/launch?gpus=2&cloudInit=https%3A%2F%2Fexample.invalid%2Ftemplate%3Ftoken%3Ddummy"
			)
		).toBe("/teams/lab/launch?gpus=2");
		expect(
			validateSearch({ cloudInit: "https://example.invalid/private", gpus: 2 })
		).toEqual({
			gpus: 2,
			image: undefined,
			page: undefined,
			pageSize: undefined,
			returnTo: undefined,
		});
	});
});
