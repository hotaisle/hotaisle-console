import type { View } from "../../lib/camera";
import type { Hall } from "./iso/hall";
export type StageMode =
	| "choose"
	| "claimed"
	| "booting"
	| "ready"
	| "off"
	| "ended";

export interface StageMachine {
	gpus: number;
	host?: string;
	id: string;
	mode: StageMode;
	name: string;
	since?: number;
}

export interface StageState {
	focus?: string; // the machine in focus: its server's tray is out
	machines: StageMachine[]; // in launch order
	preview?: number; // GPUs you are choosing, shown on a server with room
	readout: string;
	spec: [string, string][];
	specTitle: string;
}

export const NEW = "__new__";

export const FILL = [7, 6, 5, 4, 3, 2, 1, 0];

export const WARM = 0.62;

export function placeNew(machines: StageMachine[], n: number) {
	const used = new Map<string, number>();
	for (const m of machines) {
		if (m.mode !== "ended" && m.host && m.host !== NEW) {
			used.set(m.host, (used.get(m.host) ?? 0) + m.gpus);
		}
	}
	for (const [h, u] of used) {
		if (u + n <= 8) {
			return h;
		}
	}
	return NEW;
}

export interface Owned {
	index: number;
	machine: StageMachine;
}

export type TagMode = "ready" | "starting" | "off" | "new";

export interface Tag {
	adding: number;
	focus: boolean;
	gpus: number;
	host: string;
	ids: string[];
	mode: TagMode;
	names: string[];
}

export const TAG_STATE: Record<TagMode, string> = {
	new: "once you launch",
	off: "off",
	ready: "ready",
	starting: "starting",
};

function groupHosts(machines: StageMachine[]) {
	const hosts = new Map<string, StageMachine[]>();
	for (const machine of machines) {
		const host = machine.host ?? NEW;
		const members = hosts.get(host) ?? [];
		members.push(machine);
		hosts.set(host, members);
	}
	return hosts;
}
function assignSlots(hosts: Map<string, StageMachine[]>) {
	const owned = new Map<string, Owned>();
	for (const [host, machines] of hosts) {
		let next = 0;
		const ordered = [
			...machines.filter((machine) => machine.mode !== "ended"),
			...machines.filter((machine) => machine.mode === "ended"),
		];
		for (const machine of ordered) {
			for (let index = 0; index < machine.gpus && next < 8; index += 1) {
				owned.set(`${host}/${FILL[next]}`, { index, machine });
				next += 1;
			}
		}
	}
	return owned;
}
function tagMode(machines: StageMachine[]): TagMode {
	if (
		machines.some(
			(machine) => machine.mode === "booting" || machine.mode === "claimed"
		)
	) {
		return "starting";
	}
	if (machines.some((machine) => machine.mode === "ready")) {
		return "ready";
	}
	return "off";
}
function serverTags(
	hosts: Map<string, StageMachine[]>,
	state: StageState,
	previewHost?: string
): Tag[] {
	const tags: Tag[] = [];
	for (const [host, machines] of hosts) {
		const live = machines.filter((machine) => machine.mode !== "ended");
		if (!live.length) {
			continue;
		}
		tags.push({
			adding: host === previewHost ? (state.preview ?? 0) : 0,
			focus:
				previewHost === undefined &&
				live.some((machine) => machine.id === state.focus),
			gpus: live.reduce((sum, machine) => sum + machine.gpus, 0),
			host,
			ids: live.map((machine) => machine.id),
			mode: tagMode(live),
			names: live.map((machine) => machine.name),
		});
	}
	if (previewHost && !tags.some((tag) => tag.host === previewHost)) {
		tags.push({
			adding: state.preview ?? 0,
			focus: true,
			gpus: 0,
			host: previewHost,
			ids: [],
			mode: "new",
			names: [],
		});
	}
	return tags;
}
export function layout(state: StageState) {
	const hosts = groupHosts(state.machines);
	const preview = state.preview !== undefined && !state.focus;
	const previewHost = preview
		? placeNew(state.machines, state.preview ?? 0)
		: undefined;
	if (previewHost && !hosts.has(previewHost)) {
		hosts.set(previewHost, []);
	}
	const owned = assignSlots(hosts);
	const focusMachine = state.machines.find(
		(machine) => machine.id === state.focus
	);
	const focusHost = focusMachine
		? (focusMachine.host ?? NEW)
		: (previewHost ?? [...hosts.keys()][0] ?? NEW);
	if (!hosts.has(focusHost)) {
		hosts.set(focusHost, []);
	}
	const shown = previewHost ?? focusHost;
	if (!hosts.has(NEW)) {
		hosts.set(NEW, []);
	}
	const previewSlots = previewHost
		? FILL.filter((slot) => !owned.has(`${previewHost}/${slot}`)).slice(
				0,
				state.preview ?? 0
			)
		: [];
	return {
		focusHost,
		focusMachine,
		frame: [shown],
		hosts: [...hosts.keys()],
		out: [shown],
		owned,
		previewSlots,
		tags: serverTags(hosts, state, previewHost),
	};
}

export const framing = (hall: Hall, hosts: string[]): View =>
	hall.frameOf(hosts) as View;

export const PARTS: Record<string, string> = {
	baseboard:
		"GPU baseboard (UBB 2.0, 417 × 585 mm). Every GPU links to the other seven over Infinity Fabric, 128 GB/s each pair",
	blank:
		"Blanking panels fill empty rack space, so hot exhaust cannot loop back to the cold side",
	cabinet:
		"Rack cabinet, about 1.2 m deep. The servers face the cold aisle on the other side; you are in the hot aisle",
	fans: "Ten GPU fan modules, the front of the tray. Together the server moves about 1,200 CFM of air into the hot aisle",
	gpu: "AMD Instinct MI300X under its tower heatsink: 192 GB of HBM3 at 5.3 TB/s, 304 compute units, 750 W",
	ladder:
		"Overhead ladder rack, carrying single-mode fiber between racks and to the network switches",
	lift: "Lifting handle on the baseboard",
	patch:
		"Fiber patch panel: MPO connectors with green boots, carrying the 400G GPU network (eight NICs per server)",
	pdu: "Horizontal rack-mounted power distribution unit. Hot Aisle runs six per rack",
	retimer:
		"PCIe retimer under its own small heatsink, one of the links between the GPUs and the CPUs",
	server:
		"Dell PowerEdge XE9680, seen from the Hot Aisle: six power supplies over ten GPU fans. Inside: 8 MI300X, 2 Xeon CPUs, 2 TB of memory",
	switch: "Top-of-rack network switch",
	tray: "GPU tray, pulled out of the rear of the server with its fan wall. It weighs about 30 kg; Dell has two people lift it",
};

export interface Glide {
	dur: number;
	ease: (t: number) => number;
	from: number;
	start: number;
	to: number;
}
