import type { TeamMember, TeamRole } from "../src/lib/api";

const ROLES = new Set(["owner", "purchaser", "operator", "user"]);
const EMAIL = /^[^\s@]+@[^\s@]+$/u;
const encoder = new TextEncoder();
const json = (value: unknown, status = 200) =>
	Response.json(value, { headers: { "Cache-Control": "no-store" }, status });

/** Memory-only team members and invitations. This fixture never sends an email. */
export class PreviewTeamMembers {
	private readonly members: TeamMember[];
	constructor(roles: TeamRole[], includeShowcaseTeammate: boolean) {
		this.members = [
			{
				created: "2026-01-01T00:00:00Z",
				email: "preview@example.invalid",
				name: "Development preview",
				roles: [...roles],
			},
		];
		if (includeShowcaseTeammate) {
			this.members.push({
				created: "2026-01-01T00:00:00Z",
				email: "riley@example.invalid",
				name: "Riley Chen",
				roles: ["operator"],
			});
		}
	}
	all() {
		return structuredClone(this.members);
	}
	async update(request: Request, email: string) {
		if (request.method !== "PATCH") {
			return json({ message: "Method not allowed." }, 405);
		}
		const member = this.members.find(
			(item) => item.email === email.toLowerCase() && !item.invitation
		);
		if (!member) {
			return json({ message: "Member not found." }, 404);
		}
		const body: unknown = await request.json();
		if (
			!(
				body &&
				typeof body === "object" &&
				"roles" in body &&
				Array.isArray(body.roles) &&
				body.roles.every((role) => typeof role === "string" && ROLES.has(role))
			)
		) {
			return json({ message: "Choose valid permissions." }, 422);
		}
		member.roles = [...new Set(body.roles)] as TeamRole[];
		return json(member);
	}
	async invitations(request: Request, now: number) {
		if (request.method === "GET") {
			return json(this.all().filter((member) => member.invitation));
		}
		if (request.method !== "POST") {
			return json({ message: "Method not allowed." }, 405);
		}
		const body: unknown = await request.json();
		if (
			!(
				body &&
				typeof body === "object" &&
				"name" in body &&
				typeof body.name === "string" &&
				body.name.trim() &&
				encoder.encode(body.name.trim()).length <= 100 &&
				"email" in body &&
				typeof body.email === "string" &&
				EMAIL.test(body.email.trim()) &&
				encoder.encode(body.email.trim()).length <= 254 &&
				"roles" in body &&
				Array.isArray(body.roles) &&
				body.roles.every((role) => typeof role === "string" && ROLES.has(role))
			)
		) {
			return json(
				{ message: "Enter a valid name, email, and permissions." },
				422
			);
		}
		const email = body.email.trim().toLowerCase();
		if (this.members.some((member) => member.email === email)) {
			return json({ message: "Member already exists in this team." }, 409);
		}
		this.members.push({
			created: new Date(now).toISOString(),
			email,
			invitation: true,
			name: body.name.trim(),
			roles: [...new Set(body.roles)] as TeamRole[],
		});
		return new Response(null, { status: 204 });
	}
}
