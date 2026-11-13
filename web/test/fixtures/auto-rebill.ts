import type { AutoRebillStatus } from "../../src/lib/auto-rebill";

export const autoRebillStatus = (
	patch: Partial<AutoRebillStatus> = {}
): AutoRebillStatus => ({
	can_configure: true,
	can_disable: false,
	can_open_billing_portal: false,
	can_update_settings: false,
	cap_remaining_this_month_cents: 50_000,
	cap_reserved_this_month_cents: 0,
	cap_used_this_month_cents: 0,
	enabled: false,
	month_ends_at: "2026-12-01T00:00:00Z",
	month_starts_at: "2026-11-01T00:00:00Z",
	monthly_cap_cents: 50_000,
	rebill_amount_cents: 10_000,
	setup_pending: false,
	state: "disabled",
	threshold_cents: 5000,
	...patch,
});
