import { TripActions } from "./trip-actions";
import { TripConfirmation } from "./trip-confirmation";
import { TripDetails } from "./trip-details";
import { TripHeading } from "./trip-heading";
import { TripReadings } from "./trip-readings";
import { TripSummary } from "./trip-summary";
import { type TripProps, useTrip } from "./use-trip";
export function Trip(props: TripProps) {
	const context = useTrip(props);
	const { vm, head, phase, style, expanded, panel } = context;
	if (!expanded) {
		return <TripSummary context={context} />;
	}

	return (
		<article
			aria-label={`${vm.name}: ${head}`}
			className={`trip vt p-${phase}`}
			style={style}
		>
			<TripHeading context={context} />

			{panel ? (
				<TripConfirmation context={context} />
			) : (
				<>
					<TripReadings context={context} />
					<TripDetails context={context} />
					<TripActions context={context} />
				</>
			)}
		</article>
	);
}
