import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("team API contract", () => {
	it("posts team details and accepts invitations through the same-origin proxy", async () => {
		const team = {
			effective_roles: ["owner"],
			handle: "lab_team-1",
			name: "Lab",
			roles: ["owner"],
		};
		const request = vi
			.fn()
			.mockResolvedValueOnce(Response.json(team))
			.mockResolvedValueOnce(Response.json(team));
		vi.stubGlobal("fetch", request);
		expect(
			await api.createTeam({ handle: team.handle, name: team.name })
		).toEqual(team);
		expect(request).toHaveBeenNthCalledWith(
			1,
			"/api/teams/",
			expect.objectContaining({
				body: JSON.stringify({ handle: team.handle, name: team.name }),
				credentials: "same-origin",
				method: "POST",
			})
		);
		expect(await api.acceptTeamInvitation(team.handle)).toEqual(team);
		expect(request).toHaveBeenNthCalledWith(
			2,
			"/api/teams/lab_team-1/accept-invitation/",
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-Requested-With": "hotaisle-console",
				}),
				method: "POST",
			})
		);
	});
});
