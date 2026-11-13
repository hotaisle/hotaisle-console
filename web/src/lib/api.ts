import {
	type GPU,
	type MetalSpecs,
	type Offer,
	type Specs,
	specsOf,
} from "../../../shared/availability";
import {
	type MachineRef,
	machineAddress,
} from "../../../shared/machine-identity";
import type { AutoRebillSettings, AutoRebillStatus } from "./auto-rebill";
import { type HistoryKey, historyVault } from "./history-vault";
import { keyVault } from "./key-vault";

export type { GPU, Offer, Specs } from "../../../shared/availability";

// Email sessions use the Worker cookie; API keys are encrypted locally and forwarded per request.

const TOKEN_PREFIX_PATTERN = /^Token\s+/iu;
// Shapes follow https://admin.hotaisle.app/api/docs/swagger.json

/** Where a bare-metal server is in its install, as the API reports it. */
export type InstallStage =
	| "shutting_down"
	| "ac_reset"
	| "bios_reset"
	| "booting_installer"
	| "installing_os"
	| "finalizing_os"
	| "first_boot"
	| "first_boot_tasks"
	| "installed"
	| "failed";
export interface SSHAccess {
	dns_name?: string;
	ip_address: string;
	port: number;
}
export type VMStatus =
	| "ready"
	| "rebuild_queued"
	| "rebuilding"
	| "unavailable";
export type VM = Specs & {
	name: string;
	deployment_id: string;
	description?: string;
	ip_address: string;
	status: VMStatus;
	ssh_access?: SSHAccess;
	/** A bare-metal server: the whole machine, eight GPUs. */
	metal?: boolean;
};
export interface VMState {
	host: string;
	install?: InstallStage;
	state: string;
}
export interface Team {
	description?: string;
	effective_roles: string[];
	handle: string;
	invitation?: boolean;
	maximum_virtual_machines?: number;
	members?: TeamMember[] | null;
	name: string;
	roles: string[];
}
export type TeamRole = "owner" | "purchaser" | "operator" | "user";
export interface TeamMember {
	created: string;
	email: string;
	invitation?: boolean;
	name: string;
	roles: TeamRole[];
}
export interface TeamMemberInvitation {
	email: string;
	name: string;
	roles: TeamRole[];
}
export interface User {
	created: string;
	email: string;
	email_auth_enabled: boolean;
	name: string;
}
export interface UserAccount {
	teams: Team[];
	user: User;
}
export interface Balance {
	available_balance: number; // cents
	bare_metal_server_count: number;
	estimated_runout_time?: string;
	hourly_rate: number; // cents per hour
	minimum_balance?: number;
	virtual_machine_count: number;
}
export interface SSHKey {
	comment?: string;
	fingerprint: string;
	public_key: string;
	type: string;
}
/** Who is signed in, as the Worker sees it. */
export interface Status {
	/** Email sign-in is available (Hot Aisle's API must publish it, and the Worker be told its paths). */
	email_login: boolean;
	key_stored?: boolean;
	kind?: "key" | "email" | "passkey";
	passkeys: boolean;
	signed_in: boolean;
	version: string;
	/** An email sign-in waiting for its link to be opened. */
	waiting_for_email?: { email: string; expires_at: string };
}

export type { Ended, Machine as MachineRecord } from "../../../shared/records";

export class APIError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function call<T>(
	method: string,
	path: string,
	body?: unknown,
	requestKey = keyVault.token()
): Promise<T> {
	const res = await fetch(path, {
		body: body === undefined ? undefined : JSON.stringify(body),
		credentials: "same-origin",
		headers: {
			Accept: "application/json",
			...(requestKey ? { Authorization: `Token ${requestKey}` } : {}),
			"X-Requested-With": "hotaisle-console",
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
		},
		method,
	});
	const text = await res.text();
	if (!res.ok) {
		if (res.status === 401) {
			historyVault.lock();
		}
		let msg = text.trim();
		try {
			const j = JSON.parse(msg);
			msg = j.message || j.error || j.detail || msg;
		} catch {
			/* plain text, as the API usually sends */
		}
		throw new APIError(res.status, msg || res.statusText);
	}
	return (text ? JSON.parse(text) : undefined) as T;
}

const t = (team: string) => `/api/teams/${encodeURIComponent(team)}`;

// Bare metal: Hot Aisle rents whole 8-GPU servers through its own endpoints.
// Actions use the selected resource's explicit kind, never a name-only cache.
export type { MachineRef } from "../../../shared/machine-identity";

