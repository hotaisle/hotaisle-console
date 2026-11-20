import { describe, expect, it } from "vitest";
import type { Offer } from "../../lib/api";
import { offerKey, selectedOffer } from "./offers";

const COMPACT_METAL_KEY = /^bm-[\w-]{43}$/u;

const OFFER: Offer = {
	MinimumReservationMinutes: 480,
	metal: true,
	OnDemandPrice: 2700,
	Quantity: 2,
	rawSpecs: { cpu_cores: 104, gpus: [{ count: 8, model: "MI300X" }] },
	Specs: {
		cpu_cores: 104,
		disk_capacity: 1000,
		gpus: [{ count: 8, model: "MI300X" }],
		ram_capacity: 2048,
	},
};

describe("hardware-class bookmarks", () => {
	it("restores the exact class after serialization order, stock, and pricing change", () => {
		const bookmark = offerKey(OFFER);
		const refreshed = {
			...OFFER,
			OnDemandPrice: 2800,
			Quantity: 1,
			rawSpecs: JSON.parse(
				'{"gpus":[{"model":"MI300X","count":8}],"cpu_cores":104}'
			),
		};
		const other = {
			...OFFER,
			rawSpecs: { cpu_cores: 64, gpus: [{ count: 8, model: "MI300X" }] },
		};
		expect(bookmark).toMatch(COMPACT_METAL_KEY);
		expect(
			selectedOffer([other, refreshed], { count: 8, offer: bookmark })
		).toBe(refreshed);
	});
	it("does not replace a missing bare-metal class with a VM having the same specs", () => {
		const vm = { ...OFFER, metal: false };
		expect(
			selectedOffer([vm], { count: 8, offer: offerKey(OFFER) })
		).toBeUndefined();
	});
});
