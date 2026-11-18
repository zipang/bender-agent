// The TypeScript module out of a raw model response.
//
// The model emits reasoning, then the module. The extraction is pure and total: it returns the
// module, or it throws `NoModuleError`. An incomplete run must never become a candidate.
//
// The system prompt holds a fenced template, and the prompt asks for a file that follows it, so a
// reply may echo the template before writing its own module. The LAST TypeScript fence therefore
// wins (A6): the echo comes first and the answer comes last.

/** The response holds no complete TypeScript module. */
export class NoModuleError extends Error {
	constructor(
		message = "The response holds no fenced TypeScript module. Nothing was written."
	) {
		super(message);
		this.name = "NoModuleError";
	}
}

/** One fenced block: the info string of its opening line, and its body. */
type Fence = { info: string; body: string };

const OPENING_FENCE = /^\s*```(.*)$/;
const CLOSING_FENCE = /^\s*```\s*$/;

/**
 * Collect every fenced block of a response, in order.
 *
 * The info string is the text after the opening fence. The body is the text
 * between the fences, unchanged. An unterminated fence runs to the end of the
 * response.
 */
function fencedBlocks(raw: string): Fence[] {
	const lines = raw.split("\n");
	const blocks: Fence[] = [];
	let index = 0;
	while (index < lines.length) {
		const opening = OPENING_FENCE.exec(lines[index]!);
		if (!opening) {
			index += 1;
			continue;
		}
		const info = opening[1]!.trim().split(/\s+/)[0]!.toLowerCase();
		const body: string[] = [];
		index += 1;
		while (index < lines.length && !CLOSING_FENCE.test(lines[index]!)) {
			body.push(lines[index]!);
			index += 1;
		}
		// Skip the closing fence, when the response holds one.
		index += 1;
		blocks.push({ info, body: body.join("\n") });
	}
	return blocks;
}

/** Drop the leading and trailing blank lines, and keep every inner byte. */
function trimBlankLines(text: string): string {
	const lines = text.split("\n");
	while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
	while (lines.length > 0 && lines[lines.length - 1]!.trim() === "")
		lines.pop();
	return lines.join("\n");
}

/**
 * Return the TypeScript module of a raw response.
 *
 * The last `ts` or `typescript` fence wins, because a reply may echo the
 * system-prompt template before it writes the module. Without such a fence, the
 * first fence whose body holds `export default` is returned. Anything else
 * throws `NoModuleError`.
 */
export function extractTs(raw: string): string {
	const blocks = fencedBlocks(raw);

	const typescript = blocks.filter(
		(block) => block.info === "ts" || block.info === "typescript"
	);
	if (typescript.length > 0) {
		return trimBlankLines(typescript[typescript.length - 1]!.body);
	}

	const fallback = blocks.find((block) =>
		block.body.includes("export default")
	);
	if (fallback) return trimBlankLines(fallback.body);

	throw new NoModuleError();
}
