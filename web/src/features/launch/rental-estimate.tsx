import { isPresent } from "../../../../shared/present";
import type { Balance, Offer } from "../../lib/api";
import { hoursOr, money } from "../../lib/format";

function short(ms: number) {
	const minutes = Math.max(0, Math.round(ms / 60_000));
	const days = Math.floor(minutes / 1440);
	const hours = Math.floor((minutes % 1440) / 60);
	if (days) {
		return `${days} day${days > 1 ? "s" : ""}${hours ? ` ${hours} h` : ""}`;
	}
	return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

export function RentalEstimate({
	offer,
	balance,
	loading,
	error,
}: {
	offer?: Offer;
	balance?: Balance;
	loading: boolean;
	error?: Error;
}) {
	const price = offer?.OnDemandPrice;
	if (!(offer && isPresent(price))) {
		let message = "Prices will appear when a machine is available.";
		if (loading) {
			message = "Loading prices…";
		} else if (error) {
			message = "Prices couldn't be loaded. Refresh availability to try again.";
		} else if (offer) {
			message = "Pricing isn't available for this size yet.";
		}
		return (
			<section aria-label="Estimate" className="estimate group">
				<h2 className="group-h section-heading">Estimate</h2>
				<p className="muted small">{message}</p>
			</section>
		);
	}
	const minimum = (price * offer.MinimumReservationMinutes) / 60;
	const spendable = balance
		? Math.max(0, balance.available_balance - (balance.minimum_balance ?? 0))
		: undefined;
	return (
		<section aria-label="Estimate" className="estimate group">
			<h2 className="group-h section-heading">Estimate</h2>
			<dl>
				<dt>Minimum ({hoursOr(offer.MinimumReservationMinutes)})</dt>
				<dd>{money(minimum)}</dd>
				{offer.MinimumReservationMinutes === 60 ? null : (
					<>
						<dt>An hour</dt>
						<dd>{money(price)}</dd>
					</>
				)}
				<dt>A working day (8 hours)</dt>
				<dd>{money(price * 8)}</dd>
				<dt className="spare">A full day</dt>
				<dd className="spare">{money(price * 24)}</dd>
				<dt>Your balance covers</dt>
				<dd className="dim">
					{isPresent(spendable) && price > 0
						? `about ${short((spendable / (price + (balance?.hourly_rate ?? 0))) * 3_600_000)}`
						: "–"}
				</dd>
			</dl>
		</section>
	);
}
