import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryWrapper } from "../../../test/render";
import { useSessionActions } from "../../hooks/use-session";
import { api } from "../../lib/api";
import { useSessionRecords } from "./use-session-records";

afterEach(() => vi.unstubAllGlobals());
describe("browser record lifecycle", () => {
	it("keeps derived lists stable until the vault snapshot or selected team changes", () => {
		const { result, rerender } = renderHook(
			({ team }) => useSessionRecords(team),
			{ initialProps: { team: "lab" } }
		);
		const initial = result.current;
		rerender({ team: "lab" });
		expect(result.current.history).toBe(initial.history);
		expect(result.current.records).toBe(initial.records);
		act(() => result.current.record({ launched: true, name: "vm-one" }));
		expect(result.current.records).toHaveLength(1);
		const updated = result.current;
		rerender({ team: "lab" });
		expect(result.current.history).toBe(updated.history);
		expect(result.current.records).toBe(updated.records);
		rerender({ team: "other" });
		expect(result.current.records).toEqual([]);
		rerender({ team: "lab" });
		expect(result.current.records[0].name).toBe("vm-one");
	});
	it("keeps unsaved fallback records in memory without plaintext storage writes", async () => {
		const fetchRequest = vi.fn();
		vi.stubGlobal("fetch", fetchRequest);
		const persist = vi.spyOn(Storage.prototype, "setItem");
		const { Wrapper } = queryWrapper();
		const { result, rerender } = renderHook(
			({ team }) => useSessionRecords(team),
			{ initialProps: { team: "lab" }, wrapper: Wrapper }
		);
		act(() =>
			result.current.record({
				launched: true,
				name: "vm-one",
				price_cents: 598,
			})
		);
		await waitFor(() =>
			expect(result.current.records[0]).toMatchObject({
				name: "vm-one",
				price_cents: 598,
			})
		);
		act(() =>
			result.current.rememberEnd({
				ended_at: new Date().toISOString(),
				gpus: "2× MI300X",
				name: "vm-one",
				team: "lab",
			})
		);
		await waitFor(() => expect(result.current.records).toEqual([]));
		expect(result.current.history).toHaveLength(1);
		rerender({ team: "other" });
		expect(result.current.history).toEqual([]);
		rerender({ team: "lab" });
		expect(result.current.history).toHaveLength(1);
		expect(fetchRequest).not.toHaveBeenCalled();
		expect(persist).not.toHaveBeenCalled();
	});
	it("clears decrypted account data when signing out", async () => {
		vi.spyOn(api, "signOut").mockResolvedValue({ ok: true });
		const { Wrapper } = queryWrapper();
		const { result } = renderHook(
			() => ({
				memory: useSessionRecords("lab"),
				session: useSessionActions(),
			}),
			{ wrapper: Wrapper }
		);
		act(() =>
			result.current.memory.record({ launched: true, name: "private-machine" })
		);
		await waitFor(() => expect(result.current.memory.records).toHaveLength(1));
		await act(async () => {
			await result.current.session.logout.mutateAsync();
		});
		await waitFor(() => expect(result.current.memory.records).toEqual([]));
		expect(result.current.memory.history).toEqual([]);
	});
});
