// T1.4 — the system prompt and the user prompt.
//
// The system prompt is the model card's text, byte for byte, on the decision of the art director
// (T0013 D7): the card states the runtime, and the constraints live in the prompt file. The user
// prompt is a pure function of its four blocks, so a silent drift in the wording fails the build.

import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractTs } from "./extract";
import type { ResolvedImage } from "./images";
import {
	buildUserPrompt,
	buildUserTurn,
	parseNotes,
	SYSTEM_PROMPT_PATH
} from "./prompt";
import { validateAsset } from "./validate";

/** A resolved image, standing in for one that a run really encoded. */
function fakeImage(label: string): ResolvedImage {
	return {
		label,
		path: `/blueprints/${label}.png`,
		mime: "image/png",
		preset: "full",
		width: 800,
		height: 800,
		bytes: 3,
		data: "QUJD"
	};
}

// The constant prompt of 2026-11-18, after the corrections of A2 and the three contract lines of R1,
// R3, and R4. Every other byte is the art director's.
const ASSET_SYSTEM = `${[
	"Write one TypeScript module that follows this template exactly:",
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
	"```",
	"Units: metres. +Y up. +Z is the front. The origin is the centre of the base.",
	"Return the asset only: one mesh, or a Group of meshes. No scene, camera, renderer, light, ground, or animation.",
	"Declare each name once, and use a name only after its declaration."
].join("\n")}\n`;

describe("the system prompt", () => {
	test("is the asset template, byte for byte", () => {
		const text = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
		expect(text).toBe(ASSET_SYSTEM);
	});

	test("the Units line appears exactly once", () => {
		const text = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
		const marker =
			"Units: metres. +Y up. +Z is the front. The origin is the centre of the base.";
		expect(text.split(marker)).toHaveLength(2);
	});

	test("the Return the asset only line appears exactly once", () => {
		const text = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
		const marker =
			"Return the asset only: one mesh, or a Group of meshes. No scene, camera, renderer, light, ground, or animation.";
		expect(text.split(marker)).toHaveLength(2);
	});

	test("the Declare each name once line appears exactly once", () => {
		const text = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
		const marker =
			"Declare each name once, and use a name only after its declaration.";
		expect(text.split(marker)).toHaveLength(2);
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
	test("the data bullets, in the art director's order", () => {
		const output = buildUserPrompt({
			subject: "a 1972 Renault 5 TL, orange, three doors",
			size: "L=3.6 m, h=1.4 m, l=1.5 m",
			style: "low-poly stylized video game figurine, soft studio light",
			details: "blank plates, no badge, no rear door on either side"
		});
		expect(output).toBe(
			[
				"Here is the 3D model to recreate with Three.js primitives:",
				"* subject: a 1972 Renault 5 TL, orange, three doors",
				"* dimensions: L=3.6 m, h=1.4 m, l=1.5 m",
				"* style: low-poly stylized video game figurine, soft studio light",
				"* details that must survive: blank plates, no badge, no rear door on either side"
			].join("\n")
		);
	});

	test("without a size and without details, both bullets are absent", () => {
		const output = buildUserPrompt({
			subject: "a robot head",
			style: "flat shaded"
		});
		expect(output).not.toContain("* dimensions:");
		expect(output).not.toContain("* details that must survive:");
		expect(output).toBe(
			[
				"Here is the 3D model to recreate with Three.js primitives:",
				"* subject: a robot head",
				"* style: flat shaded"
			].join("\n")
		);
	});

	test("the bullets keep the art director's order", () => {
		const output = buildUserPrompt({
			subject: "a red bicycle",
			size: "L=1.8 m, h=1.1 m, l=0.4 m",
			style: "clay render",
			details: "two wheels"
		});
		const order = [
			"* subject:",
			"* dimensions:",
			"* style:",
			"* details that must survive:"
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
			style: "clay render"
		});
		expect(output.split("\n")[0]).toBe(
			"Here is the 3D model to recreate with Three.js primitives:"
		);
	});

	test("the turn carries no contract line and no asset name", () => {
		const output = buildUserPrompt({
			subject: "a red bicycle",
			style: "clay render"
		});
		for (const forbidden of [
			"import ",
			"export default",
			"One object",
			"Name every part",
			"No ground",
			"Do not add",
			"asset name",
			"Create one"
		]) {
			expect(output).not.toContain(forbidden);
		}
	});

	test("an empty subject or style throws", () => {
		expect(() =>
			buildUserPrompt({ subject: "  ", style: "clay" })
		).toThrow();
		expect(() =>
			buildUserPrompt({ subject: "a red bicycle", style: "" })
		).toThrow();
	});
});

describe("the prompt files", () => {
	const dir = join(import.meta.dir, "..", "..", "prompts", "subjects");

	// One entry per file: the data that each file encodes, and the data the header bullet does not
	// carry. The equality case proves that a hand edit which drops a bullet or adds a contract line
	// fails the build.
	const files: Array<{
		slug: string;
		input: Parameters<typeof buildUserPrompt>[0];
	}> = [
		{
			slug: "modernist-office-chair",
			input: {
				subject:
					"a wooden swivel desk chair, walnut frame, yellow leather, cast iron mechanism.",
				size: "length 0.62 m (front to back), width 0.66 m (left to right), height 0.88 m.",
				style: "low poly.",
				details:
					"open walnut C-frame arms with no pad, brass studs along the back and the seat, five flat wooden spokes, small black casters, black tilt column."
			}
		},
		{
			slug: "voxel-christmas-tree",
			input: {
				subject:
					"a Christmas tree in its pot, voxel art. Alternate pine green and dark pine green.",
				size: "L=0.5 m, h=1.5 m, l=0.5 m.",
				style: "voxel art: every visible form is made of cubes aligned to one grid, flat colors.",
				details:
					"ornaments are gold and white cubes on the outer branches of the tiers; one gold cube on the top."
			}
		},
		{
			slug: "red-sportster",
			input: {
				subject: "a red sportster car.",
				size: "L=3 m, h=1 m, l=1.5 m.",
				style: "very low poly. Almost voxel style (some 45° angles are allowed)."
			}
		}
	];

	for (const { slug, input } of files) {
		test(`${slug}.txt holds at most five lines`, () => {
			const text = readFileSync(join(dir, `${slug}.txt`), "utf8");
			const lines = text.trimEnd().split("\n");
			expect(lines.length).toBeLessThanOrEqual(5);
			expect(lines[0]).toBe(
				"Here is the 3D model to recreate with Three.js primitives:"
			);
		});

		test(`${slug}.txt holds no contract line`, () => {
			const text = readFileSync(join(dir, `${slug}.txt`), "utf8");
			for (const forbidden of [
				"import ",
				"export default",
				"No ground",
				"Do not add",
				"asset name"
			]) {
				expect(text).not.toContain(forbidden);
			}
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

describe("buildUserTurn", () => {
	const base = {
		subject: "a 1972 Renault 5 TL, orange, three doors",
		size: "L=3.6 m, h=1.4 m, l=1.5 m",
		style: "low-poly stylized video game figurine, soft studio light"
	};

	test("with no image it is one text part, byte-identical to the data turn", () => {
		const parts = buildUserTurn(base);
		expect(parts).toEqual([{ type: "text", text: buildUserPrompt(base) }]);
	});

	test("one image gives text, label, image and nothing after it", () => {
		const parts = buildUserTurn({
			...base,
			images: [fakeImage("reference")]
		});
		expect(parts).toEqual([
			{ type: "text", text: buildUserPrompt(base) },
			{ type: "text", text: "* image: reference sheet" },
			{
				type: "image",
				image: { mime: "image/png", data: "QUJD" }
			}
		]);
	});

	test("three views give three labels in order", () => {
		const parts = buildUserTurn({
			...base,
			images: [fakeImage("top"), fakeImage("right"), fakeImage("back")]
		});
		expect(parts).toHaveLength(7);
		expect(parts.map((part) => part.type)).toEqual([
			"text",
			"text",
			"image",
			"text",
			"image",
			"text",
			"image"
		]);
		expect(
			parts
				.filter((part) => part.type === "text")
				.map((part) => (part as { text: string }).text)
				.slice(1)
		).toEqual([
			"* image: top view",
			"* image: right view",
			"* image: back view"
		]);
	});

	test("the text part carries no images count and no contract line", () => {
		const [part] = buildUserTurn({
			...base,
			images: [fakeImage("top"), fakeImage("right")]
		}) as Array<{ text: string }>;
		expect(part.text).not.toContain("* images:");
		expect(part.text).not.toContain("asset name");
		expect(part.text).not.toContain("Create one");
		expect(part.text).not.toContain("import ");
	});
});
