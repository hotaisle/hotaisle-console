export interface AutoRebillSettings {
	monthly_cap_cents: number;
	rebill_amount_cents: number;
	threshold_cents: number;
}

export interface AutoRebillStatus extends AutoRebillSettings {
	can_configure: boolean;
	can_disable: boolean;
	can_open_billing_portal: boolean;
	can_update_settings: boolean;
	cap_remaining_this_month_cents: number;
	cap_reserved_this_month_cents: number;
	cap_used_this_month_cents: number;
	enabled: boolean;
	last_invoice?: {
		number: string;
		status: string;
		amount_paid_cents: number;
		created_at: string;
	};
	month_ends_at: string;
	month_starts_at: string;
	payment_method?: { type: string; display: string };
	problem?: { reason: string; recovery_action: string };
	setup_pending: boolean;
	source?: { name: string; email: string };
	state:
		| "disabled"
		| "enabled"
		| "payment_failed"
		| "payment_processing"
		| "capped";
}

export interface AutoRebillValues {
	amount: string;
	cap: string;
	threshold: string;
}

const DOLLARS = /^\d+(?:\.\d{1,2})?$/u;

/** Convert decimal dollars without rounding away fractional cents or accepting exponents. */
export function dollarCents(value: string) {
	if (!DOLLARS.test(value)) {
		return;
	}
	const [whole, fraction = ""] = value.split(".");
	const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
	return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : undefined;
}

export function rebillValidation(value: AutoRebillValues) {
	const threshold = dollarCents(value.threshold);
	const amount = dollarCents(value.amount);
	const cap = dollarCents(value.cap);
	const fields: Partial<Record<keyof AutoRebillValues, string>> = {};
	if (threshold === undefined || threshold < 500) {
		fields.threshold =
			"Enter a balance trigger of at least $5, with no more than two decimal places.";
	}
	if (amount === undefined || amount < 2500 || amount > 99_999_999) {
		fields.amount = "Enter a top-up amount from $25 to $999,999.99.";
	}
	if (cap === undefined || (amount !== undefined && cap < amount)) {
		fields.cap = "Enter a monthly cap that covers at least one top-up.";
	}
	return Object.keys(fields).length ? { fields } : undefined;
}

export function rebillSettings(value: AutoRebillValues): AutoRebillSettings {
	const threshold_cents = dollarCents(value.threshold);
	const rebill_amount_cents = dollarCents(value.amount);
	const monthly_cap_cents = dollarCents(value.cap);
	if (
		rebillValidation(value) ||
		threshold_cents === undefined ||
		rebill_amount_cents === undefined ||
		monthly_cap_cents === undefined
	) {
		throw new Error("Enter valid automatic rebill settings.");
	}
	return { monthly_cap_cents, rebill_amount_cents, threshold_cents };
}
