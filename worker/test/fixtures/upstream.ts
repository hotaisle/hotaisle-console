// Isolated upstream fixture: no server, real credentials, or live API calls.
import { verifyTestEmailLogin } from "./email-login-identity.ts";

const API_PREFIX_PATTERN = /^\/api/u;
const TOKEN_PREFIX_PATTERN = /^Bearer /u;
const LIFETIME = 20 * 60_000;
export const KEYS = {
	"ha_ak_lookup.secret": "alice@example.com",
	"lookup.secret": "alice@example.com",
	"tok-alice": "alice@example.com",
	"tok-bob": "bob@example.com",
};
interface Login {
	email: string;
	expires: number;
	opened: boolean;
}
interface Session {
	email: string;
	expires: number;
	refreshExpires: number;
	revoked: boolean;
}
interface Verifier {
	family: Session;
	spent: boolean;
}
interface FixtureRequest {
	headers: { get: (name: string) => string | null };
	json: () => Promise<unknown>;
	method: string;
	text: () => Promise<string>;
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
export function fakeHotAisle(now: () => number) {
	const calls: string[] = [];
	const logins = new Map<string, Login>();
	const tokens = new Map(Object.entries(KEYS));
	const sessions = new Map<string, { family: Session; expires: number }>();
	const refreshTokens = new Map<string, Verifier>();
	const settings = new Map<string, URLSearchParams>();
	function credential(kind: "at" | "rt") {
		const bytes = crypto.getRandomValues(new Uint8Array(44));
		const hex = Array.from(bytes, (byte) =>
			byte.toString(16).padStart(2, "0")
		).join("");
		return `ha_${kind}_${hex.slice(0, 24)}.${hex.slice(24)}`;
	}
	function issue(family: Session, handle: string, accessLifetime = LIFETIME) {
		const access = credential("at");
		const refreshToken = credential("rt");
		const expires = Math.min(now() + accessLifetime, family.refreshExpires);
		sessions.set(access, { expires, family });
		refreshTokens.set(refreshToken, { family, spent: false });
		return {
			access_token: access,
			access_token_expires_at: new Date(expires).toISOString(),
			refresh_token: refreshToken,
			refresh_token_expires_at: new Date(family.refreshExpires).toISOString(),
			session_expires_at: new Date(family.expires).toISOString(),
			session_handle: handle,
			token_type: "Bearer",
		};
	}
	async function login(request: FixtureRequest) {
		const body = await request.text();
		if (!(await verifyTestEmailLogin(request, body, now()))) {
			return json({ message: "Unverified fixture client" }, 401);
		}
		const { email } = JSON.parse(body) as { email: string };
		const ticket = `ticket-${crypto.randomUUID()}`;
		const pending = {
			email: String(email).toLowerCase(),
			expires: now() + 15 * 60_000,
			opened: false,
		};
		logins.set(ticket, pending);
		return json({
			claim_ticket: ticket,
			email: pending.email,
			expires_at: new Date(pending.expires).toISOString(),
		});
	}
	async function wait(request: FixtureRequest) {
		const { claim_ticket } = (await request.json()) as TicketRequest;
		const pending = logins.get(claim_ticket);
		if (!pending || pending.expires <= now()) {
			return json({ message: "unknown ticket" }, 401);
		}
		return new Response(null, { status: pending.opened ? 204 : 202 });
	}
	const handles = new Map<Session, string>();
	async function complete(request: FixtureRequest) {
		const { claim_ticket } = (await request.json()) as TicketRequest;
		const pending = logins.get(claim_ticket);
		if (!pending?.opened || pending.expires <= now()) {
			return json({ message: "not approved, expired, or already used" }, 401);
		}
		logins.delete(claim_ticket);
		const family = {
			email: pending.email,
			expires: now() + 30 * 86_400_000,
			refreshExpires: now() + 7 * 86_400_000,
			revoked: false,
		};
		const handle = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
		handles.set(family, handle);
		const config = settings.get(family.email);
		const pair = issue(
			family,
			handle,
			Number(config?.get("access_in") ?? 1200) * 1000
		);
		if (config?.get("complete") === "malformed") {
			return json({ ...pair, refresh_token: pair.access_token });
		}
		return json(pair);
	}
	async function refresh(request: FixtureRequest) {
		if (
			request.headers.get("Authorization") ||
			request.headers.get("Content-Type") !==
				"application/x-www-form-urlencoded"
		) {
			return json({ message: "Invalid refresh transport" }, 400);
		}
		const form = new URLSearchParams(await request.text());
		const verifier = refreshTokens.get(form.get("refresh_token") ?? "");
		if (
			form.get("grant_type") !== "refresh_token" ||
			!verifier ||
			verifier.spent ||
			verifier.family.revoked ||
			verifier.family.refreshExpires <= now() ||
			verifier.family.expires <= now()
		) {
			return json({ message: "Invalid refresh token" }, 401);
		}
		verifier.spent = true;
		const { family } = verifier;
		const pair = issue(family, handles.get(family) ?? "");
		switch (settings.get(family.email)?.get("refresh")) {
			case "lost":
				throw new Error("Fixture lost renewal response");
			case "malformed":
				return json({ ...pair, token_type: "Token" });
			case "handle":
				return json({
					...pair,
					session_handle:
						(pair.session_handle.startsWith("0") ? "1" : "0") +
						pair.session_handle.slice(1),
				});
			case "deadline":
				return json({
					...pair,
					session_expires_at: new Date(family.expires + 1000).toISOString(),
				});
			case "missing":
				return json({ ...pair, refresh_token: undefined });
			case "credential":
				return json({ ...pair, access_token: "ha_at_malformed" });
			case "ordering":
				return json({
					...pair,
					access_token_expires_at: new Date(
						family.refreshExpires + 1000
					).toISOString(),
				});
			case "same-refresh":
				return json({ ...pair, refresh_token: form.get("refresh_token") });
			case "expired":
				return json({
					...pair,
					access_token_expires_at: new Date(now()).toISOString(),
				});
			case "rejected":
				return json({ message: "Rejected" }, 401);
			default:
				return json(pair);
		}
	}
	async function logout(request: FixtureRequest) {
		if (request.headers.get("Authorization")) {
			return json({ message: "Invalid logout transport" }, 400);
		}
		const { refresh_token } = (await request.json()) as {
			refresh_token: string;
		};
		const verifier = refreshTokens.get(refresh_token);
		if (!verifier) {
			return json({ message: "Unknown verifier" }, 401);
		}
		if (settings.get(verifier.family.email)?.get("logout") === "fail") {
			return json({ message: "Revocation unavailable" }, 503);
		}
		verifier.family.revoked = true;
		return new Response(null, { status: 204 });
	}
	function control(path: string, url: URL): Response | undefined {
		if (path === "/__calls") {
			return json(calls);
		}
		if (path === "/__configure") {
			settings.set(url.searchParams.get("email") ?? "", url.searchParams);
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
	const routes: Record<string, (request: FixtureRequest) => Promise<Response>> =
		{
			"/auth/logout/": logout,
			"/auth/token/": refresh,
			"/user/email/complete/": complete,
			"/user/email/login/": login,
			"/user/email/wait/": wait,
		};
	function resourceResponse(
		request: FixtureRequest,
		path: string,
		token: string
	) {
		const live = sessions.get(token);
		if (live && (live.expires <= now() || live.family.revoked)) {
			return json({ message: "Session expired" }, 401);
		}
		const email = live ? live.family.email : tokens.get(token);
		if (!email) {
			return json({ message: "Invalid token" }, 401);
		}
		if (path === "/fixture/forbidden/") {
			return json({ message: "Forbidden" }, 403);
		}
		if (path === "/fixture/missing/") {
			return json({ message: "Not found" }, 404);
		}
		if (path === "/fixture/unauthorized/") {
			return json({ message: "Unauthorized" }, 401);
		}
		if (path === "/user/" && settings.get(email)?.get("identity") === "fail") {
			return json({ message: "Identity unavailable" }, 503);
		}
		return accountResponse(request, path, email);
	}
	function fetch(input: FixtureRequest | string | URL, init?: RequestInit) {
		const request = fixtureRequest(input, init);
		const url = new URL(request.url);
		const path = url.pathname.replace(API_PREFIX_PATTERN, "");
		const authorization = request.headers.get("Authorization") ?? "";
		const token = TOKEN_PREFIX_PATTERN.test(authorization)
			? authorization.replace(TOKEN_PREFIX_PATTERN, "")
			: "";
		const label = token
			? `${token.startsWith("ha_at_") ? "session" : "key"}:${token}`
			: "-";
		calls.push(`${request.method} ${path}${url.search} ${label}`);
		const command = control(path, url);
		if (command) {
			return command;
		}
		if (request.headers.get("X-Session-Key")) {
			return json({ message: "Legacy session headers are not accepted" }, 401);
		}
		const route = routes[path];
		if (request.method === "POST" && route) {
			return route(request);
		}
		return resourceResponse(request, path, token);
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
