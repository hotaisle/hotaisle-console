export interface GPU {
	count: number;
	manufacturer?: string;
	model?: string;
}

export interface AvailabilitySnapshot {
	checkedAt: string;
	offers: Offer[];
	team: string;
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
const nonnegative = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && value >= 0;

export function isOffer(value: unknown): value is Offer {
	if (!(record(value) && record(value.Specs))) {
		return false;
	}
	const specs = value.Specs;
	return (
		nonnegative(value.Quantity) &&
		Number.isInteger(value.Quantity) &&
		nonnegative(value.MinimumReservationMinutes) &&
		(value.OnDemandPrice === undefined || nonnegative(value.OnDemandPrice)) &&
		nonnegative(specs.cpu_cores) &&
		nonnegative(specs.disk_capacity) &&
		nonnegative(specs.ram_capacity) &&
		(specs.gpus === undefined ||
			(Array.isArray(specs.gpus) &&
				specs.gpus.every(
					(gpu) =>
						record(gpu) &&
						nonnegative(gpu.count) &&
						Number.isInteger(gpu.count) &&
						(gpu.model === undefined || typeof gpu.model === "string") &&
						(gpu.manufacturer === undefined ||
							typeof gpu.manufacturer === "string")
				)))
	);
}

export function isSnapshot(value: unknown): value is AvailabilitySnapshot {
	return (
		record(value) &&
		typeof value.team === "string" &&
		typeof value.checkedAt === "string" &&
		Number.isFinite(Date.parse(value.checkedAt)) &&
		Array.isArray(value.offers) &&
		value.offers.every(isOffer)
	);
}

/** Upstream responses are validated before publishing prices to other clients. */
export function catalog(virtualMachines: unknown, bareMetal: unknown): Offer[] {
	const vms: unknown = virtualMachines ?? [];
	const metal: unknown = bareMetal ?? [];
	if (!(Array.isArray(vms) && Array.isArray(metal))) {
		throw new Error("The API returned an invalid availability catalog.");
	}
	const offers = [
		...vms,
		...metal.map((item: unknown) => {
			if (!(record(item) && record(item.Specs))) {
				throw new Error("The API returned invalid bare-metal specifications.");
			}
			return {
				...item,
				metal: true,
				rawSpecs: item.Specs,
				Specs: specsOf(item.Specs as MetalSpecs),
			};
		}),
	];
	if (!offers.every(isOffer)) {
		throw new Error(
			"The API returned invalid machine specifications or prices."
		);
	}
	return offers;
}
export interface Specs {
	cpu_cores: number;
	cpus?: {
		count?: number;
		manufacturer?: string;
		model?: string;
		cores?: number;
		frequency?: number;
	};
	disk_capacity: number;
	gpus?: GPU[];
	ram_capacity: number;
}

/** Fallback matching HotManager's resource rules; prefer the API offer's minimum. */
export function minimumReservationMinutes(
	specs: Pick<Specs, "gpus">,
	metal = false
) {
	if (metal) {
		return 480;
	}
	const count = specs.gpus?.reduce((sum, gpu) => sum + gpu.count, 0) ?? 1;
	return count <= 1 ? 1 : count * 30;
}
export interface Offer {
	MinimumReservationMinutes: number;
	/** A whole server, reserved as bare metal, rather than a virtual machine. */
	metal?: boolean;
	OnDemandPrice?: number; // US cents per hour
	Quantity: number;
	/** Bare metal is reserved by its full spec, as the API listed it. */
	rawSpecs?: unknown;
	Specs: Specs;
}
export interface MetalSpecs {
	cpu_cores?: number;
	cpus?: {
		count?: number;
		manufacturer?: string;
		model?: string;
		cores?: number;
		frequency?: number;
	}[];
	disk_capacity?: number;
	gpus?: GPU[];
	ram_capacity?: number;
}
export function specsOf(s: MetalSpecs = {}): Specs {
	const c = s.cpus ?? [];
	const sockets = c.reduce((n, x) => n + (x.count ?? 1), 0);
	return {
		cpu_cores: s.cpu_cores ?? 0,
		cpus: c.length
			? {
					cores: c[0].cores,
					count: sockets || c.length,
					frequency: c[0].frequency,
					manufacturer: c[0].manufacturer,
					model: c[0].model,
				}
			: undefined,
		disk_capacity: s.disk_capacity ?? 0,
		gpus: s.gpus?.length
			? s.gpus
			: [{ count: 8, manufacturer: "AMD", model: "MI300X" }],
		ram_capacity: s.ram_capacity ?? 0,
	};
}
