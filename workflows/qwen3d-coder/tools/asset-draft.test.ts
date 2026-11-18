// T0017 — the entry point, its image flags, its dimensions, and its report.
//
// The CLI is tested with an injected preflight, an injected request, and an injected validator, so
// no service runs and no model loads. The free `--ask` check runs the preflight and sends no
// completion.

import { afterEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import {
	DEFAULT_BASE_URL,
	DEFAULT_MODEL,
	runCli,
	type AssetDraftDeps
} from "./asset-draft";
import type { PreflightOptions, PreflightResult } from "./lib/endpoint";

const roots: string[] = [];

// Scratch files live under the repository, as AGENTS.md requires: never in /tmp.
const SCRATCH_ROOT = resolve(import.meta.dir, "..", "..", "..", ".tmp");
mkdirSync(SCRATCH_ROOT, { recursive: true });

// A real 1 × 1 PNG: the drafter now decodes every image, so a fake byte string would be refused.
const ONE_PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lv0l1QAAAABJRU5ErkJggg==",
	"base64"
);

/** A subject folder with a kebab-case name, so the default asset name is valid. */
function subjectDir(
	options: {
		reference?: boolean;
		notes?: string | null;
		dimensions?: string | null;
		views?: string[];
	} = {}
): string {
	const root = mkdtempSync(join(SCRATCH_ROOT, "qwen3d-subject-"));
	roots.push(root);
	const dir = join(root, "test-subject");
	mkdirSync(dir);
	if (options.reference !== false)
		writeFileSync(join(dir, "reference.png"), ONE_PIXEL_PNG);
	if (options.notes !== undefined) {
		if (options.notes !== null)
			writeFileSync(join(dir, "notes.md"), options.notes);
	}
	if (options.dimensions !== undefined) {
		if (options.dimensions !== null)
			writeFileSync(join(dir, "dimensions.json"), options.dimensions);
	}
	for (const view of options.views ?? []) {
		mkdirSync(join(dir, view));
		writeFileSync(join(dir, view, "reference.png"), ONE_PIXEL_PNG);
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
	"blank plates, no badge"
].join("\n");

const ASSET = [
	'import * as THREE from "three";',
	"",
	"export default function build(): THREE.Object3D {",
	"\treturn new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));",
	"}"
].join("\n");

// The model answers with a fenced TypeScript block; the drafter extracts its body.
const RESPONSE = `\`\`\`ts\n${ASSET}\n\`\`\``;

/**
 * The candidate files of a `generated/` folder, sorted. The counter file is not
 * a candidate.
 */
function candidates(generatedDir: string): string[] {
	return readdirSync(generatedDir)
		.filter((name) => name.endsWith(".ts"))
		.sort();
}

function deps(
	streamResults: Array<
		| {
				content: string;
				promptTokens?: number | null;
				cachedTokens?: number | null;
		  }
		| Error
	> = [{ content: RESPONSE }]
) {
	const lines: string[] = [];
	const errors: string[] = [];
	const calls = {
		preflight: [] as PreflightOptions[],
		stream: [] as Array<Record<string, unknown>>
	};
	let index = 0;
	const d: AssetDraftDeps = {
		out: (line) => lines.push(line),
		err: (line) => errors.push(line),
		systemPrompt: "the system prompt",
		preflight: async (options): Promise<PreflightResult> => {
			calls.preflight.push(options);
			return { ok: true, id: options.model, multimodal: null };
		},
		stream: async (options) => {
			calls.stream.push(options as unknown as Record<string, unknown>);
			const result =
				streamResults[Math.min(index, streamResults.length - 1)]!;
			index += 1;
			if (result instanceof Error) throw result;
			return {
				content: result.content,
				tokens: 2,
				seconds: 0.1,
				tokensPerSecond: 20,
				promptTokens: result.promptTokens ?? null,
				cachedTokens: result.cachedTokens ?? null
			};
		},
		validate: async () => ({ ok: true })
	};
	return { d, lines, errors, calls };
}

afterEach(() => {
	for (const dir of roots.splice(0))
		rmSync(dir, { recursive: true, force: true });
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
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--ask"],
			d
		);
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("No gap");
		expect(calls.preflight).toHaveLength(1);
		expect(calls.stream).toHaveLength(0);
	});

	test("reports an invalid asset name as a gap", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps();
		const code = await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay",
				"--name",
				"Bad Name",
				"--ask"
			],
			d
		);
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("not kebab case");
		expect(calls.stream).toHaveLength(0);
	});

	test("an unreachable endpoint exits 2 before it lists a gap", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors } = deps();
		d.preflight = async () => ({
			ok: false,
			exitCode: 2,
			message: `The endpoint at ${DEFAULT_BASE_URL}/models is unreachable.`
		});
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--ask"],
			d
		);
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
				"another-3d-model"
			],
			d
		);
		expect(calls.preflight[0]!.baseUrl).toBe(
			"https://gateway.example/api/v1"
		);
		expect(calls.preflight[0]!.model).toBe("another-3d-model");
		expect(calls.stream[0]!.model).toBe("another-3d-model");
		expect(calls.stream[0]!.baseUrl).toBe("https://gateway.example/api/v1");
	});

	test("the first line names the endpoint and the resolved model", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps();
		await runCli(["--subject", dir, "--style", "clay render"], d);
		expect(lines[0]).toBe(
			`endpoint: ${DEFAULT_BASE_URL}  model: ${DEFAULT_MODEL}`
		);
	});

	test("a base URL with a trailing slash returns 1 before any check", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay",
				"--base-url",
				`${DEFAULT_BASE_URL}/`
			],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--base-url");
		expect(calls.preflight).toHaveLength(0);
	});

	test("a base URL that does not parse returns 1", async () => {
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", "x", "--base-url", "not a url"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--base-url");
		expect(calls.preflight).toHaveLength(0);
	});

	test("a non-http base URL returns 1", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps();
		const code = await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay",
				"--base-url",
				"ftp://example.test/v1"
			],
			d
		);
		expect(code).toBe(1);
	});

	test("an endpoint that does not publish the model exits 2 and sends no completion", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		d.preflight = async () => ({
			ok: false,
			exitCode: 2,
			message:
				'does not publish the requested model "gone". Available ids: other.'
		});
		const code = await runCli(
			["--subject", dir, "--style", "clay render"],
			d
		);
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
		const code = await runCli(
			["--subject", dir, "--style", "clay render"],
			d
		);
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
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--nope"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--nope");
	});

	test("--port and --profile are gone", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps();
		expect(await runCli(["--subject", dir, "--port", "9931"], d)).toBe(1);
		expect(
			await runCli(["--subject", dir, "--profile", "3d-coder"], d)
		).toBe(1);
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

	test("an invalid --name returns 1 and sends nothing", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--name", "Bad Name"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("not kebab case");
		expect(calls.stream).toHaveLength(0);
	});

	test("an empty --size returns 1 and names the flag", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--size", "   "],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--size");
		expect(calls.stream).toHaveLength(0);
	});
});

