import type { MachineRecord, VM, VMState } from "../../lib/api";
import type { StageMode } from "../stage/model";

export type Phase =
	| "building"
	| "starting"
	| "running"
	| "off"
	| "paused"
	| "unavailable"
	| "releasing"
	| "unknown";

export function phaseOf(vm: VM, st?: VMState, releasing?: boolean): Phase {
	if (releasing) {
		return "releasing";
	}
	if (vm.status === "rebuild_queued" || vm.status === "rebuilding") {
		return "building";
	}
	if (vm.status === "unavailable") {
		return "unavailable";
	}
	const s = st?.state?.toLowerCase();
	if (!s || s === "unknown") {
		return "unknown";
	}
	if (s === "running") {
		return "running";
	}
	if (s === "installing") {
		return "building";
	}
	if (s === "failed") {
		return "unavailable";
	}
	if (s.includes("shut") || s === "stopped" || s === "off") {
		return "off";
	}
	if (s === "paused") {
		return "paused";
	}
	return "starting";
}

export const usesCloudInit = (phase: Phase, record?: MachineRecord) =>
	phase === "building" ||
	record?.image === "vllm" ||
	record?.image === "custom";

export function stageModeOf(phase: Phase, cloudInit = true): StageMode {
	if (phase === "running") {
		return "ready";
	}
	if (["off", "paused", "unavailable"].includes(phase)) {
		return "off";
	}
	if (phase === "releasing") {
		return "ended";
	}
	if (phase === "unknown" || (phase === "starting" && !cloudInit)) {
		return "claimed";
	}
	return "booting";
}

export const HEAD: Record<Phase, [string, string]> = {
	building: ["Booting", "Running your cloud-init file."],
	off: ["Powered off", "Still yours, and still billed, until you end it."],
	paused: ["Paused", "Still billed until you end it."],
	releasing: ["Ending", "Billing stops in a moment."],
	running: ["Ready", "Copy the command below to log in."],
	starting: [
		"Assigned",
		"Waiting for Hot Aisle to confirm this machine is ready.",
	],
	unavailable: ["Unavailable", "Hot Aisle can't reach this machine right now."],
	unknown: [
		"Checking status",
		"Waiting for Hot Aisle to report this machine's status.",
	],
};

export const settled = (p: Phase) =>
	p === "running" || p === "off" || p === "unavailable";
