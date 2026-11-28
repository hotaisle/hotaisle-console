import { Link, useRouter } from "@tanstack/react-router";
import type { ChangeEvent } from "react";
import { useCallback, useId } from "react";
import { FormError } from "../../components/forms/form-error";
import { ButtonLabels } from "../../components/ui/button-labels";
import type {
	AutoRebillSettings,
	AutoRebillStatus,
} from "../../lib/auto-rebill";
import { money } from "../../lib/format";
import { AutoRebillForm } from "./auto-rebill-form";
import type { TeamUsage } from "./autopay-usage";
import { AutopayUsage } from "./autopay-usage";
import type { AutoRebillControls } from "./use-auto-rebill";
import "./auto-rebill.css";

const STATES = {
	capped: "Monthly cap reached",
	disabled: "Off",
	enabled: "On",
	payment_failed: "Payment needs attention",
	payment_processing: "Payment processing",
};

const REBILL_FEEDBACK = {
	disable:
		"Autopay turned off. Any payment already processing can still complete.",
	setup: "Autopay is enabled.",
	update: "Autopay settings saved.",
};

export function canConfigureInCheckout(
	data: AutoRebillStatus | undefined,
	showCheckout: boolean
) {
	return Boolean(
		data &&
			!data.enabled &&
			!data.setup_pending &&
			!showCheckout &&
			data.state === "disabled" &&
			data.can_configure
	);
}

function statusTone(data: AutoRebillStatus, pending: boolean) {
	if (pending) {
		return "warn";
	}
	if (data.state === "enabled") {
		return "on";
	}
	if (data.state === "payment_failed") {
		return "bad";
	}
	if (data.state === "disabled") {
		return "off";
	}
	return "warn";
}

export function AutoRebillCard({
	autopayEnabled,
	controls,
	onCloseEditor,
	onDone,
	onToggleAutopay,
	team,
	usage,
}: {
	autopayEnabled: boolean;
	controls: AutoRebillControls;
	onCloseEditor?: () => void;
	onDone: () => void;
	onToggleAutopay: (enabled: boolean) => void;
	team: string;
	usage?: TeamUsage;
}) {
	const { status, change, setupConfirmed } = controls;
	const { data } = status;
	const editing = onCloseEditor !== undefined;

	if (!data) {
		return (
			<section aria-label="Autopay" className="auto-rebill">
				<div className="autopay-head">
					<div className="autopay-title">
						<h2>Autopay</h2>
						<span className="autopay-pill is-off">Unavailable</span>
					</div>
				</div>
				{status.isError ? (
					<FormError
						actions={
							<button className="btn" onClick={controls.refresh} type="button">
								Try again
							</button>
						}
						message={`Couldn't load autopay status. ${status.error.message}`}
					/>
				) : null}
			</section>
		);
	}
	const showCheckout =
		!editing && change.data?.kind === "setup" && !setupConfirmed;
	const pending = data.setup_pending || showCheckout;
	const showPrompt = !editing && canConfigureInCheckout(data, showCheckout);

	return (
		<section aria-label="Autopay" className="auto-rebill">
			<AutoRebillHeader
				controls={controls}
				data={data}
				editing={editing}
				onToggleSetup={onToggleAutopay}
				pending={pending}
				setupSelected={autopayEnabled}
				showPrompt={showPrompt}
			/>
			{status.isError && status.error !== change.error ? (
				<FormError
					message={`Couldn't refresh autopay status. ${status.error.message}`}
				/>
			) : null}
			{editing === (change.variables?.kind === "update") ? (
				<FormError message={change.error?.message} />
			) : null}
			<div className="stack rebill-controls">
				{onCloseEditor ? (
					<RebillEditor
						controls={controls}
						data={data}
						onClose={onCloseEditor}
						usage={usage}
					/>
				) : (
					<AutoRebillBody
						controls={controls}
						data={data}
						onDone={onDone}
						showCheckout={showCheckout}
						team={team}
						usage={usage}
					/>
				)}
			</div>
			<AutoRebillFeedback controls={controls} editing={editing} />
		</section>
	);
}

function RebillEditor({
	controls,
	data,
	onClose,
	usage,
}: {
	controls: AutoRebillControls;
	data: AutoRebillStatus;
	onClose: () => void;
	usage?: TeamUsage;
}) {
	const router = useRouter();
	const { save } = controls;
	const submit = useCallback(
		async (settings: AutoRebillSettings) => {
			const entry = router.history.location.state.__TSR_key;
			// Browser Back can leave the editor while the save is in flight.
			if (
				(await save(settings)) &&
				router.history.location.state.__TSR_key === entry
			) {
				onClose();
			}
		},
		[onClose, router, save]
	);
	return data.can_update_settings ? (
		<AutoRebillForm
			busy={controls.change.isPending}
			onCancel={onClose}
			onSubmit={submit}
			settings={data}
			usage={usage}
		/>
	) : (
		<p>Autopay settings aren’t editable for this team right now.</p>
	);
}

