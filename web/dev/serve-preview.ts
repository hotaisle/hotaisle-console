import { readFile, realpath, stat } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { extname, resolve, sep } from "node:path";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = {
	".css": "text/css",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript",
	".svg": "image/svg+xml",
	".woff": "font/woff",
	".woff2": "font/woff2",
};
const PREVIEW_ENTRY_PATHS = new Set(["/", "/__preview", "/index.html"]);
const redirectsToPreview = (path: string) =>
	PREVIEW_ENTRY_PATHS.has(path) || path.startsWith("/teams/");
interface PreviewResponse {
	end: (body?: string | Uint8Array) => unknown;
	writeHead: (status: number, headers: Record<string, string>) => unknown;
}
function textResponse(res: PreviewResponse, method: string | undefined) {
	return (
		status: number,
		body: string,
		headers: Record<string, string> = {}
	) => {
		res.writeHead(status, {
			"Cache-Control": "no-store",
			"Content-Type": "text/plain; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
			...headers,
		});
		res.end(method === "HEAD" ? undefined : body);
	};
}

async function previewAsset(directory: string, pathname: string) {
	const path =
		pathname === "/__preview/"
			? "/__preview/index.html"
			: decodeURIComponent(pathname);
	const filename = resolve(directory, `.${path}`);
	const type = TYPES[extname(filename)];
	if (
		!(filename.startsWith(directory + sep) && type) ||
		path.split("/").some((part) => part.startsWith("."))
	) {
		return;
	}
	const actual = await realpath(filename);
	if (
		!(
			actual.startsWith((await realpath(directory)) + sep) &&
			(await stat(actual)).isFile()
		)
	) {
		return;
	}
	return { bytes: await readFile(actual), type };
}

async function servePreviewAsset(
	directory: string,
	pathname: string,
	method: string | undefined,
	res: PreviewResponse
) {
	const reply = textResponse(res, method);
	try {
		const asset = await previewAsset(directory, pathname);
		if (!asset) {
			reply(404, "Preview asset not found");
			return;
		}
		res.writeHead(200, {
			"Cache-Control": "no-store",
			"Content-Type": asset.type,
			"X-Content-Type-Options": "nosniff",
		});
		res.end(method === "HEAD" ? undefined : asset.bytes);
	} catch {
		reply(
			pathname.startsWith("/__preview") ? 503 : 404,
			"The local preview is not built. Run bun run preview, then reload this page. No real API requests were made."
		);
	}
}

/** Local dev only. This middleware never forwards a request to the real Worker or API. */
export function previewMiddleware(root: string) {
	const directory = resolve(root);
	return async (
		req: Pick<IncomingMessage, "headers" | "method" | "url">,
		res: PreviewResponse,
		next: () => void
	) => {
		const url = new URL(
			req.url ?? "/",
			`http://${req.headers.host ?? "localhost"}`
		);
		if (url.hostname !== "preview.localhost") {
			next();
			return;
		}
		const reply = textResponse(res, req.method);
		if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
			reply(
				403,
				"The preview origin cannot call the real API. Open /__preview/ for simulated machines."
			);
			return;
		}
		if (req.method !== "GET" && req.method !== "HEAD") {
			reply(405, "Method not allowed");
			return;
		}
		if (redirectsToPreview(url.pathname)) {
			reply(302, "Open the local preview.", { Location: "/__preview/" });
			return;
		}
		await servePreviewAsset(directory, url.pathname, req.method, res);
	};
}

export function localPreview(): Plugin {
	return {
		apply: "serve",
		configureServer(server) {
			server.middlewares.use(
				previewMiddleware(resolve(import.meta.dirname, "../preview-dist"))
			);
		},
		name: "hotaisle-local-preview",
	};
}
