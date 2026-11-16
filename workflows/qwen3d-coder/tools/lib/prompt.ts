// The system prompt and the user prompt of the scene drafter.
//
// The system prompt is read from `prompts/3d-coder-system.txt`, which holds the model card's text
// byte for byte. The user prompt is a pure function of its four blocks.

import { resolve } from "node:path";

/** The model card's system prompt, inside the workflow. */
export const SYSTEM_PROMPT_PATH = resolve(
	import.meta.dir,
	"..",
	"..",
	"prompts",
	"3d-coder-system.txt",
);

export type UserPromptInput = {
	/** What the subject is, in one paragraph. */
	subject: string;
	/** How the scene must be rendered. */
	style: string;
	/** What must survive, when the notes hold it. */
	details?: string | null;
	/** The request of this run. It defaults to the subject. */
	request?: string | null;
};

function required(value: string | null | undefined, field: string): string {
	const text = (value ?? "").trim();
	if (!text) throw new Error(`${field} is empty. The prompt is never sent empty.`);
	return text;
}

/**
 * Build the user prompt from its four blocks.
 *
 * Block 3 is optional. The other three are mandatory, and an empty input throws.
 */
export function buildUserPrompt(input: UserPromptInput): string {
	const subject = required(input.subject, "The subject");
	const style = required(input.style, "The style");
	const request = required(input.request ?? subject, "The request");
	const details = (input.details ?? "").trim();

	const blocks = [`Subject: ${subject}`, `Style: ${style}`];
	if (details) blocks.push(`Details that must survive: ${details}`);
	blocks.push(
		`Create one self-contained HTML file with Three.js from cdnjs that shows ${request}.`,
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
	"## Identity features that must not change",
] as const;

function sectionParagraph(markdown: string, heading: string): string | null {
	const lines = markdown.split("\n");
	const start = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
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
		details,
	};
}
