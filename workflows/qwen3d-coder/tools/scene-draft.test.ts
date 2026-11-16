// T1.9 — the entry point and its wiring.
//
// The CLI is tested with an injected server starter and an injected request, so no server runs and
// no model loads. The free `--ask` check sends nothing at all.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli, type SceneDraftDeps } from "./scene-draft";

const roots: string[] = [];

function subjectDir(options: { reference?: boolean; notes?: string | null } = {}): string {
	const dir = mkdtempSync(join(tmpdir(), "qwen3d-subject-"));
	roots.push(dir);
	if (options.reference !== false) writeFileSync(join(dir, "reference.png"), "PNG-BYTES");
	if (options.notes !== undefined) {
		if (options.notes !== null) writeFileSync(join(dir, "notes.md"), options.notes);
	}
	return dir;
}

const NOTES = [
	"# A subject",
	"",
	"## Subject",
	"",
	"a 1972 Renault 5 TL, orange, three doors",
	"",
	"## Specific subject details",
	"",
	"blank plates, no badge",
].join("\n");

const DOCUMENT = "<!DOCTYPE html>\n<html><body>scene</body></html>";

/** The candidate files of a `generated/` folder, sorted. The counter file is not a candidate. */
function candidates(generatedDir: string): string[] {
	return readdirSync(generatedDir)
		.filter((name) => name.endsWith(".html"))
		.sort();
}

function deps(streamResults: Array<{ content: string } | Error> = [{ content: DOCUMENT }]) {
	const lines: string[] = [];
	const errors: string[] = [];
	const calls = { ensure: 0, stop: 0, stream: [] as Array<Record<string, unknown>> };
	let index = 0;
	const d: SceneDraftDeps = {
		out: (line) => lines.push(line),
		err: (line) => errors.push(line),
		systemPrompt: "the system prompt",
		ensure: async () => {
			calls.ensure += 1;
			return {
				reused: false,
				port: 9931,
				stop: async () => {
					calls.stop += 1;
				},
			};
		},
		stream: async (options) => {
			calls.stream.push(options as unknown as Record<string, unknown>);
			const result = streamResults[Math.min(index, streamResults.length - 1)]!;
			index += 1;
			if (result instanceof Error) throw result;
			return { content: result.content, tokens: 2, seconds: 0.1, tokensPerSecond: 20 };
		},
	};
	return { d, lines, errors, calls };
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("--ask", () => {
	test("lists every missing gap and sends nothing", async () => {
		const dir = subjectDir({ reference: false, notes: null });
		const { d, lines, calls } = deps();
		const code = await runCli(["--subject", dir, "--ask"], d);
		expect(code).toBe(0);
		const output = lines.join("\n");
		expect(output).toContain("reference");
		expect(output).toContain("subject note");
		expect(output).toContain("style");
		expect(calls.ensure).toBe(0);
		expect(calls.stream).toHaveLength(0);
	});

	test("reports no gap on complete material and still sends nothing", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps();
		const code = await runCli(["--subject", dir, "--style", "clay render", "--ask"], d);
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("No gap");
		expect(calls.ensure).toBe(0);
		expect(calls.stream).toHaveLength(0);
	});
});

describe("invalid input", () => {
	test("a missing --subject returns 1", async () => {
		const { d, errors } = deps();
		const code = await runCli([], d);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--subject");
	});

	test("an unknown flag returns 1", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors } = deps();
		const code = await runCli(["--subject", dir, "--style", "clay", "--nope"], d);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--nope");
	});

	test("a missing style returns 1 before any request", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps();
		const code = await runCli(["--subject", dir], d);
		expect(code).toBe(1);
		expect(calls.ensure).toBe(0);
	});

	test("a missing reference returns 1 before any request", async () => {
		const dir = subjectDir({ reference: false, notes: NOTES });
		const { d, calls } = deps();
		const code = await runCli(["--subject", dir, "--style", "clay"], d);
		expect(code).toBe(1);
		expect(calls.ensure).toBe(0);
	});
});

