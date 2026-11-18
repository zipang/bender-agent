// The system prompt and the user prompt of the asset drafter.
//
// The system prompt is read from `prompts/asset-system.txt`, which holds the art director's
// template prompt byte for byte. The user prompt is a pure function of its blocks.

import { resolve } from "node:path";

/** The asset template prompt, inside the workflow. */
export const SYSTEM_PROMPT_PATH = resolve(
	import.meta.dir,
	"..",
	"..",
	"prompts",
	"asset-system.txt"
);

export type UserPromptInput = {
	/** What the subject is, in one paragraph. */
	subject: string;
	/** How the asset must look. */
	style: string;
	/** The real dimensions, in the art director's notation, when they are known. */
	size?: string | null;
	/** What must survive, when the notes hold it. */
	details?: string | null;
	/** The resolved asset name, for the candidate file. */
	name: string;
	/** The request of this run. It defaults to the subject. */
	request?: string | null;
};

function required(value: string | null | undefined, field: string): string {
	const text = (value ?? "").trim();
	if (!text)
		throw new Error(`${field} is empty. The prompt is never sent empty.`);
	return text;
}

/**
 * Build the user turn from its blocks.
 *
 * The `dimensions` and `details` bullets are optional. The subject, the style,
 * the name, and the request are mandatory, and an empty input throws. The order
 * of the bullets is the art director's order (A3).
 */
export function buildUserPrompt(input: UserPromptInput): string {
	const subject = required(input.subject, "The subject");
	const style = required(input.style, "The style");
	const name = required(input.name, "The asset name");
	const request = required(input.request ?? subject, "The request");
	const size = (input.size ?? "").trim();
	const details = (input.details ?? "").trim();

	const blocks = [
		"Here is the 3D model to recreate with Three.js primitives:",
		`* subject: ${subject}`
	];
	if (size) blocks.push(`* dimensions: ${size}`);
	blocks.push(`* style: ${style}`);
	if (details) blocks.push(`* details that must survive: ${details}`);
	blocks.push(
		`* asset name: ${name}`,
		"* units: metres. +Y up. +Z is the front. The origin is the centre of the base.",
		`* Create one standalone TypeScript module that shows ${request}.`,
		'* import * as THREE from "three" only.',
		"* export default function build(): THREE.Object3D",
		"* One object: one mesh, or a Group when the object has parts.",
		"* Name every part, and two calls build the same object.",
		"* No ground, grid, background, fog, overlay, camera, renderer, light, or animation.",
		"* Do not add anything else."
	);
	return blocks.join("\n");
}

export type SubjectNotes = {
	/** The first paragraph under `## Subject`, or null. */
	subject: string | null;
	/** The first paragraph under the details heading, or null. */
	details: string | null;
};

/**
 * The accepted details headings, in order of preference.
 *
 * The repository uses both. The first heading found wins.
 */
export const DETAILS_HEADINGS = [
	"## Specific subject details",
	"## Identity features that must not change"
] as const;

function sectionParagraph(markdown: string, heading: string): string | null {
	const lines = markdown.split("\n");
	const start = lines.findIndex(
		(line) => line.trim().toLowerCase() === heading.toLowerCase()
	);
	if (start < 0) return null;

	const paragraph: string[] = [];
	for (const line of lines.slice(start + 1)) {
		const trimmed = line.trim();
		if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) break;
		if (trimmed === "") {
			if (paragraph.length > 0) break;
			continue;
		}
		paragraph.push(trimmed);
	}
	const text = paragraph.join("\n").trim();
	return text ? text : null;
}

/** Read the two paragraphs of `notes.md` that feed the prompt. */
export function parseNotes(markdown: string): SubjectNotes {
	let details: string | null = null;
	for (const heading of DETAILS_HEADINGS) {
		details = sectionParagraph(markdown, heading);
		if (details) break;
	}
	return {
		subject: sectionParagraph(markdown, "## Subject"),
		details
	};
}
