// T1.4 — the system prompt and the user prompt.
//
// The system prompt is the model card's text, byte for byte, on the decision of the art director
// (T0013 D7): the card states the runtime, and the constraints live in the prompt file. The user
// prompt is a pure function of its four blocks, so a silent drift in the wording fails the build.

import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractTs } from "./extract";
import { buildUserPrompt, parseNotes, SYSTEM_PROMPT_PATH } from "./prompt";
import { validateAsset } from "./validate";

// The art director's template prompt of 2026-11-18, with the three agreed corrections of A2. Every
// other byte is his, including the `Typescript` spelling and the spacing of the first line.
const ASSET_SYSTEM = `${[
	"Generate a single Typescript file that exports a `build()` function returning a Three.js object following that template :",
	"",
	"```typescript",
	'import * as THREE from "three";',
	"",
	"/**",
	" * Build a simple cube",
	" */",
	"export default function build(): THREE.Object3D {",
	"    const geometry = new THREE.BoxGeometry(1, 1, 1);",
	"    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });",
	"    const cube = new THREE.Mesh(geometry, material);",
	"    return cube;",
	"}",
	"```"
].join("\n")}\n`;

describe("the system prompt", () => {
	test("is the asset template, byte for byte", () => {
		const text = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
		expect(text).toBe(ASSET_SYSTEM);
	});

	test("the exported path points inside the workflow", () => {
		expect(SYSTEM_PROMPT_PATH).toBe(
			join(import.meta.dir, "..", "..", "prompts", "asset-system.txt")
		);
	});

	test("the fenced template is itself a valid asset", async () => {
		const template = extractTs(readFileSync(SYSTEM_PROMPT_PATH, "utf8"));
		// The scratch file lives under the repository so that `three` resolves from node_modules.
		const dir = resolve(import.meta.dir, "..", "..", "..", "..", ".tmp");
		mkdirSync(dir, { recursive: true });
		const path = join(
			dir,
			`asset-system-template-${process.pid}-${Date.now()}.ts`
		);
		writeFileSync(path, template);
		try {
			expect(await validateAsset(path)).toEqual({ ok: true });
		} finally {
			rmSync(path, { force: true });
		}
	});
});

describe("buildUserPrompt", () => {
	test("the full turn with a size, against the A3 lines", () => {
		const output = buildUserPrompt({
			subject: "a 1972 Renault 5 TL, orange, three doors",
			size: "L=3.6 m, w=1.5 m, h=1.4 m",
			style: "low-poly stylized video game figurine, soft studio light",
			details: "blank plates, no badge, no rear door on either side",
			name: "r5-tl-1972",
			request: "a 1972 Renault 5 TL"
		});
		expect(output).toBe(
			[
				"Here is the 3D model to recreate with Three.js primitives:",
				"* subject: a 1972 Renault 5 TL, orange, three doors",
				"* dimensions: L=3.6 m, w=1.5 m, h=1.4 m",
				"* style: low-poly stylized video game figurine, soft studio light",
				"* details that must survive: blank plates, no badge, no rear door on either side",
				"* asset name: r5-tl-1972",
				"* units: metres. +Y up. +Z is the front. The origin is the centre of the base.",
				"* Create one standalone TypeScript module that shows a 1972 Renault 5 TL.",
				'* import * as THREE from "three" only.',
				"* export default function build(): THREE.Object3D",
				"* One object: one mesh, or a Group when the object has parts.",
				"* Name every part, and two calls build the same object.",
				"* No ground, grid, background, fog, overlay, camera, renderer, light, or animation.",
				"* Do not add anything else."
			].join("\n")
		);
	});

	test("without a size and without details, both bullets are absent", () => {
		const output = buildUserPrompt({
			subject: "a robot head",
			style: "flat shaded",
			name: "robot-head",
			request: "a robot head"
		});
		expect(output).not.toContain("* dimensions:");
		expect(output).not.toContain("* details that must survive:");
		expect(output).toBe(
			[
				"Here is the 3D model to recreate with Three.js primitives:",
				"* subject: a robot head",
				"* style: flat shaded",
				"* asset name: robot-head",
				"* units: metres. +Y up. +Z is the front. The origin is the centre of the base.",
				"* Create one standalone TypeScript module that shows a robot head.",
				'* import * as THREE from "three" only.',
				"* export default function build(): THREE.Object3D",
				"* One object: one mesh, or a Group when the object has parts.",
				"* Name every part, and two calls build the same object.",
				"* No ground, grid, background, fog, overlay, camera, renderer, light, or animation.",
				"* Do not add anything else."
			].join("\n")
		);
	});

	test("the bullets keep the art director's order", () => {
		const output = buildUserPrompt({
			subject: "a red bicycle",
			size: "L=1.8 m, h=1.1 m",
			style: "clay render",
			details: "two wheels",
			name: "red-bicycle"
		});
		const order = [
			"* subject:",
			"* dimensions:",
			"* style:",
			"* details that must survive:",
			"* asset name:"
		];
		let previous = -1;
		for (const marker of order) {
			const index = output.indexOf(marker);
			expect(index).toBeGreaterThan(previous);
			previous = index;
		}
	});

	test("the constant first line starts every turn", () => {
		const output = buildUserPrompt({
			subject: "a red bicycle",
			style: "clay render",
			name: "red-bicycle"
		});
		expect(output.split("\n")[0]).toBe(
			"Here is the 3D model to recreate with Three.js primitives:"
		);
	});

	test("a missing request falls back to the subject", () => {
		const output = buildUserPrompt({
			subject: "a red bicycle",
			style: "clay render",
			name: "red-bicycle"
		});
		expect(output).toContain(
			"* Create one standalone TypeScript module that shows a red bicycle."
		);
	});

	test("an empty subject throws", () => {
		expect(() =>
			buildUserPrompt({ subject: "  ", style: "clay render", name: "x" })
		).toThrow();
	});

	test("an empty style, name, or request also throws", () => {
		expect(() =>
			buildUserPrompt({ subject: "a red bicycle", style: "", name: "x" })
		).toThrow();
		expect(() =>
			buildUserPrompt({
				subject: "a red bicycle",
				style: "clay",
				name: " "
			})
		).toThrow();
		expect(() =>
			buildUserPrompt({
				subject: "a red bicycle",
				style: "clay",
				name: "x",
				request: " "
			})
		).toThrow();
	});
});

describe("the prompt files", () => {
	const dir = join(import.meta.dir, "..", "..", "prompts", "subjects");

	// One entry per file: the inputs that the file encodes. The equality case below proves that a
	// hand edit which drops a bullet or reorders it fails the build.
	const files: Array<{
		slug: string;
		input: Parameters<typeof buildUserPrompt>[0];
	}> = [
		{
			slug: "modernist-office-chair",
			input: {
				subject:
					"a modernist office chair: walnut frame and legs, yellow leather seat and back.",
				size: "L=0.6 m, w=0.6 m, h=0.8 m.",
				style: "low-poly stylized video game figurine, soft studio light.",
				details:
					"a walnut frame and legs, a yellow leather seat and back, four steel legs, two armrests.",
				name: "modernist-office-chair",
				request: "a modernist office chair"
			}
		},
		{
			slug: "voxel-christmas-tree",
			input: {
				subject:
					"a Christmas tree in its pot, voxel art. Alternate pine green and dark pine green.",
				size: "L=0.5 m, w=0.5 m, h=1.5 m.",
				style: "voxel art: every visible form is made of cubes aligned to one grid, flat colors.",
				details:
					"ornaments are gold and white cubes on the outer branches of the tiers; one gold cube on the top.",
				name: "voxel-christmas-tree",
				request: "a voxel-art Christmas tree in its pot"
			}
		},
		{
			slug: "red-sportster",
			input: {
				subject: "a red sportster car.",
				size: "L=3 m, h=1 m, l=1.5 m.",
				style: "very low poly. Almost voxel style (some 45° angles are allowed).",
				name: "red-sportster",
				request: "a red sportster car"
			}
		}
	];

	for (const { slug, input } of files) {
		test(`${slug}.txt is under twenty lines and is the A3 turn`, () => {
			const text = readFileSync(join(dir, `${slug}.txt`), "utf8");
			const lines = text.trimEnd().split("\n");
			expect(lines.length).toBeLessThan(20);
			expect(lines[0]).toBe(
				"Here is the 3D model to recreate with Three.js primitives:"
			);
			expect(text).toContain('* import * as THREE from "three" only.');
			expect(text).toContain(
				"* export default function build(): THREE.Object3D"
			);
			expect(text).toContain(`* asset name: ${slug}`);
		});

		test(`${slug}.txt is exactly the turn the builder produces`, () => {
			const text = readFileSync(join(dir, `${slug}.txt`), "utf8");
			expect(text.trimEnd()).toBe(buildUserPrompt(input));
		});
	}
});

describe("parseNotes", () => {
	test("reads the subject and the details paragraph of notes.md", () => {
		const markdown = [
			"# Renault 5 TL 1972",
			"",
			"## Reference",
			"",
			"A two-panel sheet.",
			"",
			"## Subject",
			"",
			"A 1972 Renault 5 TL, orange, three doors.",
			"It has a fabric roof.",
			"",
			"A second paragraph is not read.",
			"",
			"## Specific subject details",
			"",
			"Blank plates and no badge.",
			"",
			"## Hidden parts",
			"",
			"None."
		].join("\n");
		const notes = parseNotes(markdown);
		expect(notes.subject).toBe(
			"A 1972 Renault 5 TL, orange, three doors.\nIt has a fabric roof."
		);
		expect(notes.details).toBe("Blank plates and no badge.");
	});

	test("a missing section is null, not an empty string", () => {
		const notes = parseNotes("# A subject\n\n## Reference\n\nA sheet.\n");
		expect(notes.subject).toBeNull();
		expect(notes.details).toBeNull();
	});
});

describe("the details headings", () => {
	test("the second accepted heading is read", () => {
		const markdown = [
			"# A robot",
			"",
			"## Subject",
			"",
			"A small robot with one eye.",
			"",
			"## Identity features that must not change",
			"",
			"One eye, one antenna, two arms."
		].join("\n");
		const notes = parseNotes(markdown);
		expect(notes.subject).toBe("A small robot with one eye.");
		expect(notes.details).toBe("One eye, one antenna, two arms.");
	});

	test("the first accepted heading wins when both are present", () => {
		const markdown = [
			"## Specific subject details",
			"",
			"Blank plates.",
			"",
			"## Identity features that must not change",
			"",
			"One eye."
		].join("\n");
		expect(parseNotes(markdown).details).toBe("Blank plates.");
	});
});