type Metal = MetalSpecs & {
	name: string;
	deployment_id?: string;
	description?: string;
	ip_address?: string;
	ssh_access?: SSHAccess;
	specs?: MetalSpecs;
	os_status?: { os_install_status?: InstallStage };
};
const m = (team: string, name: string) =>
	`${t(team)}/bare_metal/${encodeURIComponent(name)}`;
function metalVM(b: Metal): VM {
	return {
		...specsOf(b.specs ?? b),
		deployment_id: b.deployment_id ?? "",
		description: b.description,
		ip_address: b.ip_address ?? "",
		metal: true,
		name: b.name,
		ssh_access: b.ssh_access,
		status: "ready",
	};
}
export type PowerAction =
	| "start"
	| "shutdown"
	| "stop"
	| "reboot"
	| "hard-reset"
	| "ac-reset";
const POWER: Record<PowerAction, string> = {
	"ac-reset": "ac_reset",
	"hard-reset": "cold_reboot",
	reboot: "warm_reboot",
	shutdown: "graceful_shutdown",
	start: "power_on",
	stop: "force_shutdown",
};

export const api = {
	acceptTeamInvitation: (team: string) =>
		call<Team>("POST", `${t(team)}/accept-invitation/`),
	addKey: (authorized_key: string) =>
		call<SSHKey>("POST", "/api/user/ssh_keys/", { authorized_key }),
	autoRebill: (team: string) =>
		call<AutoRebillStatus>("GET", `${t(team)}/auto-rebill/`),
	balance: (team: string) => call<Balance>("GET", `${t(team)}/balance/`),
	bareMetalConsole: (team: string, server: string) =>
		call<{ url: string }>("POST", `${m(team, server)}/console/`),
	bareMetalPowerState: (team: string, server: string) =>
		call<{ state: string }>("GET", `${m(team, server)}/power/`),
	buyCredits: (team: string, cents: number) =>
		call<{ checkout_url: string; expires_at: string }>(
			"POST",
			`${t(team)}/purchase-credits/`,
			{ cents }
		),
	createTeam: (team: { name: string; handle: string }) =>
		call<Team>("POST", "/api/teams/", team),
	disableAutoRebill: (team: string) =>
		call<void>("DELETE", `${t(team)}/auto-rebill/`),
	/** Emails a sign-in link. */
	emailStart: (email: string) =>
		call<{ email: string; expires_at: string }>("POST", "/auth/email/start", {
			email,
		}),
	/** Whether the emailed link has been opened yet; once it has, the session is signed in. */
	emailWait: () =>
		call<{ done: boolean; user?: User; teams?: Team[] }>(
			"POST",
			"/auth/email/wait"
		),
	forgetKey: () => keyVault.forget(),
	historyKey: () => call<HistoryKey>("POST", "/auth/history-key"),
	inviteTeamMember: (team: string, invitation: TeamMemberInvitation) =>
		call<void>("POST", `${t(team)}/members/invitations/`, invitation),
	keys: () => call<SSHKey[]>("GET", "/api/user/ssh_keys/"),
	/** Sizes you can launch: virtual machines (1, 2 or 4 GPUs) and whole bare-metal servers (8). */
	offers: async (team: string) => {
		const [vms, metal] = await Promise.all([
			call<Offer[] | null>("GET", `${t(team)}/virtual_machines/available/`),
			call<(Offer & { Specs: MetalSpecs })[] | null>(
				"GET",
				`${t(team)}/bare_metal/available/`
			),
		]);
		return [
			...(vms ?? []),
			...(metal ?? []).map((o) => ({
				...o,
				metal: true,
				rawSpecs: o.Specs,
				Specs: specsOf(o.Specs),
			})),
		];
	},
	power: async (team: string, vm: MachineRef, action: PowerAction) => {
		if (vm.metal) {
			return await call<void>(
				"POST",
				`${m(team, machineAddress(vm))}/power/${POWER[action]}/`
			);
		}
		if (action === "shutdown" || action === "stop" || action === "ac-reset") {
			throw new Error(
				"This power operation is not available for virtual machines."
			);
		}
		return await call<void>(
			"POST",
			`${t(team)}/virtual_machines/${encodeURIComponent(machineAddress(vm))}/${action}/`
		);
	},
	provision: (team: string, gpus: GPU[], user_data_url?: string) =>
		call<VM>("POST", `${t(team)}/virtual_machines/`, {
			gpus,
			...(user_data_url ? { user_data_url } : {}),
		}),
	rebuild: (team: string, vm: MachineRef, user_data_url?: string) =>
		vm.metal
			? call<void>("POST", `${m(team, machineAddress(vm))}/reinstall/`)
			: call<void>(
					"POST",
					`${t(team)}/virtual_machines/${encodeURIComponent(machineAddress(vm))}/rebuild/`,
					user_data_url ? { user_data_url } : {}
				),
	release: (team: string, vm: MachineRef, force = false) =>
		call<void>(
			"DELETE",
			`${vm.metal ? m(team, machineAddress(vm)) : `${t(team)}/virtual_machines/${encodeURIComponent(machineAddress(vm))}`}/${force ? "?force=true" : ""}`
		),
	removeKey: (fingerprint: string) =>
		call<void>(
			"DELETE",
			`/api/user/ssh_keys/${encodeURIComponent(fingerprint)}/`
		),
	/** Reserve a whole server. Billed for its minimum (8 hours) up front. */
	reserve: async (team: string, offer: Offer) =>
		metalVM(
			await call<Metal>("POST", `${t(team)}/bare_metal/`, {
				specs: offer.rawSpecs,
			})
		),
	setupAutoRebill: (team: string, settings: AutoRebillSettings) =>
		call<{ checkout_url: string; expires_at: string }>(
			"POST",
			`${t(team)}/auto-rebill/`,
			settings
		),
	/** API keys are checked per request and saved only as browser-local ciphertext. */
	signInWithKey: async (key: string, passphrase: string) => {
		const token = key.trim().replace(TOKEN_PREFIX_PATTERN, "");
		const account = await call<{ user: User; teams: Team[] }>(
			"GET",
			"/auth/key",
			undefined,
			token
		);
		await call<{ ok: boolean }>("POST", "/auth/signout");
		await keyVault.save(token, passphrase);
		return account;
	},
	signOut: async () => {
		historyVault.lock();
		const localKey = keyVault.token() !== undefined;
		keyVault.lock();
		if (localKey) {
			return { ok: true };
		}
		return await call<{ ok: boolean }>("POST", "/auth/signout");
	},
	status: async () => {
		const status = await call<Status>("GET", "/auth/status");
		const stored = keyVault.isSaved();
		if (keyVault.token()) {
			return {
				...status,
				key_stored: stored,
				kind: "key" as const,
				signed_in: true,
			};
		}
		return { ...status, key_stored: stored };
	},
	team: (handle: string) => call<Team>("GET", `${t(handle)}/`),
	teams: () => call<Team[]>("GET", "/api/teams/"),
	unlockKey: async (passphrase: string) => {
		await keyVault.unlock(passphrase);
		try {
			return await call<{ user: User; teams: Team[] }>("GET", "/auth/key");
		} catch (error) {
			keyVault.lock();
			throw error;
		}
	},
	updateAutoRebill: (team: string, settings: AutoRebillSettings) =>
		call<void>("PATCH", `${t(team)}/auto-rebill/`, settings),
	updateTeam: (
		handle: string,
		details: { name?: string; description?: string }
	) => call<Team>("PATCH", `${t(handle)}/`, details),

	user: () => call<UserAccount>("GET", "/api/user/"),
	vmState: async (team: string, vm: MachineRef): Promise<VMState> => {
		if (!vm.metal) {
			return call<VMState>(
				"GET",
				`${t(team)}/virtual_machines/${encodeURIComponent(machineAddress(vm))}/state/`
			);
		}
		// a bare-metal server is its own host; it is up once its operating system is installed
		const [d, power] = await Promise.all([
			call<Metal>("GET", `${m(team, machineAddress(vm))}/`),
			call<{ state: string }>(
				"GET",
				`${m(team, machineAddress(vm))}/power/`
			).catch(() => undefined),
		]);
		const install = d.os_status?.os_install_status;
		function resolveState() {
			if (install && install !== "installed") {
				if (install === "failed") {
					return "failed";
				}
				return "installing";
			}
			if (power?.state === "Off") {
				return "off";
			}
			return power?.state === "On" ? "running" : "unknown";
		}
		const state = resolveState();
		return { host: vm.name, install, state };
	},
	/** Your machines: virtual machines and bare-metal servers, as one list. */
	vms: async (team: string) => {
		const [vms, metal] = await Promise.all([
			call<VM[] | null>("GET", `${t(team)}/virtual_machines/`),
			call<Metal[] | null>("GET", `${t(team)}/bare_metal/`).catch(() => null),
		]);
		return [...(vms ?? []), ...(metal ?? []).map(metalVM)];
	},
};
