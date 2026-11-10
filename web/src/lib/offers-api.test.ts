import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("inventory API", () => {
	it("handles null inventory from both endpoints as a loaded empty catalog", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(Response.json(null))
				.mockResolvedValueOnce(Response.json(null))
		);
		expect(await api.offers("lab")).toEqual([]);
	});
	it("surfaces failed inventory requests so the console can offer retry", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(Response.json([]))
				.mockResolvedValueOnce(
					new Response("Service unavailable", { status: 503 })
				)
		);
		await expect(api.offers("lab")).rejects.toThrow("Service unavailable");
	});
});
