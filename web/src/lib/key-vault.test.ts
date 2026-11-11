import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keyVault } from "./key-vault";

const TOKEN = "fixture-api-key-do-not-use";
const PASSPHRASE = "a long local fixture passphrase";
beforeEach(() => {
	vi.stubGlobal("crypto", webcrypto);
	localStorage.clear();
	keyVault.lock();
});
afterEach(() => {
	keyVault.forget();
	vi.unstubAllGlobals();
});
describe("browser key vault", () => {
	it("stores ciphertext and clears the unlocked key when locked", async () => {
		await keyVault.save(TOKEN, PASSPHRASE);
		expect(keyVault.token()).toBe(TOKEN);
		const stored = localStorage.getItem("hotaisle-console:key-vault:v1");
		expect(stored).not.toContain(TOKEN);
		expect(stored).not.toContain(PASSPHRASE);
		keyVault.lock();
		expect(keyVault.token()).toBeUndefined();
		expect(keyVault.isSaved()).toBe(true);
		await keyVault.unlock(PASSPHRASE);
		expect(keyVault.token()).toBe(TOKEN);
	});
	it("rejects the wrong passphrase without unlocking", async () => {
		await keyVault.save(TOKEN, PASSPHRASE);
		keyVault.lock();
		await expect(keyVault.unlock("the wrong local passphrase")).rejects.toThrow(
			"Could not unlock"
		);
		expect(keyVault.token()).toBeUndefined();
	});
	it("uses new salt and IV values for each saved copy", async () => {
		await keyVault.save(TOKEN, PASSPHRASE);
		const first = localStorage.getItem("hotaisle-console:key-vault:v1");
		await keyVault.save(TOKEN, PASSPHRASE);
		expect(localStorage.getItem("hotaisle-console:key-vault:v1")).not.toBe(
			first
		);
	});
	it("rejects a changed ciphertext and never exposes the token", async () => {
		await keyVault.save(TOKEN, PASSPHRASE);
		keyVault.lock();
		const saved = JSON.parse(
			localStorage.getItem("hotaisle-console:key-vault:v1") ?? "{}"
		);
		saved.ciphertext = `AAAA${saved.ciphertext.slice(4)}`;
		localStorage.setItem(
			"hotaisle-console:key-vault:v1",
			JSON.stringify(saved)
		);
		await expect(keyVault.unlock(PASSPHRASE)).rejects.toThrow(
			"Could not unlock"
		);
		expect(keyVault.token()).toBeUndefined();
	});
	it("forgets both the saved and unlocked key", async () => {
		await keyVault.save(TOKEN, PASSPHRASE);
		keyVault.forget();
		expect(keyVault.isSaved()).toBe(false);
		expect(keyVault.token()).toBeUndefined();
	});
});
