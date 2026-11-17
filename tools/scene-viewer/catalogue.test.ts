// The asset catalogue: every candidate the page can offer, and whether it parses.
//
// A path typed by hand does not scale: a subject holds several candidates, and a workflow holds
// several subjects. The walk names the folders it reads, skips a folder that does not exist, and
// never imports or executes a candidate -- a listing has no side effect.
//
// Every tree this file reads lives under `.tmp/`, never under `blueprints/`: the test writes its own
// assets, copies the three fixtures into the shape the walk expects, and removes the tree in
// `afterAll`. Nothing here depends on a real subject being present, so the suite answers the same on
// a fresh clone.
//
// One candidate is made unreadable with `chmod 0o000`. The listing must still answer, with that entry
// `valid: false`, because one locked file must not turn the page into a `500`. Root ignores the mode,
// so the test is skipped when the suite runs as root.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { listAssets } from "./catalogue.ts";

/**
 * The repository root: `tools/scene-viewer/catalogue.test.ts` -> three levels
 * up.
 */
const ROOT = resolve(import.meta.dir, "../..");

/** A scratch tree, git-ignored, removed in `afterAll`. */
const TMP = join(ROOT, ".tmp/scene-viewer-test");

/** The one root every listing test reads. */
const TREE = join(TMP, "tree");

/**
 * The repository fixtures, copied into the scratch tree so the suite reads no
 * real subject.
 */
const FIXTURES = ["cube.ts", "no-import.ts", "broken.ts"];

/** A module that transpiles without a `three` import, thanks to the prelude. */
const GOOD = `export default function build(): THREE.Object3D {\n\treturn new THREE.Group();\n}\n`;

/**
 * A module with the syntax error the real candidate held before the art
 * director repaired it.
 */
const BROKEN = `export default function build(): THREE.Object3D {\n\tconst parts: THREE.Mesh[] = new THREE.Mesh[];\n\treturn new THREE.Group();\n}\n`;

/** The candidate whose mode is removed for the unreadable test. */
const UNREADABLE = "blueprints/vehicules/test-subject/generated/unreadable.ts";

/** `root` ignores the file mode, so the unreadable test cannot fail there. */
const testUnreadable = process.getuid?.() === 0 ? test.skip : test;

async function writeTree(base: string, files: Record<string, string>) {
	for (const [path, content] of Object.entries(files)) {
		const absolute = join(base, path);
		await mkdir(dirname(absolute), { recursive: true });
		await writeFile(absolute, content);
	}
}

beforeAll(async () => {
	await rm(TMP, { recursive: true, force: true });
	await mkdir(join(TMP, "empty"), { recursive: true });

	for (const name of FIXTURES) {
		const target = join(TREE, "tools/scene-viewer/fixtures", name);
		await mkdir(dirname(target), { recursive: true });
		await Bun.write(
			target,
			Bun.file(join(ROOT, "tools/scene-viewer/fixtures", name))
		);
	}

	await writeTree(TREE, {
		"blueprints/vehicules/test-subject/generated/a.ts": GOOD,
		"blueprints/vehicules/test-subject/generated/b.ts": BROKEN,
		[UNREADABLE]: GOOD,
		"blueprints/vehicules/test-subject/generated/notes.md": "not an asset",
		"blueprints/characters/other-subject/generated/c.ts": GOOD,
		"blueprints/objects/third-subject/generated/d.ts": GOOD
	});
	// A directory whose name ends in `.ts` is not a file, and must not be listed.
	await mkdir(
		join(TREE, "blueprints/vehicules/test-subject/generated/dir.ts"),
		{ recursive: true }
	);
	await chmod(join(TREE, UNREADABLE), 0o000);
});

afterAll(async () => {
	// Restore the mode before the removal, so a failed run can still delete the tree.
	await chmod(join(TREE, UNREADABLE), 0o644).catch(() => {});
	await rm(TMP, { recursive: true, force: true });
});

