import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { previewMiddleware } from "./serve-preview";

let root: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "console-preview-"));
});
afterEach(async () => {
	await rm(root, { force: true, recursive: true });
});
async function request(
	path: string,
	host = "preview.localhost:8787",
	method = "GET"
) {
	let status = 0;
	let headers: Record<string, string> = {};
	let body = "";
	const next = vi.fn();
	await previewMiddleware(root)(
		{ headers: { host }, method, url: path },
		{
			end(value) {
				body =
					typeof value === "string"
						? value
						: Buffer.from(value ?? []).toString();
			},
			writeHead(code, values) {
				status = code;
				headers = values;
			},
		},
		next
	);
	return { body, headers, next, status };
}
describe("isolated local preview serving", () => {
	it("serves its own assets and never substitutes the normal console for a missing entry", async () => {
		const missing = await request("/__preview/");
		expect(missing.status).toBe(503);
		expect(missing.body).toContain("bun run preview");
		expect(missing.next).not.toHaveBeenCalled();
		await mkdir(join(root, "__preview"));
		await writeFile(
			join(root, "__preview/index.html"),
			"isolated scenario explorer"
		);
		const ready = await request("/__preview/?scenario=running");
		expect(ready.status).toBe(200);
		expect(ready.body).toBe("isolated scenario explorer");
		expect(ready.headers["Cache-Control"]).toBe("no-store");
		expect(
			(await request("/__preview/", "preview.localhost", "HEAD")).body
		).toBe("");
	});
	it("corrects old preview-origin console links and blocks real auth and API requests", async () => {
		expect((await request("/teams/lab/machines")).headers.Location).toBe(
			"/__preview/"
		);
		expect((await request("/__preview")).headers.Location).toBe("/__preview/");
		const denied = await request("/api/user/", "preview.localhost", "POST");
		expect(denied.status).toBe(403);
		expect(denied.next).not.toHaveBeenCalled();
		expect((await request("/auth/history-key")).status).toBe(403);
		expect(
			(await request("/unknown", "preview.localhost", "POST")).status
		).toBe(405);
	});
	it("leaves other hosts alone and refuses traversal, hidden files, and escaping symlinks", async () => {
		expect(
			(await request("/teams/lab/machines", "localhost:8787")).next
		).toHaveBeenCalledOnce();
		expect((await request("/assets/..%2f..%2f.env")).status).toBe(404);
		expect((await request("/.hidden.js")).status).toBe(404);
		await symlink(join(root, ".."), join(root, "outside"));
		expect((await request("/outside/secret.js")).status).toBe(404);
	});
});
