import type { Offer } from "../../lib/api";

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
	if (!sizes.length) {
		return "No machines are available right now.";
	}
	if (offer?.OnDemandPrice === undefined) {
		return "Pricing is not available for this size.";
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
