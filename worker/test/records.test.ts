import { describe, expect, it } from "vitest";
import {
	addEnded,
	type Ended,
	emptyRecords,
	historyOf,
	pruneMachines,
	updateMachine,
} from "../../shared/records";

describe("records", () => {
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
		expect(s.machines["t/a"]).toMatchObject({
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
		expect(Object.keys(s.machines)).toEqual(["t/new"]);
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
