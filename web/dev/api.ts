import { minimumReservationMinutes } from "../../shared/availability";
import {
	addEnded,
	emptyRecords,
	removeMachine,
	updateMachine,
} from "../../shared/records";
import type { Team, TeamRole } from "../src/lib/api";
import { PreviewAPITokens } from "./api-tokens";
import { PreviewAutoRebill } from "./auto-rebill";
import { BareMetalPreview } from "./bare-metal";
import type { PreviewMachine } from "./machines";
import { available, machineView, newMachine, powerView } from "./machines";
import type { Scenario } from "./scenarios";
import { autopayScenario } from "./scenarios";
import { PreviewTeamMembers } from "./team-members";

const TEAM_HANDLE = /^[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/u;
const json = (value: unknown, status = 200) =>
	Response.json(value, { headers: { "Cache-Control": "no-store" }, status });
const fail = (status: number, message: string) => json({ message }, status);
function object(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Browser-only simulator. Unknown endpoints fail; there is no upstream fallback. */
export class PreviewAPI {
	private readonly team: Team;
	private readonly members: PreviewTeamMembers;
	private readonly tokens: PreviewAPITokens;
	private readonly otherTeams: Team[] = [];
	private readonly machines = new Map<string, PreviewMachine>();
	private readonly records = emptyRecords();
	private readonly now: () => number;
	private readonly scenario: Scenario;
	private serial = 0;
	private expireSession: boolean;
	private readonly auth: {
		signedIn: boolean;
		pendingEmail: string;
		approvedEmail: boolean;
		teamCreated: boolean;
	};
	private readonly metal?: BareMetalPreview;
	private readonly rebill: PreviewAutoRebill;

	constructor(scenario: Scenario, now = Date.now) {
		const roles: TeamRole[] = ["owner"];
		if (scenario === "sign-in" || scenario === "api-tokens") {
			roles.push("purchaser", "operator", "user");
		}
		if (scenario === "api-tokens") {
			this.otherTeams.push(
				{
					effective_roles: ["operator", "user"],
					handle: "research",
					name: "Research",
					roles: ["operator", "user"],
				},
				{
					effective_roles: ["purchaser"],
					handle: "finance",
					name: "Finance",
					roles: ["purchaser"],
				}
			);
		}
		this.team = {
			description: "",
			effective_roles: [...roles],
			handle: "preview",
			name: "Development preview",
			roles,
		};
		this.members = new PreviewTeamMembers(roles, scenario === "sign-in");
		this.tokens = new PreviewAPITokens(
			[this.team, ...this.otherTeams],
			scenario !== "sign-in"
		);
		this.rebill = new PreviewAutoRebill(
			autopayScenario(scenario)?.state ?? "disabled"
		);
		this.scenario = scenario;
		this.expireSession = scenario === "session-ended";
		this.auth = {
			approvedEmail: false,
			pendingEmail: "",
			signedIn: scenario !== "sign-in",
			teamCreated: scenario !== "sign-in",
		};
		this.now = now;
		if (scenario === "bare-metal" || scenario === "same-name") {
			this.metal = new BareMetalPreview(now);
			updateMachine(
				this.records,
				{
					deployment_id: this.metal.deployment_id,
					image: "standard",
					launched: true,
					metal: true,
					name: this.metal.name,
					price_cents: 2392,
					team: "preview",
				},
				now() - 38 * 60_000
			);
			if (scenario === "same-name") {
				this.seed(2, "running", this.metal.name);
			}
		}
		if (
			scenario === "assigned" ||
			scenario === "setting-up" ||
			scenario === "booting" ||
			scenario === "running"
		) {
			this.seed(2, scenario);
		}
		if (scenario === "multiple") {
			this.seed(2, "running");
			this.seed(4, "booting");
			this.seed(1, "assigned");
		}
		if (scenario === "ended") {
			addEnded(this.records, {
				cents: 1046.5,
				ended_at: new Date(this.now() - 900_000).toISOString(),
				ended_by: "you",
				gpus: "2× MI300X",
				image: "vllm",
				name: "preview-previous",
				price_cents: 598,
				ran_ms: 6_300_000,
				server: "preview-server-1",
				started_at: new Date(this.now() - 7_200_000).toISOString(),
				team: "preview",
			});
		}
		if (scenario === "history") {
			this.seedHistory();
		}
	}
	private seedHistory() {
		for (let index = 200; index > 0; index -= 1) {
			const count = [1, 2, 4][index % 3];
			addEnded(this.records, {
				cents: count * 598,
				ended_at: new Date(this.now() - index * 3_600_000).toISOString(),
				gpus: `${count}× MI300X`,
				image: "vllm",
				name: `previous-${String(index).padStart(3, "0")}`,
				price_cents: count * 299,
				ran_ms: 7_200_000,
				server: `preview-server-${(index % 8) + 1}`,
				started_at: new Date(
					this.now() - (index + 2) * 3_600_000
				).toISOString(),
				team: "preview",
			});
		}
	}
	private seed(
		count: number,
		mode: PreviewMachine["mode"],
		customName?: string
	) {
		this.serial += 1;
		const name =
			customName ?? `preview-${String(this.serial).padStart(3, "0")}`;
		const startedAt = this.now() - 38 * 60_000;
		const machine = newMachine(name, count, mode, startedAt);
		this.machines.set(name, machine);
		updateMachine(
			this.records,
			{
				deployment_id: machine.vm.deployment_id,
				image: mode === "assigned" ? "standard" : "vllm",
				launched: true,
				name,
				price_cents: count * 299,
				team: "preview",
			},
			startedAt
		);
	}
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const { method } = request;
		if (path.startsWith("/auth/email/")) {
			return this.emailRequest(request, path);
		}
		if (method === "GET" && path === "/auth/status") {
			return json({
				email_login: true,
				kind: "email",
				passkeys: false,
				signed_in: this.auth.signedIn,
				version: "preview",
				waiting_for_email: this.auth.pendingEmail
					? {
							email: this.auth.pendingEmail,
							expires_at: new Date(this.now() + 600_000).toISOString(),
							request_code: "PREV-2026",
						}
					: undefined,
			});
		}
		if (!this.auth.signedIn) {
			return fail(401, "Sign in to the simulated account first.");
		}
		if (method === "GET" && path === "/api/user/") {
			if (this.expireSession) {
				this.expireSession = false;
				this.auth.signedIn = false;
				return fail(401, "The simulated session has ended.");
			}
			return json({
				teams: this.auth.teamCreated ? [this.team, ...this.otherTeams] : [],
				user: {
					created: "2026-01-01",
					email: "preview@example.invalid",
					email_auth_enabled: true,
					name: "Preview",
				},
			});
		}
		if (method === "POST" && path === "/api/teams/") {
			return this.createTeam(request);
		}
		if (path.startsWith("/api/user/api_keys/")) {
			return this.tokens.request(request);
		}
		if (method === "GET" && path === "/api/user/ssh_keys/") {
			return json([
				{
					comment: "Preview laptop",
					fingerprint: "SHA256:preview",
					public_key: "preview-only",
					type: "ssh-ed25519",
				},
			]);
		}
		const prefix = `/api/teams/${this.team.handle}/`;
		if (!this.auth.teamCreated && path.startsWith(prefix)) {
			return fail(403, "Create the simulated team first.");
		}
		if (!path.startsWith(prefix)) {
			return fail(
				501,
				"This action is unavailable in the development preview. Reset a scenario to continue."
			);
		}
		const parts = path.slice(prefix.length).split("/").filter(Boolean);
		return await this.teamResource(request, url, parts);
	}
	private async updateMember(request: Request, email: string) {
		if (!this.team.effective_roles.includes("owner")) {
			return fail(403, "A team owner can edit permissions.");
		}
		const response = await this.members.update(request, email);
		if (response.ok) {
			const current = this.members
				.all()
				.find((member) => member.email === "preview@example.invalid");
			if (current) {
				this.team.roles = [...current.roles];
				this.team.effective_roles = [...current.roles];
			}
		}
		return response;
	}
	private async teamResource(request: Request, url: URL, parts: string[]) {
		const { method } = request;
		if (parts.length === 1 && parts[0] === "auto-rebill") {
			return this.rebill.request(request, this.now());
		}
		if (method === "GET" && parts.join("/") === "auto-rebill/setup") {
			return fail(501, "Stripe authorization is unavailable in the preview.");
		}
		if (parts.join("/") === "members/invitations") {
			return await this.members.invitations(request, this.now());
		}
		if (parts.length === 2 && parts[0] === "members") {
			return this.updateMember(request, decodeURIComponent(parts[1]));
		}
		if (parts.length === 0) {
			return this.teamRequest(request);
		}
		if (method === "GET" && parts[0] === "balance") {
			return this.balance();
		}
		if (parts[0] === "bare_metal") {
			return this.metal ? this.metal.request(request, url, parts) : json([]);
		}
		if (method === "GET" && parts[1] === "available") {
			const offers = available(this.machines.values());
			return json(
				this.scenario === "no-capacity"
					? offers.map((offer) => ({ ...offer, Quantity: 0 }))
					: offers
			);
		}
		if (parts[0] !== "virtual_machines") {
			return fail(
				501,
				"This preview only simulates virtual machines. No real request was made."
			);
		}
		return await this.machineRequest(request, url, parts);
	}
	private async createTeam(request: Request) {
		if (this.scenario !== "sign-in" || this.auth.teamCreated) {
			return fail(409, "The fixture team already exists.");
		}
		const body: unknown = await request.json();
		if (
			!(
				object(body) &&
				typeof body.name === "string" &&
				body.name.trim() &&
				typeof body.handle === "string" &&
				TEAM_HANDLE.test(body.handle)
			)
		) {
			return fail(422, "Enter a team name and valid handle.");
		}
		this.team.handle = body.handle;
		this.team.name = body.name.trim();
		this.auth.teamCreated = true;
		return json(this.team);
	}
	/** Simulates approval on another device; never sends an email. */
	approveEmail() {
		this.auth.approvedEmail = Boolean(this.auth.pendingEmail);
	}
	private async emailRequest(request: Request, path: string) {
		if (request.method !== "POST" || this.scenario !== "sign-in") {
			return fail(405, "Simulated sign-in is unavailable here.");
		}
		if (path === "/auth/email/start") {
			const body: unknown = await request.json();
			if (!object(body) || body.email !== "preview@example.invalid") {
				return fail(422, "Use preview@example.invalid for this simulation.");
			}
			this.auth.pendingEmail = body.email;
			this.auth.approvedEmail = false;
			return json({
				email: body.email,
				expires_at: new Date(this.now() + 600_000).toISOString(),
				request_code: "PREV-2026",
			});
		}
		if (path === "/auth/email/wait" && this.auth.pendingEmail) {
			if (!this.auth.approvedEmail) {
				return json({ done: false });
			}
			this.auth.signedIn = true;
			this.auth.pendingEmail = "";
			return json({ done: true });
		}
		return fail(404, "No simulated sign-in is pending.");
	}
	private async teamRequest(request: Request) {
		if (request.method === "GET") {
			return json({ ...this.team, members: this.members.all() });
		}
		if (request.method !== "PATCH") {
			return fail(405, "Method not allowed");
		}
		const body: unknown = await request.json();
		if (!object(body)) {
			return fail(422, "Invalid team details.");
		}
		if (
			body.name !== undefined &&
			(typeof body.name !== "string" ||
				!body.name.trim() ||
				new TextEncoder().encode(body.name).length > 100)
		) {
			return fail(422, "Enter a valid team name.");
		}
		if (
			body.description !== undefined &&
			(typeof body.description !== "string" ||
				new TextEncoder().encode(body.description).length > 200)
		) {
			return fail(422, "Enter a valid team description.");
		}
		if (typeof body.name === "string") {
			this.team.name = body.name;
		}
		if (typeof body.description === "string") {
			this.team.description = body.description;
		}
		return json({ ...this.team, members: this.members.all() });
	}
	private balance() {
		const hourlyRate = [...this.machines.values()].reduce(
			(sum, machine) => sum + (machine.vm.gpus?.[0]?.count ?? 0) * 299,
			this.metal?.assigned ? 2392 : 0
		);
		const balance = this.scenario === "auto-rebill-setup" ? 1200 : 50_000;
		return json({
			available_balance: balance,
			bare_metal_server_count: this.metal?.assigned ? 1 : 0,
			estimated_runout_time: hourlyRate
				? new Date(
						this.now() + ((balance - 1000) / hourlyRate) * 3_600_000
					).toISOString()
				: undefined,
			hourly_rate: hourlyRate,
			minimum_balance: 1000,
			virtual_machine_count: this.machines.size,
		});
	}
	private async machineRequest(request: Request, url: URL, parts: string[]) {
		const [, name, action] = parts;
		if (!name) {
			return await this.collection(request);
		}
		const selector = decodeURIComponent(name);
		const machine =
			this.machines.get(selector) ??
			[...this.machines.values()].find(
				(item) => item.vm.deployment_id === selector
			);
		if (!machine) {
			return fail(404, "This preview machine no longer exists.");
		}
		if (request.method === "GET" && action === "state") {
			return json(powerView(machine, this.now()));
		}
		if (request.method === "DELETE" && !action) {
			const minimumMs = minimumReservationMinutes(machine.vm) * 60_000;
			if (
				this.now() - machine.createdAt < minimumMs &&
				url.searchParams.get("force") !== "true"
			) {
				return fail(
					409,
					"This machine is inside its minimum reservation. Confirm the minimum charge to end it."
				);
			}
			this.machines.delete(machine.vm.name);
			removeMachine(this.records, "preview", machine.vm);
			return new Response(null, { status: 204 });
		}
		if (request.method !== "POST") {
			return fail(405, "Method not allowed");
		}
		return this.powerAction(machine, action);
	}
	private collection(request: Request) {
		if (request.method === "GET") {
			return json(
				[...this.machines.values()].map((machine) =>
					machineView(machine, this.now())
				)
			);
		}
		return request.method === "POST"
			? this.launch(request)
			: fail(405, "Method not allowed");
	}
	private powerAction(machine: PreviewMachine, action: string) {
		if (action === "rebuild") {
			machine.cloudInit = true;
			machine.mode = "live";
			machine.startedAt = this.now();
		} else if (
			action === "start" ||
			action === "reboot" ||
			action === "hard-reset"
		) {
			machine.cloudInit = false;
			machine.mode = "live";
			machine.startedAt = this.now();
		} else {
			return fail(501, "This action is not simulated.");
		}
		return new Response(null, { status: 204 });
	}
	private async launch(request: Request) {
		if (this.scenario === "launch-error") {
			return fail(
				503,
				"Simulated launch failure. Pick another preview scenario to try again."
			);
		}
		const body: unknown = await request.json();
		const gpu =
			object(body) && Array.isArray(body.gpus) ? body.gpus[0] : undefined;
		if (
			!object(gpu) ||
			typeof gpu.count !== "number" ||
			![1, 2, 4].includes(gpu.count)
		) {
			return fail(422, "Choose 1, 2, or 4 GPUs.");
		}
		if (this.machines.size >= 4) {
			return fail(
				409,
				"The preview team already has four machines. End one or reset the scenario."
			);
		}
		this.serial += 1;
		const name = `preview-${String(this.serial).padStart(3, "0")}`;
		const machine = newMachine(
			name,
			gpu.count,
			"live",
			this.now(),
			object(body) && typeof body.user_data_url === "string"
		);
		if (this.scenario === "sign-in") {
			machine.bootMs = 3000;
		}
		this.machines.set(name, machine);
		return json(machineView(machine, this.now()));
	}
	initialRecords() {
		return structuredClone(this.records);
	}
}
