// T16.4 — the validation of a written candidate.
//
// The validator imports the candidate, calls `build()`, and checks what it returned. It never edits
// the file. The asset contract of T0015 §1 is the authority: one default-exported function, one
// `Object3D`, at least one mesh, a finite positive size on all three axes.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateAsset } from "./validate";

// The scratch files must live inside the repository so that `three` resolves from `node_modules`.
const SCRATCH = resolve(import.meta.dir, "..", "..", "..", "..", ".tmp");
const FIXTURES = join(import.meta.dir, "..", "fixtures");

const scratchRoots: string[] = [];

function scratchFile(name: string, source: string): string {
	const dir = join(SCRATCH, name);
	mkdirSync(dir, { recursive: true });
	scratchRoots.push(dir);
	const path = join(dir, "asset.ts");
	writeFileSync(path, source);
	return path;
}

afterEach(() => {
	for (const dir of scratchRoots.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

describe("validateAsset", () => {
	test("a valid group passes", async () => {
		const path = join(FIXTURES, "valid-asset.ts");
		expect(await validateAsset(path)).toEqual({ ok: true });
	});

	test("a default export that is not a function fails", async () => {
		const path = join(FIXTURES, "not-an-asset.ts");
		const result = await validateAsset(path);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("function");
	});

	test("a build() that throws fails with its message", async () => {
		const path = join(FIXTURES, "broken-asset.ts");
		const result = await validateAsset(path);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("boom");
	});

	test("a group with no mesh fails", async () => {
		const path = scratchFile(
			`no-mesh-${process.pid}-${Date.now()}`,
			[
				'import * as THREE from "three";',
				"export default function build(): THREE.Object3D {",
				"\treturn new THREE.Group();",
				"}"
			].join("\n")
		);
		const result = await validateAsset(path);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("mesh");
	});

	test("a missing file fails", async () => {
		const result = await validateAsset(join(FIXTURES, "does-not-exist.ts"));
		expect(result.ok).toBe(false);
	});

	test("the validator never edits the candidate", async () => {
		const path = join(FIXTURES, "valid-asset.ts");
		const before = readFileSync(path, "utf8");
		await validateAsset(path);
		expect(readFileSync(path, "utf8")).toBe(before);
	});

	test("a candidate that omits the three import is invalid: THREE is not defined", async () => {
		const path = scratchFile(
			`no-import-${process.pid}-${Date.now()}`,
			[
				"export default function build(): THREE.Object3D {",
				"\treturn new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));",
				"}"
			].join("\n")
		);
		const result = await validateAsset(path);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("THREE is not defined");
	});
});