describe("a run", () => {
	test("writes one candidate per variant, validates it, and reports each one", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps([{ content: RESPONSE }]);
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--variants", "2"],
			d
		);
		expect(code).toBe(0);
		const files = candidates(join(dir, "generated"));
		expect(files).toEqual(["test-subject--01.ts", "test-subject--02.ts"]);
		expect(readFileSync(join(dir, "generated", files[0]!), "utf8")).toBe(
			ASSET
		);
		expect(calls.preflight).toHaveLength(1);
		expect(calls.stream).toHaveLength(2);
		const output = lines.join("\n");
		expect(output).toContain("test-subject--01.ts");
		expect(output).toContain("test-subject--02.ts");
		expect(output).toContain("tokens");
		expect(output).toContain("tok/s");
		expect(output).toContain("valid");
	});

	test("--name sets the candidate prefix", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--name", "chair"],
			d
		);
		expect(code).toBe(0);
		expect(candidates(join(dir, "generated"))).toEqual(["chair--01.ts"]);
	});

	test("a valid candidate prints the viewer command", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps();
		await runCli(["--subject", dir, "--style", "clay"], d);
		expect(lines.join("\n")).toContain(
			"view  bun run tools/scene-viewer/serve.ts --asset"
		);
		expect(lines.join("\n")).toContain("test-subject--01.ts");
	});

	test("the request carries the model, the system prompt, the data turn, and the guard", async () => {
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
				"42"
			],
			d
		);
		const sent = calls.stream[0]!;
		expect(sent.model).toBe(DEFAULT_MODEL);
		expect(sent.system).toBe("the system prompt");
		const parts = sent.user as Array<{
			type: string;
			text?: string;
		}>;
		expect(parts).toHaveLength(1);
		expect(parts[0]!.type).toBe("text");
		// `--prompt` supplies the subject only when notes.md has no `## Subject` paragraph.
		expect(parts[0]!.text).toContain(
			"* subject: a 1972 Renault 5 TL, orange, three doors"
		);
		expect(parts[0]!.text).not.toContain("Create one");
		expect(sent.maxTokens).toBe(512);
		expect(sent.seed).toBe(42);
	});

	test("--size reaches the user turn as the dimensions bullet", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps();
		await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay",
				"--size",
				"L=3 m, h=1 m, l=1.5 m"
			],
			d
		);
		const parts = calls.stream[0]!.user as Array<{ text?: string }>;
		expect(parts[0]!.text).toContain("* dimensions: L=3 m, h=1 m, l=1.5 m");
	});

	test("--image sends the reference as one labelled image part at the default preset", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls, lines } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--image"],
			d
		);
		expect(code).toBe(0);
		const parts = calls.stream[0]!.user as Array<Record<string, unknown>>;
		expect(parts.map((part) => part.type)).toEqual([
			"text",
			"text",
			"image"
		]);
		expect(parts[1]).toEqual({
			type: "text",
			text: "* image: reference sheet"
		});
		const image = parts[2] as {
			type: string;
			image: { mime: string; data: string };
		};
		expect(image.type).toBe("image");
		expect(image.image.mime).toBe("image/png");
		expect(Buffer.from(image.image.data, "base64").subarray(0, 4)).toEqual(
			Buffer.from([0x89, 0x50, 0x4e, 0x47])
		);
		expect(lines.join("\n")).toContain("images tiny ×1");
	});

	test("an invalid candidate exits 6, prints the reason, and prints no viewer line", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps();
		d.validate = async () => ({
			ok: false,
			reason: "build() returned no Object3D"
		});
		const code = await runCli(["--subject", dir, "--style", "clay"], d);
		expect(code).toBe(6);
		expect(lines.join("\n")).toContain(
			"invalid: build() returned no Object3D"
		);
		expect(lines.join("\n")).not.toContain("view  bun run");
	});

	test("one valid candidate exits 0 even when another is invalid", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps([
			{ content: RESPONSE },
			{ content: RESPONSE }
		]);
		let call = 0;
		d.validate = async () => {
			call += 1;
			return call === 1 ? { ok: false, reason: "bad" } : { ok: true };
		};
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--variants", "2"],
			d
		);
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("invalid: bad");
		expect(lines.join("\n")).toContain("view  bun run");
	});

	test("a validator that throws is reported invalid and does not abort the run", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps([
			{ content: RESPONSE },
			{ content: RESPONSE }
		]);
		let call = 0;
		d.validate = async () => {
			call += 1;
			if (call === 1) throw new Error("traverse exploded");
			return { ok: true };
		};
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--variants", "2"],
			d
		);
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("invalid: traverse exploded");
		expect(lines.join("\n")).toContain("view  bun run");
	});

	test("a failed variant does not stop the next one", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps([
			{ content: "reasoning only, no module" },
			{ content: RESPONSE }
		]);
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--variants", "2"],
			d
		);
		expect(code).toBe(0);
		expect(calls.stream).toHaveLength(2);
		expect(candidates(join(dir, "generated"))).toEqual([
			"test-subject--01.ts"
		]);
		expect(lines.join("\n")).toContain("failed");
	});

	test("a request failure returns 3 when no variant is written", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps([new Error("request failed")]);
		d.stream = async () => {
			throw new Error("request failed");
		};
		const code = await runCli(
			["--subject", dir, "--style", "clay render"],
			d
		);
		expect(code).toBe(3);
	});

	test("an incomplete module on every variant returns 4", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d } = deps([{ content: "no module here" }]);
		const code = await runCli(
			["--subject", dir, "--style", "clay render"],
			d
		);
		expect(code).toBe(4);
	});

	test("existing candidates are never overwritten", async () => {
		const dir = subjectDir({ notes: NOTES });
		mkdirSync(join(dir, "generated"));
		const existing = join(dir, "generated", "test-subject--01.ts");
		writeFileSync(existing, "the first run");
		const { d } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay render"],
			d
		);
		expect(code).toBe(0);
		expect(readFileSync(existing, "utf8")).toBe("the first run");
		expect(candidates(join(dir, "generated"))).toEqual([
			"test-subject--01.ts",
			"test-subject--02.ts"
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
		const code = await runCli(
			["--subject", dir, "--style", "clay render"],
			d
		);
		expect(code).toBe(5);
		expect(calls.stream).toHaveLength(1);
		expect(lines.join("\n")).toContain("could not be written");
	});

	test("a write failure does not stop the next variant", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, calls } = deps([
			{ content: RESPONSE },
			{ content: RESPONSE }
		]);
		let attempts = 0;
		d.write = () => {
			attempts += 1;
			if (attempts === 1) throw new Error("disk full");
			return `${dir}/generated/test-subject--01.ts`;
		};
		const code = await runCli(
			["--subject", dir, "--style", "clay render", "--variants", "2"],
			d
		);
		expect(code).toBe(0);
		expect(calls.stream).toHaveLength(2);
	});
});

