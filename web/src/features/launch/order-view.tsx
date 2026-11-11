import type { HotkeyChord } from "@tanstack/react-hotkeys";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isPresent } from "../../../../shared/present";
import type { ConsoleSearch } from "../../app/route-state";
import { HoldButton } from "../../components/ui/hold-button";
import { Picker } from "../../components/ui/picker";
import { useToast } from "../../components/ui/toast";
import { useShortcuts } from "../../hooks/use-shortcut";
import {
	type APIError,
	api,
	type Balance,
	type Offer,
	type SSHKey,
	type Team,
	type VM,
} from "../../lib/api";
import { hoursOr, money } from "../../lib/format";
import { IMAGES, type Image, VLLM_URL } from "../../lib/prefs";
import type { Signal } from "../../lib/signal";
import { sound } from "../../lib/sound";
import { ImageFooter } from "./image-footer";
import { MachineOptions } from "./machine-options";
import { OfferStatus } from "./offer-status";
import { availabilityBlocker, sizesOf } from "./offers";
import { RentalCredits } from "./rental-credits";
import { RentalEstimate } from "./rental-estimate";
import type { LaunchMeta, Order } from "./types";

export const HTTPS_URL_PATTERN = /^https:\/\/\S+$/u;
const preserveSearch = (previous: ConsoleSearch) => previous;

