import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useId } from "react";
import { Form } from "../../components/forms/form";
import { useAppForm } from "../../components/forms/use-app-form";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import { AutoRebill } from "./auto-rebill";
import { checkoutURL, prepareCheckoutWindow } from "./checkout-window";

const AMOUNTS = [50, 100, 250, 500];
const amounts = (state: { values: { amount: number; custom: string } }) =>
	state.values;

export function CreditsView(props: {
	team: string;
	gpuHour: number;
	onDone: () => void;
}) {
	return (
		<div className="credits-view">
			<section aria-label="One-time credits">
				<OneTimeCredits {...props} />
			</section>
			<AutoRebill key={props.team} team={props.team} />
		</div>
	);
}

function OneTimeCredits({
	team,
	gpuHour,
	onDone,
}: {
	team: string;
	gpuHour: number;
	onDone: () => void;
}) {
	const group = useId();
	const checkout = useMutation({
		mutationFn: async (dollars: number) => {
			const session = await api.buyCredits(team, Math.round(dollars * 100));
			return { ...session, checkout_url: checkoutURL(session.checkout_url) };
		},
	});
	const form = useAppForm({
		defaultValues: { amount: 100, custom: "" },
		onSubmit: async ({ value }) => {
			const dollars = value.custom ? Number(value.custom) : value.amount;
			if (!Number.isFinite(dollars) || dollars < 20 || dollars > 999_999) {
				return;
			}
			const tab = prepareCheckoutWindow();
			try {
				const result = await checkout.mutateAsync(dollars);
				if (tab && !tab.closed) {
					tab.location.replace(result.checkout_url);
				}
			} catch {
				tab?.close();
				// The checkout error remains visible in the form.
			}
		},
	});
	const select = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			form.setFieldValue("amount", Number(event.currentTarget.value));
			form.setFieldValue("custom", "");
		},
		[form]
	);
	const change = useCallback(
		(event: ChangeEvent<HTMLInputElement>) =>
			form.setFieldValue("custom", event.currentTarget.value),
		[form]
	);
	if (checkout.isSuccess) {
		return (
			<div className="stack">
				<p>
					Complete your payment in the Stripe tab. If it didn't open, use the
					button below. Your balance updates automatically after payment is
					confirmed.
				</p>
				<a
					className="btn primary big"
					href={checkout.data.checkout_url}
					rel="noopener noreferrer"
					target="_blank"
				>
					Open checkout
				</a>
				<p className="small muted">Opens in a new tab.</p>
				<button className="btn" onClick={onDone} type="button">
					Done
				</button>
			</div>
		);
	}
	return (
		<form.Subscribe selector={amounts}>
			{({ amount, custom }) => {
				const dollars = custom ? Number(custom) : amount;
				return (
					<Form className="stack" onSubmit={form.handleSubmit}>
						<fieldset className="amounts">
							<legend className="visually-hidden">Amount</legend>
							{AMOUNTS.map((value) => (
								<label
									className={!custom && amount === value ? "on" : ""}
									htmlFor={`${group}-${value}`}
									key={value}
								>
									<input
										checked={!custom && amount === value}
										className="visually-hidden"
										id={`${group}-${value}`}
										name={group}
										onChange={select}
										type="radio"
										value={value}
									/>
									<b>${value}</b>
									<span>
										{Number.isFinite(gpuHour) && gpuHour > 0
											? `about ${Math.floor((value * 100) / gpuHour)} GPU hours`
											: " "}
									</span>
								</label>
							))}
						</fieldset>
						<label className="field" htmlFor={`${group}-custom`}>
							<span className="field-l">Other</span>
							<span className="dollar">
								<span aria-hidden="true">$</span>
								<input
									id={`${group}-custom`}
									inputMode="decimal"
									max={999_999}
									min={20}
									name="custom"
									onChange={change}
									placeholder="20 or more"
									step="0.01"
									type="number"
									value={custom}
								/>
							</span>
						</label>
						<p className="muted small">
							The minimum is $20. You pay on Stripe's page; this app never sees
							your card.
						</p>
						{!!checkout.isError && (
							<p role="alert">
								Couldn't open checkout. {checkout.error.message}
							</p>
						)}
						<div className="foot">
							<form.AppForm>
								<form.SubmitButton
									className="btn primary big"
									pendingText="Preparing checkout…"
								>
									{`Continue to checkout, ${money(dollars * 100, 0)}`}
								</form.SubmitButton>
							</form.AppForm>
						</div>
					</Form>
				);
			}}
		</form.Subscribe>
	);
}