describe("text mode, a prompt file instead of a subject", () => {
	// The trailing newline is part of the file, so it is part of the turn (A3, byte for byte).
	const PROMPT = [
		"Here is the 3D model to recreate with Three.js primitives:",
		"* subject: a Christmas tree in its pot.",
		"* style: voxel art.",
		""
	].join("\n");

	function promptFile(text: string | null = PROMPT): string {
		const dir = mkdtempSync(join(SCRATCH_ROOT, "qwen3d-prompt-"));
		roots.push(dir);
		const path = join(dir, "subject.txt");
		if (text !== null) writeFileSync(path, text);
		return path;
	}

	function outDir(): string {
		const dir = mkdtempSync(join(SCRATCH_ROOT, "qwen3d-out-"));
		roots.push(dir);
		return dir;
	}

	test("sends the file text as the user turn, with no image and no style", async () => {
		const path = promptFile();
		const out = join(outDir(), "generated");
		const { d, lines, calls } = deps();
		const code = await runCli(["--prompt-file", path, "--out", out], d);

		expect(code).toBe(0);
		expect(candidates(out)).toEqual(["subject--01.ts"]);
		expect(readFileSync(join(out, "subject--01.ts"), "utf8")).toBe(ASSET);
		const sent = calls.stream[0]!;
		expect(sent.user).toBe(PROMPT);
		expect(lines.join("\n")).toContain("prompt: .tmp/");
		expect(lines.join("\n")).toContain("subject.txt");
	});

	test("a second run writes --02 and leaves --01 byte-identical", async () => {
		const path = promptFile();
		const out = join(outDir(), "generated");
		const first = deps();
		await runCli(["--prompt-file", path, "--out", out], first.d);
		const before = readFileSync(join(out, "subject--01.ts"), "utf8");

		const second = deps([
			{ content: `\`\`\`ts\n${ASSET}\n// second\n\`\`\`` }
		]);
		await runCli(["--prompt-file", path, "--out", out], second.d);

		expect(candidates(out)).toEqual(["subject--01.ts", "subject--02.ts"]);
		expect(readFileSync(join(out, "subject--01.ts"), "utf8")).toBe(before);
	});

	test("--prompt-file without --out returns 1 and sends nothing", async () => {
		const path = promptFile();
		const { d, errors, calls } = deps();
		const code = await runCli(["--prompt-file", path], d);

		expect(code).toBe(1);
		expect(errors.join("\n")).toContain(
			"--out is required with --prompt-file"
		);
		expect(calls.preflight).toHaveLength(0);
		expect(calls.stream).toHaveLength(0);
	});

	test("a missing prompt file returns 1 and sends nothing", async () => {
		const path = join(promptFile(), "absent.txt");
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--prompt-file", path, "--out", outDir()],
			d
		);

		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("does not exist");
		expect(calls.stream).toHaveLength(0);
	});

	test("an empty prompt file returns 1 and sends nothing", async () => {
		const path = promptFile("   \n\n ");
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--prompt-file", path, "--out", outDir()],
			d
		);

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
			d
		);

		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("exclusive");
		expect(calls.stream).toHaveLength(0);
	});

	test("--ask on a complete prompt file lists no gap and sends nothing", async () => {
		const path = promptFile();
		const { d, lines, calls } = deps();
		const code = await runCli(
			["--prompt-file", path, "--out", outDir(), "--ask"],
			d
		);

		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("No gap found");
		expect(calls.stream).toHaveLength(0);
		expect(calls.preflight).toHaveLength(1);
	});
});

