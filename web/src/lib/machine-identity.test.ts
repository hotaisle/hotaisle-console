import { describe, expect, it } from "vitest";
import { machineKey, parseMachineKey } from "../../../shared/machine-identity";
import { viewFromPath, viewPath } from "../app/route-state";
import { vtName } from "./motion";

describe("machine API identity", () => {
	it("uses deployment IDs independently of display names", () => {
		const rental = { deployment_id: "rental-1", name: "server" };
		expect(machineKey("lab", rental)).toBe(
			machineKey("lab", { ...rental, name: "renamed" })
		);
		expect(machineKey("lab", rental)).not.toBe(
			machineKey("lab", { ...rental, deployment_id: "rental-2" })
		);
		expect(viewPath("lab", "home", machineKey("lab", rental))).toBe(
			"/teams/lab/machines/virtual_machines/rental-1"
		);
	});
	it("does not interpret resource or team names as page names", () => {
		for (const name of [
			"launch",
			"settings",
			"credits",
			"image",
			"history",
			"keys",
		]) {
			expect(
				viewFromPath(`/teams/history/machines/virtual_machines/${name}`)
			).toBe("home");
			expect(viewFromPath(`/teams/history/history/bare_metal/${name}`)).toBe(
				"run"
			);
		}
	});
	it("separates teams, collections, and delimiter-containing names without losing their original values", () => {
		const vm = { name: 'same/:"雪' };
		const keys = [
			machineKey("a", vm),
			machineKey("b", vm),
			machineKey("a", { ...vm, metal: true }),
		];
		expect(new Set(keys).size).toBe(3);
		expect(parseMachineKey(keys[0])).toEqual({
			metal: false,
			name: vm.name,
			team: "a",
		});
		expect(viewPath("a", "home", keys[0])).toBe(
			`/teams/a/machines/virtual_machines/${encodeURIComponent(vm.name)}`
		);
		expect(viewPath("a", "run", keys[2])).toBe(
			`/teams/a/history/bare_metal/${encodeURIComponent(vm.name)}`
		);
		expect(parseMachineKey('["a","other","name"]')).toBeUndefined();
	});
	it("keeps animation names distinct for punctuation, Unicode, and resource kinds", () => {
		const identities = [
			machineKey("a", { name: "a.b" }),
			machineKey("a", { name: "a_b" }),
			machineKey("a", { name: "雪" }),
			machineKey("a", { metal: true, name: "a.b" }),
		];
		expect(new Set(identities.map((id) => vtName("machine", id))).size).toBe(4);
	});
});
