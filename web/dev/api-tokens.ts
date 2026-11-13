import type { APIToken, APITokenRequest, Team } from "../src/lib/api";

const BASE = "/api/user/api_keys/";
const TRAILING_SLASH = /\/$/u;
const json = (value: unknown, status = 200) => Response.json(value, { status });
type TokenMembership = Pick<Team, "handle" | "name" | "roles">;

export class PreviewAPITokens {
	private readonly memberships: readonly TokenMembership[];
	constructor(memberships: readonly TokenMembership[]) {
		this.memberships = memberships;
	}
	private serial = 1;
	private readonly tokens: APIToken[] = [
		{
			label: "Development",
			prefix: "preview-token-1",
			teams: [
				{
					handle: "preview",
					name: "Development preview",
					roles: ["operator", "user"],
				},
			],
			user_role: "user",
		},
	];
	async request(request: Request): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (request.method === "GET" && path === BASE) {
			return json(this.tokens);
		}
		const prefix = path.slice(BASE.length).replace(TRAILING_SLASH, "");
		const index = this.tokens.findIndex((token) => token.prefix === prefix);
		if (request.method === "DELETE" && index >= 0) {
			this.tokens.splice(index, 1);
			return new Response(null, { status: 204 });
		}
		if (
			!(
				(request.method === "POST" && path === BASE) ||
				(request.method === "PATCH" && index >= 0)
			)
		) {
			return json({ message: "Simulated token not found." }, 404);
		}
		const body = (await request.json()) as APITokenRequest;
		if (
			typeof body.label !== "string" ||
			!["user", "owner"].includes(body.user_role) ||
			(body.teams !== undefined &&
				(!Array.isArray(body.teams) ||
					body.teams.some(
						(team) =>
							!(
								this.memberships.some(
									(membership) => membership.handle === team.team
								) && Array.isArray(team.roles)
							) ||
							team.roles.some(
								(role) =>
									!this.memberships
										.find((membership) => membership.handle === team.team)
										?.roles.includes(role)
							)
					)))
		) {
			return json({ message: "Invalid simulated token permissions." }, 422);
		}
		const teams =
			body.teams?.map((team) => ({
				handle: team.team,
				name:
					this.memberships.find((membership) => membership.handle === team.team)
						?.name ?? team.team,
				roles: team.roles,
			})) ??
			this.tokens[index]?.teams ??
			[];
		if (index < 0) {
			this.serial += 1;
		}
		const details: APIToken = {
			label: body.label,
			prefix: index >= 0 ? prefix : `preview-token-${this.serial}`,
			teams,
			user_role: body.user_role,
		};
		if (index >= 0) {
			this.tokens[index] = details;
			return json(details);
		}
		this.tokens.push(details);
		return json({
			...details,
			token: `${details.prefix}.simulated-token-not-a-real-credential`,
		});
	}
}
