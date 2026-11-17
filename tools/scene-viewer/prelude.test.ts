// The import prelude: one missing line, added in one place.
//
// A model writes an asset and forgets `import * as THREE from "three";`. The page then fails on a
// module that is otherwise correct, and the failure reads as "the viewer is broken". The server adds
// the line instead, and this function is the only place that decides.
//
// The rule is anchored on an IMPORT STATEMENT, not on the bare word: a comment that mentions three,
// or a string that holds it, must not stop the prelude, because the file still has no import. The
// rule matches a NAMESPACE binding only. A named import from `three` does not bind `THREE`, so that
// file still gets the prelude.

import { describe, expect, test } from "bun:test";
import { THREE_IMPORT, withThreeImport } from "./prelude.ts";

describe("THREE_IMPORT", () => {
	test("is the exact line the asset contract requires", () => {
		expect(THREE_IMPORT).toBe('import * as THREE from "three";\n');
	});
});

describe("withThreeImport", () => {
	test("returns a source that already binds the namespace unchanged", () => {
		const source = `import * as THREE from "three";\n\nexport default function build() {\n\treturn new THREE.Group();\n}\n`;

		expect(withThreeImport(source)).toBe(source);
	});

	test("accepts a namespace import in single quotes", () => {
		const single = `import * as THREE from 'three';\nexport default () => new THREE.Group();\n`;

		expect(withThreeImport(single)).toBe(single);
	});

	test("prepends the line on a named import that is not the namespace", () => {
		// `import { Group } from "three"` does not bind `THREE`, so the file still needs the
		// namespace line. The narrow rule is what keeps the listing and the page in agreement.
		const named = `import { Group } from "three";\nexport default () => new THREE.Group();\n`;
		const types = `import type { Group } from "three";\nexport default () => new THREE.Group();\n`;

		expect(withThreeImport(named)).toBe(THREE_IMPORT + named);
		expect(withThreeImport(types)).toBe(THREE_IMPORT + types);
	});

	test("prepends the line on a source without it", () => {
		const source = `export default function build() {\n\treturn new THREE.Group();\n}\n`;

		expect(withThreeImport(source)).toBe(THREE_IMPORT + source);
	});

	test("prepends the line when three appears only in a comment", () => {
		const source = `// three is not imported here\nconst name = "three";\nexport default function build() {\n\treturn new THREE.Group();\n}\n`;

		expect(withThreeImport(source)).toBe(THREE_IMPORT + source);
	});

	test("finds an import that comes after a leading comment", () => {
		const source = `// the asset\nimport * as THREE from "three";\nexport default () => new THREE.Group();\n`;

		expect(withThreeImport(source)).toBe(source);
	});

	test("documents its limit: an import inside a block comment gets a second line", () => {
		// The rule is anchored on a line, so it cannot tell a real statement from one written inside
		// `/* … */` when the comment does not start the line. Duplicate module imports are legal, and
		// the binding is then declared once.
		const source = `/* import * as THREE from "three"; */\nexport default () => new THREE.Group();\n`;

		expect(withThreeImport(source)).toBe(THREE_IMPORT + source);
	});

	test("is pure: two calls give the same answer", () => {
		const source = `export default () => new THREE.Group();\n`;

		expect(withThreeImport(source)).toBe(withThreeImport(source));
	});
});
