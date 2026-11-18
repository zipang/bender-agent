// The asset drafter: one subject reference image and a short note, one candidate TypeScript module.
//
// `--ask` sends no completion and lists the gaps. A run checks the endpoint through
// `lib/endpoint.ts`, sends one streamed request per variant, extracts the module, writes it beside
// the subject, and validates what it wrote. This script never chooses a candidate, never edits the
// model's TypeScript, and never starts a server: the endpoint is an input, named by `--base-url`
// and `--model`.

import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { NAME_PATTERN, writeCandidate } from "./lib/candidates";
import {
	DEFAULT_MAX_TOKENS,
	streamChat,
	type ChatResult,
	type StreamChatOptions
} from "./lib/client";
import { dimensionsLine } from "./lib/dimensions";
import {
	checkEndpoint,
	type PreflightOptions,
	type PreflightResult
} from "./lib/endpoint";
import { extractTs, NoModuleError } from "./lib/extract";
import {
	DEFAULT_IMAGE_PRESET,
	findReference,
	IMAGE_PRESETS,
	type ImagePreset,
	type ResolvedImage,
	resolveImages
} from "./lib/images";
import {
	buildUserTurn,
	imageLabel,
	parseNotes,
	SYSTEM_PROMPT_PATH,
	type SubjectNotes
} from "./lib/prompt";
import { validateAsset, type Validation } from "./lib/validate";

// The repository root. This file lives in <root>/workflows/qwen3d-coder/tools/.
const PROJECT_ROOT = resolve(import.meta.dir, "..", "..", "..");

/**
 * The documented default port of an OpenAI-compatible endpoint, as a
 * convenience.
 */
export const DEFAULT_BASE_URL = "http://127.0.0.1:9931/v1";
/** The `id` that the reference endpoint publishes for the 3D Coder weights. */
export const DEFAULT_MODEL = "qwen3.5-4b-3d-coder";

const DEFAULT_TIMEOUT_S = 1800;

export type AssetDraftDeps = {
	out?: (line: string) => void;
	err?: (line: string) => void;
	/** The `/models` preflight. Absent means the real fetch. */
	preflight?: (options: PreflightOptions) => Promise<PreflightResult>;
	stream?: (options: StreamChatOptions) => Promise<ChatResult>;
	/**
	 * The candidate writer. Absent means write beside the subject with
	 * `O_EXCL`.
	 */
	write?: (dir: string, name: string, source: string) => string;
	/** The candidate validator. Absent means import and check the written file. */
	validate?: (path: string) => Promise<Validation>;
	/** The system prompt text. Absent means read the workflow file. */
	systemPrompt?: string;
};

type Options = {
	subject: string | null;
	/** A file that holds the whole user turn. It replaces the subject folder. */
	promptFile: string | null;
	/**
	 * The candidate folder of a text prompt. It replaces
	 * `<subject>/generated/`.
	 */
	out: string | null;
	style: string | null;
	/** The real dimensions, in the art director's notation. */
	size: string | null;
	/**
	 * The resolved asset name. Absent means the subject folder name, or the
	 * prompt file base name.
	 */
	name: string | null;
	variants: number;
	image: boolean;
	/** The comma-separated view names, or null. */
	views: string | null;
	/** The size and the encoding of every image sent. */
	imagePreset: ImagePreset;
	prompt: string | null;
	baseUrl: string;
	model: string;
	maxTokens: number;
	timeout: number;
	seed: number | null;
	ask: boolean;
};

type Parsed = { options: Options } | { error: string };

/**
 * The endpoint check as the caller reads it: a resolved id, or the exit code to
 * return.
 */
type EndpointResolution = { ok: true; id: string } | { ok: false; code: 2 };

