import { describe, expect, it } from "vitest";
import { machineKey } from "../../shared/machine-identity";
import type { VM, VMState } from "../src/lib/api";
import { PreviewAPI } from "./api";

const ORIGIN = "http://preview.localhost:8787";
const MACHINES = "/api/teams/preview/virtual_machines/";
function request(
	api: PreviewAPI,
	method: string,
	path: string,
	body?: unknown
) {
	return api.fetch(
		new Request(ORIGIN + path, {
			body: body === undefined ? undefined : JSON.stringify(body),
			method,
		})
	);
}
describe("development preview machine lifecycle", () => {
	it("previews token permissions across three memberships and rejects unavailable grants", async () => {
		const api = new PreviewAPI("api-tokens");
		const account = await (await request(api, "GET", "/api/user/")).json();
		expect(
			account.teams.map((team: { handle: string }) => team.handle)
		).toEqual(["preview", "research", "finance"]);
		const base = "/api/user/api_keys/";
		const result = await request(api, "POST", base, {
			label: "Team automation",
			teams: [
				{ roles: ["operator"], team: "research" },
				{ roles: ["purchaser"], team: "finance" },
			],
			user_role: "user",
		});
		expect(result.status).toBe(200);
		expect((await result.json()).teams).toEqual([
			{ handle: "research", name: "Research", roles: ["operator"] },
			{ handle: "finance", name: "Finance", roles: ["purchaser"] },
		]);
		expect(
			(
				await request(api, "POST", base, {
					label: "Unavailable grant",
					teams: [{ roles: ["owner"], team: "finance" }],
					user_role: "user",
				})
			).status
		).toBe(422);
	});
	it("simulates token creation, editing, and revocation in memory without listing token values", async () => {
		const api = new PreviewAPI("running");
		const base = "/api/user/api_keys/";
		const created = await (
			await request(api, "POST", base, {
				label: "Automation",
				teams: [{ roles: ["owner"], team: "preview" }],
				user_role: "user",
			})
		).json();
		expect(created.token).toContain("simulated-token-not-a-real-credential");
		expect(await (await request(api, "GET", base)).text()).not.toContain(
			created.token
		);
		const edited = await (
			await request(api, "PATCH", `${base}${created.prefix}/`, {
				label: "Renamed",
				user_role: "user",
			})
		).json();
		expect(edited).toMatchObject({ label: "Renamed", teams: created.teams });
		expect(edited.token).toBeUndefined();
		expect(
			(await request(api, "DELETE", `${base}${created.prefix}/`)).status
		).toBe(204);
		expect(await (await request(api, "GET", base)).text()).not.toContain(
			created.prefix
		);
		expect(
			await (await request(new PreviewAPI("running"), "GET", base)).json()
		).toHaveLength(1);
	});
	it("simulates rebill edits and disabling without opening real payment setup", async () => {
		const api = new PreviewAPI("auto-rebill");
		const path = "/api/teams/preview/auto-rebill/";
		expect(await (await request(api, "GET", path)).json()).toMatchObject({
			can_update_settings: true,
			enabled: true,
		});
		const settings = {
			monthly_cap_cents: 100_000,
			rebill_amount_cents: 15_000,
			threshold_cents: 5000,
		};
		expect((await request(api, "PATCH", path, settings)).status).toBe(204);
		expect(await (await request(api, "GET", path)).json()).toMatchObject(
			settings
		);
		expect((await request(api, "DELETE", path)).status).toBe(204);
		expect(await (await request(api, "GET", path)).json()).toMatchObject({
			enabled: false,
		});
		expect((await request(api, "POST", path, settings)).status).toBe(501);
	});
	it("simulates invitations in memory and keeps members when team details change", async () => {
		const api = new PreviewAPI("running");
		const invitation = {
			email: "Dana@example.invalid",
			name: "Dana Doe",
			roles: ["user", "operator"],
		};
		expect(
			(
				await request(
					api,
					"POST",
					"/api/teams/preview/members/invitations/",
					invitation
				)
			).status
		).toBe(204);
		const team = await (
			await request(api, "GET", "/api/teams/preview/")
		).json();
		expect(team.members).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					email: "dana@example.invalid",
					invitation: true,
					roles: ["user", "operator"],
				}),
			])
		);
		expect(
			(
				await request(
					api,
					"POST",
					"/api/teams/preview/members/invitations/",
					invitation
				)
			).status
		).toBe(409);
		expect(
			(
				await request(api, "POST", "/api/teams/preview/members/invitations/", {
					...invitation,
					email: "another@example.invalid",
					roles: ["admin"],
				})
			).status
		).toBe(422);
		const saved = await (
			await request(api, "PATCH", "/api/teams/preview/", { name: "New name" })
		).json();
		expect(saved.members).toEqual(team.members);
	});
	it("signs into only the fixture account after simulated email approval", async () => {
		const api = new PreviewAPI("sign-in");
		expect(
			await (await request(api, "GET", "/auth/status")).json()
		).toMatchObject({ signed_in: false });
		expect((await request(api, "GET", "/api/user/")).status).toBe(401);
		expect(
			(
				await request(api, "POST", "/auth/email/start", {
					email: "someone@example.com",
				})
			).status
		).toBe(422);
		api.approveEmail();
		expect((await request(api, "POST", "/auth/email/wait")).status).toBe(404);
		expect(
			(
				await request(api, "POST", "/auth/email/start", {
					email: "preview@example.invalid",
				})
			).status
		).toBe(200);
		expect(
			await (await request(api, "POST", "/auth/email/wait")).json()
		).toEqual({ done: false });
		api.approveEmail();
		expect(
			await (await request(api, "POST", "/auth/email/wait")).json()
		).toEqual({ done: true });
		expect(
			await (await request(api, "GET", "/auth/status")).json()
		).toMatchObject({ signed_in: true });
		expect((await request(api, "GET", "/api/user/")).status).toBe(200);
		expect(
			await (await request(api, "GET", "/api/user/")).json()
		).toMatchObject({ teams: [] });
		expect((await request(api, "GET", `${MACHINES}available/`)).status).toBe(
			403
		);
		expect(
			(
				await request(api, "POST", "/api/teams/", {
					handle: "bad handle",
					name: "Research",
				})
			).status
		).toBe(422);
		const created = await request(api, "POST", "/api/teams/", {
			handle: "research",
			name: "Research team",
		});
		expect(await created.json()).toMatchObject({
			effective_roles: ["owner"],
			handle: "research",
			name: "Research team",
		});
		expect(
			await (await request(api, "GET", "/api/user/")).json()
		).toMatchObject({ teams: [{ handle: "research" }] });
		expect(
			await (await request(api, "GET", "/api/teams/research/balance/")).json()
		).toMatchObject({ available_balance: 50_000 });
		expect(
			(
				await request(api, "POST", "/api/teams/", {
					handle: "another",
					name: "Another",
				})
			).status
		).toBe(409);
	});
	it.each([
		[1, 1],
		[2, 60],
		[4, 120],
	])(
		"uses HotManager's minimum for %s GPU(s): %s minutes",
		async (count, minimum) => {
			let now = Date.parse("2026-11-09T12:00:00Z");
			const api = new PreviewAPI("empty", () => now);
			const offers = await (
				await request(api, "GET", `${MACHINES}available/`)
			).json();
			expect(
				offers.find(
					(offer: { Specs: { gpus: { count: number }[] } }) =>
						offer.Specs.gpus[0].count === count
				).MinimumReservationMinutes
			).toBe(minimum);
			const machine = (await (
				await request(api, "POST", MACHINES, { gpus: [{ count }] })
			).json()) as VM;
			now += minimum * 60_000 - 1000;
			expect(
				(await request(api, "DELETE", `${MACHINES}${machine.name}/`)).status
			).toBe(409);
			now += 2000;
			expect(
				(await request(api, "DELETE", `${MACHINES}${machine.name}/`)).status
			).toBe(204);
		}
	);
	it("assigns a hot-staged VM without simulating a boot or rebuild", async () => {
		let now = Date.parse("2026-11-09T12:00:00Z");
		const api = new PreviewAPI("empty", () => now);
		const response = await request(api, "POST", MACHINES, {
			gpus: [{ count: 1 }],
		});
		const machine = (await response.json()) as VM;
		expect(machine.status).toBe("ready");
		expect(
			(
				await (
					await request(api, "GET", `${MACHINES}${machine.name}/state/`)
				).json()
			).state
		).toBe("starting");
		now += 2000;
		expect(
			(
				await (
					await request(api, "GET", `${MACHINES}${machine.name}/state/`)
				).json()
			).state
		).toBe("running");
		expect((await (await request(api, "GET", MACHINES)).json())[0].status).toBe(
			"ready"
		);
	});
	it("shows assignment, cloud-init booting and SSH readiness after a simulated launch", async () => {
		let now = Date.parse("2026-11-09T12:00:00Z");
		const api = new PreviewAPI("empty", () => now);
		expect(await (await request(api, "GET", MACHINES)).json()).toEqual([]);
		const response = await request(api, "POST", MACHINES, {
			gpus: [{ count: 2 }],
			user_data_url: "https://example.invalid/cloud-init.yaml",
		});
		const machine = (await response.json()) as VM;
		expect(machine.status).toBe("ready");
		expect(machine.ssh_access).toBeUndefined();
		now += 3500;
		let machines = (await (await request(api, "GET", MACHINES)).json()) as VM[];
		let power = (await (
			await request(api, "GET", `${MACHINES}${machine.name}/state/`)
		).json()) as VMState;
		expect(machines[0].status).toBe("rebuilding");
		expect(power.state).toBe("starting");
		now += 5000;
		machines = (await (await request(api, "GET", MACHINES)).json()) as VM[];
		power = (await (
			await request(api, "GET", `${MACHINES}${machine.name}/state/`)
		).json()) as VMState;
		expect(power.state).toBe("running");
		expect(machines[0].ssh_access?.dns_name).toBe("preview-001.invalid");
	});
	it("seeds a mixed VM list with ready, cloud-init and assigned machines", async () => {
		const api = new PreviewAPI("multiple");
		const machines = (await (
			await request(api, "GET", MACHINES)
		).json()) as VM[];
		expect(machines).toHaveLength(3);
		const power = await Promise.all(
			machines.map(
				async (machine) =>
					(
						await request(api, "GET", `${MACHINES}${machine.name}/state/`)
					).json() as Promise<VMState>
			)
		);
		expect(power.map((item) => item.state)).toEqual([
			"running",
			"starting",
			"starting",
		]);
		expect(machines[2].ssh_access).toBeUndefined();
		expect(
			api.initialRecords().machines[machineKey("preview", machines[2])]?.image
		).toBe("standard");
	});
	it("requires minimum-charge confirmation to release a new machine", async () => {
		const api = new PreviewAPI("running");
		expect(
			(await request(api, "DELETE", `${MACHINES}preview-001/`)).status
		).toBe(409);
		expect(
			(await request(api, "DELETE", `${MACHINES}preview-001/?force=true`))
				.status
		).toBe(204);
		expect(await (await request(api, "GET", MACHINES)).json()).toEqual([]);
	});
	it("keeps failed launches failed and never creates a machine", async () => {
		const api = new PreviewAPI("launch-error");
		expect(
			(await request(api, "POST", MACHINES, { gpus: [{ count: 2 }] })).status
		).toBe(503);
		expect(await (await request(api, "GET", MACHINES)).json()).toEqual([]);
	});
	it("seeds browser-only history without providing records endpoints", async () => {
		const api = new PreviewAPI("history");
		expect(api.initialRecords().history).toHaveLength(200);
		expect(
			(
				await request(api, "POST", "/records/history", {
					name: "retired",
					team: "preview",
				})
			).status
		).toBe(501);
	});
	it("refuses checkout and unknown endpoints instead of forwarding them", async () => {
		const api = new PreviewAPI("empty");
		expect(
			(
				await request(api, "POST", "/api/teams/preview/purchase-credits/", {
					cents: 5000,
				})
			).status
		).toBe(501);
		expect(
			(await request(api, "GET", "/api/teams/real-team/virtual_machines/"))
				.status
		).toBe(501);
	});
});
