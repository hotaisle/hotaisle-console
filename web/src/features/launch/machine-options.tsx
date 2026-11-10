import { type ChangeEvent, useCallback, useId } from "react";
import { isPresent } from "../../../../shared/present";
import type { Offer } from "../../lib/api";
import { gb, hbm, money } from "../../lib/format";
import { sound } from "../../lib/sound";
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
	count,
	onChange,
	loading = false,
}: {
	sizes: Offer[];
	count: number;
	onChange: (order: Partial<Order>) => void;
	loading?: boolean;
}) {
	const group = useId();
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			sound.tick();
			onChange({ count: Number(event.currentTarget.value) });
		},
		[onChange]
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
				const selected = gpu.count === count && offer.Quantity >= 0;
				const unavailable = offer.Quantity <= 0;
				const id = `${group}-${gpu.count}`;
				const availabilityClass =
					offer.Quantity > 0 && offer.Quantity <= 2 ? "low" : "";
				return (
					<label
						className={`opt ${selected ? "on" : ""} ${unavailable ? "out" : ""}`}
						htmlFor={id}
						key={gpu.count}
					>
						<input
							aria-keyshortcuts={String(gpu.count)}
							checked={selected}
							className="visually-hidden"
							disabled={unavailable}
							id={id}
							name={group}
							onChange={change}
							type="radio"
							value={gpu.count}
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
