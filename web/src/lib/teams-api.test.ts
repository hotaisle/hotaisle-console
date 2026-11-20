import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIError, TeamMemberInvitation } from "./api";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("team API contract", () => {
	it("updates member roles through an encoded same-origin PATCH", async () => {
		const member = {
			created: "2026-01-01",
			email: "dana/ops+gpu@example.com",
			name: "Dana",
			roles: ["user", "operator"] as const,
		};
		const request = vi.fn().mockResolvedValue(Response.json(member));
		vi.stubGlobal("fetch", request);
		expect(
			await api.updateTeamMember("lab/team", member.email, ["user", "operator"])
		).toEqual(member);
		expect(request).toHaveBeenCalledWith(
			"/api/teams/lab%2Fteam/members/dana%2Fops%2Bgpu%40example.com/",
			expect.objectContaining({
				body: JSON.stringify({ roles: ["user", "operator"] }),
				credentials: "same-origin",
				method: "PATCH",
			})
		);
	});
	it("encodes the team and sends invitation details as same-origin JSON with a 204 response", async () => {
		const invitation: TeamMemberInvitation = {
			email: "dana+gpu@example.com",
			name: "Dana Doe",
			roles: ["user", "operator"],
		};
		const request = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", request);
		expect(await api.inviteTeamMember("lab/team", invitation)).toBeUndefined();
		expect(request).toHaveBeenCalledWith(
			"/api/teams/lab%2Fteam/members/invitations/",
			expect.objectContaining({
				body: JSON.stringify(invitation),
				credentials: "same-origin",
				headers: expect.objectContaining({
					"Content-Type": "application/json",
					"X-Requested-With": "hotaisle-console",
				}),
				method: "POST",
			})
		);
	});
	it.each([403, 409])(
		"propagates a rejected invitation (%s) without synthesizing success",
		async (status) => {
			vi.stubGlobal(
				"fetch",
				vi
					.fn()
					.mockResolvedValue(Response.json({ message: "Rejected" }, { status }))
			);
			await expect(
				api.inviteTeamMember("lab", {
					email: "dana@example.com",
					name: "Dana",
					roles: ["user"],
				})
			).rejects.toMatchObject<Partial<APIError>>({
				message: "Rejected",
				status,
			});
		}
	);
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
