import { revalidateLogic } from "@tanstack/react-form";
import { useRef } from "react";
import { Form } from "../../components/forms/form";
import { useAppForm } from "../../components/forms/use-app-form";
import type {
	AutoRebillSettings,
	AutoRebillValues,
} from "../../lib/auto-rebill";
import {
	dollarCents,
	formatDollarInput,
	rebillSettings,
	rebillValidation,
} from "../../lib/auto-rebill";
import type { TeamUsage } from "./autopay-usage";
import { AutopayUsage } from "./autopay-usage";
import { DollarField } from "./dollar-field";

export const AUTO_REBILL_WARNING =
	"Bank payments can take up to 4 business days to clear. Machines can still be deleted if your balance runs too low.";

const MIN_TOP_UP = 25;
const FIELDS = [
	{
		label: "Top up below ($)",
		name: "threshold",
	},
	{
		label: `Top-up amount ($${MIN_TOP_UP} min.)`,
		name: "amount",
	},
	{
		label: "Monthly cap ($)",
		name: "cap",
	},
] as const;
const submitting = (state: { isSubmitting: boolean }) => state.isSubmitting;
const formValues = (state: { values: AutoRebillValues }) => state.values;

export function AutoRebillForm({
	busy,
	settings,
	onSubmit,
	onCancel,
	usage,
}: {
	busy: boolean;
	onCancel: () => void;
	onSubmit: (settings: AutoRebillSettings) => Promise<void>;
	settings: AutoRebillSettings;
	usage?: TeamUsage;
}) {
	const amount = useRef<HTMLInputElement>(null);
	const cap = useRef<HTMLInputElement>(null);
	const threshold = useRef<HTMLInputElement>(null);
	const inputs = { amount, cap, threshold };
	const form = useAppForm({
		defaultValues: {
			amount: formatDollarInput(settings.rebill_amount_cents),
			cap: formatDollarInput(settings.monthly_cap_cents),
			threshold: formatDollarInput(settings.threshold_cents),
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
		validationLogic: revalidateLogic({ mode: "change" }),
		validators: { onDynamic: ({ value }) => rebillValidation(value) },
	});
	return (
		<Form
			aria-label="Edit autopay"
			className="stack rebill-form"
			noValidate
			onSubmit={form.handleSubmit}
		>
			{FIELDS.map(({ name, label }) => (
				<form.AppField key={name} name={name}>
					{() => <DollarField label={label} ref={inputs[name]} required />}
				</form.AppField>
			))}
			{usage && usage.hourly_rate > 0 ? (
				<form.Subscribe selector={formValues}>
					{({ amount: topUp, threshold: trigger }) => (
						<div className="autopay-estimates">
							<AutopayUsage
								cents={dollarCents(trigger)}
								kind="trigger"
								usage={usage}
							/>
							<AutopayUsage
								cents={dollarCents(topUp)}
								kind="interval"
								usage={usage}
							/>
						</div>
					)}
				</form.Subscribe>
			) : null}
			<p className="rebill-warning">{AUTO_REBILL_WARNING}</p>
			<div className="rebill-actions">
				<form.AppForm>
					<form.SubmitButton disabled={busy} pendingText="Saving…">
						Save settings
					</form.SubmitButton>
				</form.AppForm>
				<form.Subscribe selector={submitting}>
					{(pending) => (
						<button
							className="btn"
							disabled={busy || pending}
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