function AutoRebillBody({
	controls,
	data,
	onDone,
	showCheckout,
	team,
	usage,
}: {
	controls: AutoRebillControls;
	data: AutoRebillStatus;
	onDone: () => void;
	showCheckout: boolean;
	team: string;
	usage?: TeamUsage;
}) {
	const checkout = controls.change.data;
	if (showCheckout && checkout?.kind === "setup") {
		return (
			<>
				<RebillSummary
					data={data}
					pending
					submittedSettings={checkout.settings}
					usage={usage}
				/>
				<SetupCheckoutHandoff
					canDisable={data.can_disable}
					checkoutUrl={checkout.url}
					controls={controls}
					onDone={onDone}
				/>
			</>
		);
	}
	return (
		<>
			<RebillSummary data={data} usage={usage} />
			<RebillButtons controls={controls} data={data} team={team} />
		</>
	);
}

function AutoRebillFeedback({
	controls: { change, setupConfirmed },
	editing,
}: {
	controls: AutoRebillControls;
	editing: boolean;
}) {
	let kind: keyof typeof REBILL_FEEDBACK | undefined;
	if (!editing && setupConfirmed) {
		kind = "setup";
	} else if (!editing && change.isSuccess) {
		const result = change.data.kind;
		if (result === "update" || result === "disable") {
			kind = result;
		}
	}

	return (
		<div className={kind ? undefined : "visually-hidden"} role="status">
			{kind ? (
				<p className={kind === "update" ? "autopay-saved" : undefined}>
					{kind === "update" && (
						<svg
							aria-hidden="true"
							fill="none"
							height="28"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							viewBox="0 0 28 28"
							width="28"
						>
							<rect height="24" rx="6" width="24" x="2" y="2" />
							<path d="m8 14 4 4 8-8" />
						</svg>
					)}
					{REBILL_FEEDBACK[kind]}
				</p>
			) : null}
		</div>
	);
}

function AutoRebillHeader({
	controls,
	data,
	editing,
	onToggleSetup,
	pending,
	setupSelected,
	showPrompt,
}: {
	controls: AutoRebillControls;
	data: AutoRebillStatus;
	editing: boolean;
	onToggleSetup: (checked: boolean) => void;
	pending: boolean;
	setupSelected: boolean;
	showPrompt: boolean;
}) {
	const id = useId();
	const { change, disable } = controls;
	const showSwitch =
		!editing && (showPrompt || (data.enabled && data.can_disable && !pending));
	const locked = change.isPending;
	const checked = showPrompt ? setupSelected : data.enabled;
	const title = showPrompt ? "Set up autopay" : "Autopay";
	const tone = statusTone(data, pending);
	const paymentMethod = data.payment_method ? (
		<p className="autopay-method">{data.payment_method.display}</p>
	) : null;

	const toggle = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			if (locked) {
				return;
			}
			if (showPrompt) {
				onToggleSetup(event.currentTarget.checked);
			} else {
				disable();
			}
		},
		[disable, locked, onToggleSetup, showPrompt]
	);

	return (
		<>
			<div className={showPrompt ? "autopay-toggle" : "autopay-head"}>
				<div className={showPrompt ? "autopay-toggle-copy" : "autopay-title"}>
					<h2>
						{showSwitch ? <label htmlFor={id}>{title}</label> : "Autopay"}
					</h2>
					{showPrompt ? (
						<span id={`${id}-help`}>Top up when your balance runs low.</span>
					) : (
						<span className={`autopay-pill is-${tone}`}>
							{pending ? "Setup pending" : STATES[data.state]}
						</span>
					)}
				</div>
				{editing ? paymentMethod : null}
				{showSwitch ? (
					<input
						{...{ switch: "" }}
						aria-checked={checked}
						aria-describedby={showPrompt ? `${id}-help` : undefined}
						aria-disabled={locked}
						checked={checked}
						className="autopay-switch"
						id={id}
						onChange={toggle}
						role="switch"
						type="checkbox"
					/>
				) : null}
			</div>
			{!editing && paymentMethod}
		</>
	);
}

function SetupCheckoutHandoff({
	canDisable,
	checkoutUrl,
	controls,
	onDone,
}: {
	canDisable: boolean;
	checkoutUrl: string;
	controls: AutoRebillControls;
	onDone: () => void;
}) {
	return (
		<div className="stack">
			<p role="status">Finish setup on Stripe to save your payment method.</p>
			<a
				className="btn primary"
				href={checkoutUrl}
				rel="noopener noreferrer"
				target="_blank"
			>
				Open Stripe setup
			</a>
			<div className="rebill-actions">
				{canDisable ? (
					<button
						aria-busy={controls.change.isPending}
						className="btn"
						disabled={controls.change.isPending}
						onClick={controls.disable}
						type="button"
					>
						Cancel setup
					</button>
				) : null}
				<button className="btn" onClick={onDone} type="button">
					Done
				</button>
			</div>
		</div>
	);
}

function remainingMonthlyCap(
	data: AutoRebillStatus,
	pendingSettings?: AutoRebillSettings
) {
	return pendingSettings
		? Math.max(
				0,
				pendingSettings.monthly_cap_cents -
					data.cap_used_this_month_cents -
					data.cap_reserved_this_month_cents
			)
		: data.cap_remaining_this_month_cents;
}

