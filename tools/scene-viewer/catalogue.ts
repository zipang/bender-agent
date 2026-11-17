// The asset catalogue: every candidate the page can offer, and whether it parses.
//
// A path typed by hand does not scale: a subject holds several candidates, and a workflow holds
// several subjects. The walk names the folders it reads, skips a folder that does not exist, and
// never imports or executes a candidate -- a listing has no side effect.
//
// Validity is decided by the same prelude and the same transpiler as the `/asset/` route, so the
// listing and the page agree about which candidate the browser can load. The prelude is the narrow
// one of `prelude.ts`: a file that imports only a named binding gets the namespace line, exactly as
// the page would get it, so neither side calls that file valid on the strength of the wrong import.
//
// The one case where the two sides differ is a file that cannot be read at all. The catalogue lists
// it `valid: false`, and the page never opens it, because the page takes the first valid entry.
//
// The catalogue reads no cache. A handful of files of a few kilobytes each is not worth one.

import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { withThreeImport } from "./prelude.ts";

export type CatalogueEntry = {
	/** Repository-relative, with forward slashes. */
	path: string;
	/** The file base name, without `.ts`. */
	slug: string;
	/** The subject folder, or `fixtures`. */
	subject: string;
	/** `vehicules`, `characters`, `objects`, or `fixtures`. */
	category: string;
	bytes: number;
	/** Epoch milliseconds, from `stat`. */
	modified: number;
	/** The module transpiles with the prelude of §11. */
	valid: boolean;
	/** The message `Bun.Transpiler` gave, or `null`. */
	error: string | null;
};

/** The three subject categories of `blueprints/`. A draft is not a category. */
const CATEGORIES = ["vehicules", "characters", "objects"] as const;

/**
 * The built-in fixtures of this tool, listed beside the candidates of
 * `blueprints/`.
 */
const FIXTURES = "tools/scene-viewer/fixtures";

/** One transpiler for the whole process: it holds no state and resolves nothing. */
const transpiler = new Bun.Transpiler({ loader: "ts" });

/** A path from the repository root, with forward slashes. */
function toRepoPath(root: string, absolute: string): string {
	return relative(root, absolute).split(sep).join("/");
}

/**
 * The `.ts` files directly in a folder. A missing folder is not an error: it is
 * skipped.
 */
async function filesIn(directory: string): Promise<string[]> {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
		.map((entry) => join(directory, entry.name));
}

/** The subject folders of one category. A missing category is not an error. */
async function subjectsIn(directory: string): Promise<string[]> {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(directory, entry.name));
}

/** The category and the subject a repository path belongs to. */
function placeOf(path: string): { category: string; subject: string } {
	const segments = path.split("/");
	// `blueprints/<category>/<subject>/generated/<file>.ts`
	if (segments[0] === "blueprints" && segments.length >= 5) {
		return { category: segments[1], subject: segments[2] };
	}
	// `tools/scene-viewer/fixtures/<file>.ts`: the built-in assets have no subject folder.
	return { category: "fixtures", subject: "fixtures" };
}

/**
 * One catalogue entry, from one absolute path.
 *
 * The read and the `stat` are guarded together. An `EACCES`, an `ENOENT`
 * between the walk and the read, or a link that `isFile()` reported all land
 * here, and each of them must cost one entry rather than the whole listing: a
 * `500` hides the candidates that do parse.
 */
async function entryOf(
	root: string,
	absolute: string
): Promise<CatalogueEntry> {
	const path = toRepoPath(root, absolute);
	const place = placeOf(path);
	const slug = basename(absolute).replace(/\.ts$/, "");

	let source: string;
	let info;
	try {
		info = await stat(absolute);
		source = await Bun.file(absolute).text();
	} catch {
		return {
			path,
			slug,
			...place,
			bytes: 0,
			modified: 0,
			valid: false,
			error: `${path}: the candidate could not be read`
		};
	}

	let valid = true;
	let error: string | null = null;
	try {
		transpiler.transformSync(withThreeImport(source));
	} catch (thrown) {
		valid = false;
		// The transpiler throws a `BuildMessage` without a position. Its message is the reason the
		// page shows, so it is reported as it arrived and never located or repaired.
		error = String((thrown as Error)?.message ?? thrown);
	}

	return {
		path,
		slug,
		...place,
		bytes: info.size,
		// The type says epoch milliseconds. `mtimeMs` is a float, so the fraction is dropped.
		modified: Math.trunc(info.mtimeMs),
		valid,
		error
	};
}

/**
 * List every asset a viewer may open: the candidates of the three categories,
 * plus the fixtures.
 *
 * @param root The repository root, absolute
 * @returns The entries, sorted by `path` so two runs give the same order
 */
export async function listAssets(root: string): Promise<CatalogueEntry[]> {
	const absoluteRoot = resolve(root);
	const found: string[] = [];

	for (const category of CATEGORIES) {
		const categoryDir = join(absoluteRoot, "blueprints", category);
		for (const subject of await subjectsIn(categoryDir)) {
			found.push(...(await filesIn(join(subject, "generated"))));
		}
	}
	found.push(...(await filesIn(join(absoluteRoot, FIXTURES))));

	const entries = await Promise.all(
		found.map((file) => entryOf(absoluteRoot, file))
	);
	return entries.sort((a, b) => a.path.localeCompare(b.path, "en"));
}
