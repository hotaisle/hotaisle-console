import { useRouter, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { isPresent } from "../../../../shared/present";
import { BuildDate } from "../../components/build-date";
import { FormError } from "../../components/forms/form-error";
import { PanelScroll } from "../../components/panel-scroll";
import { cloudInitVault } from "../../lib/cloud-init-vault";
import { ImageView } from "../launch/image-view";
import { OrderView } from "../launch/order-view";
import { runTitle } from "../machines/formatting";
import { History } from "../machines/history";
import { HistoryView } from "../machines/history-view";
import { SettingsView } from "../settings/settings";
import { AccountInstruments } from "./account-instruments";
import { CreditsView } from "./credits-view";
import { MachineList } from "./machine-list";
import { RunResult, runSubtitle } from "./run-result";
import type { ConsoleContext } from "./use-console";
import type { View } from "./use-navigation";

const chevronLeft = (
	<svg aria-hidden="true" height="14" viewBox="0 0 8 14" width="8">
		<path
			d="M7 1L1 7l6 6"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.6"
		/>
	</svg>
);
export function ConsolePanel({ context }: { context: ConsoleContext }) {
	const {
		b,
		back,
		balance,
		dismiss,
		focusMachine,
		focusedKey,
		gpusAtWork,
		h,
		history,
		hold,
		keys,
		launchedNow,
		list,
		loaded,
		offerFor,
		offers,
		onEnded,
		onLaunched,
		onTeam,
		order,
		priceOf,
		push,
		receipts,
		recByIdentity,
		refreshAll,
		rootIsOrder,
		run,
		runError,
		selectionError,
		sizes,
		vms,
		serverOf,
		setOrder,
		stack,
		states,
		status,
		team,
		teams,
		view,
	} = context;
	// ---------------------------------------------------------------- panel views
	function resolveHomeTitle() {
		if (rootIsOrder) {
			return "Rent MI300x compute";
		}
		if (list.length > 1) {
			return `Your machines (${list.length})`;
		}
		return "Your machines";
	}
	const homeTitle = resolveHomeTitle();
	const titles: Record<View, string> = {
		credits: "Add credits",
		history: "Machine history",
		home: homeTitle,
		image: "Custom cloud-init file",
		order: "New machine",
		run: runTitle(run),
		settings: "Settings",
	};
	const router = useRouter();
	const search = useSearch({ from: "__root__" });
	const showImage = useCallback(() => push("image"), [push]);
	const showOrder = useCallback(() => push("order"), [push]);
	const showCredits = useCallback(() => push("credits"), [push]);
	const creditsDone = useCallback(async () => {
		await balance.refresh();
		back();
	}, [balance.refresh, back]);
	const saveImage = useCallback(
		async (url: string) => {
			await cloudInitVault.save(url);
			return router.navigate({
				params: { team: team.handle },
				replace: true,
				search: { ...search, image: "custom" },
				to: "/teams/$team/launch",
			});
		},
		[router, team.handle, search]
	);
	const orderView = (
		<OrderView
			balance={b}
			hold={hold}
			keys={keys.data}
			offers={offers.data}
			offersError={offers.error}
			onAddCredits={showCredits}
			onImage={showImage}
			onLaunched={onLaunched}
			onRefreshOffers={offers.refresh}
			order={order}
			setOrder={setOrder}
			team={team}
			vmCount={list.length}
		>
			{view === "home" && <History items={history} />}
		</OrderView>
	);
	let body: React.ReactNode;
	let sub: string | undefined;
	const action: React.ReactNode = null;
	const launchSubtitle = sizes.some((size) => size.Quantity > 0)
		? "Pick a size, hold the button, and SSH in a minute later."
		: undefined;
	if (view === "home" && rootIsOrder) {
		sub = launchSubtitle;
		body = orderView;
	} else if (view === "home") {
		body = (
			<>
				<FormError message={selectionError} />
				<AccountInstruments balance={b} gpus={gpusAtWork} />
				<MachineList
					focused={focusedKey}
					launchedNow={launchedNow}
					list={list}
					offerFor={offerFor}
					onChanged={refreshAll}
					onDismiss={dismiss}
					onEnded={onEnded}
					onFocus={focusMachine}
					priceOf={priceOf}
					receipts={receipts}
					records={recByIdentity}
					serverOf={serverOf}
					states={states}
					team={team}
				/>
				<History items={history} />
				<div className="foot">
					<button
						className="btn primary big new"
						onClick={showOrder}
						type="button"
					>
						<span aria-hidden="true" className="plus" />
						New machine
					</button>
				</div>
			</>
		);
	} else if (view === "order") {
		sub = launchSubtitle;
		body = orderView;
	} else if (view === "settings") {
		body = (
			<SettingsView
				keysError={keys.error}
				onTeam={onTeam}
				refreshKeys={keys.refresh}
				sshKeys={keys.data}
				status={status}
				team={team}
				teams={teams}
			/>
		);
	} else if (view === "credits") {
		body = (
			<CreditsView
				gpuHour={Math.min(
					...sizes
						.filter((o) => o.Specs.gpus?.[0]?.count === 1 && o.OnDemandPrice)
						.map((o) => o.OnDemandPrice)
						.filter(isPresent)
				)}
				onDone={creditsDone}
				team={h}
			/>
		);
	} else if (view === "run") {
		sub = runSubtitle(run);
		body = <RunResult error={runError} loading={false} run={run} team={h} />;
	} else if (view === "history") {
		body = <HistoryView items={history} team={h} />;
	} else {
		body = <ImageView onSave={saveImage} value={order.customURL} />;
	}

	return (
		<aside className="panel">
			<div
				className="pv"
				key={view === "home" ? `home-${rootIsOrder}` : view}
				style={{
					viewTransitionName: "panel",
				}}
			>
				<header className="pv-head">
					<div className="pv-title">
						{stack.length > 1 && (
							<button
								aria-label={`Back to ${stack.at(-2) === "home" ? homeTitle : titles[stack.at(-2) ?? "home"]}`}
								className="back-btn"
								onClick={back}
								title="Back (Esc)"
								type="button"
							>
								{chevronLeft}
							</button>
						)}
						<h1>{titles[view]}</h1>
						{action}
					</div>
					{sub !== undefined && <p className="pv-sub">{sub}</p>}
				</header>
				{!!vms.error && (
					<FormError
						actions={
							<button className="btn-text" onClick={refreshAll} type="button">
								Try again
							</button>
						}
						message={vms.error.message}
					/>
				)}
				<PanelScroll>
					{loaded ? body : <div aria-busy="true" className="placeholder" />}
				</PanelScroll>
			</div>
			<footer className="panel-build">
				<BuildDate />
			</footer>
		</aside>
	);
}
