// The scene drafter: one subject reference image and a short note, one candidate HTML file.
//
// `--ask` sends no completion and lists the gaps. A run checks the endpoint through
// `lib/endpoint.ts`, sends one streamed request per variant, extracts the document, and writes it
// beside the subject. This script never chooses a candidate, never edits the model's JavaScript,
// and never starts a server: the endpoint is an input, named by `--base-url` and `--model`.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { writeCandidate } from "./lib/candidates";
import {
	DEFAULT_MAX_TOKENS,
	streamChat,
	type ChatImage,
	type ChatResult,
	type StreamChatOptions,
} from "./lib/client";
import { checkEndpoint, type PreflightOptions, type PreflightResult } from "./lib/endpoint";
import { extractHtml, NoHtmlError } from "./lib/extract";
import { buildUserPrompt, parseNotes, SYSTEM_PROMPT_PATH } from "./lib/prompt";

// The repository root. This file lives in <root>/workflows/qwen3d-coder/tools/.
const PROJECT_ROOT = resolve(import.meta.dir, "..", "..", "..");

/** The documented default port of an OpenAI-compatible endpoint, as a convenience. */
export const DEFAULT_BASE_URL = "http://127.0.0.1:9931/v1";
/** The `id` that the reference endpoint publishes for the 3D Coder weights. */
export const DEFAULT_MODEL = "qwen3.5-4b-3d-coder";

const DEFAULT_TIMEOUT_S = 1800;

const MEDIA_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
};

const REFERENCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export type SceneDraftDeps = {
	out?: (line: string) => void;
	err?: (line: string) => void;
	/** The `/models` preflight. Absent means the real fetch. */
	preflight?: (options: PreflightOptions) => Promise<PreflightResult>;
	stream?: (options: StreamChatOptions) => Promise<ChatResult>;
	/** The candidate writer. Absent means write beside the subject with `O_EXCL`. */
	write?: (dir: string, html: string) => string;
	/** The system prompt text. Absent means read the workflow file. */
	systemPrompt?: string;
};

type Options = {
	subject: string | null;
	style: string | null;
	variants: number;
	image: boolean;
	prompt: string | null;
	baseUrl: string;
	model: string;
	maxTokens: number;
	timeout: number;
	seed: number | null;
	ask: boolean;
};

type Parsed = { options: Options } | { error: string };

/** The endpoint check as the caller reads it: a resolved id, or the exit code to return. */
type EndpointResolution = { ok: true; id: string } | { ok: false; code: 2 };

/** The base URL must parse and must hold no trailing slash. */
function validateBaseUrl(value: string): string | null {
	if (value.endsWith("/")) return `--base-url must not end with "/", got "${value}".`;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return `--base-url is not a valid URL, got "${value}".`;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return `--base-url is an http or https URL, got "${value}".`;
	}
	return null;
}

function parseOptions(argv: string[]): Parsed {
	const options: Options = {
		subject: null,
		style: null,
		variants: 1,
		image: false,
		prompt: null,
		baseUrl: DEFAULT_BASE_URL,
		model: DEFAULT_MODEL,
		maxTokens: DEFAULT_MAX_TOKENS,
		timeout: DEFAULT_TIMEOUT_S,
		seed: null,
		ask: false,
	};

	const withValue = new Set([
		"--subject",
		"--style",
		"--variants",
		"--prompt",
		"--base-url",
		"--model",
		"--max-tokens",
		"--timeout",
		"--seed",
	]);
	const booleans = new Set(["--image", "--ask"]);

	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index]!;
		if (booleans.has(flag)) {
			if (flag === "--image") options.image = true;
			if (flag === "--ask") options.ask = true;
			continue;
		}
		if (!withValue.has(flag)) return { error: `Unknown flag "${flag}".` };

		const value = argv[index + 1];
		if (value === undefined) return { error: `${flag} needs a value.` };
		index += 1;

		switch (flag) {
			case "--subject":
				options.subject = value;
				break;
			case "--style":
				options.style = value;
				break;
			case "--prompt":
				options.prompt = value;
				break;
			case "--model":
				if (!value.trim()) return { error: `--model is empty.` };
				options.model = value;
				break;
			case "--base-url": {
				const error = validateBaseUrl(value);
				if (error) return { error };
				options.baseUrl = value;
				break;
			}
			case "--variants": {
				const parsed = Number(value);
				if (!Number.isInteger(parsed) || parsed < 1)
					return { error: `--variants is a positive integer, got "${value}".` };
				options.variants = parsed;
				break;
			}
			case "--max-tokens": {
				const parsed = Number(value);
				if (!Number.isInteger(parsed) || parsed < -1) {
					return { error: `--max-tokens is an integer of -1 or more, got "${value}".` };
				}
				options.maxTokens = parsed;
				break;
			}
			case "--timeout": {
				const parsed = Number(value);
				if (!Number.isFinite(parsed) || parsed <= 0)
					return { error: `--timeout is a positive number of seconds, got "${value}".` };
				options.timeout = parsed;
				break;
			}
			case "--seed": {
				const parsed = Number(value);
				if (!Number.isInteger(parsed))
					return { error: `--seed is an integer, got "${value}".` };
				options.seed = parsed;
				break;
			}
		}
	}

	return { options };
}

/** The chosen identity image of the subject folder. Generation reads no other image. */
function findReference(dir: string): string | null {
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return null;
	}
	for (const ext of REFERENCE_EXTENSIONS) {
		const name = `reference${ext}`;
		if (names.includes(name)) return join(dir, name);
	}
	return null;
}