describe("a run", () => {
	test("writes one candidate per variant, reports each one, and stops the server", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps([{ content: DOCUMENT }]);
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--variants", "2"],
			d,
		);
		expect(code).toBe(0);
		const files = candidates(join(dir, "generated"));
		expect(files).toEqual(["qwen3d-coder-scene--01.html", "qwen3d-coder-scene--02.html"]);
		expect(readFileSync(join(dir, "generated", files[0]!), "utf8")).toBe(DOCUMENT);
		expect(calls.stream).toHaveLength(2);
		expect(calls.stop).toBe(1);
		const output = lines.join("\n");
		expect(output).toContain("qwen3d-coder-scene--01.html");
		expect(output).toContain("qwen3d-coder-scene--02.html");
		expect(output).toContain("tokens");
		expect(output).toContain("tok/s");
	});

	test("the request carries the alias, the system prompt, the user prompt, and the guard", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps();
		await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay render",
				"--prompt",
				"the car on a turntable",
				"--max-tokens",
				"512",
				"--seed",
				"42",
			],
			d,
		);
		const sent = calls.stream[0]!;
		expect(sent.alias).toBe("local/3d-coder");
		expect(sent.system).toBe("the system prompt");
		expect(String(sent.user)).toContain("Subject: a 1972 Renault 5 TL, orange, three doors");
		expect(String(sent.user)).toContain("shows the car on a turntable.");
		expect(sent.maxTokens).toBe(512);
		expect(sent.seed).toBe(42);
		expect(sent.image).toBeNull();
	});

	test("--image sends the reference bytes with their media type", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps();
		await runCli(["--subject", dir, "--style", "clay render", "--image"], d);
		const image = calls.stream[0]!.image as { mime: string; data: string };
		expect(image.mime).toBe("image/png");
		expect(image.data).toBe(Buffer.from("PNG-BYTES").toString("base64"));
	});

	test("a failed variant does not stop the next one", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps([
			{ content: "reasoning only, no document" },
			{ content: DOCUMENT },
		]);
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--variants", "2"],
			d,
		);
		expect(code).toBe(0);
		expect(calls.stream).toHaveLength(2);
		expect(candidates(join(dir, "generated"))).toEqual(["qwen3d-coder-scene--01.html"]);
		expect(lines.join("\n")).toContain("failed");
	});

	test("a server that never becomes ready returns 2", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors } = deps();
		d.ensure = async () => {
			throw new Error("Server did not become ready");
		};
		const code = await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(code).toBe(2);
		expect(errors.join("\n")).toContain("not become ready");
	});

	test("a request failure returns 3 when no variant is written", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps([new Error("request failed")]);
		d.stream = async () => {
			throw new Error("request failed");
		};
		const code = await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(code).toBe(3);
	});

	test("an incomplete document on every variant returns 4", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps([{ content: "no html here" }]);
		const code = await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(code).toBe(4);
	});

	test("existing candidates are never overwritten", async () => {
		const dir = subjectDir({ notes: NOTES });
		mkdirSync(join(dir, "generated"));
		const existing = join(dir, "generated", "qwen3d-coder-scene--01.html");
		writeFileSync(existing, "the first run");
		const { d } = deps();
		const code = await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(code).toBe(0);
		expect(readFileSync(existing, "utf8")).toBe("the first run");
		expect(candidates(join(dir, "generated"))).toEqual([
			"qwen3d-coder-scene--01.html",
			"qwen3d-coder-scene--02.html",
		]);
	});
});

describe("a write failure", () => {
	test("returns 5 and is not reported as a request failure", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps();
		d.write = () => {
			throw new Error("disk full");
		};
		const code = await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(code).toBe(5);
		expect(calls.stream).toHaveLength(1);
		expect(lines.join("\n")).toContain("could not be written");
	});

	test("a write failure does not stop the next variant", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps([{ content: DOCUMENT }, { content: DOCUMENT }]);
		let attempts = 0;
		d.write = () => {
			attempts += 1;
			if (attempts === 1) throw new Error("disk full");
			return `${dir}/generated/qwen3d-coder-scene--01.html`;
		};
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--variants", "2"],
			d,
		);
		expect(code).toBe(0);
		expect(calls.stream).toHaveLength(2);
	});
});
