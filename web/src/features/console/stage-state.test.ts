import { describe, expect, it, vi } from "vitest";
import { machineKey } from "../../../../shared/machine-identity";
import type { Ended, VM } from "../../lib/api";
import { layout } from "../stage/model";
import { buildStage, type StageInput } from "./stage-state";

function input(): StageInput {
	return {
		list: [],
		offerFor: vi.fn(),
		offers: [],
		order: { count: 1, customURL: "", image: "standard" },
		orderContext: true,
		priceOf: vi.fn(),
		receipts: [],
		records: {},
		serverOf: vi.fn(),
		states: {},
		team: "lab",
	};
}
describe("machine preview availability", () => {
	it("focuses the right tray and status for a VM and bare-metal server sharing a name", () => {
		const vm: VM = {
			cpu_cores: 1,
			deployment_id: "vm",
			disk_capacity: 1,
			gpus: [{ count: 1, model: "MI300X" }],
			ip_address: "",
			name: "shared",
			ram_capacity: 1,
			status: "ready",
		};
		const metal = { ...vm, deployment_id: "metal", metal: true };
		const hosts = {
			[machineKey("lab", vm)]: "vm-host",
			[machineKey("lab", metal)]: "metal-host",
		};
		const serverOf = (key: string) => hosts[key];
		const drawing = buildStage({
			...input(),
			focused: metal,
			list: [vm, metal],
			orderContext: false,
			serverOf,
			states: {
				[machineKey("lab", vm)]: { host: "vm-host", state: "running" },
				[machineKey("lab", metal)]: { host: "metal-host", state: "off" },
			},
		});
		expect(layout(drawing).focusHost).toBe("metal-host");
		expect(drawing.machines.map((machine) => machine.mode)).toEqual([
			"ready",
			"off",
		]);
		expect(drawing.readout).toContain("powered off");
	});
	it("reports a completed empty catalog without claiming sizes are loading", () => {
		expect(buildStage(input()).specTitle).toBe("No machines available");
	});
	it("distinguishes loading from a failed inventory request", () => {
		expect(buildStage({ ...input(), offers: undefined }).specTitle).toBe(
			"Loading sizes"
		);
		const failed = buildStage({
			...input(),
			offersError: new Error("Unavailable"),
		});
		expect(failed.specTitle).toBe("Sizes unavailable");
		expect(failed.readout).toContain("Refresh");
	});
});

describe("history drawing", () => {
	it("uses the recorded server and receipt instead of current availability or a reassigned host", () => {
		const receipt: Ended = {
			cents: 500,
			ended_at: "2026-11-10T20:00:00Z",
			gpus: "2× MI300X",
			name: "internal-vm-id",
			ran_ms: 3_600_000,
			server: "original-server",
			team: "lab",
		};
		const historical: StageInput = {
			focusedReceipt: receipt,
			list: [],
			offerFor: () => undefined,
			order: { count: 1, customURL: "", image: "standard" },
			orderContext: false,
			priceOf: () => undefined,
			receipts: [receipt],
			records: {},
			serverOf: () => "newly-assigned-server",
			states: {},
			team: "lab",
		};
		const drawing = buildStage(historical);
		expect(drawing.specTitle).toBe("original-server");
		expect(drawing.preview).toBeUndefined();
		expect(drawing.spec).toContainEqual(["Total", "$5.00"]);
		expect(drawing.machines[0]).toMatchObject({
			host: "original-server",
			mode: "ended",
		});
		expect(drawing.readout).not.toContain(receipt.name);
	});
});
