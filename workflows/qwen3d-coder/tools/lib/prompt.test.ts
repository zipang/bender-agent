// T1.4 — the system prompt and the user prompt.
//
// The system prompt is the model card's text, byte for byte, on the decision of the art director
// (T0013 D7): the card states the runtime, and the constraints live in the prompt file. The user
// prompt is a pure function of its four blocks, so a silent drift in the wording fails the build.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildUserPrompt, parseNotes, SYSTEM_PROMPT_PATH } from "./prompt";

// The model card, section "System prompt", three lines.
const CARD_LINES = [
	"Use only the Three.js core ES module from",
	"https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js.",
	"Do not import addons or legacy examples/js paths;",
	"implement any camera controls directly inside the HTML.",
];

describe("the system prompt", () => {
	test("is the model card text byte for byte", () => {
		const text = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
		expect(text).toBe(`${CARD_LINES.join("\n")}\n`);
	});

	test("the exported path points inside the workflow", () => {
		expect(SYSTEM_PROMPT_PATH).toBe(
			join(import.meta.dir, "..", "..", "prompts", "3d-coder-system.txt"),
		);
	});
});

describe("buildUserPrompt", () => {
	test("the four blocks, with details, against a fixture", () => {
		const output = buildUserPrompt({
			subject: "a 1972 Renault 5 TL, orange, three doors",
			style: "low-poly stylized video game figurine, soft studio light",
			details: "blank plates, no badge, no rear door on either side",
			request: "the car on a plain turntable",
		});
		expect(output).toBe(
			[
				"Subject: a 1972 Renault 5 TL, orange, three doors",
				"Style: low-poly stylized video game figurine, soft studio light",
				"Details that must survive: blank plates, no badge, no rear door on either side",
				"Create one self-contained HTML file with Three.js from cdnjs that shows the car on a plain turntable.",
			].join("\n"),
		);
	});

	test("the details block is optional and vanishes when absent", () => {
		const output = buildUserPrompt({
			subject: "a robot head",
			style: "flat shaded",
			details: "   ",
			request: "a robot head",
		});
		expect(output).toBe(
			[
				"Subject: a robot head",
				"Style: flat shaded",
				"Create one self-contained HTML file with Three.js from cdnjs that shows a robot head.",
			].join("\n"),
		);
		expect(output).not.toContain("Details that must survive:");
	});

	test("a missing request falls back to the subject", () => {
		const output = buildUserPrompt({ subject: "a red bicycle", style: "clay render" });
		expect(output).toBe(
			[
				"Subject: a red bicycle",
				"Style: clay render",
				"Create one self-contained HTML file with Three.js from cdnjs that shows a red bicycle.",
			].join("\n"),
		);
	});

	test("an empty input throws", () => {
		expect(() => buildUserPrompt({ subject: "  ", style: "clay render" })).toThrow();
		expect(() => buildUserPrompt({ subject: "a red bicycle", style: "" })).toThrow();
		expect(() =>
			buildUserPrompt({ subject: "a red bicycle", style: "clay", request: " " }),
		).toThrow();
	});
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
			"None.",
		].join("\n");
		const notes = parseNotes(markdown);
		expect(notes.subject).toBe(
			"A 1972 Renault 5 TL, orange, three doors.\nIt has a fabric roof.",
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
			"One eye, one antenna, two arms.",
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
			"One eye.",
		].join("\n");
		expect(parseNotes(markdown).details).toBe("Blank plates.");
	});
});
