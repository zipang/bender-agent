// T1.9 and T1.15 — the entry point and its wiring.
//
// The CLI is tested with an injected preflight and an injected request, so no service runs and no
// model loads. The free `--ask` check runs the preflight and sends no completion.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_BASE_URL, DEFAULT_MODEL, runCli, type SceneDraftDeps } from "./scene-draft";
import type { PreflightOptions, PreflightResult } from "./lib/endpoint";

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
	const calls = {
		preflight: [] as PreflightOptions[],
		stream: [] as Array<Record<string, unknown>>,
	};
	let index = 0;
	const d: SceneDraftDeps = {
		out: (line) => lines.push(line),
		err: (line) => errors.push(line),
		systemPrompt: "the system prompt",
		preflight: async (options): Promise<PreflightResult> => {
			calls.preflight.push(options);
			return { ok: true, id: options.model };
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
	test("lists every missing gap, checks the endpoint, and sends nothing", async () => {
		const dir = subjectDir({ reference: false, notes: null });
		const { d, lines, calls } = deps();
		const code = await runCli(["--subject", dir, "--ask"], d);
		expect(code).toBe(0);
		const output = lines.join("\n");
		expect(output).toContain("reference");
		expect(output).toContain("subject note");
		expect(output).toContain("style");
		expect(calls.preflight).toHaveLength(1);
		expect(calls.stream).toHaveLength(0);
	});

	test("reports no gap on complete material and still sends nothing", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps();
		const code = await runCli(["--subject", dir, "--style", "clay render", "--ask"], d);
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("No gap");
		expect(calls.preflight).toHaveLength(1);
		expect(calls.stream).toHaveLength(0);
	});

	test("an unreachable endpoint exits 2 before it lists a gap", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors } = deps();
		d.preflight = async () => ({
			ok: false,
			exitCode: 2,
			message: `The endpoint at ${DEFAULT_BASE_URL}/models is unreachable.`,
		});
		const code = await runCli(["--subject", dir, "--style", "clay render", "--ask"], d);
		expect(code).toBe(2);
		expect(errors.join("\n")).toContain(DEFAULT_BASE_URL);
	});
});

describe("the endpoint flags", () => {
	test("the defaults are the documented base URL and model", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps();
		await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(calls.preflight[0]!.baseUrl).toBe(DEFAULT_BASE_URL);
		expect(calls.preflight[0]!.model).toBe(DEFAULT_MODEL);
	});

	test("--base-url and --model reach the preflight and the request", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps();
		await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay render",
				"--base-url",
				"https://gateway.example/api/v1",
				"--model",
				"another-3d-model",
			],
			d,
		);
		expect(calls.preflight[0]!.baseUrl).toBe("https://gateway.example/api/v1");
		expect(calls.preflight[0]!.model).toBe("another-3d-model");
		expect(calls.stream[0]!.model).toBe("another-3d-model");
		expect(calls.stream[0]!.baseUrl).toBe("https://gateway.example/api/v1");
	});

	test("the first line names the endpoint and the resolved model", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps();
		await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(lines[0]).toBe(`endpoint: ${DEFAULT_BASE_URL}  model: ${DEFAULT_MODEL}`);
	});

	test("a base URL with a trailing slash returns 1 before any check", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--base-url", `${DEFAULT_BASE_URL}/`],
			d,
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--base-url");
		expect(calls.preflight).toHaveLength(0);
	});

	test("a base URL that does not parse returns 1", async () => {
		const { d, errors, calls } = deps();
		const code = await runCli(["--subject", "x", "--base-url", "not a url"], d);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--base-url");
		expect(calls.preflight).toHaveLength(0);
	});

	test("a non-http base URL returns 1", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--base-url", "ftp://example.test/v1"],
			d,
		);
		expect(code).toBe(1);
	});

	test("an endpoint that does not publish the model exits 2 and sends no completion", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		d.preflight = async () => ({
			ok: false,
			exitCode: 2,
			message: 'does not publish the requested model "gone". Available ids: other.',
		});
		const code = await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(code).toBe(2);
		expect(errors.join("\n")).toContain("does not publish");
		expect(calls.stream).toHaveLength(0);
	});

	test("a thrown preflight is a failure with exit code 2", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		d.preflight = async () => {
			throw new Error("socket closed");
		};
		const code = await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(code).toBe(2);
		expect(errors.join("\n")).toContain("socket closed");
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

	test("--port and --profile are gone", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps();
		expect(await runCli(["--subject", dir, "--port", "9931"], d)).toBe(1);
		expect(await runCli(["--subject", dir, "--profile", "3d-coder"], d)).toBe(1);
	});

	test("a missing style returns 1 before any request", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps();
		const code = await runCli(["--subject", dir], d);
		expect(code).toBe(1);
		expect(calls.preflight).toHaveLength(0);
	});

	test("a missing reference returns 1 before any request", async () => {
		const dir = subjectDir({ reference: false, notes: NOTES });
		const { d, calls } = deps();
		const code = await runCli(["--subject", dir, "--style", "clay"], d);
		expect(code).toBe(1);
		expect(calls.preflight).toHaveLength(0);
	});
});

