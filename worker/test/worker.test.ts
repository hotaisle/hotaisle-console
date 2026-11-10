import { describe, expect, it } from "vitest";
import { env, worker } from "./runtime";

const HTTP_ONLY_PATTERN = /HttpOnly/u;
const SECURE_COOKIE_PATTERN = /Secure/u;
const SAME_SITE_PATTERN = /SameSite=Strict/u;
const CLEARED_COOKIE_PATTERN = /Max-Age=0/u;
const SESSION_AUTH_PATTERN = / session:sess-/u;

const ORIGIN = "https://ui.test";
const H = {
	"Content-Type": "application/json",
	"X-Requested-With": "hotaisle-console",
};

/** One browser: keeps the session cookie between calls, like a real one. */
function browser() {
	let cookie = "";
	let requestKey: string | undefined;
	const call = async (
		method: string,
		path: string,
		body?: unknown,
		headers: Record<string, string> = H
	) => {
		const r = await worker.default.fetch(ORIGIN + path, {
			body: body === undefined ? undefined : JSON.stringify(body),
			headers: {
				...headers,
				...(cookie ? { Cookie: cookie } : {}),
				...(requestKey ? { Authorization: `Token ${requestKey}` } : {}),
			},
			method,
		});
		const set = r.headers.get("Set-Cookie");
		if (set) {
			cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
		}
		return {
			headers: r.headers,
			setCookie: set,
			status: r.status,
			text: await r.text(),
		};
	};
	return {
		authorize: (key?: string) => {
			requestKey = key;
		},
		call,
		cookie: () => cookie,
	};
}

const upstreamCalls = async (): Promise<string[]> =>
	(await (
		await env.UPSTREAM.fetch("https://api.test/api/__calls")
	).json()) as string[];

describe("stateless API keys", () => {
	it("releases stable history keys only for verified, same-origin credentials", async () => {
		const alice = browser();
		const bob = browser();
		alice.authorize("tok-alice");
		bob.authorize("tok-bob");
		const first = await alice.call("POST", "/auth/history-key");
		expect(first.status).toBe(200);
		expect(first.headers.get("Cache-Control")).toBe("no-store");
		expect(first.headers.get("Cross-Origin-Resource-Policy")).toBe(
			"same-origin"
		);
		expect(first.setCookie).toBeNull();
		expect(first.text).not.toContain("tok-alice");
		expect(first.text).not.toContain("alice@example.com");
		expect((await alice.call("POST", "/auth/history-key")).text).toBe(
			first.text
		);
		expect((await bob.call("POST", "/auth/history-key")).text).not.toBe(
			first.text
		);
		expect((await browser().call("POST", "/auth/history-key")).status).toBe(
			401
		);
		alice.authorize("revoked-key");
		expect((await alice.call("POST", "/auth/history-key")).status).toBe(401);
		alice.authorize("tok-alice");
		expect(
			(
				await alice.call("POST", "/auth/history-key", undefined, {
					...H,
					Origin: "https://evil.test",
				})
			).status
		).toBe(403);
	});
	it("uses the same history key for email and API-key sign-ins to the same account", async () => {
		const keyLogin = browser();
		keyLogin.authorize("tok-alice");
		const expected = (await keyLogin.call("POST", "/auth/history-key")).text;
		const emailLogin = browser();
		await emailLogin.call("POST", "/auth/email/start", {
			email: "alice@example.com",
		});
		await env.UPSTREAM.fetch(
			"https://api.test/api/__open?email=alice%40example.com"
		);
		await emailLogin.call("POST", "/auth/email/wait");
		expect((await emailLogin.call("POST", "/auth/history-key")).text).toBe(
			expected
		);
		await emailLogin.call("POST", "/auth/signout");
		expect((await emailLogin.call("POST", "/auth/history-key")).status).toBe(
			401
		);
	});
	it("checks a key without creating a session or cookie", async () => {
		const visitor = browser();
		visitor.authorize("tok-alice");
		const result = await visitor.call("GET", "/auth/key");
		expect(result.status).toBe(200);
		expect(result.setCookie).toBeNull();
		expect(visitor.cookie()).toBe("");
		expect(result.text).not.toContain("tok-alice");
		expect(
			JSON.parse((await visitor.call("GET", "/auth/status")).text).signed_in
		).toBe(false);
		visitor.authorize();
		expect((await visitor.call("GET", "/api/user/")).status).toBe(401);
	});
	it("rejects invalid keys and the former cookie-based key endpoint", async () => {
		const visitor = browser();
		visitor.authorize("tok-nobody");
		const result = await visitor.call("GET", "/auth/key");
		expect(result.status).toBe(401);
		expect(result.setCookie).toBeNull();
		expect(
			(await visitor.call("POST", "/auth/key", { key: "tok-alice" })).status
		).toBe(404);
	});
	it("forwards each request with only that visitor's supplied key", async () => {
		const alice = browser();
		const bob = browser();
		alice.authorize("tok-alice");
		bob.authorize("tok-bob");
		expect(
			JSON.parse((await alice.call("GET", "/api/teams/lab/whoami/")).text).who
		).toBe("alice@example.com");
		expect(
			JSON.parse((await bob.call("GET", "/api/teams/lab/whoami/")).text).who
		).toBe("bob@example.com");
		expect(await upstreamCalls()).toContain(
			"GET /teams/lab/whoami/ key:tok-bob"
		);
		alice.authorize();
		expect((await alice.call("GET", "/api/user/")).status).toBe(401);
	});
	it("clears email-session cookies on signout without storing the API key", async () => {
		const visitor = browser();
		visitor.authorize("tok-alice");
		expect((await visitor.call("POST", "/auth/signout")).setCookie).toMatch(
			CLEARED_COOKIE_PATTERN
		);
		visitor.authorize();
		expect((await visitor.call("GET", "/api/user/")).status).toBe(401);
	});
});

