// Isolated upstream fixture: no server, real credentials, or live API calls.
const API_PREFIX_PATTERN = /^\/api/u;
const TOKEN_PREFIX_PATTERN = /^Token /u;
const LIFETIME = 20 * 60_000;
export const KEYS = {
	"tok-alice": "alice@example.com",
	"tok-bob": "bob@example.com",
};
interface Login {
	email: string;
	opened: boolean;
	token: string;
}
interface Session {
	email: string;
	expires: number;
}
interface FixtureRequest {
	headers: { get: (name: string) => string | null };
	json: () => Promise<unknown>;
	method: string;
	url: string;
}
interface TicketRequest {
	claim_ticket: string;
}
function json(value: unknown, status = 200) {
	return Response.json(value, { status });
}
function accountResponse(request: FixtureRequest, path: string, email: string) {
	if (path === "/user/") {
		return json({
			teams: [
				{
					effective_roles: ["owner"],
					handle: "lab",
					name: "Lab",
					roles: ["owner"],
				},
			],
			user: {
				created: "2026-01-01T00:00:00Z",
				email,
				name: email.split("@")[0],
			},
		});
	}
	if (request.method === "DELETE") {
		return new Response(null, { status: 204 });
	}
	if (path.endsWith("/whoami/")) {
		return json({ path, who: email });
	}
	if (path.endsWith("/balance/")) {
		return json({
			available_balance: 0,
			bare_metal_server_count: 0,
			hourly_rate: 0,
			minimum_balance: 1000,
			virtual_machine_count: 0,
		});
	}
	if (path === "/teams/lab/virtual_machines/available/") {
		return json([
			{
				MinimumReservationMinutes: 30,
				OnDemandPrice: 600,
				Quantity: 1,
				Specs: {
					cpu_cores: 32,
					disk_capacity: 100,
					gpus: [{ count: 2, manufacturer: "AMD", model: "MI300X" }],
					ram_capacity: 128,
				},
			},
		]);
	}
	if (request.method === "GET") {
		return json([]);
	}
	return json({ message: "the isolated upstream fixture only signs in" }, 400);
}
export function fakeHotAisle() {
	const calls: string[] = [];
	const logins = new Map<string, Login>();
	const tokens = new Map(Object.entries(KEYS));
	const sessions = new Map<string, Session>();
	async function login(request: FixtureRequest) {
		const { email } = (await request.json()) as { email: string };
		const ticket = `ticket-${crypto.randomUUID()}`;
		const pending = {
			email: String(email).toLowerCase(),
			opened: false,
			token: `sess-${crypto.randomUUID()}`,
		};
		logins.set(ticket, pending);
		return json({
			claim_ticket: ticket,
			email: pending.email,
			expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
		});
	}
	async function wait(request: FixtureRequest) {
		const { claim_ticket } = (await request.json()) as TicketRequest;
		const pending = logins.get(claim_ticket);
		if (!pending) {
			return json({ message: "unknown ticket" }, 401);
		}
		if (!pending.opened) {
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
		return new Response(null, { status: pending.opened ? 204 : 202 });
	}
	async function complete(request: FixtureRequest) {
		const { claim_ticket } = (await request.json()) as TicketRequest;
		const pending = logins.get(claim_ticket);
		if (!pending?.opened) {
			return json({ message: "not approved, expired, or already used" }, 401);
		}
		const expires = Date.now() + LIFETIME;
		sessions.set(pending.token, { email: pending.email, expires });
		logins.delete(claim_ticket);
		return new Response(null, {
			headers: {
				"X-New-Session-Key": pending.token,
				"X-Session-Key-Expires": new Date(expires).toUTCString(),
			},
			status: 204,
		});
	}
	function control(path: string, url: URL): Response | undefined {
		if (path === "/__calls") {
			return json(calls);
		}
		if (path === "/__expire") {
			for (const session of sessions.values()) {
				if (session.email === url.searchParams.get("email")) {
					session.expires =
						Date.now() + Number(url.searchParams.get("in") ?? 30) * 1000;
				}
			}
			return json({ ok: true });
		}
		if (path === "/__open") {
			const pending = [...logins.values()].find(
				(value) => value.email === url.searchParams.get("email")
			);
			if (!pending) {
				return json({ error: "no login for that email" }, 404);
			}
			pending.opened = true;
			return json({ ok: true });
		}
		return undefined;
	}
	function renewal(session: Session | undefined, email: string) {
		if (!session || session.expires - Date.now() >= 60_000) {
			return;
		}
		const token = `sess-${crypto.randomUUID()}`;
		const expires = Date.now() + LIFETIME;
		sessions.set(token, { email, expires });
		return {
			"X-New-Session-Key": token,
			"X-Session-Key-Expires": new Date(expires).toUTCString(),
		};
	}
	const emailRoutes: Record<
		string,
		(request: FixtureRequest) => Promise<Response>
	> = {
		"/user/email/complete/": complete,
		"/user/email/login/": login,
		"/user/email/wait/": wait,
	};
	function credentialLabel(session: string, key: string) {
		if (session) {
			return `session:${session}`;
		}
		if (key) {
			return `key:${key}`;
		}
		return "-";
	}
	function fetch(input: FixtureRequest | string | URL, init?: RequestInit) {
		const request = fixtureRequest(input, init);
		const url = new URL(request.url);
		const path = url.pathname.replace(API_PREFIX_PATTERN, "");
		const key = (request.headers.get("Authorization") ?? "").replace(
			TOKEN_PREFIX_PATTERN,
			""
		);
		const session = request.headers.get("X-Session-Key") ?? "";
		calls.push(
			`${request.method} ${path}${url.search} ${credentialLabel(session, key)}`
		);
		const command = control(path, url);
		if (command) {
			return command;
		}
		const emailRoute = emailRoutes[path];
		if (request.method === "POST" && emailRoute) {
			return emailRoute(request);
		}
		const live = sessions.get(session);
		if (live !== undefined && live.expires <= Date.now()) {
			return json({ message: "Session expired" }, 401);
		}
		const email = session ? live?.email : tokens.get(key);
		if (!email) {
			return json({ message: "Invalid token" }, 401);
		}
		const response = accountResponse(request, path, email);
		const fresh = renewal(live, email);
		if (fresh) {
			for (const [name, value] of Object.entries(fresh)) {
				response.headers.set(name, value);
			}
		}
		return response;
	}
	return { calls, fetch };
}

function fixtureRequest(
	input: FixtureRequest | string | URL,
	init?: RequestInit
) {
	return typeof input === "string" || input instanceof URL
		? new Request(input, init)
		: input;
}
