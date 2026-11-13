import { FormError } from "../../components/forms/form-error";

export function OfferStatus({
	loading,
	error,
	empty,
	onRefresh,
}: {
	loading: boolean;
	error?: Error;
	empty: boolean;
	onRefresh: () => Promise<void>;
}) {
	return (
		<>
			{!(loading || error) && empty ? (
				<div className="offer-status stack">
					<p className="availability-empty" role="status">
						<strong>No machines are available right now.</strong>
						<span>
							Availability updates automatically. A balance does not have an
							effect on availability.
						</span>
					</p>
				</div>
			) : (
				<p className="small muted availability-state" role="status">
					{loading
						? "Loading available sizes and prices…"
						: "Availability refreshes automatically every 10 seconds"}
				</p>
			)}
			<FormError
				actions={
					<button className="btn" onClick={onRefresh} type="button">
						Refresh availability
					</button>
				}
				message={
					error ? `Couldn't load sizes and prices. ${error.message}` : undefined
				}
			/>
		</>
	);
}
