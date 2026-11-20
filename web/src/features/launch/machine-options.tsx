import type { ChangeEvent } from "react";
import { useCallback, useId } from "react";
import { isPresent } from "../../../../shared/present";
import type { Offer } from "../../lib/api";
import { gb, hbm, money } from "../../lib/format";
import { sound } from "../../lib/sound";
import { offerKey } from "./offers";
import type { Order } from "./types";

const PLACEHOLDER: Offer[] = [1, 2, 4, 8].map((count) => ({
	MinimumReservationMinutes: 0,
	Quantity: -1,
	Specs: {
		cpu_cores: 0,
		disk_capacity: 0,
		gpus: [{ count, manufacturer: "AMD", model: "MI300X" }],
		ram_capacity: 0,
	},
}));

function description(offer: Offer) {
	const gpu = offer.Specs.gpus?.[0];
	if (!gpu || offer.Quantity < 0) {
		return " ";
	}
	const specs = `${offer.Specs.cpu_cores} cores, ${gb(offer.Specs.ram_capacity)}`;
	if (offer.metal) {
		return `Whole server: ${hbm(gpu)}${offer.Specs.cpu_cores ? `, ${specs}` : ""}`;
	}
	return `${hbm(gpu) || `${gpu.count} GPU${gpu.count > 1 ? "s" : ""}`}, ${specs}`;
}
function availability(quantity: number) {
	if (quantity < 0) {
		return " ";
	}
	if (!quantity) {
		return "None left";
	}
	return `${quantity} left`;
}
export function MachineOptions({
	sizes,
	selectedOffer,
	onChange,
	loading = false,
}: {
	sizes: Offer[];
	selectedOffer?: Offer;
	onChange: (order: Partial<Order>) => void;
	loading?: boolean;
}) {
	const group = useId();
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			sound.tick();
			const offer = sizes.find(
				(size) => offerKey(size) === event.currentTarget.value
			);
			if (offer) {
				onChange({
					count: offer.Specs.gpus?.[0]?.count,
					offer: offerKey(offer),
				});
			}
		},
		[onChange, sizes]
	);
	if (!loading && sizes.length === 0) {
		return null;
	}
	return (
		<fieldset className="options">
			<legend className="visually-hidden">Machine size</legend>
			{(loading ? PLACEHOLDER : sizes).map((offer) => {
				const gpu = offer.Specs.gpus?.[0];
				if (!gpu) {
					return null;
				}
				const key = offerKey(offer);
				const selected =
					selectedOffer !== undefined &&
					key === offerKey(selectedOffer) &&
					offer.Quantity >= 0;
				const unavailable = offer.Quantity <= 0;
				const id = `${group}-${encodeURIComponent(key)}`;
				const availabilityClass =
					offer.Quantity > 0 && offer.Quantity <= 2 ? "low" : "";
				return (
					<label
						className={`opt ${selected ? "on" : ""} ${unavailable ? "out" : ""}`}
						htmlFor={id}
						key={key}
					>
						<input
							aria-keyshortcuts={
								sizes.filter(
									(size) => size.Specs.gpus?.[0]?.count === gpu.count
								).length === 1
									? String(gpu.count)
									: undefined
							}
							checked={selected}
							className="visually-hidden"
							disabled={unavailable}
							id={id}
							name={group}
							onChange={change}
							type="radio"
							value={key}
						/>
						<span aria-hidden="true" className="opt-radio" />
						<span className="opt-main">
							<span className="opt-name">
								{gpu.count}× {gpu.model ?? "MI300X"}
							</span>
							<span className="opt-sub">{description(offer)}</span>
						</span>
						<span className="opt-end">
							<span className="opt-price">
								<b>
									{isPresent(offer.OnDemandPrice)
										? money(offer.OnDemandPrice)
										: "–"}
								</b>
								<span>/hr</span>
							</span>
							<span
								className={`opt-avail ${offer.Quantity === 0 ? "none" : availabilityClass}`}
							>
								{availability(offer.Quantity)}
							</span>
						</span>
					</label>
				);
			})}
		</fieldset>
	);
}
