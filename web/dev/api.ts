import {
	addEnded,
	emptyRecords,
	removeMachine,
	updateMachine,
} from "../../shared/records";
import {
	available,
	machineView,
	newMachine,
	type PreviewMachine,
	powerView,
} from "./machines";
import type { Scenario } from "./scenarios";

const PREFIX = "/api/teams/preview/";
const TEAM = {
	effective_roles: ["owner"],
	handle: "preview",
	name: "Development preview",
	roles: ["owner"],
};
const json = (value: unknown, status = 200) =>
	Response.json(value, { headers: { "Cache-Control": "no-store" }, status });
const fail = (status: number, message: string) => json({ message }, status);
function object(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Browser-only simulator. Unknown endpoints fail; there is no upstream fallback. */
export class PreviewAPI {
	private readonly machines = new Map<string, PreviewMachine>();
	private readonly records = emptyRecords();
	private readonly now: () => number;
	private readonly scenario: Scenario;
	private serial = 0;

	constructor(scenario: Scenario, now = Date.now) {
		this.scenario = scenario;
		this.now = now;
		if (
			scenario === "setting-up" ||
			scenario === "booting" ||
			scenario === "running"
		) {
			this.seed(2, scenario);
		}
		if (scenario === "multiple") {
			this.seed(2, "running");
			this.seed(4, "booting");
			this.seed(1, "off");
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
	private seed(count: number, mode: PreviewMachine["mode"]) {
		this.serial += 1;
		const name = `preview-${String(this.serial).padStart(3, "0")}`;
		const startedAt = this.now() - 38 * 60_000;
		this.machines.set(name, newMachine(name, count, mode, startedAt));
		updateMachine(
			this.records,
			{
				image: "vllm",
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
		if (method === "GET" && path === "/auth/status") {
			return json({
				email_login: true,
				kind: "email",
				passkeys: false,
				signed_in: true,
				version: "preview",
			});
		}
		if (method === "GET" && path === "/api/user/") {
			return json({
				teams: [TEAM],
				user: {
					created: "2026-01-01",
					email: "preview@example.invalid",
					email_auth_enabled: true,
					name: "Preview",
				},
			});
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
		if (!path.startsWith(PREFIX)) {
			return fail(
				501,
				"This action is unavailable in the development preview. Reset a scenario to continue."
			);
		}
		const parts = path.slice(PREFIX.length).split("/").filter(Boolean);
		if (method === "GET" && parts[0] === "balance") {
			return this.balance();
		}
		if (method === "GET" && parts[0] === "bare_metal") {
			return json([]);
		}
		if (method === "GET" && parts[1] === "available") {
			return json(available(this.machines.values()));
		}
		if (parts[0] !== "virtual_machines") {
			return fail(
				501,
				"This preview only simulates virtual machines. No real request was made."
			);
		}
		return await this.machineRequest(request, url, parts);
	}
	private balance() {
		const hourlyRate = [...this.machines.values()].reduce(
			(sum, machine) => sum + (machine.vm.gpus?.[0]?.count ?? 0) * 299,
			0
		);
		return json({
			available_balance: 50_000,
			bare_metal_server_count: 0,
			estimated_runout_time: hourlyRate
				? new Date(this.now() + (49_000 / hourlyRate) * 3_600_000).toISOString()
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
		const machine = this.machines.get(decodeURIComponent(name));
		if (!machine) {
			return fail(404, "This preview machine no longer exists.");
		}
		if (request.method === "GET" && action === "state") {
			return json(powerView(machine, this.now()));
		}
		if (request.method === "DELETE" && !action) {
			if (
				this.now() - machine.createdAt < 3_600_000 &&
				url.searchParams.get("force") !== "true"
			) {
				return fail(
					409,
					"This machine is inside its minimum reservation. Confirm the minimum charge to end it."
				);
			}
			this.machines.delete(name);
			removeMachine(this.records, "preview", name);
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
		if (action === "shutdown" || action === "stop") {
			machine.mode = "off";
		} else if (["start", "reboot", "hard-reset", "rebuild"].includes(action)) {
			machine.mode = "live";
			machine.startedAt = this.now() - (action === "rebuild" ? 0 : 3000);
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
		const machine = newMachine(name, gpu.count, "live", this.now());
		this.machines.set(name, machine);
		return json(machineView(machine, this.now()));
	}
	initialRecords() {
		return structuredClone(this.records);
	}
}
