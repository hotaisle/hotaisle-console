import { describe, expect, it } from "vitest";
import type { Offer } from "../../lib/api";
import { offerKey, selectedOffer, sizesOf } from "./offers";

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

describe("size ordering", () => {
	it("orders by GPU count, CPU cores, memory, and disk regardless of API order", () => {
		const specs = [
			{ cpu_cores: 104, gpus: [{ count: 4 }] },
			{ cpu_cores: 64 },
			{ cpu_cores: 104, ram_capacity: 1024 },
			{ cpu_cores: 104, disk_capacity: 500 },
			{ cpu_cores: 104 },
		];
		const expected = specs.map((spec) => ({
			...OFFER,
			Specs: { ...OFFER.Specs, ...spec },
		}));
		for (let offset = 0; offset < expected.length; offset += 1) {
			const input = [
				...expected.slice(offset),
				...expected.slice(0, offset),
			].reverse();
			const original = [...input];
			expect(sizesOf(input)).toEqual(expected);
			expect(input).toEqual(original);
		}
	});

	it("keeps tied hardware classes stable when stock and prices change", () => {
		const vm = { ...OFFER, metal: false };
		const otherMetal = {
			...OFFER,
			rawSpecs: { ...OFFER.Specs, model: "other" },
		};
		const initial = sizesOf([OFFER, vm, otherMetal]);
		const refreshed = initial
			.map((offer, index) => ({
				...offer,
				OnDemandPrice: 1000 + index,
				Quantity: index,
			}))
			.reverse();
		expect(sizesOf(refreshed).map(offerKey)).toEqual(initial.map(offerKey));
		expect(initial[0]).toBe(vm);
	});
});
