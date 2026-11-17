// The viewer server: four kinds of answer, and one transform.
//
// The page cannot open a `.ts` file by itself. `Bun.serve` does not transpile a file it returns with
// `Bun.file`: it hands the types to the browser and the module fails. `/asset/` is therefore the one
// route that transforms its answer, and it is the reason this server exists.
//
// The server also publishes the catalogue, so a page never builds a path from a name typed by hand,
// and it serves the copy of `three` from `node_modules`, so the page and the tests read one version.
//
// `createServer` returns a listening `Server`; the caller chooses the port. The test passes `0` and
// reads the port Bun assigned, and the CLI passes 5181. `readOptions` is separate, pure, and takes
// the root, so the CLI's rules are tested without starting anything.

import { existsSync, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { listAssets } from "./catalogue.ts";
import { withThreeImport } from "./prelude.ts";

/** The default port of the viewer, one above the Three.js viewer's 5180. */
export const DEFAULT_PORT = 5181;

/** The transpiler resolves nothing and executes nothing; it returns a string. */
const transpiler = new Bun.Transpiler({ loader: "ts" });

export type Options = {
	/**
	 * Repository-relative, with forward slashes, or `null` when the page asks
	 * the catalogue.
	 */
	asset: string | null;
	port: number;
};

/** The value after a flag, or a message that names the flag. */
function valueAfter(argv: string[], flag: string, index: number): string {
	const value = argv[index];
	if (value === undefined || value.startsWith("--"))
		throw new Error(`${flag} needs a value`);
	return value;
}

/**
 * Read the asset path, or reject it with the reason that stops the CLI.
 *
 * The order is the order of the contract: the extension, the root,
 * `node_modules`, and only then existence. A path outside the root is refused
 * for being outside, not for being absent, so the message names the rule it
 * broke.
 */
function assetPath(raw: string, root: string): string {
	if (!raw.endsWith(".ts")) throw new Error(`${raw} is not a .ts file`);

	const absolute = resolve(root, raw);
	const path = relative(root, absolute);
	if (path.startsWith("..") || isAbsolute(path))
		throw new Error(`${raw} is not inside the repository root`);
	if (path.split(sep).includes("node_modules"))
		throw new Error(`${raw} is inside node_modules`);
	if (!existsSync(absolute) || !statSync(absolute).isFile())
		throw new Error(`${raw} does not exist`);

	return path.split(sep).join("/");
}

/**
 * Parse the CLI arguments.
 *
 * @param argv The arguments after the script name
 * @param root The repository root, for the asset rules
 * @returns The asset path and the port
 */
export function readOptions(argv: string[], root = process.cwd()): Options {
	let asset: string | null = null;
	let port = DEFAULT_PORT;

	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (flag === "--asset") {
			asset = assetPath(valueAfter(argv, flag, index + 1), root);
			index += 1;
		} else if (flag === "--port") {
			const value = Number(valueAfter(argv, flag, index + 1));
			if (!Number.isInteger(value) || value < 0 || value > 65535)
				throw new Error(`--port takes an integer from 0 to 65535`);
			port = value;
			index += 1;
		} else {
			throw new Error(`unknown argument "${flag}"`);
		}
	}

	return { asset, port };
}

