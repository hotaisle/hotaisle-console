export interface AutoRebillSettings {
	monthly_cap_cents: number;
	rebill_amount_cents: number;
	threshold_cents: number;
}

export interface AutoRebillStatus extends AutoRebillSettings {
	can_configure: boolean;
	can_disable: boolean;
	can_open_billing_portal: boolean;
	can_resume_setup?: boolean;
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
	pending_settings?: AutoRebillSettings;
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

const DOLLARS = /^\d+(?:\.\d{0,2})?$/u;

export function acceptsDollarInput(value: string) {
	return value === "" || DOLLARS.test(value);
}

/** Convert decimal dollars without rounding away fractional cents or accepting exponents. */
export function dollarCents(value: string) {
	if (!DOLLARS.test(value)) {
		return;
	}
	const [whole, fraction = ""] = value.split(".");
	const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
	return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : undefined;
}

export function formatDollarInput(cents: number) {
	return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function creditPurchaseError(value: string): string | undefined {
	const cents = dollarCents(value.trim());
	return creditAmountError(cents, 20);
}

function creditAmountError(cents: number | undefined, minimum: number) {
	if (cents === undefined || cents < minimum * 100) {
		return `Minimum $${minimum}.`;
	}
	if (cents > 99_999_999) {
		return "Maximum $999,999.99.";
	}
}

export function rebillValidation(value: AutoRebillValues) {
	const threshold = dollarCents(value.threshold);
	const amount = dollarCents(value.amount);
	const cap = dollarCents(value.cap);
	const fields: Partial<Record<keyof AutoRebillValues, string>> = {};
	if (threshold === undefined || threshold < 500) {
		fields.threshold = "Minimum $5.";
	}
	const amountError = creditAmountError(amount, 25);
	if (amountError) {
		fields.amount = amountError;
	}
	if (cap === undefined) {
		fields.cap = "Enter a cap.";
	} else if (amount !== undefined && cap < amount) {
		fields.cap = "Must cover one top-up.";
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
