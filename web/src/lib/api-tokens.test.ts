import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("API token resource", () => {
	it("uses JSON mutations with encoded metadata prefixes and same-origin credentials", async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(Response.json([]))
			.mockResolvedValueOnce(Response.json({ token: "fixture-secret" }))
			.mockResolvedValueOnce(Response.json({ prefix: "fixture/a" }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", request);
		await api.apiTokens();
		const body = { label: "Fixture", teams: [], user_role: "user" as const };
		await api.createAPIToken(body);
		await api.updateAPIToken("fixture/a", body);
		await api.revokeAPIToken("fixture/a");
		expect(request).toHaveBeenNthCalledWith(
			1,
			"/api/user/api_keys/",
			expect.objectContaining({ method: "GET" })
		);
		expect(request).toHaveBeenNthCalledWith(
			2,
			"/api/user/api_keys/",
			expect.objectContaining({
				body: JSON.stringify(body),
				credentials: "same-origin",
				method: "POST",
			})
		);
		expect(request).toHaveBeenNthCalledWith(
			3,
			"/api/user/api_keys/fixture%2Fa/",
			expect.objectContaining({ method: "PATCH" })
		);
		expect(request).toHaveBeenNthCalledWith(
			4,
			"/api/user/api_keys/fixture%2Fa/",
			expect.objectContaining({ method: "DELETE" })
		);
	});
});
