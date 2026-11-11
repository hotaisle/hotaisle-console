import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudInitVault } from "./cloud-init-vault";

const UNLOCK_FAILURE = /could not unlock/iu;

const key = async () =>
	await crypto.subtle.importKey(
		"raw",
		new Uint8Array(32).fill(7),
		"AES-GCM",
		false,
		["encrypt", "decrypt"]
	);

beforeEach(() => {
	vi.stubGlobal("crypto", webcrypto);
	localStorage.clear();
});

describe("encrypted cloud-init settings", () => {
	it("saves only ciphertext and unlocks it for the same account", async () => {
		const vault = createCloudInitVault();
		await vault.unlock(await key(), "account-a");
		const url = "https://example.invalid/template?token=dummy-secret";
		await vault.save(url);
		const saved = localStorage.getItem(
			"hotaisle-console:cloud-init:v1:account-a"
		);
		expect(saved).toBeTruthy();
		expect(saved).not.toContain(url);
		expect(saved).not.toContain("dummy-secret");
		vault.lock();
		expect(vault.getSnapshot().value).toBe("");
		const reloaded = createCloudInitVault();
		await reloaded.unlock(await key(), "account-a");
		expect(reloaded.getSnapshot().value).toBe(url);
		await reloaded.unlock(await key(), "account-b");
		expect(reloaded.getSnapshot().value).toBe("");
	});
	it("migrates legacy plaintext preferences only after encryption succeeds", async () => {
		const url = "https://example.invalid/legacy?token=dummy";
		localStorage.setItem(
			"hotaisle-ui:prefs",
			JSON.stringify({ customURL: url, theme: "dark" })
		);
		const vault = createCloudInitVault();
		await vault.unlock(await key(), "account-a");
		expect(vault.getSnapshot().value).toBe(url);
		expect(localStorage.getItem("hotaisle-ui:prefs")).toBe(
			JSON.stringify({ theme: "dark" })
		);
		expect(
			localStorage.getItem("hotaisle-console:cloud-init:v1:account-a")
		).not.toContain(url);
	});
	it("preserves unreadable ciphertext without replacing it", async () => {
		const storageKey = "hotaisle-console:cloud-init:v1:account-a";
		localStorage.setItem(storageKey, "damaged ciphertext");
		const vault = createCloudInitVault();
		await vault.unlock(await key(), "account-a");
		expect(vault.getSnapshot().error).toMatch(UNLOCK_FAILURE);
		expect(localStorage.getItem(storageKey)).toBe("damaged ciphertext");
	});
});
