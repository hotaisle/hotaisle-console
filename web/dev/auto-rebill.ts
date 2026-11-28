import type {
	AutoRebillSettings,
	AutoRebillStatus,
} from "../src/lib/auto-rebill";
import type { PreviewRebillState } from "./scenarios";

/** Memory-only billing fixture. It never opens a real payment flow. */
export class PreviewAutoRebill {
	private enabled: boolean;
	private state: Exclude<PreviewRebillState, "capped">;
	private readonly used: number;
	private readonly reserved: number;
	private settings: AutoRebillSettings = {
		monthly_cap_cents: 50_000,
		rebill_amount_cents: 10_000,
		threshold_cents: 5000,
	};
	constructor(state: PreviewRebillState) {
		this.state = state === "capped" ? "enabled" : state;
		this.enabled =
			state !== "disabled" &&
			state !== "setup_pending" &&
			state !== "failed_top_up";
		this.used = this.enabled || state === "failed_top_up" ? 10_000 : 0;
		if (state === "capped") {
			this.used = this.settings.monthly_cap_cents;
		}
		this.reserved =
			state === "payment_processing" ? this.settings.rebill_amount_cents : 0;
	}
	async request(request: Request, now: number) {
		if (request.method === "GET") {
			return Response.json(this.status(now));
		}
		if (request.method === "DELETE") {
			this.enabled = false;
			if (
				this.state !== "payment_processing" &&
				this.state !== "failed_top_up"
			) {
				this.state = "disabled";
			}
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
		const previewState = this.state;
		const setupPending = previewState === "setup_pending";
		const failedTopUp = previewState === "failed_top_up";
		const settings =
			this.enabled || this.reserved > 0
				? this.settings
				: { monthly_cap_cents: 0, rebill_amount_cents: 0, threshold_cents: 0 };
		const remaining = Math.max(
			0,
			settings.monthly_cap_cents - this.used - this.reserved
		);
		let state: AutoRebillStatus["state"] =
			setupPending || failedTopUp ? "disabled" : previewState;
		if (state === "enabled" && remaining < this.settings.rebill_amount_cents) {
			state = "capped";
		}
		return {
			...settings,
			can_configure: true,
			can_disable: this.enabled || setupPending,
			can_open_billing_portal: false,
			can_resume_setup: setupPending,
			can_update_settings: this.enabled,
			cap_remaining_this_month_cents: remaining,
			cap_reserved_this_month_cents: this.reserved,
			cap_used_this_month_cents: this.used,
			enabled: this.enabled,
			month_ends_at: new Date(
				Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
			).toISOString(),
			month_starts_at: new Date(
				Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
			).toISOString(),
			setup_pending: setupPending,
			state,
			...(setupPending ? { pending_settings: this.settings } : {}),
			...(failedTopUp
				? {
						problem: {
							reason:
								"The automatic payment failed and will not be retried automatically. Automatic rebilling is now unconfigured.",
							recovery_action:
								"Configure automatic rebilling again through Stripe Checkout or purchase credits manually before the balance is exhausted.",
						},
					}
				: {}),
			...(this.enabled || this.reserved > 0
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