function readNotes(dir: string): string {
	const path = join(dir, "notes.md");
	return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function displayPath(path: string): string {
	return path.startsWith(PROJECT_ROOT) ? relative(PROJECT_ROOT, path) : path;
}

/**
 * The command-line entry point.
 *
 * Exit codes: 0 a candidate was written, 1 invalid input, 2 the endpoint is unreachable or does not
 * name the model, 3 a request failed, 4 the response held no complete document, 5 the candidate
 * could not be written.
 */
export async function runCli(argv: string[], deps: SceneDraftDeps = {}): Promise<number> {
	const out = deps.out ?? console.log;
	const err = deps.err ?? console.error;
	const preflight = deps.preflight ?? checkEndpoint;
	const send = deps.stream ?? streamChat;
	const write = deps.write ?? writeCandidate;

	const parsed = parseOptions(argv);
	if ("error" in parsed) {
		err(parsed.error);
		return 1;
	}
	const options = parsed.options;

	if (!options.subject) {
		err("--subject is required: pass the subject folder.");
		return 1;
	}
	const subjectDir = resolve(options.subject);
	if (!existsSync(subjectDir)) {
		err(`The subject folder does not exist: ${subjectDir}`);
		return 1;
	}

	const notes = parseNotes(readNotes(subjectDir));
	const reference = findReference(subjectDir);
	const subjectText = notes.subject ?? options.prompt;
	const request = options.prompt ?? subjectText;

	/** The endpoint check. It runs once per run, before the first variant (`--ask` included). */
	const resolveModel = async (): Promise<EndpointResolution> => {
		let result: PreflightResult;
		try {
			result = await preflight({
				baseUrl: options.baseUrl,
				model: options.model,
				timeoutMs: Math.min(options.timeout * 1000, 10_000),
			});
		} catch (error) {
			err(`endpoint not ready: ${(error as Error).message}`);
			return { ok: false, code: 2 };
		}
		if (!result.ok) {
			err(result.message);
			return { ok: false, code: 2 };
		}
		out(`endpoint: ${options.baseUrl}  model: ${result.id}`);
		return { ok: true, id: result.id };
	};

	if (options.ask) {
		const endpoint = await resolveModel();
		if (!endpoint.ok) return endpoint.code;

		const gaps: string[] = [];
		if (!reference) gaps.push(`reference.<ext>: missing in ${displayPath(subjectDir)}`);
		if (!subjectText)
			gaps.push(
				'subject note: missing. Add a "## Subject" paragraph to notes.md, or pass --prompt.',
			);
		if (!options.style) gaps.push('style: missing. Pass --style "<style>".');

		if (gaps.length === 0) {
			out("ask:        No gap found. The material is complete enough to draft.");
			out("No request was sent and nothing was spent.");
			return 0;
		}
		out(`ask:        ${gaps.length} gap(s) in the subject material`);
		gaps.forEach((gap, index) => out(`  ${index + 1}. ${gap}`));
		out("No request was sent and nothing was spent.");
		return 0;
	}

	if (!options.style) {
		err("--style is required: pass the style in the art director's words.");
		return 1;
	}
	if (!reference) {
		err(
			`reference.<ext> is missing in ${displayPath(subjectDir)}. Generation reads no other image.`,
		);
		return 1;
	}
	if (!subjectText) {
		err(
			'An empty subject or an empty request is never sent. Add a "## Subject" paragraph to notes.md, or pass --prompt.',
		);
		return 1;
	}

	const endpoint = await resolveModel();
	if (!endpoint.ok) return endpoint.code;

	const systemPrompt = deps.systemPrompt ?? readFileSync(SYSTEM_PROMPT_PATH, "utf8");
	const mediaType = MEDIA_TYPES[extname(reference).toLowerCase()] ?? "application/octet-stream";
	const image: ChatImage | null = options.image
		? { mime: mediaType, data: readFileSync(reference).toString("base64") }
		: null;

	const userPrompt = buildUserPrompt({
		subject: subjectText,
		style: options.style,
		details: notes.details,
		request,
	});

	const generatedDir = join(subjectDir, "generated");
	let written = 0;
	let firstFailure: number | null = null;

	for (let variant = 1; variant <= options.variants; variant += 1) {
		const started = performance.now();
		let html: string;
		let result: ChatResult;
		try {
			result = await send({
				baseUrl: options.baseUrl,
				model: endpoint.id,
				system: systemPrompt,
				user: userPrompt,
				image,
				maxTokens: options.maxTokens,
				seed: options.seed,
				timeoutMs: options.timeout * 1000,
			});
			html = extractHtml(result.content);
		} catch (error) {
			// A failed request is not a failed write. The next variant still runs.
			const code = error instanceof NoHtmlError ? 4 : 3;
			firstFailure ??= code;
			out(`variant ${variant}  failed: ${(error as Error).message}`);
			continue;
		}

		let path: string;
		try {
			path = write(generatedDir, html);
		} catch (error) {
			// The model answered, but the candidate could not be stored.
			firstFailure ??= 5;
			out(
				`variant ${variant}  the candidate could not be written: ${(error as Error).message}`,
			);
			continue;
		}

		written += 1;
		const seconds = (performance.now() - started) / 1000;
		out(
			`variant ${variant}  ${displayPath(path)}  ${seconds.toFixed(1)} s  ${result.tokens} tokens  ${result.tokensPerSecond.toFixed(1)} tok/s`,
		);
	}

	if (written > 0) {
		out(
			`${written} candidate(s) written to ${displayPath(generatedDir)}. The art director chooses.`,
		);
		return 0;
	}
	// Unreachable with --variants >= 1 (parseOptions rejects less), kept as the total-failure fallback.
	return firstFailure ?? 0;
}

if (import.meta.main) {
	process.exit(await runCli(process.argv.slice(2)));
}
