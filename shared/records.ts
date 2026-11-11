// What the app remembers about machines that the Hot Aisle API doesn't keep: when each was launched, with
// which image and at what price, and a short history of machines that have ended (how long they ran and about
// what they cost).
//
// There is no auto-end. Hot Aisle's API can't schedule a shutdown, and an app-side timer could miss one and
// leave a machine billing, so the app never promises to end a machine on its own.
//
// Persisted only as encrypted, append-only browser entries. No Cloudflare user-data storage.

import { type MachineRef, machineKey, machineKind } from "./machine-identity";

export interface Machine {
	deployment_id?: string;
	/** The size as people say it ("4× MI300X"). */
	gpus?: string;
	image?: string;
	launched_at?: string;
	/** A bare-metal server. */
	metal?: boolean;
	name: string;
	price_cents?: number;
	team: string;
	user_data_url?: string;
}

export interface Ended {
	cents?: number;
	cpu_cores?: number;
	deployment_id?: string;
	disk_capacity?: number;
	ended_at: string;
	ended_by?: "you";
	gpus: string;
	image?: string;
	metal?: boolean;
	minimum_applied?: boolean;
	name: string;
	price_cents?: number;
	ram_capacity?: number;
	ran_ms?: number;
	server?: string;
	started_at?: string;
	team: string;
}

export interface RecordsState {
	history: Ended[];
	machines: Record<string, Machine>;
}

/** What the app sends to record a launch. */
export interface MachineUpdate {
	deployment_id?: string;
	gpus?: string;
	image?: string;
	launched?: boolean;
	metal?: boolean;
	name: string;
	price_cents?: number;
	team: string;
	user_data_url?: string;
}

/** Records of machines launched this recently are kept whatever a machine list says (it may predate them). */
export const PRUNE_GRACE_MS = 5 * 60_000;

export const emptyRecords = (): RecordsState => ({ history: [], machines: {} });

export function listMachines(s: RecordsState, team: string): Machine[] {
	return Object.values(s.machines)
		.filter((m) => m.team === team)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Read old name-only launch metadata only when the current collection has exactly one match. */
export function recordsByIdentity(
	team: string,
	records: Machine[],
	machines: MachineRef[]
) {
	const indexed: Record<string, Machine | undefined> = Object.fromEntries(
		records.map((record) => [machineKey(team, record), record])
	);
	for (const record of records) {
		if (record.deployment_id) {
			continue;
		}
		const matches = machines.filter(
			(machine) =>
				machine.name === record.name &&
				machineKind(machine) === machineKind(record)
		);
		if (matches.length === 1) {
			const key = machineKey(team, matches[0]);
			indexed[key] ??= record;
		}
	}
	return indexed;
}

/** Validates an update; returns an error message, or nothing. */
export function checkUpdate(u: Partial<MachineUpdate>): string | undefined {
	if (
		typeof u.team !== "string" ||
		!u.team ||
		typeof u.name !== "string" ||
		!u.name
	) {
		return "body must name the team and the machine";
	}
	return undefined;
}

export function updateMachine(
	s: RecordsState,
	u: MachineUpdate,
	now = Date.now()
): Machine {
	const k = machineKey(u.team, u);
	const m: Machine = s.machines[k] ?? { name: u.name, team: u.team };
	m.name = u.name;
	if (u.deployment_id) {
		m.deployment_id = u.deployment_id;
	}
	if (u.launched && !m.launched_at) {
		m.launched_at = new Date(now).toISOString();
	}
	if (u.image) {
		m.image = u.image;
	}
	if (u.user_data_url) {
		m.user_data_url = u.user_data_url;
	}
	if (u.price_cents && u.price_cents > 0) {
		m.price_cents = Math.round(u.price_cents);
	}
	if (u.gpus) {
		m.gpus = u.gpus;
	}
	if (u.metal) {
		m.metal = true;
	}
	s.machines[k] = m;
	return m;
}

/** Forgets machines of a team that no longer exist, except ones launched in the last few minutes. */
export function pruneMachines(
	s: RecordsState,
	team: string,
	alive: string[],
	now = Date.now()
): boolean {
	const keep = new Set(alive);
	let changed = false;
	for (const [k, m] of Object.entries(s.machines)) {
		if (m.launched_at && now - Date.parse(m.launched_at) < PRUNE_GRACE_MS) {
			continue;
		}
		if (m.team === team && !keep.has(machineKey(team, m))) {
			delete s.machines[k];
			changed = true;
		}
	}
	return changed;
}

export function removeMachine(
	s: RecordsState,
	team: string,
	machine: MachineRef
) {
	delete s.machines[machineKey(team, machine)];
}

/** Records an ended machine, newest first; the same machine twice replaces the displayed receipt. */
export function addEnded(s: RecordsState, e: Ended) {
	const out = [e];
	for (const h of s.history) {
		if (machineKey(h.team, h) === machineKey(e.team, e)) {
			continue;
		}
		out.push(h);
	}
	s.history = out;
}

export const historyOf = (s: RecordsState, team: string) =>
	s.history.filter((h) => h.team === team);
