import { revalidateLogic } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Form } from "../../components/forms/form";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { api } from "../../lib/api";
import type { AutoRebillSettings } from "../../lib/auto-rebill";
import {
	creditPurchaseError,
	dollarCents,
	formatDollarInput,
	rebillSettings,
	rebillValidation,
} from "../../lib/auto-rebill";
import { money } from "../../lib/format";
import { AutoRebillCard, canConfigureInCheckout } from "./auto-rebill";
import { AUTO_REBILL_WARNING } from "./auto-rebill-form";
import { checkoutURL, prepareCheckoutWindow } from "./checkout-window";
import { DollarField } from "./dollar-field";
import type { PanelBack } from "./panel-page";
import { PanelPage } from "./panel-page";
import { useAutoRebill } from "./use-auto-rebill";

const AMOUNTS = [50, 100, 250, 500];
const AUTOPAY_FIELDS = [
	{
		label: "Top up below ($)",
		name: "threshold",
	},
	{
		label: "Monthly cap ($)",
		name: "cap",
	},
] as const;
interface CheckoutValues {
	amount: number;
	cap: string;
	custom: string;
	threshold: string;
}
const formValues = (state: { values: CheckoutValues }) => state.values;

interface CreditsViewProps {
	back: PanelBack;
	balanceCents?: number;
	editingAutopay?: boolean;
	notice?: ReactNode;
	onDone: () => void;
	team: string;
	waitingForCapacity: boolean;
}

export function CreditsView(props: CreditsViewProps) {
	return <CreditsContent key={props.team} {...props} />;
}

function CreditsContent({
	back,
	balanceCents,
	editingAutopay = false,
	notice,
	onDone,
	team,
	waitingForCapacity,
}: CreditsViewProps) {
	const rebill = useAutoRebill(team);
	const [wantAutopay, setWantAutopay] = useState(false);
	const checkout = useMutation({
		mutationFn: async (cents: number) => {
			const session = await api.buyCredits(team, cents);
			return { ...session, checkout_url: checkoutURL(session.checkout_url) };
		},
	});

	const { data } = rebill.status;
	const showSetupCheckout = Boolean(
		rebill.change.data?.kind === "setup" && !rebill.setupConfirmed
	);
	const canEnableHere = canConfigureInCheckout(data, showSetupCheckout);
	const autopayActive = canEnableHere && wantAutopay;
	const panelBack = editingAutopay
		? {
				...back,
				disabled: rebill.change.isPending,
			}
		: back;
	const { isError, reset, variables } = rebill.change;
	useEffect(() => {
		if (!editingAutopay && isError && variables?.kind === "update") {
			reset();
		}
	}, [editingAutopay, isError, reset, variables]);

	const toggleAutopay = useCallback(
		(next: boolean) => {
			checkout.reset();
			rebill.change.reset();
			setWantAutopay(next);
		},
		[checkout, rebill.change]
	);

	const buyCredits = useCallback(
		async (cents: number) => {
			const tab = prepareCheckoutWindow();
			try {
				const result = await checkout.mutateAsync(cents);
				if (tab && !tab.closed) {
					tab.location.replace(result.checkout_url);
				}
			} catch {
				tab?.close();
				// The checkout error remains visible in the form.
			}
		},
		[checkout]
	);

	const startAutopaySetup = useCallback(
		async (settings: AutoRebillSettings) => {
			const ok = await rebill.startSetup(settings);
			if (ok) {
				setWantAutopay(false);
			}
		},
		[rebill]
	);

	const balance =
		balanceCents === undefined ? undefined : (
			<p className="credits-balance">
				Balance <strong>{money(balanceCents)}</strong>
			</p>
		);

	if (checkout.isSuccess && !editingAutopay) {
		return (
			<PanelPage
				back={back}
				notice={notice}
				title="Add credits"
				titleAside={balance}
			>
				<div className="credits-view">
					<div className="stack">
						<p role="status">
							Finish payment on Stripe. Your balance updates once payment
							clears.
						</p>
						<a
							className="btn primary"
							href={checkout.data.checkout_url}
							rel="noopener noreferrer"
							target="_blank"
						>
							Open Stripe checkout
						</a>
						<button className="btn" onClick={onDone} type="button">
							Done
						</button>
					</div>
				</div>
			</PanelPage>
		);
	}

	return (
		<PanelPage
			back={panelBack}
			notice={notice}
			title={editingAutopay ? "Autopay settings" : "Add credits"}
			titleAside={editingAutopay ? undefined : balance}
		>
			<div className="credits-view">
				<div className="autopay-slot" data-checking={rebill.status.isPending}>
					<AutoRebillCard
						autopayEnabled={autopayActive}
						controls={rebill}
						onCloseEditor={editingAutopay ? back.onClick : undefined}
						onDone={onDone}
						onToggleAutopay={toggleAutopay}
						team={team}
					/>
				</div>
				{showSetupCheckout || editingAutopay ? null : (
					<section
						aria-label={autopayActive ? "Autopay checkout" : "One-time credits"}
					>
						<CreditsCheckoutForm
							autopayActive={autopayActive}
							checkoutError={
								checkout.isError
									? `Couldn't open checkout. ${checkout.error.message}`
									: undefined
							}
							onBuyCredits={buyCredits}
							onStartAutopaySetup={startAutopaySetup}
							previousSettings={rebill.previousSettings}
							waitingForCapacity={waitingForCapacity}
						/>
					</section>
				)}
			</div>
		</PanelPage>
	);
}

