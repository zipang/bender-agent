// The import prelude: the one line a model forgets.
//
// The asset contract requires `import * as THREE from "three";`, and a model sometimes omits it.
// The candidates that predate T0016 were written without any contract at all, so the viewer
// tolerates the omission: the server adds the line before it transpiles.
//
// The guarantee is narrow on purpose. The rule matches a NAMESPACE binding from `three`, the one
// form that declares `THREE`. A file that writes `import { Mesh } from "three"` does not bind
// `THREE`, and `import type { Group } from "three"` is erased by the transpiler. Both still need
// the line. A namespace import next to a named one is legal, so adding it in those cases loses
// nothing. The reverse choice -- treat any `from "three"` as enough -- would list such a file
// `valid: true` and let the page throw on it, and that is the disagreement the catalogue exists to
// prevent.
//
// The anchor also means a comment that mentions `three`, or a string that holds it, does not stop
// the prelude.
//
// Known limit, stated rather than solved. A multi-line block comment that holds
// `import * as THREE from "three"` at the start of a line satisfies the rule, so no import is added.
// The file then fails in the page on `THREE is not defined`, while the catalogue calls it valid. A
// comment that mentions `three`, or that keeps the marker mid-line
// (`/* import * as THREE from "three"; */`), does not match and does get the prelude. This is a
// limit, not a task: the rule runs before any parser, and detecting the false positive costs a
// parse for a case no model has written yet.
//
// The function is pure: same input, same output, no file read. It is applied in exactly two places,
// the `/asset/` route and the catalogue's validity check, so both sides read the same source.

export const THREE_IMPORT = 'import * as THREE from "three";\n';

/**
 * A namespace import of the bare module `three`: the only form that declares
 * `THREE`.
 */
const THREE_NAMESPACE_IMPORT =
	/^\s*import\s+\*\s+as\s+THREE\b[^;]*\bfrom\s*["']three["']/m;

/**
 * Return `source` with the `three` namespace import, adding it only when the
 * file does not already bind it.
 *
 * @param source The TypeScript source of one asset
 * @returns The source the transpiler reads
 */
export function withThreeImport(source: string): string {
	return THREE_NAMESPACE_IMPORT.test(source) ? source : THREE_IMPORT + source;
}
