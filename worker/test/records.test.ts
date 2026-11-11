import { describe, expect, it } from "vitest";
import { machineKey } from "../../shared/machine-identity";
import {
	addEnded,
	type Ended,
	emptyRecords,
	historyOf,
	pruneMachines,
	recordsByIdentity,
	removeMachine,
	updateMachine,
} from "../../shared/records";

describe("records", () => {
	it("preserves distinct rentals when a machine name is reused", () => {
		const s = emptyRecords();
		const first = {
			deployment_id: "first",
			name: "shared",
			price_cents: 299,
			team: "lab",
		};
		const second = { ...first, deployment_id: "second", price_cents: 598 };
		for (const rental of [first, second]) {
			updateMachine(s, rental);
			addEnded(s, { ...rental, ended_at: "2030-01-01", gpus: "1×" });
		}
		expect(s.history).toHaveLength(2);
		removeMachine(s, "lab", first);
		expect(s.machines[machineKey("lab", second)]?.price_cents).toBe(598);
	});
	it("reads legacy launch metadata only for an unambiguous kind/name match without overriding exact IDs", () => {
		const legacy = { name: "shared", price_cents: 299, team: "lab" };
		const vm = { deployment_id: "first", name: "shared" };
		const metal = { ...vm, deployment_id: "metal", metal: true };
		expect(
			recordsByIdentity("lab", [legacy], [vm, metal])[machineKey("lab", vm)]
		).toBe(legacy);
		expect(
			recordsByIdentity("lab", [legacy], [vm, metal])[machineKey("lab", metal)]
		).toBeUndefined();
		const second = { ...vm, deployment_id: "second" };
		expect(
			recordsByIdentity("lab", [legacy], [vm, second])[machineKey("lab", vm)]
		).toBeUndefined();
		const exact = { ...legacy, ...vm, price_cents: 598 };
		expect(
			recordsByIdentity("lab", [exact, legacy], [vm])[machineKey("lab", vm)]
		).toBe(exact);
	});
	it("keeps same-name records and receipts independent by team and machine kind", () => {
		const s = emptyRecords();
		const vm = { name: "shared", price_cents: 299, team: "lab" };
		const metal = { ...vm, metal: true, price_cents: 2392 };
		updateMachine(s, vm);
		updateMachine(s, metal);
		updateMachine(s, { ...vm, team: "other" });
		expect(Object.keys(s.machines)).toHaveLength(3);
		pruneMachines(s, "lab", [machineKey("lab", metal)]);
		expect(s.machines[machineKey("lab", vm)]).toBeUndefined();
		expect(s.machines[machineKey("lab", metal)]?.price_cents).toBe(2392);
		removeMachine(s, "lab", { name: "shared" });
		expect(s.machines[machineKey("lab", metal)]).toBeDefined();
		for (const resource of [vm, metal, { ...vm, team: "other" }]) {
			addEnded(s, { ...resource, ended_at: "2030-01-01", gpus: "1×" });
		}
		expect(s.history).toHaveLength(3);
	});
	it("records a launch once, keeping the first launch time", () => {
		const s = emptyRecords();
		updateMachine(
			s,
			{ image: "vllm", launched: true, name: "a", price_cents: 299, team: "t" },
			Date.parse("2026-01-01T00:00:00Z")
		);
		updateMachine(
			s,
			{ launched: true, name: "a", team: "t" },
			Date.parse("2026-01-01T01:00:00Z")
		);
		expect(s.machines[machineKey("t", { name: "a" })]).toMatchObject({
			image: "vllm",
			launched_at: "2026-01-01T00:00:00.000Z",
			price_cents: 299,
		});
	});

	it("never forgets a machine launched in the last few minutes, whatever a list says", () => {
		const s = emptyRecords();
		const now = Date.now();
		updateMachine(s, { launched: true, name: "new", team: "t" }, now);
		updateMachine(
			s,
			{ launched: true, name: "old", team: "t" },
			now - 3_600_000
		);
		pruneMachines(s, "t", [], now);
		expect(Object.keys(s.machines)).toEqual([machineKey("t", { name: "new" })]);
	});

	it("keeps the newest entries per team, one per machine", () => {
		const s = emptyRecords();
		const e = (name: string): Ended => ({
			ended_at: "",
			gpus: "1×",
			name,
			team: "t",
		});
		for (let i = 0; i < 1005; i += 1) {
			addEnded(s, e(`m${i}`));
		}
		addEnded(s, e("m24"));
		const h = historyOf(s, "t");
		expect(h.length).toBe(1005);
		expect(h.filter((x) => x.name === "m24").length).toBe(1);
	});
});