export function OrderView({
	team,
	offers,
	balance,
	keys,
	vmCount,
	order,
	setOrder,
	hold,
	onImage,
	onLaunched,
	onAddCredits,
	onRefreshOffers,
	offersError,
	children,
}: {
	team: Team;
	offers?: Offer[];
	balance?: Balance;
	keys?: SSHKey[];
	vmCount: number;
	order: Order;
	setOrder: (o: Partial<Order>) => void;
	hold: Signal<number>;
	onImage: () => void;
	onLaunched: (vm: VM, meta: LaunchMeta) => void;
	onAddCredits: () => void;
	onRefreshOffers: () => Promise<void>;
	offersError?: Error;
	children?: React.ReactNode;
}) {
	const toast = useToast();
	const sizes = useMemo(() => sizesOf(offers), [offers]);
	const [busy, setBusy] = useState(false);
	const { count, image, customURL } = order;

	// Fall back to the nearest size in stock when the preferred one is gone.
	const currentSize = sizes.find((o) => o.Specs.gpus?.[0]?.count === count);
	const fallbackCount = currentSize?.Quantity
		? undefined
		: sizes
				.filter((o) => o.Quantity > 0)
				.sort(
					(a, b) =>
						Math.abs((a.Specs.gpus?.[0]?.count ?? 0) - count) -
						Math.abs((b.Specs.gpus?.[0]?.count ?? 0) - count)
				)[0]?.Specs.gpus?.[0]?.count;
	const requestedCount = useRef<number>(undefined);
	useEffect(() => {
		if (!fallbackCount) {
			requestedCount.current = undefined;
			return;
		}
		if (requestedCount.current === fallbackCount) {
			return;
		}
		requestedCount.current = fallbackCount;
		setOrder({ count: fallbackCount });
	}, [fallbackCount, setOrder]);

	useShortcuts(
		sizes
			.filter((size) => size.Quantity > 0)
			.map((size) => ({
				callback: () => {
					sound.tick();
					setOrder({ count: size.Specs.gpus?.[0]?.count });
				},
				hotkey: String(size.Specs.gpus?.[0]?.count) as HotkeyChord,
				options: {
					enabled: !busy,
					meta: {
						name: `Select ${size.Specs.gpus?.[0]?.count} GPU${size.Specs.gpus?.[0]?.count === 1 ? "" : "s"}`,
					},
				},
			}))
	);

	const offer = currentSize;
	const g = offer?.Specs.gpus?.[0];
	const price = offer?.OnDemandPrice;
	const minCharge =
		isPresent(price) && offer
			? (price * offer.MinimumReservationMinutes) / 60
			: undefined;
	const canOperate =
		team.effective_roles.includes("operator") ||
		team.effective_roles.includes("owner");
	const atLimit =
		!!team.maximum_virtual_machines && vmCount >= team.maximum_virtual_machines;
	const noKey = isPresent(keys) && keys.length === 0;
	function resolveUserData() {
		if (image === "vllm") {
			return VLLM_URL;
		}
		if (image === "custom") {
			return customURL.trim();
		}
		return "";
	}
	const userData = resolveUserData();
	const badURL = image === "custom" && !HTTPS_URL_PATTERN.test(userData);
	const spendable = balance
		? balance.available_balance - (balance.minimum_balance ?? 0)
		: undefined;
	const lowBalance =
		isPresent(spendable) && isPresent(minCharge) && spendable < minCharge;

	const availabilityLoading = offers === undefined && !offersError;
	const blocker =
		availabilityBlocker({ error: offersError, offer, offers, sizes }) ||
		launchBlocker({
			atLimit,
			badURL,
			canOperate,
			lowBalance,
			noKey,
			offer,
			offers,
			sizes,
			team,
		});
	const launch = useCallback(async () => {
		if (!(offer && g)) {
			return;
		}
		setBusy(true);
		try {
			const vm = offer.metal
				? await api.reserve(team.handle, offer)
				: await api.provision(
						team.handle,
						[{ count: g.count, manufacturer: g.manufacturer, model: g.model }],
						userData || undefined
					);
			await onLaunched(vm, {
				image: offer.metal ? "standard" : image,
				price,
				user_data_url: offer.metal ? undefined : userData || undefined,
			});
		} catch (e) {
			const err = e as APIError;
			const known: Record<number, string> = {
				402: "Not enough balance for this machine. Add credits and try again.",
				404: "That size was just taken. Pick another, or try again in a minute.",
				428: "Hot Aisle needs an SSH key on your account first.",
			};
			toast(known[err.status] ?? `Launch failed. ${err.message}`, "err");
			hold.set(0);
		} finally {
			setBusy(false);
		}
	}, [offer, g, team.handle, userData, onLaunched, image, price, toast, hold]);

	const handleOnChange = useCallback(
		(v: Image) => {
			setOrder({ image: v });
			if (v === "custom" && !customURL.trim()) {
				onImage();
			}
		},
		[setOrder, customURL, onImage]
	);
	const handleOnProgress = useCallback((p: number) => hold.set(p), [hold]);
	function resolveValue3() {
		if (offer?.metal && isPresent(minCharge)) {
			return `A whole server. Billed for at least ${hoursOr(offer.MinimumReservationMinutes)} (${money(minCharge)}), even if you end it sooner.`;
		}
		if (offer) {
			return "Billed by the minute. Billing starts once the machine is yours.";
		}
		return " ";
	}
	function resolveLabel() {
		if (g) {
			return `Hold to ${offer?.metal ? "reserve" : "launch"} ${g.count}× ${g.model ?? "MI300X"}`;
		}
		return "Hold to launch";
	}
	return (
		<section
			aria-label="Launch a machine"
			className="order vt"
			style={{ ["--vt" as string]: "launcher" }}
		>
			<OfferStatus
				empty={sizes.every((size) => size.Quantity <= 0)}
				error={offersError}
				loading={availabilityLoading}
				onRefresh={onRefreshOffers}
			/>
			<MachineOptions
				count={count}
				loading={availabilityLoading}
				onChange={setOrder}
				sizes={sizes}
			/>
			<RentalCredits
				balance={balance}
				minimumCharge={minCharge}
				onAddCredits={onAddCredits}
				team={team}
			/>

			<div className="details">
				<Picker<Image>
					fixed={offer?.metal ? "Hot Aisle's standard image" : undefined}
					footer={
						offer?.metal ? null : (
							<ImageFooter image={image} onChange={onImage} />
						)
					}
					label="Image"
					onChange={handleOnChange}
					options={(Object.keys(IMAGES) as Image[]).map((k) => ({
						hint: IMAGES[k].note,
						label: IMAGES[k].name,
						value: k,
					}))}
					value={image}
				/>
				{noKey ? (
					<Link
						className="missing-ssh-key"
						hash="ssh-keys"
						hashScrollIntoView={{ block: "start" }}
						params={{ team: team.handle }}
						search={preserveSearch}
						to="/teams/$team/settings"
					>
						Add an SSH key in Settings <span aria-hidden="true">→</span>
					</Link>
				) : null}
			</div>

			<RentalEstimate
				balance={balance}
				error={offersError}
				loading={availabilityLoading}
				offer={offer}
			/>
			{children}
			<div className="go foot">
				<HoldButton
					busy={busy}
					busyLabel={offer?.metal ? "Reserving" : "Launching"}
					disabled={!!blocker || !offer}
					hint="Press and hold, or hold L. Billing starts once the machine is yours."
					hotkey="L"
					id="launch"
					label={resolveLabel()}
					onConfirm={launch}
					onProgress={handleOnProgress}
					trailing={isPresent(price) ? `${money(price)}/hr` : undefined}
				/>
				<p className={`fine ${blocker ? "blocked" : ""}`}>
					{blocker || resolveValue3()}
				</p>
			</div>
		</section>
	);
}

function launchBlocker({
	canOperate,
	atLimit,
	noKey,
	offers,
	sizes,
	badURL,
	offer,
	lowBalance,
	team,
}: {
	canOperate: boolean;
	atLimit: boolean;
	noKey: boolean;
	offers: Offer[] | undefined;
	sizes: Offer[];
	badURL: boolean;
	offer: Offer | undefined;
	lowBalance: boolean;
	team: Team;
}) {
	let blocker = "";
	if (!canOperate) {
		blocker =
			"Your API key can't launch machines on this team. It needs the operator role.";
	} else if (atLimit) {
		blocker = `This team can run ${team.maximum_virtual_machines} machines at once. End one to launch another.`;
	} else if (noKey) {
		blocker = "Add an SSH key first. It is how you log in.";
	} else if (offers && !sizes.some((o) => o.Quantity > 0)) {
		blocker = "Every size is taken right now. Check back in a few minutes.";
	} else if (badURL && !offer?.metal) {
		blocker = "Add the https:// link to your cloud-init file.";
	} else if (lowBalance) {
		blocker =
			"Your balance is below the minimum charge. Add credits to launch.";
	}

	return blocker;
}
