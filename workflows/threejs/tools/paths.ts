// The paths of the Three.js workflow, in one place.
//
// Why one module. The tools sit three levels under the repository root, and a scene sits four.
// Every tool used to compute its own root with `resolve(import.meta.dir, "../..")`, which was
// correct while the tools were two levels deep. When the workflow moved into `workflows/threejs/`
// that expression started pointing at `workflows/`, and the failure was quiet: the server started
// and served an empty page.
//
// So the root is computed once, here, and every tool imports it.

import { relative, resolve, sep } from "node:path";

/** `workflows/threejs/tools/paths.ts` -> the repository root. */
export const ROOT = resolve(import.meta.dir, "../../..");

/** `workflows/threejs`. The workflow owns the viewer, the scenes and the tools. */
export const WORKFLOW = resolve(import.meta.dir, "..");

/** `workflows/threejs/viewer`. The shared page and the only view table. */
export const VIEWER = resolve(WORKFLOW, "viewer");

/** `workflows/threejs/scenes`. One directory per subject. */
export const SCENES = resolve(WORKFLOW, "scenes");

/** `workflows/threejs/tools`. This directory. */
export const TOOLS = resolve(import.meta.dir);

/** `workflows/threejs/viewer/views.json`. The only view table. */
export const VIEW_TABLE = resolve(VIEWER, "views.json");

/**
 * `test-reports/` at the repository root. Where a check writes what a human reads: the overlays,
 * the scratch captures, the contact sheets. Git-ignored, and named in the root `README.md` because
 * it is a top-level directory.
 */
export const REPORTS = resolve(ROOT, "test-reports");

/** A repository path in the form a URL and a scene id use: forward slashes, no leading `./`. */
export function toRepoPath(absolute: string): string {
  return relative(ROOT, absolute).split(sep).join("/");
}

/** True when `child` is `parent` or sits under it. */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
}