describe("the guard", () => {
	it("blocks real account requests from the preview origin", async () => {
		const response = await worker.default.fetch(
			"http://preview.localhost:8787/api/user/",
			{ headers: { ...H, Authorization: "Token tok-alice" } }
		);
		expect(response.status).toBe(403);
		expect(await response.text()).toContain("cannot call the real API");
	});
	it("never exposes development preview routes on a public origin", async () => {
		const result = await worker.default.fetch(`${ORIGIN}/__preview/index.html`);
		expect(result.status).toBe(404);
	});
	it("refuses calls without the custom header, from other origins, or without a session", async () => {
		const b = browser();
		b.authorize("tok-alice");
		expect(
			(
				await b.call("GET", "/api/user/", undefined, {
					"Content-Type": "application/json",
				})
			).status
		).toBe(403);
		expect(
			(
				await b.call("GET", "/api/user/", undefined, {
					...H,
					Origin: "https://evil.example",
				})
			).status
		).toBe(403);
		expect(
			(await b.call("GET", "/api/user/", undefined, { ...H, Origin: ORIGIN }))
				.status
		).toBe(200);
		expect((await browser().call("GET", "/api/user/")).status).toBe(401);
		expect(
			(await browser().call("GET", "/records/machines?team=lab")).status
		).toBe(410);
	});

	it("rejects a tampered cookie", async () => {
		const r = await worker.default.fetch(`${ORIGIN}/api/user/`, {
			headers: {
				...H,
				Cookie: "hai_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			},
		});
		expect(r.status).toBe(401);
	});

	it("serves the app with a strict Content Security Policy", async () => {
		const r = await worker.default.fetch(`${ORIGIN}/`);
		expect(r.status).toBe(200);
		expect(r.headers.get("Content-Security-Policy")).toContain(
			"default-src 'self'"
		);
		expect(await r.text()).toContain('<div id="root">');
	});
});

describe("sign-in with an email link", () => {
	it("waits for the link to be opened, then signs in; the claim ticket never reaches the page", async () => {
		const b = browser();
		const status0 = JSON.parse((await b.call("GET", "/auth/status")).text);
		expect(status0.email_login).toBe(true);
		const start = await b.call("POST", "/auth/email/start", {
			email: "Carol@Example.com",
		});
		expect(start.status).toBe(200);
		expect(await upstreamCalls()).toContain("POST /user/email/login/ -");
		expect(start.text).not.toContain("ticket");
		expect(b.cookie()).not.toContain("ticket");
		expect(
			JSON.parse((await b.call("GET", "/auth/status")).text).waiting_for_email
				.email
		).toBe("carol@example.com");
		expect(
			JSON.parse((await b.call("POST", "/auth/email/wait")).text).done
		).toBe(false);
		expect((await b.call("GET", "/api/user/")).status).toBe(401);
		// the person opens the link in their email
		await env.UPSTREAM.fetch(
			"https://api.test/api/__open?email=carol%40example.com"
		);
		const done = await b.call("POST", "/auth/email/wait");
		expect(done.setCookie).toMatch(HTTP_ONLY_PATTERN);
		expect(done.setCookie).toMatch(SECURE_COOKIE_PATTERN);
		expect(done.setCookie).toMatch(SAME_SITE_PATTERN);
		expect(JSON.parse(done.text)).toMatchObject({
			done: true,
			user: { email: "carol@example.com" },
		});
		expect(
			JSON.parse((await b.call("GET", "/auth/status")).text)
		).toMatchObject({ kind: "email", signed_in: true });
		expect(
			JSON.parse((await b.call("GET", "/api/teams/lab/whoami/")).text).who
		).toBe("carol@example.com");
		// a session from email sign-in goes out as X-Session-Key, never as an API key
		const calls = await upstreamCalls();
		expect(
			calls.filter((c) => c.startsWith("GET /teams/lab/whoami/ session:sess-"))
				.length
		).toBeGreaterThan(0);
		expect(
			calls.some((c) => c.startsWith("GET /teams/lab/whoami/ key:sess-"))
		).toBe(false);
		expect(calls).toContain("POST /user/email/complete/ -");
	});

	it("renews the session as it is used, and switches to the new key", async () => {
		const b = browser();
		await b.call("POST", "/auth/email/start", { email: "dave@example.com" });
		await env.UPSTREAM.fetch(
			"https://api.test/api/__open?email=dave%40example.com"
		);
		expect(
			JSON.parse((await b.call("POST", "/auth/email/wait")).text).done
		).toBe(true);
		const keyIn = async () => {
			await b.call("GET", "/api/teams/lab/whoami/");
			return (await upstreamCalls())
				.filter((c) => c.startsWith("GET /teams/lab/whoami/"))
				.pop();
		};
		const first = await keyIn();
		// the session gets near its end: Hot Aisle answers the next call with a new key
		await env.UPSTREAM.fetch(
			"https://api.test/api/__expire?email=dave%40example.com&in=30"
		);
		const renewing = await b.call("GET", "/api/teams/lab/whoami/");
		expect(renewing.setCookie).toMatch(HTTP_ONLY_PATTERN);
		expect(renewing.text).not.toContain("sess-");
		const after = await keyIn();
		expect(after).toMatch(SESSION_AUTH_PATTERN);
		expect(after).not.toBe(first);
	});

	it("never signs in from an unapproved link", async () => {
		const b = browser();
		await b.call("POST", "/auth/email/start", { email: "erin@example.com" });
		expect(
			JSON.parse((await b.call("POST", "/auth/email/wait")).text).done
		).toBe(false);
		expect(
			JSON.parse((await b.call("GET", "/auth/status")).text).signed_in
		).toBe(false);
	});

	it("refuses something that is not an email address", async () => {
		expect(
			(
				await browser().call("POST", "/auth/email/start", {
					email: "not an email",
				})
			).status
		).toBe(400);
	});
});

describe("retired records endpoints", () => {
	it("refuses reads and writes without opening a storage binding", async () => {
		const visitor = browser();
		visitor.authorize("tok-alice");
		const responses = await Promise.all([
			visitor.call("GET", "/records/history?team=lab"),
			visitor.call("GET", "/records/machines?team=lab"),
			visitor.call("POST", "/records/history", {
				name: "retired",
				team: "lab",
			}),
			visitor.call("POST", "/records/machines", {
				name: "retired",
				team: "lab",
			}),
			visitor.call("POST", "/live/availability/ticket?team=lab"),
			visitor.call("GET", "/live/availability/snapshot?team=lab"),
		]);
		expect(responses.map((response) => response.status)).toEqual([
			410, 410, 410, 410, 410, 410,
		]);
		expect("ACCOUNTS" in env).toBe(false);
		expect("AVAILABILITY" in env).toBe(false);
	});
});
