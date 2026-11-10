import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHistoryVault, type HistoryKey } from "./history-vault";

const receipt = {
	ended_at: "2026-11-09T12:00:00Z",
	gpus: "2× MI300X",
	name: "private-machine",
	team: "private-team",
};
const bundle = (seed = 1): HistoryKey => ({
	key: btoa(String.fromCharCode(...new Uint8Array(32).fill(seed))),
	scope: btoa(String.fromCharCode(...new Uint8Array(32).fill(seed + 1))),
	version: 1,
});
const storageSnapshot = () =>
	Object.fromEntries(
		Array.from({ length: localStorage.length }, (_, index) => {
			const key = localStorage.key(index) ?? "";
			return [key, localStorage.getItem(key)];
		})
	);
beforeEach(() => {
	vi.stubGlobal("crypto", webcrypto);
	localStorage.clear();
});

describe("encrypted browser history", () => {
	it("does not let a delayed cross-tab refresh replace a newer local receipt", async () => {
		const vault = createHistoryVault();
		await vault.unlock(async () => bundle());
		vault.rememberEnd(receipt);
		await vault.flush();
		let finish: (() => void) | undefined;
		const paused = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
		const request = vi
			.spyOn(crypto.subtle, "decrypt")
			.mockImplementationOnce(async (...args) => {
				await paused;
				return decrypt(...args);
			});
		const refresh = vault.refresh(localStorage.key(0));
		await vi.waitFor(() => expect(request).toHaveBeenCalled());
		vault.rememberEnd({ ...receipt, name: "newer-local-run" });
		await vault.flush();
		finish?.();
		await refresh;
		expect(
			vault.getSnapshot().records.history.map((entry) => entry.name)
		).toEqual(["newer-local-run", receipt.name]);
	});
	it("survives reload and sign-out as ciphertext, never persisting the key or plaintext", async () => {
		const vault = createHistoryVault();
		await vault.unlock(async () => bundle());
		vault.record({ launched: true, name: receipt.name, team: receipt.team });
		vault.rememberEnd(receipt);
		await vault.flush();
		const saved = storageSnapshot();
		expect(Object.keys(saved)).toHaveLength(2);
		const raw = JSON.stringify(saved);
		expect(raw).not.toContain(receipt.name);
		expect(raw).not.toContain(receipt.team);
		expect(raw).not.toContain(bundle().key);
		vault.lock();
		expect(vault.getSnapshot().records.history).toEqual([]);
		expect(storageSnapshot()).toEqual(saved);
		const reloaded = createHistoryVault();
		await reloaded.unlock(async () => bundle());
		expect(reloaded.getSnapshot().records.history).toEqual([receipt]);
		expect(reloaded.getSnapshot().records.machines).toEqual({});
		expect(storageSnapshot()).toEqual(saved);
	});
	it("isolates accounts and preserves every account's encrypted entries", async () => {
		const vault = createHistoryVault();
		await vault.unlock(async () => bundle());
		vault.rememberEnd(receipt);
		await vault.flush();
		const saved = storageSnapshot();
		await vault.unlock(async () => bundle(3));
		expect(vault.getSnapshot().records.history).toEqual([]);
		vault.rememberEnd({ ...receipt, name: "other-user-machine" });
		await vault.flush();
		await vault.unlock(async () => bundle());
		expect(vault.getSnapshot().records.history).toEqual([receipt]);
		expect(localStorage.length).toBe(2);
		expect(storageSnapshot()).toMatchObject(saved);
	});
	it("preserves unreadable ciphertext and refuses to replace it with an empty history", async () => {
		const vault = createHistoryVault();
		await vault.unlock(async () => bundle());
		vault.rememberEnd(receipt);
		await vault.flush();
		const id = localStorage.key(0) ?? "";
		const raw = JSON.parse(localStorage.getItem(id) ?? "{}");
		raw.ciphertext = `AAAA${raw.ciphertext.slice(4)}`;
		localStorage.setItem(id, JSON.stringify(raw));
		const saved = storageSnapshot();
		await vault.unlock(async () => bundle());
		expect(vault.getSnapshot().error).toContain("Could not unlock");
		vault.rememberEnd({ ...receipt, name: "unsaved" });
		await vault.flush();
		expect(storageSnapshot()).toEqual(saved);
		await vault.unlock(async () => ({ ...bundle(), key: bundle(9).key }));
		expect(vault.getSnapshot().error).toContain("Could not unlock");
		expect(storageSnapshot()).toEqual(saved);
	});
	it("does not unlock from a response that arrives after sign-out", async () => {
		const vault = createHistoryVault();
		let release: ((key: HistoryKey) => void) | undefined;
		const opening = vault.unlock(
			() =>
				new Promise((resolve) => {
					release = resolve;
				})
		);
		vault.lock();
		release?.(bundle());
		await opening;
		vault.rememberEnd(receipt);
		await vault.flush();
		expect(localStorage.length).toBe(0);
	});
	it("finishes authorized saves on logout and merges concurrent tabs without overwriting entries", async () => {
		const first = createHistoryVault();
		const second = createHistoryVault();
		await first.unlock(async () => bundle());
		await second.unlock(async () => bundle());
		first.rememberEnd(receipt);
		second.rememberEnd({ ...receipt, name: "second-tab" });
		first.lock();
		await Promise.all([first.flush(), second.flush()]);
		await second.refresh(localStorage.key(0));
		expect(
			second
				.getSnapshot()
				.records.history.map((entry) => entry.name)
				.sort()
		).toEqual(["private-machine", "second-tab"]);
		expect(first.getSnapshot().records.history).toEqual([]);
		expect(localStorage.length).toBe(2);
	});
	it("reports quota failures without deleting or pruning saved entries", async () => {
		const vault = createHistoryVault();
		await vault.unlock(async () => bundle());
		vault.rememberEnd(receipt);
		await vault.flush();
		const saved = storageSnapshot();
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("Full", "QuotaExceededError");
		});
		vault.rememberEnd({ ...receipt, name: "quota-unsaved" });
		await vault.flush();
		expect(vault.getSnapshot().error).toContain("Could not save");
		vault.prune(receipt.team, []);
		vault.lock();
		expect(storageSnapshot()).toEqual(saved);
	});
});
