// The system prompt and the user prompt of the asset drafter.
//
// The system prompt is read from `prompts/asset-system.txt`, which holds the art director's
// template prompt byte for byte. The user prompt is a pure function of its blocks.

import { resolve } from "node:path";
import type { TurnPart } from "./client";
import type { ResolvedImage } from "./images";

export type { TurnPart } from "./client";

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
	/** What must survive, when the notes hold it and the subject line does not. */
	details?: string | null;
	/** The images that go with the turn, already resolved. */
	images?: ResolvedImage[];
};

function required(value: string | null | undefined, field: string): string {
	const text = (value ?? "").trim();
	if (!text)
		throw new Error(`${field} is empty. The prompt is never sent empty.`);
	return text;
}

/**
 * The header of the turn: the constant first line, then one bullet per fact
 * that exists.
 *
 * The turn is data only. The output contract lives in the system prompt, so no
 * import, export, naming, or prohibition line appears here.
 */
function headerLines(input: UserPromptInput): string[] {
	const subject = required(input.subject, "The subject");
	const style = required(input.style, "The style");
	const size = (input.size ?? "").trim();
	const details = (input.details ?? "").trim();

	const lines = [
		"Here is the 3D model to recreate with Three.js primitives:",
		`* subject: ${subject}`
	];
	if (size) lines.push(`* dimensions: ${size}`);
	lines.push(`* style: ${style}`);
	if (details) lines.push(`* details that must survive: ${details}`);
	return lines;
}

/** The label a reader sees for one image: `reference sheet`, or `<view> view`. */
export function imageLabel(image: ResolvedImage): string {
	return image.label === "reference"
		? "reference sheet"
		: `${image.label} view`;
}

/**
 * Build the user turn text from its data.
 *
 * The `dimensions` and `details` bullets are optional. The subject and the
 * style are mandatory, and an empty input throws. The order of the bullets is
 * the art director's order.
 */
export function buildUserPrompt(input: UserPromptInput): string {
	return headerLines(input).join("\n");
}

/**
 * Build the typed user turn, for a request that may carry images.
 *
 * With no image the result is one text part, byte-identical to
 * `buildUserPrompt`. With images the result is that text part, then one text
 * label and one image part per image, in order.
 */
export function buildUserTurn(input: UserPromptInput): TurnPart[] {
	const parts: TurnPart[] = [
		{ type: "text", text: headerLines(input).join("\n") }
	];
	for (const image of input.images ?? []) {
		parts.push({ type: "text", text: `* image: ${imageLabel(image)}` });
		parts.push({
			type: "image",
			image: { mime: image.mime, data: image.data }
		});
	}
	return parts;
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
