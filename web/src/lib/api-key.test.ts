import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { keyVault } from "./key-vault";

const TOKEN = "fixture-api-key";
const PASSPHRASE = "a fixture unlock passphrase";
afterEach(() => {
	keyVault.forget();
	vi.unstubAllGlobals();
});
describe("API-key transport", () => {
	it("sends only the request key header and stores no plaintext key or passphrase", async () => {
		vi.stubGlobal("crypto", webcrypto);
		const fetcher = vi.fn().mockImplementation(() =>
			Promise.resolve(
				Response.json({
					teams: [],
					user: { email: "fixture@example.com" },
				})
			)
		);
		vi.stubGlobal("fetch", fetcher);
		await api.signInWithKey(TOKEN, PASSPHRASE);
		expect(fetcher.mock.calls[0][0]).toBe("/auth/key");
		expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
			`Token ${TOKEN}`
		);
		expect(fetcher.mock.calls[0][1].body).toBeUndefined();
		for (const [, options] of fetcher.mock.calls) {
			expect(JSON.stringify(options)).not.toContain(PASSPHRASE);
			expect(options.body).toBeUndefined();
		}
		expect(localStorage.getItem("hotaisle-console:key-vault:v1")).not.toContain(
			TOKEN
		);
		keyVault.lock();
		await api.status();
		const [, lastOptions] = fetcher.mock.calls.at(-1) ?? [];
		expect(lastOptions.headers.Authorization).toBeUndefined();
	});
});
