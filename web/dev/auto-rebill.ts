import type {
	AutoRebillSettings,
	AutoRebillStatus,
} from "../src/lib/auto-rebill";

/** Memory-only billing fixture. It never opens a real payment flow. */
export class PreviewAutoRebill {
	private enabled: boolean;
	private settings: AutoRebillSettings = {
		monthly_cap_cents: 50_000,
		rebill_amount_cents: 10_000,
		threshold_cents: 5000,
	};
	constructor(enabled: boolean) {
		this.enabled = enabled;
	}
	async request(request: Request, now: number) {
		if (request.method === "GET") {
			return Response.json(this.status(now));
		}
		if (request.method === "DELETE") {
			this.enabled = false;
			return new Response(null, { status: 204 });
		}
		if (request.method === "POST") {
			return Response.json(
				{
					message:
						"Stripe authorization is unavailable in the preview. No real payment request was made.",
				},
				{ status: 501 }
			);
		}
		if (request.method !== "PATCH") {
			return new Response(null, { status: 405 });
		}
		if (!this.enabled) {
			return Response.json(
				{ message: "Automatic rebill is not configured." },
				{ status: 409 }
			);
		}
		const settings = (await request.json()) as AutoRebillSettings;
		if (
			![
				settings.threshold_cents,
				settings.rebill_amount_cents,
				settings.monthly_cap_cents,
			].every(Number.isSafeInteger) ||
			settings.threshold_cents < 500 ||
			settings.rebill_amount_cents < 2500 ||
			settings.rebill_amount_cents > 99_999_999 ||
			settings.monthly_cap_cents < settings.rebill_amount_cents
		) {
			return Response.json(
				{ message: "Invalid automatic rebill settings." },
				{ status: 422 }
			);
		}
		this.settings = settings;
		return new Response(null, { status: 204 });
	}
	private status(now: number): AutoRebillStatus {
		const date = new Date(now);
		return {
			...this.settings,
			can_configure: true,
			can_disable: this.enabled,
			can_open_billing_portal: false,
			can_update_settings: this.enabled,
			cap_remaining_this_month_cents: Math.max(
				0,
				this.settings.monthly_cap_cents - 10_000
			),
			cap_reserved_this_month_cents: 0,
			cap_used_this_month_cents: 10_000,
			enabled: this.enabled,
			month_ends_at: new Date(
				Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
			).toISOString(),
			month_starts_at: new Date(
				Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
			).toISOString(),
			setup_pending: false,
			state: this.enabled ? "enabled" : "disabled",
			...(this.enabled
				? {
						payment_method: { display: "Visa ending 4242", type: "card" },
						source: {
							email: "preview@example.invalid",
							name: "Preview purchaser",
						},
					}
				: {}),
		};
	}
}
