import type { VM } from "../../lib/api";

export function reservationStart(vm: VM): number | undefined {
	const started = vm.reservation?.started_at;
	const value = started ? Date.parse(started) : Number.NaN;
	return Number.isFinite(value) ? value : undefined;
}

export function reservationReadings(vm: VM, now: number) {
	const launched = reservationStart(vm);
	const price = vm.reservation?.hourly_rate_cents ?? undefined;
	const minimumMin = vm.reservation?.minimum_reservation_minutes ?? undefined;
	const ranMs =
		launched === undefined ? undefined : Math.max(0, now - launched);
	const underMin =
		ranMs !== undefined &&
		minimumMin !== undefined &&
		ranMs < minimumMin * 60_000;
	const cost =
		ranMs !== undefined && price !== undefined && minimumMin !== undefined
			? (Math.max(ranMs, minimumMin * 60_000) * price) / 3_600_000
			: undefined;
	return { cost, launched, minimumMin, price, ranMs, underMin };
}
