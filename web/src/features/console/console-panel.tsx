import { useRouter, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { BuildDate } from "../../components/build-date";
import { FormError } from "../../components/forms/form-error";
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
import { PanelPage } from "./panel-page";
import { RunResult, runSubtitle } from "./run-result";
import type { ConsoleContext } from "./use-console";
import type { View } from "./use-navigation";

export function ConsolePanel({ context }: { context: ConsoleContext }) {
	const {
		b,
		back,
		backView,
		balance,
		dismiss,
		editingAutopay,
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
		offers,
		onEnded,
		onLaunched,
		order,
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
	const backAction = { label: `Back to ${titles[backView]}`, onClick: back };
	const notice = vms.error ? (
		<FormError
			actions={
				<button className="btn-text" onClick={refreshAll} type="button">
					Try again
				</button>
			}
			message={vms.error.message}
		/>
	) : null;
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
	const launchSubtitle = sizes.some((size) => size.Quantity > 0)
		? "Availability refreshes automatically every 10 seconds"
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
					onChanged={refreshAll}
					onDismiss={dismiss}
					onEnded={onEnded}
					onFocus={focusMachine}
					receipts={receipts}
					records={recByIdentity}
					serverOf={serverOf}
					states={states}
					team={team}
				/>
				<History items={history} />
				<div className="foot">
					<button className="btn primary new" onClick={showOrder} type="button">
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
				refreshKeys={keys.refresh}
				sshKeys={keys.data}
				status={status}
			/>
		);
	} else if (view === "credits") {
		body = (
			<CreditsView
				back={backAction}
				balanceCents={b?.available_balance}
				editingAutopay={editingAutopay}
				loading={!creditsReady(context)}
				notice={notice}
				onDone={creditsDone}
				team={h}
				usage={b}
				waitingForCapacity={
					offers.data !== undefined &&
					!offers.error &&
					!sizes.some((size) => size.Quantity > 0) &&
					vms.data !== undefined &&
					!vms.error &&
					list.length === 0
				}
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
				{view === "credits" ? (
					body
				) : (
					<PanelPage
						back={stack.length > 1 ? backAction : undefined}
						notice={notice}
						subtitle={sub}
						title={titles[view]}
					>
						{loaded ? body : <div aria-busy="true" className="placeholder" />}
					</PanelPage>
				)}
			</div>
			<footer className="panel-build">
				<BuildDate />
			</footer>
		</aside>
	);
}

function creditsReady({ b, balance, loaded }: ConsoleContext) {
	return loaded && (b !== undefined || balance.error !== undefined);
}
