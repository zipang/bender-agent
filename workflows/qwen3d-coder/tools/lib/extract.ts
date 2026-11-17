// The HTML document out of a raw model response.
//
// The model emits reasoning, then the document. The extraction is pure and total: it returns the
// document, or it throws `NoHtmlError`. An incomplete run must never become a candidate.

/** The response holds no complete HTML document. */
export class NoHtmlError extends Error {
	constructor(message = "The response holds no complete HTML document.") {
		super(message);
		this.name = "NoHtmlError";
	}
}

const HTML_START = "<html";
const DOCTYPE_START = "<!doctype html";
const HTML_END = "</html>";

/**
 * Return the document, from the first `<!DOCTYPE html` or `<html` to the last
 * `</html>`.
 *
 * A leading fence and a trailing fence are outside the returned span, and a
 * trailing prose paragraph is dropped. The response must hold an `<html` and a
 * `</html>`, or this throws.
 */
export function extractHtml(raw: string): string {
	const lower = raw.toLowerCase();
	const htmlStart = lower.indexOf(HTML_START);
	if (htmlStart < 0) {
		throw new NoHtmlError(
			"The response holds no <html>. Nothing was written."
		);
	}

	const doctypeStart = lower.indexOf(DOCTYPE_START);
	const start =
		doctypeStart >= 0 && doctypeStart < htmlStart
			? doctypeStart
			: htmlStart;

	const end = lower.lastIndexOf(HTML_END);
	if (end < start) {
		throw new NoHtmlError(
			"The response holds no </html>. The run is incomplete, so nothing was written."
		);
	}

	return raw.slice(start, end + HTML_END.length);
}
