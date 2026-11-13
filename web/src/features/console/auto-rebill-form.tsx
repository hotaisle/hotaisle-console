import { useRef } from "react";
import { Form } from "../../components/forms/form";
import { useAppForm } from "../../components/forms/use-app-form";
import {
	type AutoRebillSettings,
	rebillSettings,
	rebillValidation,
} from "../../lib/auto-rebill";

const FIELDS = [
	{
		help: "Top up when the team's balance falls below this amount. Minimum $5.",
		label: "Balance trigger (USD)",
		min: 5,
		name: "threshold",
	},
	{
		help: "Amount to add each time. Minimum $25.",
		label: "Top-up amount (USD)",
		min: 25,
		name: "amount",
	},
	{
		help: "Maximum automatic top-ups per UTC calendar month. Must cover at least one top-up.",
		label: "Monthly cap (USD)",
		min: 25,
		name: "cap",
	},
] as const;
const submitting = (state: { isSubmitting: boolean }) => state.isSubmitting;

export function AutoRebillForm({
	settings,
	onSubmit,
	onCancel,
	setup,
}: {
	settings?: AutoRebillSettings;
	onSubmit: (settings: AutoRebillSettings) => Promise<void>;
	onCancel: () => void;
	setup: boolean;
}) {
	const amount = useRef<HTMLInputElement>(null);
	const cap = useRef<HTMLInputElement>(null);
	const threshold = useRef<HTMLInputElement>(null);
	const inputs = { amount, cap, threshold };
	const form = useAppForm({
		defaultValues: {
			amount: settings?.rebill_amount_cents
				? (settings.rebill_amount_cents / 100).toFixed(2)
				: "100",
			cap: settings?.monthly_cap_cents
				? (settings.monthly_cap_cents / 100).toFixed(2)
				: "500",
			threshold: settings?.threshold_cents
				? (settings.threshold_cents / 100).toFixed(2)
				: "50",
		},
		onSubmit: async ({ value }) => await onSubmit(rebillSettings(value)),
		onSubmitInvalid: ({ formApi }) => {
			const invalid = FIELDS.find(
				({ name }) => formApi.getFieldMeta(name)?.errors.length
			);
			if (invalid) {
				inputs[invalid.name].current?.focus();
			}
		},
		validators: { onSubmit: ({ value }) => rebillValidation(value) },
	});
	return (
		<Form
			aria-label={setup ? "Set up automatic rebill" : "Edit automatic rebill"}
			className="stack rebill-form"
			onSubmit={form.handleSubmit}
		>
			{FIELDS.map(({ name, label, help, min }) => (
				<form.AppField key={name} name={name}>
					{(field) => (
						<field.TextField
							className="note-in"
							help={help}
							inputMode="decimal"
							label={label}
							max={name === "amount" ? 999_999.99 : undefined}
							min={min}
							ref={inputs[name]}
							required
							step="0.01"
							type="number"
						/>
					)}
				</form.AppField>
			))}
			<p className="small rebill-warning">
				Credits are added only after payment succeeds. Bank payments may take up
				to four business days. Auto-rebill does not prevent machine deletion if
				your balance reaches its minimum; leave enough credit for payment to
				clear.
			</p>
			<div className="rebill-actions">
				<form.AppForm>
					<form.SubmitButton
						pendingText={setup ? "Preparing Stripe setup…" : "Saving…"}
					>
						{setup ? "Continue to Stripe" : "Save rebill settings"}
					</form.SubmitButton>
				</form.AppForm>
				<form.Subscribe selector={submitting}>
					{(pending) => (
						<button
							className="btn"
							disabled={pending}
							onClick={onCancel}
							type="button"
						>
							Cancel
						</button>
					)}
				</form.Subscribe>
			</div>
		</Form>
	);
}