describe("a run", () => {
	test("checks the endpoint once, writes one candidate per variant, and reports each one", async () => {
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
		expect(calls.preflight).toHaveLength(1);
		expect(calls.stream).toHaveLength(2);
		const output = lines.join("\n");
		expect(output).toContain("qwen3d-coder-scene--01.html");
		expect(output).toContain("qwen3d-coder-scene--02.html");
		expect(output).toContain("tokens");
		expect(output).toContain("tok/s");
	});

	test("the request carries the model, the system prompt, the user prompt, and the guard", async () => {
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
		expect(sent.model).toBe(DEFAULT_MODEL);
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

describe("text mode, a prompt file instead of a subject", () => {
	const PROMPT = "A Christmas tree in its pot, voxel art.\nEvery form is a cube of size 1.";

	function promptFile(text: string | null = PROMPT): string {
		const dir = mkdtempSync(join(tmpdir(), "qwen3d-prompt-"));
		roots.push(dir);
		const path = join(dir, "subject.txt");
		if (text !== null) writeFileSync(path, text);
		return path;
	}

	function outDir(): string {
		const dir = mkdtempSync(join(tmpdir(), "qwen3d-out-"));
		roots.push(dir);
		return dir;
	}

	test("sends the file text as the user turn, with no image and no style", async () => {
		const path = promptFile();
		const out = join(outDir(), "generated");
		const { d, lines, calls } = deps();
		const code = await runCli(["--prompt-file", path, "--out", out], d);

		expect(code).toBe(0);
		expect(candidates(out)).toEqual(["qwen3d-coder-scene--01.html"]);
		expect(readFileSync(join(out, "qwen3d-coder-scene--01.html"), "utf8")).toBe(DOCUMENT);
		const sent = calls.stream[0]!;
		expect(sent.user).toBe(PROMPT);
		expect(sent.image).toBeNull();
		expect(lines.join("\n")).toContain(`prompt: ${path}`);
	});

	test("a second run writes --02 and leaves --01 byte-identical", async () => {
		const path = promptFile();
		const out = join(outDir(), "generated");
		const first = deps();
		await runCli(["--prompt-file", path, "--out", out], first.d);
		const before = readFileSync(join(out, "qwen3d-coder-scene--01.html"), "utf8");

		const second = deps([{ content: "<!DOCTYPE html>\n<html><body>second</body></html>" }]);
		await runCli(["--prompt-file", path, "--out", out], second.d);

		expect(candidates(out)).toEqual(["qwen3d-coder-scene--01.html", "qwen3d-coder-scene--02.html"]);
		expect(readFileSync(join(out, "qwen3d-coder-scene--01.html"), "utf8")).toBe(before);
	});

	test("--prompt-file without --out returns 1 and sends nothing", async () => {
		const path = promptFile();
		const { d, errors, calls } = deps();
		const code = await runCli(["--prompt-file", path], d);

		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--out is required with --prompt-file");
		expect(calls.preflight).toHaveLength(0);
		expect(calls.stream).toHaveLength(0);
	});

	test("a missing prompt file returns 1 and sends nothing", async () => {
		const path = join(promptFile(), "absent.txt");
		const { d, errors, calls } = deps();
		const code = await runCli(["--prompt-file", path, "--out", outDir()], d);

		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("does not exist");
		expect(calls.stream).toHaveLength(0);
	});

	test("an empty prompt file returns 1 and sends nothing", async () => {
		const path = promptFile("   \n\n ");
		const { d, errors, calls } = deps();
		const code = await runCli(["--prompt-file", path, "--out", outDir()], d);

		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("is empty");
		expect(calls.stream).toHaveLength(0);
	});

	test("--prompt-file and --subject are exclusive", async () => {
		const path = promptFile();
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--prompt-file", path, "--subject", dir, "--out", outDir()],
			d,
		);

		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("exclusive");
		expect(calls.stream).toHaveLength(0);
	});

	test("--ask on a complete prompt file lists no gap and sends nothing", async () => {
		const path = promptFile();
		const { d, lines, calls } = deps();
		const code = await runCli(["--prompt-file", path, "--out", outDir(), "--ask"], d);

		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("No gap found");
		expect(calls.stream).toHaveLength(0);
		expect(calls.preflight).toHaveLength(1);
	});
});