describe("the image flags", () => {
	test("--image and --views are exclusive", async () => {
		const dir = subjectDir({ notes: NOTES, views: ["top"] });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--image", "--views", "top"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("--image");
		expect(errors.join("\n")).toContain("--views");
		expect(calls.preflight).toHaveLength(0);
	});

	test("a prompt file with --views says text mode sends no image", async () => {
		const { d, errors, calls } = deps();
		const code = await runCli(
			[
				"--prompt-file",
				join(subjectDir({ notes: NOTES }), "notes.md"),
				"--out",
				join(subjectDir({ notes: NOTES }), "generated"),
				"--views",
				"top"
			],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain(
			"a prompt file has no blueprint beside it"
		);
		expect(calls.stream).toHaveLength(0);
	});

	test("a prompt file with --image says text mode sends no image", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			[
				"--prompt-file",
				join(dir, "notes.md"),
				"--out",
				join(dir, "generated"),
				"--image"
			],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain(
			"a prompt file has no blueprint beside it"
		);
		expect(calls.stream).toHaveLength(0);
	});

	test("a name outside the six exits 1 and lists the six", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--views", "top,sides"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain(
			"front, left, right, back, top, bottom"
		);
		expect(calls.preflight).toHaveLength(0);
	});

	test("an empty list and an empty name exit 1", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors } = deps();
		expect(
			await runCli(
				["--subject", dir, "--style", "clay", "--views", "  "],
				d
			)
		).toBe(1);
		expect(errors.join("\n")).toContain("empty");
		const second = deps();
		expect(
			await runCli(
				["--subject", dir, "--style", "clay", "--views", "top,,back"],
				second.d
			)
		).toBe(1);
		expect(second.errors.join("\n")).toContain("empty");
	});

	test("a repeated name exits 1", async () => {
		const dir = subjectDir({ notes: NOTES, views: ["top"] });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--views", "top,top"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("repeated");
		expect(calls.stream).toHaveLength(0);
	});

	test("a missing view file exits 1 and quotes the path", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--views", "top"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain(join(dir, "top", "reference.png"));
		expect(calls.stream).toHaveLength(0);
	});

	test("a missing reference with --image exits 1 and sends nothing", async () => {
		const dir = subjectDir({ reference: false, notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--image"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("reference.<ext> is missing");
		expect(calls.preflight).toHaveLength(0);
		expect(calls.stream).toHaveLength(0);
	});

	test("a reference that does not decode exits 1 with the code", async () => {
		const dir = subjectDir({ reference: false, notes: NOTES });
		writeFileSync(join(dir, "reference.png"), "not an image");
		const { d, errors } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--image"],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toMatch(/ERR_/);
	});

	test("an unknown preset exits 1 and lists the three", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, errors, calls } = deps();
		const code = await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay",
				"--image",
				"--image-preset",
				"huge"
			],
			d
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("tiny, small, full");
		expect(calls.preflight).toHaveLength(0);
	});

	test("--views top sends one image as three parts", async () => {
		const dir = subjectDir({ notes: NOTES, views: ["top"] });
		const { d, calls, lines } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--views", "top"],
			d
		);
		expect(code).toBe(0);
		const parts = calls.stream[0]!.user as Array<{
			type: string;
			text?: string;
		}>;
		expect(parts.map((part) => part.type)).toEqual([
			"text",
			"text",
			"image"
		]);
		expect(parts[1]!.text).toBe("* image: top view");
		expect(lines.join("\n")).toContain("images tiny ×1");
	});

	test("three views send three labels in order", async () => {
		const dir = subjectDir({
			notes: NOTES,
			views: ["top", "right", "back"]
		});
		const { d, calls } = deps();
		await runCli(
			["--subject", dir, "--style", "clay", "--views", "top,right,back"],
			d
		);
		const parts = calls.stream[0]!.user as Array<{
			type: string;
			text?: string;
		}>;
		expect(parts).toHaveLength(7);
		expect(
			parts
				.filter((part) => part.text?.startsWith("* image:"))
				.map((part) => part.text)
		).toEqual([
			"* image: top view",
			"* image: right view",
			"* image: back view"
		]);
	});

	test("--image-preset small is the ladder's first climb", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps();
		const code = await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay",
				"--image",
				"--image-preset",
				"small"
			],
			d
		);
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("images small ×1");
	});

	test("--image-preset does nothing on a run without an image", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--image-preset", "full"],
			d
		);
		expect(code).toBe(0);
		expect((calls.stream[0]!.user as unknown[]).length).toBe(1);
		expect(lines.join("\n")).toContain("images —");
	});
});