describe("listAssets and the fixtures", () => {
	test("lists the three fixtures and parses each one", async () => {
		const entries = await listAssets(TREE);
		const byPath = new Map(entries.map((entry) => [entry.path, entry]));

		for (const name of FIXTURES) {
			expect(byPath.has(`tools/scene-viewer/fixtures/${name}`)).toBe(
				true
			);
		}

		const cube = byPath.get("tools/scene-viewer/fixtures/cube.ts");
		expect(cube?.slug).toBe("cube");
		expect(cube?.subject).toBe("fixtures");
		expect(cube?.category).toBe("fixtures");
		expect(cube?.valid).toBe(true);
		expect(cube?.error).toBeNull();
		expect(cube?.bytes).toBeGreaterThan(0);
		expect(Number.isInteger(cube?.modified)).toBe(true);

		expect(
			byPath.get("tools/scene-viewer/fixtures/no-import.ts")?.valid
		).toBe(true);
	});

	test("marks the broken fixture invalid with the transpiler message", async () => {
		const entries = await listAssets(TREE);
		const broken = entries.find(
			(entry) => entry.path === "tools/scene-viewer/fixtures/broken.ts"
		);

		expect(broken?.valid).toBe(false);
		expect(broken?.error).toContain("Unexpected ]");
	});
});

describe("listAssets and an unreadable candidate", () => {
	testUnreadable(
		"lists an unreadable candidate as invalid and keeps the other entries",
		async () => {
			const entries = await listAssets(TREE);
			const unreadable = entries.find(
				(entry) => entry.path === UNREADABLE
			);

			expect(unreadable?.valid).toBe(false);
			expect(unreadable?.error).toBe(
				`${UNREADABLE}: the candidate could not be read`
			);
			// The rest of the walk is untouched: the same number of entries as the readable run.
			expect(entries.length).toBe(8);
			expect(entries.filter((entry) => entry.valid).length).toBe(5);
		}
	);
});

describe("listAssets on a scratch tree", () => {
	test("finds blueprints/<category>/<subject>/generated/*.ts", async () => {
		const entries = await listAssets(TREE);
		const byPath = new Map(entries.map((entry) => [entry.path, entry]));

		expect(
			byPath.has("blueprints/vehicules/test-subject/generated/a.ts")
		).toBe(true);
		const a = byPath.get(
			"blueprints/vehicules/test-subject/generated/a.ts"
		);
		expect(a?.slug).toBe("a");
		expect(a?.subject).toBe("test-subject");
		expect(a?.category).toBe("vehicules");
		expect(a?.valid).toBe(true);
		expect(a?.error).toBeNull();
	});

	test("reads the three categories and skips a non-file and a non-ts file", async () => {
		const entries = await listAssets(TREE);

		expect(entries.map((entry) => entry.path)).toEqual([
			"blueprints/characters/other-subject/generated/c.ts",
			"blueprints/objects/third-subject/generated/d.ts",
			"blueprints/vehicules/test-subject/generated/a.ts",
			"blueprints/vehicules/test-subject/generated/b.ts",
			UNREADABLE,
			"tools/scene-viewer/fixtures/broken.ts",
			"tools/scene-viewer/fixtures/cube.ts",
			"tools/scene-viewer/fixtures/no-import.ts"
		]);
	});

	test("marks a syntax error on the scratch tree", async () => {
		const entries = await listAssets(TREE);
		const b = entries.find((entry) =>
			entry.path.endsWith("test-subject/generated/b.ts")
		);

		expect(b?.valid).toBe(false);
		expect(b?.error).toContain("Unexpected");
	});

	test("returns the list sorted by path", async () => {
		const entries = await listAssets(TREE);
		const paths = entries.map((entry) => entry.path);

		expect(paths).toEqual(
			[...paths].sort((a, b) => a.localeCompare(b, "en"))
		);
	});

	test("returns an empty list for a root with no candidate folder", async () => {
		expect(await listAssets(join(TMP, "empty"))).toEqual([]);
	});

	test("returns an empty list for a root that does not exist", async () => {
		expect(await listAssets(join(TMP, "missing"))).toEqual([]);
	});
});