function RebillProblem({
	problem,
}: {
	problem: NonNullable<AutoRebillStatus["problem"]>;
}) {
	const { reason, recovery_action } = problem;
	const firstPeriod = reason.indexOf(". ");
	const firstSentenceEnd = firstPeriod === -1 ? reason.length : firstPeriod + 1;
	return (
		<p className="rebill-warning" role="status">
			<strong>{reason.slice(0, firstSentenceEnd)}</strong>
			{reason.slice(firstSentenceEnd)} {recovery_action}
		</p>
	);
}

function RebillSummary({
	data,
	pending = data.setup_pending,
	submittedSettings,
	usage,
}: {
	data: AutoRebillStatus;
	pending?: boolean;
	submittedSettings?: AutoRebillSettings;
	usage?: TeamUsage;
}) {
	const settings = pending
		? (data.pending_settings ?? submittedSettings)
		: data;
	const hasPendingPayment = data.cap_reserved_this_month_cents > 0;
	const showSettings =
		settings &&
		settings.rebill_amount_cents > 0 &&
		(data.enabled ||
			pending ||
			data.state === "payment_processing" ||
			hasPendingPayment);
	const capRemaining = remainingMonthlyCap(
		data,
		pending ? settings : undefined
	);
	return (
		<>
			{showSettings || hasPendingPayment ? (
				<dl className="rebill-summary">
					{showSettings ? (
						<>
							<dt>Balance trigger</dt>
							<dd className="rebill-value">
								<AutopayUsage
									as="span"
									cents={settings.threshold_cents}
									kind="trigger"
									usage={usage}
								/>
								<span>{money(settings.threshold_cents)}</span>
							</dd>
							<dt>Top-up amount</dt>
							<dd className="rebill-value">
								<AutopayUsage
									as="span"
									cents={settings.rebill_amount_cents}
									kind="interval"
									usage={usage}
								/>
								<span>{money(settings.rebill_amount_cents)}</span>
							</dd>
							<dt>Monthly cap (UTC)</dt>
							<dd>{money(settings.monthly_cap_cents)}</dd>
							<dt>Used this month</dt>
							<dd>{money(data.cap_used_this_month_cents)}</dd>
						</>
					) : null}
					{hasPendingPayment ? (
						<>
							<dt>Pending payment</dt>
							<dd>{money(data.cap_reserved_this_month_cents)}</dd>
						</>
					) : null}
					{showSettings ? (
						<>
							<dt>Cap remaining</dt>
							<dd>{money(capRemaining)}</dd>
						</>
					) : null}
				</dl>
			) : null}
			{hasPendingPayment ? (
				<p className="credits-secondary">
					Pending payments count toward the cap.
				</p>
			) : null}
			{data.problem ? <RebillProblem problem={data.problem} /> : null}
			{data.state === "payment_processing" ? (
				<p>Credits post after payment clears.</p>
			) : null}
			{data.state === "payment_processing" && !data.enabled ? (
				<p>Future top-ups are off; this payment is still processing.</p>
			) : null}
		</>
	);
}

function RebillButtons({
	controls,
	data,
	team,
}: {
	controls: AutoRebillControls;
	data: AutoRebillStatus;
	team: string;
}) {
	const canCancelSetup = data.can_disable && data.setup_pending;
	const canResumeSetup = data.can_resume_setup;
	const stripeAction = canResumeSetup
		? controls.resumeSetup
		: controls.changePaymentMethod;
	const openingStripe =
		controls.change.isPending &&
		controls.change.variables.kind ===
			(canResumeSetup ? "resume-setup" : "change-method");
	const hasActions = data.can_update_settings || canCancelSetup || stripeAction;
	return (
		<>
			{hasActions ? (
				<div className="rebill-actions">
					{data.can_update_settings ? (
						<Link
							className="btn"
							disabled={controls.change.isPending}
							params={{ team }}
							search={{}}
							state={{ autopayFromCredits: true }}
							to="/teams/$team/credits/autopay"
						>
							Edit settings
						</Link>
					) : null}
					{canCancelSetup ? (
						<button
							aria-busy={controls.change.isPending}
							className="btn"
							disabled={controls.change.isPending}
							onClick={controls.disable}
							type="button"
						>
							Cancel setup
						</button>
					) : null}
					{stripeAction ? (
						<button
							aria-busy={openingStripe}
							className="btn primary"
							disabled={controls.change.isPending}
							onClick={stripeAction}
							type="button"
						>
							<ButtonLabels active={openingStripe} alternate="Opening Stripe…">
								{canResumeSetup
									? "Continue setup on Stripe"
									: "Update payment on Stripe"}
							</ButtonLabels>
						</button>
					) : null}
				</div>
			) : null}
			{!(data.can_configure || data.can_update_settings || data.can_disable) &&
			data.state !== "payment_processing" ? (
				<p className="credits-secondary">
					{data.enabled
						? "A team purchaser can manage autopay. Only the purchaser who authorized it can edit the saved amounts."
						: "A team purchaser can enable autopay."}
				</p>
			) : null}
		</>
	);
}