function CreditsCheckoutForm({
	autopayActive,
	checkoutError,
	onBuyCredits,
	onStartAutopaySetup,
	previousSettings,
	waitingForCapacity,
}: {
	autopayActive: boolean;
	checkoutError?: string;
	onBuyCredits: (cents: number) => Promise<void>;
	onStartAutopaySetup: (settings: AutoRebillSettings) => Promise<void>;
	previousSettings?: AutoRebillSettings;
	waitingForCapacity: boolean;
}) {
	const group = useId();
	const autopayRef = useRef(autopayActive);
	autopayRef.current = autopayActive;

	const customInput = useRef<HTMLInputElement>(null);
	const thresholdInput = useRef<HTMLInputElement>(null);
	const capInput = useRef<HTMLInputElement>(null);
	const inputs = {
		cap: capInput,
		custom: customInput,
		threshold: thresholdInput,
	};

	const form = useAppForm({
		defaultValues: {
			amount: 100,
			cap: "500",
			custom: "",
			threshold: "50",
		},
		onSubmit: async ({ value }) => {
			const effective = value.custom.trim() || String(value.amount);
			if (!autopayRef.current) {
				const cents = dollarCents(effective);
				if (cents === undefined) {
					return;
				}
				await onBuyCredits(cents);
				return;
			}
			await onStartAutopaySetup(
				rebillSettings({
					amount: effective,
					cap: value.cap.trim(),
					threshold: value.threshold.trim(),
				})
			);
		},
		onSubmitInvalid: ({ formApi }) => {
			const invalid = (["custom", "threshold", "cap"] as const).find(
				(name) => formApi.getFieldMeta(name)?.errors.length
			);
			if (invalid) {
				inputs[invalid].current?.focus();
			}
		},
		validationLogic: revalidateLogic({ mode: "change" }),
		validators: {
			onDynamic: ({ value }) => {
				const effective = value.custom.trim() || String(value.amount);
				if (!autopayRef.current) {
					const error = creditPurchaseError(effective);
					return error ? { fields: { custom: error } } : undefined;
				}
				const result = rebillValidation({
					amount: effective,
					cap: value.cap.trim(),
					threshold: value.threshold.trim(),
				});
				if (!result) {
					return;
				}
				const fields: Partial<Record<"cap" | "custom" | "threshold", string>> =
					{};
				if (result.fields.amount) {
					fields.custom = result.fields.amount;
				}
				if (result.fields.threshold) {
					fields.threshold = result.fields.threshold;
				}
				if (result.fields.cap) {
					fields.cap = result.fields.cap;
				}
				return { fields };
			},
		},
	});

	const previousSettingsRef = useRef(previousSettings);
	previousSettingsRef.current = previousSettings;
	const oneTimeValues = useRef<CheckoutValues | undefined>(undefined);

	useEffect(() => {
		if (!autopayActive && oneTimeValues.current) {
			form.reset(oneTimeValues.current);
			oneTimeValues.current = undefined;
			return;
		}
		const saved = previousSettingsRef.current;
		if (autopayActive && saved && !oneTimeValues.current) {
			const current = form.state.values;
			const amount = saved.rebill_amount_cents / 100;
			const isPreset = AMOUNTS.includes(amount);
			oneTimeValues.current = current;
			form.reset({
				amount: isPreset ? amount : current.amount,
				cap: formatDollarInput(saved.monthly_cap_cents),
				custom: isPreset ? "" : formatDollarInput(saved.rebill_amount_cents),
				threshold: formatDollarInput(saved.threshold_cents),
			});
			return;
		}
		for (const name of ["custom", "threshold", "cap"] as const) {
			form.setFieldMeta(name, (previous) => ({
				...previous,
				errorMap: {},
				errors: [],
			}));
		}
		if (!autopayActive) {
			return;
		}
		if (!form.getFieldMeta("cap")?.isDirty) {
			const current = form.state.values;
			const selectedCents =
				dollarCents(current.custom.trim() || String(current.amount)) ?? 0;
			form.setFieldValue(
				"cap",
				formatDollarInput(Math.max(50_000, selectedCents))
			);
		}
	}, [autopayActive, form]);

	const select = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			form.setFieldValue("amount", Number(event.currentTarget.value));
			form.setFieldValue("custom", "");
		},
		[form]
	);

	return (
		<form.Subscribe selector={formValues}>
			{({ amount, custom }) => {
				const effective = custom.trim() || String(amount);
				const cents = dollarCents(effective);
				const copy = checkoutCopy(autopayActive, cents);
				return (
					<Form className="stack" noValidate onSubmit={form.handleSubmit}>
						<fieldset className="credits-amount">
							<legend>
								{autopayActive ? "Autopay amount" : "Top-up amount"}
							</legend>
							<AmountChoices
								amount={amount}
								custom={custom}
								group={group}
								onSelect={select}
							/>
							<form.AppField name="custom">
								{() => (
									<DollarField
										label={`Custom amount ($${copy.min} min.)`}
										ref={customInput}
									/>
								)}
							</form.AppField>
						</fieldset>
						{autopayActive ? (
							<div className="autopay-fields">
								{AUTOPAY_FIELDS.map(({ name, label }) => (
									<form.AppField key={name} name={name}>
										{() => (
											<DollarField label={label} ref={inputs[name]} required />
										)}
									</form.AppField>
								))}
							</div>
						) : null}
						<p
							className="credits-disclosure"
							role={waitingForCapacity ? "status" : undefined}
						>
							{waitingForCapacity ? (
								<>
									<strong>No compute is available now.</strong>{" "}
								</>
							) : null}
							{`${AUTO_REBILL_WARNING} `}
							Friendly reminder, credits don't reserve a machine.
						</p>
						{checkoutError ? <FormError message={checkoutError} /> : null}
						<form.AppForm>
							<form.SubmitButton pendingText={copy.pending}>
								{copy.submit}
							</form.SubmitButton>
						</form.AppForm>
					</Form>
				);
			}}
		</form.Subscribe>
	);
}

function checkoutCopy(autopayActive: boolean, cents: number | undefined) {
	if (autopayActive) {
		return {
			min: 25,
			pending: "Preparing Stripe setup…",
			submit: "Set up autopay on Stripe",
		};
	}
	const submit =
		cents !== undefined && cents > 0
			? `Continue to Stripe · ${money(cents, cents % 100 === 0 ? 0 : 2)}`
			: "Continue to Stripe";
	return {
		min: 20,
		pending: "Preparing checkout…",
		submit,
	};
}

function AmountChoices({
	amount,
	custom,
	group,
	onSelect,
}: {
	amount: number;
	custom: string;
	group: string;
	onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
	return (
		<div className="credits-presets">
			{AMOUNTS.map((value) => (
				<label key={value}>
					<input
						checked={!custom && amount === value}
						className="visually-hidden"
						name={group}
						onChange={onSelect}
						type="radio"
						value={value}
					/>
					{`$${value}`}
				</label>
			))}
		</div>
	);
}
