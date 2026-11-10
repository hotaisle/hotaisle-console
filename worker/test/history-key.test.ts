import { describe, expect, it } from "vitest";
import { historyKey } from "../src/history-key";
import handler from "../src/index";
import { env } from "./runtime";

const SECRET = "isolated-history-secret-0123456789abcdef";
const USER = { created: "2026-01-01T00:00:00Z", email: "alice@example.com" };
describe("history key identity and configuration", () => {
	it("separates origins and recreated accounts, and normalizes equivalent identity values", async () => {
		const baseline = await historyKey(SECRET, "https://console.test", {
			teams: [],
			user: USER,
		});
		expect(
			await historyKey(SECRET, "https://console.test", {
				teams: [],
				user: {
					...USER,
					created: "2026-01-01T00:00:00.000Z",
					email: "Alice@Example.com",
				},
			})
		).toEqual(baseline);
		expect(
			await historyKey(SECRET, "https://other.test", { teams: [], user: USER })
		).not.toEqual(baseline);
		expect(
			await historyKey(SECRET, "https://console.test", {
				teams: [],
				user: { ...USER, created: "2026-02-01T00:00:00Z" },
			})
		).not.toEqual(baseline);
		await expect(
			historyKey(SECRET, "https://console.test", {
				teams: [],
				user: { email: USER.email },
			})
		).rejects.toThrow("complete account identity");
	});
	it("fails closed when the dedicated history secret is missing instead of using the session secret", async () => {
		const response = await handler.fetch(
			new Request("https://console.test/auth/history-key", {
				headers: {
					Authorization: "Token tok-alice",
					"X-Requested-With": "hotaisle-console",
				},
				method: "POST",
			}),
			{ ...env, HISTORY_SECRET: undefined }
		);
		expect(response.status).toBe(503);
		expect(await response.text()).toContain(
			"Existing saved history has not been changed"
		);
	});
});
