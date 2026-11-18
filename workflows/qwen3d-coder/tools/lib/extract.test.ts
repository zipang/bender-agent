// T16.1 and T16.10 — the extracted module.
//
// The model emits its reasoning, then the TypeScript module. `extractTs` is pure and total: it
// returns the module, or it throws `NoModuleError` because an incomplete run must never become a
// candidate. The system prompt holds a TypeScript template, so a reply may echo it: the LAST
// TypeScript fence wins (A6).

import { describe, expect, test } from "bun:test";
import { extractTs, NoModuleError } from "./extract";

const MODULE = [
	'import * as THREE from "three";',
	"",
	"export default function build(): THREE.Object3D {",
	"  return new THREE.Mesh();",
	"}"
].join("\n");

const TEMPLATE = [
	'import * as THREE from "three";',
	"",
	"export default function build(): THREE.Object3D {",
	"  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));",
	"}"
].join("\n");

describe("extractTs", () => {
	test("a ts fence is returned", () => {
		const raw = `Here it is:\n\n\`\`\`ts\n${MODULE}\n\`\`\`\n\nDone.`;
		expect(extractTs(raw)).toBe(MODULE);
	});

	test("a typescript fence is returned", () => {
		const raw = `\`\`\`typescript\n${MODULE}\n\`\`\``;
		expect(extractTs(raw)).toBe(MODULE);
	});

	test("an unlabelled fence with export default is the fallback", () => {
		const raw = `\`\`\`\n${MODULE}\n\`\`\``;
		expect(extractTs(raw)).toBe(MODULE);
	});

	test("two unlabelled blocks: the first with export default wins", () => {
		const second = "export default function build() {\n  return null;\n}";
		const raw = `\`\`\`\n${MODULE}\n\`\`\`\n\n\`\`\`\n${second}\n\`\`\``;
		expect(extractTs(raw)).toBe(MODULE);
	});

	test("an HTML fence throws NoModuleError", () => {
		const raw = "```html\n<!DOCTYPE html>\n<html></html>\n```";
		expect(() => extractTs(raw)).toThrow(NoModuleError);
	});

	test("a response with no fence throws NoModuleError", () => {
		const raw = "I will build a cube. Then a ground plane. Then a light.";
		expect(() => extractTs(raw)).toThrow(NoModuleError);
	});

	test("the leading and trailing blank lines of a fence are dropped", () => {
		const raw = `\`\`\`ts\n\n\n${MODULE}\n\n\n\`\`\``;
		expect(extractTs(raw)).toBe(MODULE);
	});

	test("the bytes inside the fence are unchanged, blank lines included", () => {
		// MODULE holds one blank line between the import and the export; it must survive.
		expect(extractTs(`\`\`\`ts\n${MODULE}\n\`\`\``)).toContain(
			'from "three";\n\nexport default'
		);
	});

	test("the message of NoModuleError is the documented one", () => {
		expect(() => extractTs("no fence")).toThrow(
			"The response holds no fenced TypeScript module. Nothing was written."
		);
	});

	// T16.10 — the model echoes the system-prompt template, then writes its own module.
	test("a reply that echoes the template then writes the module returns the module", () => {
		const raw = [
			"Follow this template:",
			"```typescript",
			TEMPLATE,
			"```",
			"",
			"Here is the asset:",
			"```typescript",
			MODULE,
			"```"
		].join("\n");
		expect(extractTs(raw)).toBe(MODULE);
	});
});