/** A path under `base` that leaves it is a refusal, not a lookup. */
function inside(base: string, absolute: string): boolean {
	const path = relative(base, absolute);
	return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

/** The type of a served file, or `undefined` to let Bun infer it. */
function contentType(path: string): string | undefined {
	if (path.endsWith(".html")) return "text/html; charset=utf-8";
	if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
	return undefined;
}

/** A file on disk, or `404` when it is absent. */
async function sendFile(absolute: string): Promise<Response> {
	const info = await stat(absolute).catch(() => null);
	if (!info?.isFile()) return new Response("not found", { status: 404 });
	const type = contentType(absolute);
	return new Response(Bun.file(absolute), {
		headers: type ? { "content-type": type } : {}
	});
}

/** Decode one path segment group, or `null` when the escape is malformed. */
function decodePath(path: string): string | null {
	try {
		return decodeURIComponent(path);
	} catch {
		return null;
	}
}

/**
 * Start the viewer.
 *
 * @param options.asset The asset the CLI named, repository-relative
 * @param options.port The port to bind, or `0` for one Bun chooses
 * @param options.root The repository root
 */
export function createServer({
	asset = null,
	port = 0,
	root = process.cwd()
}: {
	asset?: string | null;
	port?: number;
	root?: string;
}) {
	const rootDir = resolve(root);
	const viewerDir = join(rootDir, "tools", "scene-viewer");
	const threeDir = join(rootDir, "node_modules", "three");

	/** The catalogue, as JSON. */
	async function catalogue(): Promise<Response> {
		const assets = await listAssets(rootDir);
		return Response.json(
			{ assets },
			{ headers: { "cache-control": "no-store" } }
		);
	}

	/** The one route that transforms: the prelude, then the transpiler. */
	async function serveAsset(path: string): Promise<Response> {
		const decoded = decodePath(path);
		if (decoded === null) return new Response("bad path", { status: 400 });
		if (!decoded.endsWith(".ts"))
			return new Response("forbidden", { status: 403 });

		const absolute = resolve(rootDir, decoded);
		const relativePath = relative(rootDir, absolute);
		if (relativePath.startsWith("..") || isAbsolute(relativePath))
			return new Response("forbidden", { status: 403 });
		if (relativePath.split(sep).includes("node_modules"))
			return new Response("forbidden", { status: 403 });

		const info = await stat(absolute).catch(() => null);
		if (!info?.isFile()) return new Response("not found", { status: 404 });

		const source = await Bun.file(absolute).text();
		let javascript: string;
		try {
			javascript = transpiler.transformSync(withThreeImport(source));
		} catch (thrown) {
			// A syntax error is never repaired here. The message crosses the HTTP boundary as a module
			// that throws on evaluation, so the page's `import()` rejects with the transpiler's own
			// words and the error box shows them. A plain 500 would reach the page as a MIME error and
			// lose the one sentence that names the broken line.
			const message = String((thrown as Error)?.message ?? thrown);
			javascript = `throw new Error(${JSON.stringify(message)});\n`;
		}

		return new Response(javascript, {
			headers: {
				"content-type": "text/javascript; charset=utf-8",
				"cache-control": "no-store"
			}
		});
	}

	async function fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// `/` goes to the page, carrying the asset the CLI named when the query names none. The query
		// is kept so `?view=` and a later flag survive the hop.
		if (pathname === "/") {
			if (asset && !url.searchParams.has("asset"))
				url.searchParams.set("asset", asset);
			return new Response(null, {
				status: 302,
				headers: { location: `/viewer/${url.search}` }
			});
		}

		if (pathname === "/api/assets") return catalogue();

		if (pathname.startsWith("/asset/"))
			return serveAsset(pathname.slice("/asset/".length));

		if (pathname.startsWith("/vendor/three/build/")) {
			const rest = pathname.slice("/vendor/three/build/".length);
			const absolute = resolve(join(threeDir, "build"), rest);
			if (!inside(join(threeDir, "build"), absolute))
				return new Response("forbidden", { status: 403 });
			return sendFile(absolute);
		}

		if (pathname.startsWith("/vendor/three/addons/")) {
			const rest = pathname.slice("/vendor/three/addons/".length);
			const absolute = resolve(join(threeDir, "examples", "jsm"), rest);
			if (!inside(join(threeDir, "examples", "jsm"), absolute))
				return new Response("forbidden", { status: 403 });
			return sendFile(absolute);
		}

		if (pathname.startsWith("/viewer/")) {
			const rest = pathname.slice("/viewer/".length);
			// Only the empty rest is the page. A trailing slash on a directory must not serve
			// `index.html`: that URL would be a second spelling of the viewer, with a different base
			// for every relative link, and nothing lives at `/viewer/fixtures/`.
			if (rest === "") return sendFile(join(viewerDir, "index.html"));
			const decoded = decodePath(rest);
			if (decoded === null)
				return new Response("bad path", { status: 400 });
			if (decoded.endsWith("/"))
				return new Response("not found", { status: 404 });
			const absolute = resolve(viewerDir, decoded);
			if (!inside(viewerDir, absolute))
				return new Response("forbidden", { status: 403 });
			return sendFile(absolute);
		}

		return new Response("not found", { status: 404 });
	}

	// `127.0.0.1` only, so the URL the CLI prints is the URL it answers on. `Bun.serve` binds every
	// interface by default, and `/asset/` serves any `.ts` under the repository root.
	return Bun.serve({ hostname: "127.0.0.1", port, fetch });
}
