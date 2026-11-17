// The layout gate of T0014.
//
// The root folder that holds the tools more than one workflow reads was renamed. The new name is
// `tools/`. This test is the regression gate of that rename: the old folder is gone, the moved tools
// are at their new path, and no live file names the old path.
//
// The needle is assembled at run time on purpose. A literal in this file would make the file match
// itself, and the third assertion could never pass.

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

/** The repository root: `tools/layout.test.ts` -> one level up. */
const ROOT = resolve(import.meta.dir, "..");

/** The old folder name, without its trailing slash. */
const OLD_DIR = ["scri", "pts"].join("");

/** The old path as a live file writes it, with its trailing slash. */
const NEEDLE = `${OLD_DIR}/`;

/**
 * The extensions this gate reads. The set is the list in the T0014 contract: a
 * wider set is a ticket change, not a local fix. A binary file carries no
 * reference to a path.
 */
const EXTENSIONS = new Set([
	".ts",
	".js",
	".mjs",
	".cjs",
	".py",
	".md",
	".json",
	".html"
]);

/** Prefixes that hold records, third-party text, or generated output. */
const SKIPPED_PREFIXES = [
	".git/",
	"node_modules/",
	".tmp/",
	"test-reports/",
	"tickets/",
	"research/",
	"blueprints/",
	".agents/skills/use-bun/"
];

/**
 * One file that holds a third-party path, and is not a reference to this
 * repository.
 */
const SKIPPED_FILES = new Set(["workflows/blender/README.md"]);

/** The three moved files the contract names, at their new path. */
const REQUIRED = [
	"tools/blueprint-generate/blueprint-generate.ts",
	"tools/blueprint/view_scale.py",
	"tools/measure/index.html"
];

/** A path from the repository root, with forward slashes. */
function toRepoPath(absolute: string): string {
	return relative(ROOT, absolute).split(sep).join("/");
}

/** Every live file, as a repository path. */
async function liveFiles(): Promise<string[]> {
	const found: string[] = [];
	async function walk(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = toRepoPath(join(directory, entry.name));
			if (
				SKIPPED_PREFIXES.some((prefix) => `${path}/`.startsWith(prefix))
			)
				continue;
			if (entry.isDirectory()) await walk(join(directory, entry.name));
			else if (entry.isFile()) found.push(path);
		}
	}
	await walk(ROOT);
	return found.sort();
}

describe("the root tool folder", () => {
	test("the old folder is gone", () => {
		const problems = existsSync(join(ROOT, OLD_DIR))
			? [`${OLD_DIR}/ still exists at the repository root`]
			: [];
		expect(problems).toEqual([]);
	});

	test("the moved tools are at the new path", () => {
		const problems = REQUIRED.filter(
			(path) => !existsSync(join(ROOT, path))
		).map((path) => `${path} does not exist`);
		expect(problems).toEqual([]);
	});

	test("no live file names the old path", async () => {
		const hits: string[] = [];
		for (const path of await liveFiles()) {
			if (SKIPPED_FILES.has(path)) continue;
			if (!EXTENSIONS.has(extname(path))) continue;
			const lines = (await readFile(join(ROOT, path), "utf8")).split(
				"\n"
			);
			for (const [index, line] of lines.entries()) {
				if (line.includes(NEEDLE))
					hits.push(`${path}:${index + 1}: ${line.trim()}`);
			}
		}
		const files = new Set(
			hits.map((hit) => hit.slice(0, hit.indexOf(":")))
		);
		const failures = hits.length
			? [
					`${files.size} live file(s) name the old path. Fix the path; never widen the skip list.`,
					...hits
				]
			: [];
		expect(failures).toEqual([]);
	});
});