describe("the dimensions of the blueprint", () => {
	const DIMENSIONS = JSON.stringify({
		unit: "m",
		real: {
			length: { value: 3.521 },
			height: { value: 1.4 },
			width: { value: 1.525 }
		}
	});

	test("dimensions.json fills the * dimensions: bullet", async () => {
		const dir = subjectDir({ notes: NOTES, dimensions: DIMENSIONS });
		const { d, calls } = deps();
		await runCli(["--subject", dir, "--style", "clay"], d);
		const [part] = calls.stream[0]!.user as Array<{ text: string }>;
		expect(part.text).toContain(
			"* dimensions: L=3.521 m, h=1.4 m, l=1.525 m"
		);
	});

	test("--size wins over dimensions.json", async () => {
		const dir = subjectDir({ notes: NOTES, dimensions: DIMENSIONS });
		const { d, calls } = deps();
		await runCli(
			[
				"--subject",
				dir,
				"--style",
				"clay",
				"--size",
				"L=9 m, h=9 m, l=9 m"
			],
			d
		);
		const [part] = calls.stream[0]!.user as Array<{ text: string }>;
		expect(part.text).toContain("* dimensions: L=9 m, h=9 m, l=9 m");
		expect(part.text).not.toContain("3.521");
	});

	test("a malformed file leaves the bullet absent and the run does not fail", async () => {
		const dir = subjectDir({ notes: NOTES, dimensions: "{not json" });
		const { d, calls } = deps();
		const code = await runCli(["--subject", dir, "--style", "clay"], d);
		expect(code).toBe(0);
		const [part] = calls.stream[0]!.user as Array<{ text: string }>;
		expect(part.text).not.toContain("* dimensions:");
	});
});

