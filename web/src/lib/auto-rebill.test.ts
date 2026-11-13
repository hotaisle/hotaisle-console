import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { dollarCents, rebillSettings, rebillValidation } from "./auto-rebill";

afterEach(() => vi.unstubAllGlobals());
describe("automatic rebill amounts", () => {
	it.each([
		["0.29", 29],
		["25", 2500],
		["999999.99", 99_999_999],
	])("converts %s exactly into cents", (dollars, cents) =>
		expect(dollarCents(dollars)).toBe(cents)
	);
	it.each(["", "-5", "1e3", "2.999", "Infinity", "9007199254740992"])(
		"rejects invalid dollar values: %s",
		(value) => expect(dollarCents(value)).toBeUndefined()
	);
	it("validates the API minimums and cap without silently rounding", () => {
		expect(
			rebillValidation({ amount: "24.99", cap: "20", threshold: "4.99" })
				?.fields
		).toEqual({
			amount: expect.any(String),
			cap: expect.any(String),
			threshold: expect.any(String),
		});
		expect(() =>
			rebillSettings({ amount: "25", cap: "24.99", threshold: "5" })
		).toThrow();
		expect(rebillSettings({ amount: "25", cap: "25", threshold: "5" })).toEqual(
			{
				monthly_cap_cents: 2500,
				rebill_amount_cents: 2500,
				threshold_cents: 500,
			}
		);
	});
});
describe("automatic rebill API contract", () => {
	it("uses the encoded team, exact cents, and same-origin authenticated transport", async () => {
		const settings = {
			monthly_cap_cents: 100_000,
			rebill_amount_cents: 10_025,
			threshold_cents: 5000,
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ enabled: false }))
			.mockResolvedValueOnce(
				Response.json({
					checkout_url: "https://checkout.stripe.com/test",
					expires_at: "2030-01-01",
				})
			)
			.mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetch);
		await api.autoRebill("lab/team");
		await api.setupAutoRebill("lab/team", settings);
		await api.updateAutoRebill("lab/team", settings);
		await api.disableAutoRebill("lab/team");
		for (const [index, method] of [
			"GET",
			"POST",
			"PATCH",
			"DELETE",
		].entries()) {
			expect(fetch).toHaveBeenNthCalledWith(
				index + 1,
				"/api/teams/lab%2Fteam/auto-rebill/",
				expect.objectContaining({
					body:
						method === "POST" || method === "PATCH"
							? JSON.stringify(settings)
							: undefined,
					credentials: "same-origin",
					headers: expect.objectContaining({
						"X-Requested-With": "hotaisle-console",
					}),
					method,
				})
			);
		}
	});
	it.each([403, 409, 422, 503])(
		"preserves API failures (%s)",
		async (status) => {
			vi.stubGlobal(
				"fetch",
				vi
					.fn()
					.mockResolvedValue(
						Response.json({ message: "Not allowed" }, { status })
					)
			);
			await expect(api.disableAutoRebill("lab")).rejects.toMatchObject({
				message: "Not allowed",
				status,
			});
		}
	);
});
