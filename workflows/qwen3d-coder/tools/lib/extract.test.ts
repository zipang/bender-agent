// T1.5 — the extracted document.
//
// The model emits its reasoning, then the HTML. `extractHtml` is pure and total: it returns the
// document, or it throws `NoHtmlError` because an incomplete run must never become a candidate.

import { describe, expect, test } from "bun:test";
import { extractHtml, NoHtmlError } from "./extract";

const DOCUMENT = [
	"<!DOCTYPE html>",
	'<html lang="en">',
	'<head><meta charset="utf-8"><title>Scene</title></head>',
	'<body><script type="module">console.log("hi");</script></body>',
	"</html>",
].join("\n");

describe("extractHtml", () => {
	test("reasoning only throws NoHtmlError", () => {
		const raw =
			"The user wants a scene. I will build a ground plane and a box.\n\nThen a light.";
		expect(() => extractHtml(raw)).toThrow(NoHtmlError);
	});

	test("a plain document is returned unchanged", () => {
		expect(extractHtml(DOCUMENT)).toBe(DOCUMENT);
	});

	test("a fenced document is unwrapped", () => {
		const raw = ["Here is the file:", "```html", DOCUMENT, "```", "Enjoy."].join("\n");
		expect(extractHtml(raw)).toBe(DOCUMENT);
	});

	test("a document with trailing prose stops at the last </html>", () => {
		const raw = `${DOCUMENT}\n\nThis scene uses a hemisphere light and one box.`;
		expect(extractHtml(raw)).toBe(DOCUMENT);
	});

	test("a document with leading reasoning and a doctype starts at the doctype", () => {
		const raw = `I will now write the HTML.\n\n${DOCUMENT}`;
		expect(extractHtml(raw)).toBe(DOCUMENT);
	});

	test("a truncated document throws NoHtmlError", () => {
		const raw = DOCUMENT.slice(0, DOCUMENT.indexOf("</html>"));
		expect(() => extractHtml(raw)).toThrow(NoHtmlError);
		expect(raw).toContain("<html");
		expect(raw).not.toContain("</html>");
	});

	test("a document without a doctype starts at <html", () => {
		const raw = DOCUMENT.replace("<!DOCTYPE html>\n", "");
		expect(extractHtml(raw)).toBe(raw);
	});
});