describe("the report line", () => {
	test("prints the two token counts, the preset, the count, and the state", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps([
			{ content: RESPONSE, promptTokens: 3847, cachedTokens: 31 }
		]);
		await runCli(["--subject", dir, "--style", "clay", "--image"], d);
		expect(lines.join("\n")).toContain(
			"prompt 3847 tok  cache 31 tok  images tiny ×1  valid"
		);
	});

	test("prints — for absent timings", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps();
		await runCli(["--subject", dir, "--style", "clay"], d);
		expect(lines.join("\n")).toContain("prompt —  cache —  images —");
	});
});

describe("--ask, the images, the dimensions, and the capability", () => {
	const DIMENSIONS = JSON.stringify({
		unit: "m",
		real: {
			length: { value: 3.521 },
			height: { value: 1.4 },
			width: { value: 1.525 }
		}
	});

	test("prints the preset, the image list, the dimensions, and the capability", async () => {
		const dir = subjectDir({ notes: NOTES, dimensions: DIMENSIONS });
		const { d, lines, calls } = deps();
		const code = await runCli(
			["--subject", dir, "--style", "clay", "--image", "--ask"],
			d
		);
		expect(code).toBe(0);
		const output = lines.join("\n");
		expect(output).toContain("images:     tiny ×1");
		expect(output).toContain("image 1:    reference sheet");
		expect(output).toContain("1×1");
		expect(output).toContain("dimensions: L=3.521 m, h=1.4 m, l=1.525 m");
		expect(output).toContain("multimodal: null");
		expect(calls.stream).toHaveLength(0);
	});

	test("a run without an image prints images: none and dimensions: none", async () => {
		const dir = subjectDir({ notes: NOTES });
		const { d, lines } = deps();
		await runCli(["--subject", dir, "--style", "clay", "--ask"], d);
		expect(lines.join("\n")).toContain("images:     none");
		expect(lines.join("\n")).toContain("dimensions: none");
	});
});