/** The base URL must parse and must hold no trailing slash. */
function validateBaseUrl(value: string): string | null {
	if (value.endsWith("/"))
		return `--base-url must not end with "/", got "${value}".`;
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

/** The resolved asset name, or the reason it is invalid. */
type NameResolution = { ok: true; name: string } | { ok: false; error: string };

function parseOptions(argv: string[]): Parsed {
	const options: Options = {
		subject: null,
		promptFile: null,
		out: null,
		style: null,
		size: null,
		name: null,
		variants: 1,
		image: false,
		views: null,
		imagePreset: DEFAULT_IMAGE_PRESET,
		prompt: null,
		baseUrl: DEFAULT_BASE_URL,
		model: DEFAULT_MODEL,
		maxTokens: DEFAULT_MAX_TOKENS,
		timeout: DEFAULT_TIMEOUT_S,
		seed: null,
		ask: false
	};

	const withValue = new Set([
		"--subject",
		"--prompt-file",
		"--out",
		"--style",
		"--size",
		"--name",
		"--variants",
		"--views",
		"--image-preset",
		"--prompt",
		"--base-url",
		"--model",
		"--max-tokens",
		"--timeout",
		"--seed"
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
			case "--prompt-file":
				if (!value.trim()) return { error: `--prompt-file is empty.` };
				options.promptFile = value;
				break;
			case "--out":
				if (!value.trim()) return { error: `--out is empty.` };
				options.out = value;
				break;
			case "--style":
				options.style = value;
				break;
			case "--size":
				if (!value.trim()) return { error: `--size is empty.` };
				options.size = value;
				break;
			case "--name":
				if (!value.trim()) return { error: `--name is empty.` };
				options.name = value;
				break;
			case "--prompt":
				options.prompt = value;
				break;
			case "--views":
				if (!value.trim()) return { error: `--views is empty.` };
				options.views = value;
				break;
			case "--image-preset": {
				const names = Object.keys(IMAGE_PRESETS);
				if (!names.includes(value)) {
					return {
						error: `Unknown image preset "${value}". The three presets are ${names.join(", ")}.`
					};
				}
				options.imagePreset = value as ImagePreset;
				break;
			}
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
					return {
						error: `--variants is a positive integer, got "${value}".`
					};
				options.variants = parsed;
				break;
			}
			case "--max-tokens": {
				const parsed = Number(value);
				if (!Number.isInteger(parsed) || parsed < -1) {
					return {
						error: `--max-tokens is an integer of -1 or more, got "${value}".`
					};
				}
				options.maxTokens = parsed;
				break;
			}
			case "--timeout": {
				const parsed = Number(value);
				if (!Number.isFinite(parsed) || parsed <= 0)
					return {
						error: `--timeout is a positive number of seconds, got "${value}".`
					};
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

function readNotes(dir: string): string {
	const path = join(dir, "notes.md");
	return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/**
 * The `* dimensions:` line of a subject, or null.
 *
 * A missing file, invalid JSON, or one bad value is a null line, never an
 * error: a blueprint without dimensions is a normal blueprint.
 */
function readDimensionsLine(dir: string): string | null {
	const path = join(dir, "dimensions.json");
	if (!existsSync(path)) return null;
	try {
		return dimensionsLine(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return null;
	}
}

function displayPath(path: string): string {
	return path.startsWith(PROJECT_ROOT) ? relative(PROJECT_ROOT, path) : path;
}

/**
 * The resolved asset name.
 *
 * `--name` wins. Without it, the subject folder name is used in subject mode,
 * and the prompt file base name without `.txt` is used in text mode. The name
 * must be kebab case.
 */
function resolveName(
	options: Options,
	textMode: boolean,
	subjectDir: string | null,
	promptPath: string | null
): NameResolution {
	const name =
		options.name ??
		(textMode
			? basename(promptPath as string, extname(promptPath as string))
			: basename(subjectDir as string));
	if (!NAME_PATTERN.test(name)) {
		return {
			ok: false,
			error: `The asset name "${name}" is not kebab case. Pass --name "<slug>".`
		};
	}
	return { ok: true, name };
}

/**
 * The command-line entry point.
 *
 * Exit codes: 0 at least one candidate was written and is valid, or `--ask`
 * completed; 1 invalid input (a flag, the subject, the style, the size, the
 * name, the reference, the images, the views, or the preset); 2 the endpoint is
 * unreachable or does not name the model; 3 a request failed; 4 the response
 * held no complete module; 5 the candidate could not be written; 6 candidates
 * were written and none is a valid asset.
 */
export async function runCli(
	argv: string[],
	deps: AssetDraftDeps = {}
): Promise<number> {
	const out = deps.out ?? console.log;
	const err = deps.err ?? console.error;
	const preflight = deps.preflight ?? checkEndpoint;
	const send = deps.stream ?? streamChat;
	const write = deps.write ?? writeCandidate;
	const validate = deps.validate ?? validateAsset;

	const parsed = parseOptions(argv);
	if ("error" in parsed) {
		err(parsed.error);
		return 1;
	}
	const options = parsed.options;

	// Text mode: a prompt file replaces the subject folder and its reference image.
	const textMode = options.promptFile !== null;

	let subjectDir: string | null = null;
	let promptPath: string | null = null;
	let notes: SubjectNotes = { subject: null, details: null };
	let reference: string | null = null;
	let subjectText: string | null = null;
	let promptText: string | null = null;

	if (textMode) {
		if (options.subject) {
			err(
				"--prompt-file and --subject are exclusive: pass one of the two."
			);
			return 1;
		}
		if (options.image) {
			err(
				"--image needs --subject: a prompt file has no blueprint beside it."
			);
			return 1;
		}
		promptPath = resolve(options.promptFile as string);
		if (!existsSync(promptPath)) {
			err(`The prompt file does not exist: ${displayPath(promptPath)}`);
			return 1;
		}
		// The file is the whole turn, byte for byte (A3). Only the emptiness check trims.
		const raw = readFileSync(promptPath, "utf8");
		if (!raw.trim()) {
			err(`The prompt file is empty: ${displayPath(promptPath)}`);
			return 1;
		}
		promptText = raw;
	} else {
		if (!options.subject) {
			err(
				"--subject is required: pass the subject folder, or --prompt-file for a text prompt."
			);
			return 1;
		}
		subjectDir = resolve(options.subject);
		if (!existsSync(subjectDir)) {
			err(`The subject folder does not exist: ${subjectDir}`);
			return 1;
		}

		notes = parseNotes(readNotes(subjectDir));
		reference = findReference(subjectDir);
		// `--prompt` supplies the subject when notes.md has no `## Subject` paragraph.
		subjectText = notes.subject ?? options.prompt;
	}

	// The dimensions are an input: `--size` wins, then the blueprint, then absent.
	const dimensions = subjectDir ? readDimensionsLine(subjectDir) : null;
	const size = textMode ? null : (options.size ?? dimensions);

	const nameResolution = resolveName(
		options,
		textMode,
		subjectDir,
		promptPath
	);
	if (!nameResolution.ok && !options.ask) {
		err(nameResolution.error);
		return 1;
	}

	// The images are read before the request, so a missing or broken file sends nothing.
	let images: ResolvedImage[] = [];
	if (options.image || options.views !== null) {
		try {
			images = await resolveImages({
				subjectDir,
				image: options.image,
				views: options.views,
				preset: options.imagePreset
			});
		} catch (error) {
			err((error as Error).message);
			return 1;
		}
	}

	/**
	 * The endpoint check. It runs once per run, before the first variant
	 * (`--ask` included).
	 */
	const resolveModel = async (): Promise<EndpointResolution> => {
		let result: PreflightResult;
		try {
			result = await preflight({
				baseUrl: options.baseUrl,
				model: options.model,
				timeoutMs: Math.min(options.timeout * 1000, 10_000)
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
		out(`multimodal: ${result.multimodal}`);
		return { ok: true, id: result.id };
	};

	if (options.ask) {
		const endpoint = await resolveModel();
		if (!endpoint.ok) return endpoint.code;

		out(
			`images:     ${images.length > 0 ? `${options.imagePreset} ×${images.length}` : "none"}`
		);
		images.forEach((image, index) =>
			out(
				`image ${index + 1}:    ${imageLabel(image)}  ${displayPath(image.path)}  ${image.width}×${image.height}  ${Math.round(image.bytes / 1024)} KB`
			)
		);
		out(`dimensions: ${size ?? "none"}`);

		const gaps: string[] = [];
		if (!nameResolution.ok) gaps.push(nameResolution.error);
		if (textMode) {
			if (!options.out)
				gaps.push("--out: missing. Pass the candidate folder.");
		} else {
			if (!reference)
				gaps.push(
					`reference.<ext>: missing in ${displayPath(subjectDir as string)}`
				);
			if (!subjectText)
				gaps.push(
					'subject note: missing. Add a "## Subject" paragraph to notes.md, or pass --prompt.'
				);
			if (!options.style)
				gaps.push('style: missing. Pass --style "<style>".');
		}

		if (gaps.length === 0) {
			out(
				"ask:        No gap found. The material is complete enough to draft."
			);
			out("No request was sent and nothing was spent.");
			return 0;
		}
		out(`ask:        ${gaps.length} gap(s) to fill before a draft`);
		gaps.forEach((gap, index) => out(`  ${index + 1}. ${gap}`));
		out("No request was sent and nothing was spent.");
		return 0;
	}

	if (!nameResolution.ok) {
		err(nameResolution.error);
		return 1;
	}
	const name = nameResolution.name;

	if (!textMode) {
		if (!options.style) {
			err(
				"--style is required: pass the style in the art director's words."
			);
			return 1;
		}
		if (!reference) {
			err(
				`reference.<ext> is missing in ${displayPath(subjectDir as string)}. Generation reads no other image.`
			);
			return 1;
		}
		if (!subjectText) {
			err(
				'An empty subject is never sent. Add a "## Subject" paragraph to notes.md, or pass --prompt.'
			);
			return 1;
		}
	} else if (!options.out) {
		err("--out is required with --prompt-file: pass the candidate folder.");
		return 1;
	}

	const endpoint = await resolveModel();
	if (!endpoint.ok) return endpoint.code;

	const systemPrompt =
		deps.systemPrompt ?? readFileSync(SYSTEM_PROMPT_PATH, "utf8");

	const user = textMode
		? (promptText as string)
		: buildUserTurn({
				subject: subjectText as string,
				style: options.style as string,
				details: notes.details,
				size,
				images
			});

	if (textMode) out(`prompt: ${displayPath(promptPath as string)}`);

	const generatedDir = textMode
		? resolve(options.out as string)
		: join(subjectDir as string, "generated");
	let written = 0;
	let firstFailure: number | null = null;
	const valid: string[] = [];

	for (let variant = 1; variant <= options.variants; variant += 1) {
		const started = performance.now();
		let module_: string;
		let result: ChatResult;
		try {
			result = await send({
				baseUrl: options.baseUrl,
				model: endpoint.id,
				system: systemPrompt,
				user,
				maxTokens: options.maxTokens,
				seed: options.seed,
				timeoutMs: options.timeout * 1000
			});
			module_ = extractTs(result.content);
		} catch (error) {
			// A failed request is not a failed write. The next variant still runs.
			const code = error instanceof NoModuleError ? 4 : 3;
			firstFailure ??= code;
			out(`variant ${variant}  failed: ${(error as Error).message}`);
			continue;
		}

		let path: string;
		try {
			path = write(generatedDir, name, module_);
		} catch (error) {
			// The model answered, but the candidate could not be stored.
			firstFailure ??= 5;
			out(
				`variant ${variant}  the candidate could not be written: ${(error as Error).message}`
			);
			continue;
		}

		written += 1;
		const seconds = (performance.now() - started) / 1000;
		// `validateAsset` catches the import and `build()`, but `traverse` and `Box3.setFromObject`
		// run model code and can throw. A throw must not abort the run, or the candidates already
		// written lose their summary and their viewer line.
		let validation: Validation;
		try {
			validation = await validate(path);
		} catch (error) {
			validation = { ok: false, reason: (error as Error).message };
		}
		const state = validation.ok ? "valid" : `invalid: ${validation.reason}`;
		if (validation.ok) valid.push(path);
		const prompt =
			result.promptTokens === null ? "—" : `${result.promptTokens} tok`;
		const cache =
			result.cachedTokens === null ? "—" : `${result.cachedTokens} tok`;
		const imageField =
			images.length > 0
				? `${options.imagePreset} ×${images.length}`
				: "—";
		out(
			`variant ${variant}  ${displayPath(path)}  ${seconds.toFixed(1)} s  ${result.tokens} tokens  ${result.tokensPerSecond.toFixed(1)} tok/s  prompt ${prompt}  cache ${cache}  images ${imageField}  ${state}`
		);
	}

	if (written > 0) {
		out(
			`${written} candidate(s) written to ${displayPath(generatedDir)}. The art director chooses.`
		);
	}
	for (const path of valid) {
		out(
			`view  bun run tools/scene-viewer/serve.ts --asset ${displayPath(path)}`
		);
	}

	if (valid.length > 0) return 0;
	// Candidates were written, and none is a valid asset.
	if (written > 0) return 6;
	// Unreachable with --variants >= 1 (parseOptions rejects less), kept as the total-failure
	// fallback. It must never answer 0: 0 means a candidate was written and is valid.
	return firstFailure ?? 3;
}

if (import.meta.main) {
	process.exit(await runCli(process.argv.slice(2)));
}
