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
	if (!(loading || error || empty)) {
		return (
			<p className="small muted availability-state">
				Availability refreshes automatically every 10 seconds
			</p>
		);
	}
	return (
		<div className="offer-status stack">
			{loading ? (
				<p role="status">Loading available sizes and prices…</p>
			) : null}
			{error ? (
				<p role="alert">Couldn't load sizes and prices. {error.message}</p>
			) : null}
			{!(loading || error) && empty ? (
				<p className="availability-empty" role="status">
					No machines are available right now. Availability updates
					automatically. A balance does not have an effect on availability.
				</p>
			) : null}
			{error ? (
				<button className="btn" onClick={onRefresh} type="button">
					Refresh availability
				</button>
			) : null}
		</div>
	);
}
