import { sha256 } from "@noble/hashes/sha2.js";
import type { Offer } from "../../lib/api";
import type { Order } from "./types";

const encoder = new TextEncoder();

/** Stable, compact class identity; full specifications stay in the availability data. */
export function offerKey(offer: Offer): string {
	const identity = JSON.stringify(
		[offer.metal ? "metal" : "vm", offer.rawSpecs ?? offer.Specs],
		(_key, value: unknown) =>
			value && typeof value === "object" && !Array.isArray(value)
				? Object.fromEntries(
						Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
					)
				: value
	);
	const digest = btoa(String.fromCharCode(...sha256(encoder.encode(identity))))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
	return `${offer.metal ? "bm" : "vm"}-${digest}`;
}

export function selectedOffer(
	sizes: Offer[],
	order: Pick<Order, "count" | "offer">
) {
	if (order.offer) {
		return sizes.find((size) => offerKey(size) === order.offer);
	}
	return (
		sizes.find(
			(size) => size.Specs.gpus?.[0]?.count === order.count && size.Quantity > 0
		) ?? sizes.find((size) => size.Specs.gpus?.[0]?.count === order.count)
	);
}

/** Only legacy count-only links may switch to the nearest available size. */
export function fallbackGPUCount(
	sizes: Offer[],
	order: Pick<Order, "count" | "offer">,
	current?: Offer
) {
	if (order.offer || current?.Quantity) {
		return;
	}
	return sizes
		.filter((size) => size.Quantity > 0)
		.sort(
			(a, b) =>
				Math.abs((a.Specs.gpus?.[0]?.count ?? 0) - order.count) -
				Math.abs((b.Specs.gpus?.[0]?.count ?? 0) - order.count)
		)[0]?.Specs.gpus?.[0]?.count;
}

export function availabilityBlocker({
	offers,
	sizes,
	offer,
	error,
}: {
	offers?: Offer[];
	sizes: Offer[];
	offer?: Offer;
	error?: Error;
}) {
	if (error) {
		return "Refresh availability before launching.";
	}
	if (offers === undefined) {
		return "Loading sizes and prices…";
	}
	if (sizes.every((size) => size.Quantity <= 0)) {
		return "No machines are available right now.";
	}
	if (offer?.OnDemandPrice === undefined) {
		return "Pricing is not available for this size.";
	}
	if (offer.Quantity <= 0) {
		return "This server class is no longer available. Choose another class.";
	}
	return "";
}

export const sizesOf = (offers?: Offer[]) => {
	const list = (offers ?? [])
		.filter((o) => o.Specs?.gpus?.length)
		.sort(
			(a, b) =>
				(a.Specs.gpus?.[0]?.count ?? 0) - (b.Specs.gpus?.[0]?.count ?? 0)
		);
	return list;
};
