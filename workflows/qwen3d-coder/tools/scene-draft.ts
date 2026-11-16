// The scene drafter: one subject reference image and a short note, one candidate HTML file.
//
// `--ask` sends nothing and lists the gaps. A run starts the local server through
// `scripts/llama-server/serve.ts`, sends one streamed request per variant, extracts the document,
// and writes it beside the subject. This script never chooses a candidate and never edits the
// model's JavaScript.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import {
	selectProfile,
	UnknownProfileError,
	type Profile,
} from "../../../scripts/llama-server/profiles";
import {
	AliasConflictError,
	ensureServer,
	ServerCrashedError,
	ServerTimeoutError,
	type EnsureServerOptions,
	type ServerHandle,
} from "../../../scripts/llama-server/serve";
import { writeCandidate } from "./lib/candidates";
import {
	DEFAULT_MAX_TOKENS,
	streamChat,
	type ChatImage,
	type ChatResult,
	type StreamChatOptions,
} from "./lib/client";
import { extractHtml, NoHtmlError } from "./lib/extract";
import { buildUserPrompt, parseNotes, SYSTEM_PROMPT_PATH } from "./lib/prompt";

// The repository root. This file lives in <root>/workflows/qwen3d-coder/tools/.
const PROJECT_ROOT = resolve(import.meta.dir, "..", "..", "..");

const DEFAULT_PROFILE = "3d-coder";
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
	ensure?: (options: EnsureServerOptions) => Promise<ServerHandle>;
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
	port: number | null;
	maxTokens: number;
	timeout: number;
	seed: number | null;
	ask: boolean;
	profile: string;
};

type Parsed = { options: Options } | { error: string };

function parseOptions(argv: string[]): Parsed {
	const options: Options = {
		subject: null,
		style: null,
		variants: 1,
		image: false,
		prompt: null,
		port: null,
		maxTokens: DEFAULT_MAX_TOKENS,
		timeout: DEFAULT_TIMEOUT_S,
		seed: null,
		ask: false,
		profile: DEFAULT_PROFILE,
	};

	const withValue = new Set([
		"--subject",
		"--style",
		"--variants",
		"--prompt",
		"--port",
		"--max-tokens",
		"--timeout",
		"--seed",
		"--profile",
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
			case "--variants": {
				const parsed = Number(value);
				if (!Number.isInteger(parsed) || parsed < 1)
					return { error: `--variants is a positive integer, got "${value}".` };
				options.variants = parsed;
				break;
			}
			case "--port": {
				const parsed = Number(value);
				if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
					return { error: `--port is a TCP port, got "${value}".` };
				}
				options.port = parsed;
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
			case "--profile":
				options.profile = value;
				break;
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
 * Exit codes: 0 a candidate was written, 1 invalid input, 2 the server did not become ready,
 * 3 a request failed, 4 the response held no complete document, 5 the candidate could not be
 * written.
 */
export async function runCli(argv: string[], deps: SceneDraftDeps = {}): Promise<number> {
	const out = deps.out ?? console.log;
	const err = deps.err ?? console.error;
	const ensure = deps.ensure ?? ensureServer;
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

	if (options.ask) {
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
	if (!subjectText || !request) {
		err('The subject is empty. Add a "## Subject" paragraph to notes.md, or pass --prompt.');
		return 1;
	}

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

	let profile: Profile;
	try {
		const base = selectProfile(options.profile);
		profile = options.port === null ? base : { ...base, port: options.port };
	} catch (error) {
		if (error instanceof UnknownProfileError) {
			err(error.message);
			return 1;
		}
		throw error;
	}

	let handle: ServerHandle;
	try {
		handle = await ensure({ profile, out });
	} catch (error) {
		if (
			error instanceof AliasConflictError ||
			error instanceof ServerTimeoutError ||
			error instanceof ServerCrashedError
		) {
			err(`server not ready: ${error.message}`);
			return error.exitCode;
		}
		err(`server not ready: ${(error as Error).message}`);
		return 2;
	}

	const generatedDir = join(subjectDir, "generated");
	let written = 0;
	let firstFailure: number | null = null;

	try {
		for (let variant = 1; variant <= options.variants; variant += 1) {
			const started = performance.now();
			let html: string;
			let result: ChatResult;
			try {
				result = await send({
					port: profile.port,
					alias: profile.alias,
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
	} finally {
		await handle.stop();
	}

	if (written > 0) {
		out(
			`${written} candidate(s) written to ${displayPath(generatedDir)}. The art director chooses.`,
		);
		return 0;
	}
	return firstFailure ?? 0;
}

if (import.meta.main) {
	process.exit(await runCli(process.argv.slice(2)));
}
