// The viewer server: the page, the catalogue, the three build, and the transpiled asset.
//
// The test imports `server.ts`, never `serve.ts`, so no second server starts. It binds port `0` and
// reads the port Bun assigned, and it closes the server in `afterAll` so a failing assertion never
// leaves a port open behind it.
//
// The route that matters is `/asset/`: `Bun.serve` hands a `.ts` file it returns with `Bun.file` to
// the browser with its types still in it, and the module then fails. The route transpiles the source
// first, and the assertions below are the proof: no `interface`, no `: THREE.`, one `three` import.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { createServer, readOptions } from "./server.ts";

/** The repository root: `tools/scene-viewer/server.test.ts` -> three levels up. */
const ROOT = resolve(import.meta.dir, "../..");

/** The asset the test opens, as the `--asset` flag would name it. */
const ASSET = "tools/scene-viewer/fixtures/cube.ts";

let server;
let base;

beforeAll(() => {
	server = createServer({ asset: ASSET, port: 0, root: ROOT });
	base = `http://127.0.0.1:${server.port}`;
});

afterAll(() => {
	server?.stop(true);
});

/** One request, with the response and its text. */
async function get(path) {
	const response = await fetch(base + path, { redirect: "manual" });
	return { response, text: await response.text() };
}

describe("readOptions", () => {
	test("accepts no flag, with the default port and no asset", () => {
		expect(readOptions([], ROOT)).toEqual({ asset: null, port: 5181 });
	});

	test("accepts a repository asset path and a port", () => {
		expect(readOptions(["--asset", ASSET, "--port", "5190"], ROOT)).toEqual(
			{
				asset: ASSET,
				port: 5190
			}
		);
	});

	test("rewrites the asset path with forward slashes", () => {
		expect(
			readOptions(
				["--asset", "./tools/scene-viewer/fixtures/cube.ts"],
				ROOT
			)
		).toEqual({ asset: ASSET, port: 5181 });
	});

	test("rejects an asset that is not a .ts file", () => {
		expect(() => readOptions(["--asset", "README.md"], ROOT)).toThrow(
			/\.ts/
		);
	});

	test("rejects an asset that does not exist", () => {
		expect(() =>
			readOptions(
				["--asset", "tools/scene-viewer/fixtures/nope.ts"],
				ROOT
			)
		).toThrow(/does not exist/);
	});

	test("rejects an asset outside the repository root", () => {
		expect(() =>
			readOptions(["--asset", "../package.json.ts"], ROOT)
		).toThrow(/inside the repository/);
	});

	test("rejects an asset inside node_modules", () => {
		expect(() =>
			readOptions(
				["--asset", "node_modules/three/build/three.module.ts"],
				ROOT
			)
		).toThrow(/node_modules/);
	});
});

describe("the viewer server", () => {
	test("redirects the root to /viewer/ with the asset", async () => {
		const { response } = await get("/");

		expect(response.status).toBe(302);
		const location = response.headers.get("location");
		expect(location.startsWith("/viewer/")).toBe(true);
		expect(new URL(location, base).searchParams.get("asset")).toBe(ASSET);
	});

	test("keeps an asset the query already names", async () => {
		const { response } = await get(
			"/?asset=tools%2Fscene-viewer%2Ffixtures%2Fno-import.ts"
		);

		expect(response.status).toBe(302);
		expect(
			new URL(response.headers.get("location"), base).searchParams.get(
				"asset"
			)
		).toBe("tools/scene-viewer/fixtures/no-import.ts");
	});

	test("answers /viewer/ with the page", async () => {
		const { response, text } = await get("/viewer/");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(text).toContain('id="hud"');
		expect(text).toContain("/vendor/three/build/three.module.js");
	});

	test("serves the three module from node_modules", async () => {
		const { response, text } = await get(
			"/vendor/three/build/three.module.js"
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain(
			"text/javascript"
		);
		expect(text.length).toBeGreaterThan(1000);
	});

	test("serves an addon through the addons prefix", async () => {
		const { response } = await get(
			"/vendor/three/addons/controls/OrbitControls.js"
		);

		expect(response.status).toBe(200);
	});

	test("transpiles an asset and adds no second three import", async () => {
		const { response, text } = await get(`/asset/${ASSET}`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain(
			"text/javascript"
		);
		expect(text).not.toContain("interface");
		expect(text).not.toContain(": THREE.");
		expect(text).toContain("export default");
		expect((text.match(/from\s*["']three["']/g) ?? []).length).toBe(1);
	});

	test("prepends the three import on an asset that has none", async () => {
		const { text } = await get(
			"/asset/tools/scene-viewer/fixtures/no-import.ts"
		);

		expect(text.startsWith('import * as THREE from "three";')).toBe(true);
	});

	test("answers the catalogue as JSON, sorted", async () => {
		const { response, text } = await get("/api/assets");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain(
			"application/json"
		);
		const body = JSON.parse(text);
		expect(Array.isArray(body.assets)).toBe(true);
		const paths = body.assets.map((entry) => entry.path);
		for (const name of ["cube.ts", "no-import.ts", "broken.ts"]) {
			expect(paths).toContain(`tools/scene-viewer/fixtures/${name}`);
		}
		expect(paths).toEqual(
			[...paths].sort((a, b) => a.localeCompare(b, "en"))
		);
	});

	test("reports a missing asset as 404", async () => {
		const { response } = await get(
			"/asset/tools/scene-viewer/fixtures/missing.ts"
		);

		expect(response.status).toBe(404);
	});

	test("refuses an asset that is not a .ts file", async () => {
		const { response } = await get("/asset/tools/scene-viewer/main.js");

		expect(response.status).toBe(403);
	});

	test("refuses an asset inside node_modules", async () => {
		const { response } = await get(
			"/asset/node_modules/three/package.json.ts"
		);

		expect(response.status).toBe(403);
	});

	test("answers a broken asset with a module that throws its message", async () => {
		const { response, text } = await get(
			"/asset/tools/scene-viewer/fixtures/broken.ts"
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain(
			"text/javascript"
		);
		expect(text.startsWith("throw new Error(")).toBe(true);
		expect(text).toContain("Unexpected ]");
	});

	test("refuses a viewer path that leaves the folder", async () => {
		const { response } = await get("/viewer/..%2Fserver.ts");

		expect(response.status).toBe(403);
	});

	test("refuses an asset path that leaves the root", async () => {
		const { response } = await get("/asset/..%2Fpackage.json.ts");

		expect(response.status).toBe(403);
	});

	test("does not answer a directory with the page", async () => {
		const { response } = await get("/viewer/fixtures/");

		expect(response.status).toBe(404);
	});

	test("answers an unknown route as 404", async () => {
		const { response } = await get("/nothing");

		expect(response.status).toBe(404);
	});
});
