import { useEffect, useRef, useState } from "react";
import { isPresent } from "../../../../shared/present";
import { useToast } from "../../components/ui/toast";
import {
	type APIError,
	api,
	type Ended,
	type MachineRecord,
	type Team,
	type VM,
	type VMState,
} from "../../lib/api";
import { money } from "../../lib/format";
import { vtName } from "../../lib/motion";
import { sound } from "../../lib/sound";
import { HEAD, type Phase, phaseOf, stageModeOf } from "./state";
import { useNow } from "./use-now";

export interface TripProps {
	expanded: boolean;
	host?: string;
	minimumMin: number;
	morph: boolean;
	onChanged: () => void;
	onEnded: (e: Ended) => void;
	onFocus: () => void;
	price?: number;
	record?: MachineRecord;
	state?: VMState;
	team: Team;
	vm: VM;
}

const MINIMUM_RESERVATION_PATTERN = /minimum|reservation/iu;
export function useTrip(props: TripProps) {
	const {
		team,
		vm,
		state,
		record,
		price,
		minimumMin,
		host: server,
		expanded,
		morph,
		onFocus,
		onChanged,
		onEnded,
	} = props;
	const toast = useToast();
	const [ending, setEnding] = useState(false);
	const [panel, setPanel] = useState<null | "end" | "rebuild">(null);
	const [menu, setMenu] = useState(false);
	const [force, setForce] = useState(false);
	const [busy, setBusy] = useState("");
	const phase = phaseOf(vm, state, ending);
	const prev = useRef<Phase>(phase);
	const menuRef = useRef<HTMLDivElement>(null);
	const now = useNow(1000);
	const launched = record?.launched_at
		? new Date(record.launched_at).getTime()
		: undefined;
	const g = vm.gpus?.[0];
	const gpus = g ? `${g.count}× ${g.model ?? "GPU"}` : "";
	const underMin = isPresent(launched) && now - launched < minimumMin * 60_000;
	const minCost = price ? money((price * minimumMin) / 60) : "";

	useEffect(() => {
		if (
			prev.current !== "running" &&
			phase === "running" &&
			prev.current !== "unknown"
		) {
			sound.chime();
		}
		prev.current = phase;
	}, [phase]);
	useEffect(() => {
		if (!menu) {
			return;
		}
		const close = (e: MouseEvent) =>
			!menuRef.current?.contains(e.target as Node) && setMenu(false);
		const esc = (e: KeyboardEvent) => {
			if (e.key !== "Escape") {
				return;
			}
			e.preventDefault(); // this Escape closed the menu; it doesn't also go back
			setMenu(false);
		};
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", esc);
		};
	}, [menu]);
	useEffect(() => {
		if (!expanded) {
			setPanel(null);
		}
	}, [expanded]);

	const act = async (label: string, fn: () => Promise<void>, ok: string) => {
		setMenu(false);
		setBusy(label);
		try {
			await fn();
			toast(ok);
			onChanged();
		} catch (e) {
			toast(`${label} didn't work. ${(e as Error).message}`, "err");
		} finally {
			setBusy("");
		}
	};

	const end = async (forced: boolean) => {
		setBusy("End");
		try {
			await api.release(team.handle, vm.name, forced);
			setEnding(true);
			const ran = launched ? Date.now() - launched : undefined;
			const billedMs = isPresent(ran)
				? Math.max(ran, minimumMin * 60_000)
				: undefined;
			window.setTimeout(
				() =>
					onEnded({
						cents:
							isPresent(billedMs) && price
								? (price * billedMs) / 3_600_000
								: undefined,
						cpu_cores: vm.cpu_cores,
						disk_capacity: vm.disk_capacity,
						ended_at: new Date().toISOString(),
						ended_by: "you",
						gpus,
						image: record?.image,
						metal: vm.metal,
						minimum_applied: isPresent(ran) && ran < minimumMin * 60_000,
						name: vm.name,
						price_cents: price,
						ram_capacity: vm.ram_capacity,
						ran_ms: ran,
						server: vm.metal ? vm.name : server,
						started_at: record?.launched_at,
						team: team.handle,
					}),
				250
			);
		} catch (e) {
			const err = e as APIError;
			if (
				!forced &&
				err.status >= 400 &&
				err.status < 500 &&
				MINIMUM_RESERVATION_PATTERN.test(err.message)
			) {
				setForce(true);
			} else {
				toast(`Couldn't end it. ${err.message}`, "err");
			}
		} finally {
			setBusy("");
		}
	};

	const copy = async (text: string, what: string) => {
		setMenu(false);
		try {
			await navigator.clipboard.writeText(text);
			sound.tick();
			toast(`Copied ${what}.`);
		} catch {
			toast(
				`Could not copy ${what}. Select and copy the text manually.`,
				"err"
			);
		}
	};

	const ssh = vm.ssh_access;
	const ready = phase === "running";
	const host = ssh ? ssh.dns_name || ssh.ip_address : "";
	const cloudInit =
		phase === "building" ||
		record?.image === "vllm" ||
		record?.image === "custom";
	// a bare-metal server installs its operating system before its first boot
	const install = state?.install;
	function resolveMetalStep() {
		if (install) {
			if (
				["booting_installer", "installing_os", "finalizing_os"].includes(
					install
				)
			) {
				return 1;
			}
			if (["first_boot", "first_boot_tasks"].includes(install)) {
				return 2;
			}
			if (install === "installed") {
				return 3;
			}
			return 0;
		}
		return 0;
	}
	const metalStep = resolveMetalStep();
	function resolveSteps() {
		if (vm.metal) {
			return ["Assigned", "Installing", "First boot", "Ready"];
		}
		if (cloudInit) {
			return ["Assigned", "Setting up", "Booting", "Ready"];
		}
		return ["Assigned", "Booting", "Ready"];
	}
	const steps = resolveSteps();
	function resolveCurrent() {
		if (ready) {
			return steps.length;
		}
		if (vm.metal) {
			return metalStep;
		}
		if (phase === "building") {
			return 1;
		}
		return steps.indexOf("Booting");
	}
	const current = resolveCurrent();
	const [head, sub] =
		vm.metal && phase === "building"
			? ([
					"Installing",
					"Hot Aisle is installing the operating system on your server. This takes a while.",
				] as const)
			: HEAD[phase];
	const ranMs = launched ? now - launched : undefined;
	const mode = stageModeOf(phase);
	const style = {
		["--vt" as string]: morph ? "launcher" : vtName("vm", vm.name),
	};

	return {
		act,
		busy,
		copy,
		current,
		end,
		ending,
		expanded,
		force,
		g,
		gpus,
		head,
		host,
		launched,
		menu,
		menuRef,
		minCost,
		minimumMin,
		mode,
		morph,
		now,
		onChanged,
		onEnded,
		onFocus,
		panel,
		phase,
		price,
		ranMs,
		ready,
		record,
		server,
		setForce,
		setMenu,
		setPanel,
		ssh,
		state,
		steps,
		style,
		sub,
		team,
		toast,
		underMin,
		vm,
	};
}
export type TripContext = ReturnType<typeof useTrip>;
