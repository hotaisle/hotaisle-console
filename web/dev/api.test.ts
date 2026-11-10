import { describe, expect, it } from "vitest";
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
	it("shows setup, booting and SSH readiness after a simulated launch", async () => {
		let now = Date.parse("2026-11-09T12:00:00Z");
		const api = new PreviewAPI("empty", () => now);
		expect(await (await request(api, "GET", MACHINES)).json()).toEqual([]);
		const response = await request(api, "POST", MACHINES, {
			gpus: [{ count: 2 }],
		});
		const machine = (await response.json()) as VM;
		expect(machine.status).toBe("rebuilding");
		expect(machine.ssh_access).toBeUndefined();
		now += 3500;
		let machines = (await (await request(api, "GET", MACHINES)).json()) as VM[];
		let power = (await (
			await request(api, "GET", `${MACHINES}${machine.name}/state/`)
		).json()) as VMState;
		expect(machines[0].status).toBe("ready");
		expect(power.state).toBe("starting");
		now += 5000;
		machines = (await (await request(api, "GET", MACHINES)).json()) as VM[];
		power = (await (
			await request(api, "GET", `${MACHINES}${machine.name}/state/`)
		).json()) as VMState;
		expect(power.state).toBe("running");
		expect(machines[0].ssh_access?.dns_name).toBe("preview-001.invalid");
	});
	it("seeds a mixed machine list with ready, booting and powered-off machines", async () => {
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
			"shut off",
		]);
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
