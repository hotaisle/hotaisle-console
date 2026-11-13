import { type SyntheticEvent, useCallback, useState } from "react";
import { FormError } from "../../components/forms/form-error";
import type { AutoRebillStatus } from "../../lib/auto-rebill";
import { money } from "../../lib/format";
import { AutoRebillForm } from "./auto-rebill-form";
import { useAutoRebill } from "./use-auto-rebill";
import "./auto-rebill.css";

const STATES = {
	capped: "Monthly cap reached",
	disabled: "Off",
	enabled: "On",
	payment_failed: "Payment needs attention",
	payment_processing: "Payment processing",
};
type Controls = ReturnType<typeof useAutoRebill>;

export function AutoRebill({ team }: { team: string }) {
	const [open, setOpen] = useState(false);
	const toggle = useCallback(
		(event: SyntheticEvent<HTMLDetailsElement>) =>
			setOpen(event.currentTarget.open),
		[]
	);
	return (
		<details className="auto-rebill" onToggle={toggle}>
			<summary>
				<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
					<path
						d="m4 6 4 4 4-4"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
				</svg>
				<span className="rebill-introduction">
					<strong>Automatic rebill</strong>
					<span>Keep your team funded with automatic top-ups.</span>
					<span className="rebill-entry-action">
						{open ? "Close options" : "Click to view options"}
					</span>
				</span>
			</summary>
			{open ? <AutoRebillControls key={team} team={team} /> : null}
		</details>
	);
}

function AutoRebillControls({ team }: { team: string }) {
	const controls = useAutoRebill(team);
	const { status, change } = controls;
	const { data } = status;
	if (!data) {
		return status.isError ? (
			<FormError
				actions={
					<button className="btn" onClick={controls.refresh} type="button">
						Try again
					</button>
				}
				message={`Couldn't load automatic rebill. ${status.error.message}`}
			/>
		) : (
			<p className="muted small" role="status">
				Loading automatic rebill…
			</p>
		);
	}
	return (
		<div className="stack rebill-controls">
			<RebillSummary data={data} />
			{status.isError ? (
				<FormError
					message={`Couldn't refresh automatic rebill. The status above may be out of date. ${status.error.message}`}
				/>
			) : null}
			<RebillActions controls={controls} data={data} />
			<FormError message={change.error?.message} />
			{change.isSuccess && change.data.kind !== "setup" ? (
				<p role="status">
					{change.data.kind === "disable"
						? "Automatic rebill turned off. Any payment already processing can still complete."
						: "Automatic rebill settings saved."}
				</p>
			) : null}
		</div>
	);
}

function RebillSummary({ data }: { data: AutoRebillStatus }) {
	return (
		<>
			<div className="rebill-status">
				<strong>
					{data.setup_pending ? "Setup pending" : STATES[data.state]}
				</strong>
				{data.payment_method ? (
					<span className="small muted">{data.payment_method.display}</span>
				) : null}
			</div>
			{data.source ? (
				<p className="small muted">
					Authorized by {data.source.name || data.source.email}.
				</p>
			) : null}
			{data.rebill_amount_cents > 0 ? (
				<>
					<dl className="rebill-summary">
						<dt>Balance trigger</dt>
						<dd>{money(data.threshold_cents)}</dd>
						<dt>Top-up amount</dt>
						<dd>{money(data.rebill_amount_cents)}</dd>
						<dt>Monthly cap</dt>
						<dd>{money(data.monthly_cap_cents)}</dd>
						<dt>Used this month</dt>
						<dd>{money(data.cap_used_this_month_cents)}</dd>
						{data.cap_reserved_this_month_cents > 0 ? (
							<>
								<dt>Pending payment</dt>
								<dd>{money(data.cap_reserved_this_month_cents)}</dd>
							</>
						) : null}
						<dt>Cap remaining</dt>
						<dd>{money(data.cap_remaining_this_month_cents)}</dd>
					</dl>
					<p className="small muted">
						The cap resets each UTC calendar month. Pending payments count
						toward it.
					</p>
				</>
			) : null}
			{data.problem ? (
				<p className="rebill-warning" role="status">
					{data.problem.reason} {data.problem.recovery_action}
				</p>
			) : null}
			{data.state === "payment_processing" ? (
				<p className="small">
					Credits will appear after the payment succeeds.
					{data.enabled
						? ""
						: " Future top-ups are off; this payment is still processing."}
				</p>
			) : null}
		</>
	);
}

function RebillActions({
	controls,
	data,
}: {
	controls: Controls;
	data: AutoRebillStatus;
}) {
	const { change, mode, status } = controls;
	const checkout = change.data?.kind === "setup" ? change.data.url : undefined;
	const confirmed =
		status.dataUpdatedAt > change.submittedAt &&
		data.enabled &&
		!data.setup_pending;
	const showCheckout = checkout && !confirmed;
	const showForm =
		(mode === "setup" && data.can_configure) ||
		(mode === "edit" && data.can_update_settings);
	return (
		<>
			{showCheckout ? (
				<div className="stack">
					<p role="status">
						Finish authorizing automatic rebill in the Stripe tab. This page
						updates automatically after setup is confirmed.
					</p>
					<a
						className="btn primary"
						href={checkout}
						rel="noopener noreferrer"
						target="_blank"
					>
						Open setup checkout
					</a>
					<p className="small muted">
						Opens in a new tab. Automatic rebill is not enabled by opening this
						link.
					</p>
				</div>
			) : null}
			{data.setup_pending && !showCheckout ? (
				<p className="small">
					Finish setup in your Stripe tab, or cancel setup below to start again.
				</p>
			) : null}
			{showForm ? (
				<AutoRebillForm
					key={mode}
					onCancel={controls.cancel}
					onSubmit={controls.save}
					settings={data}
					setup={mode === "setup"}
				/>
			) : (
				<RebillButtons
					controls={controls}
					data={data}
					showCheckout={!!showCheckout}
				/>
			)}
		</>
	);
}

function RebillButtons({
	controls,
	data,
	showCheckout,
}: {
	controls: Controls;
	data: AutoRebillStatus;
	showCheckout: boolean;
}) {
	return (
		<>
			<div className="rebill-actions">
				{data.can_update_settings ? (
					<button
						className="btn"
						disabled={controls.change.isPending}
						onClick={controls.edit}
						type="button"
					>
						Edit rebill settings
					</button>
				) : null}
				{data.can_configure && !data.setup_pending && !showCheckout ? (
					<button
						className="btn"
						disabled={controls.change.isPending}
						onClick={controls.setup}
						type="button"
					>
						{data.enabled ? "Change payment method" : "Set up automatic rebill"}
					</button>
				) : null}
				{data.can_disable ? (
					<button
						aria-busy={controls.change.isPending}
						className="btn"
						disabled={controls.change.isPending}
						onClick={controls.disable}
						type="button"
					>
						{data.enabled ? "Turn off auto-rebill" : "Cancel setup"}
					</button>
				) : null}
			</div>
			{!(data.can_configure || data.can_update_settings || data.can_disable) &&
			data.state !== "payment_processing" ? (
				<p className="muted small">
					A team purchaser can manage automatic rebill. Only the purchaser who
					authorized it can edit the saved amounts.
				</p>
			) : null}
		</>
	);
}
