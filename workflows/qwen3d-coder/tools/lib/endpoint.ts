// The preflight of the endpoint: is it up, and does it publish the requested model?
//
// The workflow ships no inference server. The endpoint is an input, named by `--base-url` and
// `--model`. This module reads `GET <base-url>/models`, which the OpenAI-compatible API documents as
// the model list, and it never sends a completion.
//
// The function is pure over its injected `fetchImpl`, so a test reads no socket.

/** The documented route of the model list, appended to `--base-url`. */
const MODELS_ROUTE = "/models";

/** How much of an unexpected body an error message quotes. */
const BODY_PREVIEW = 200;

export type PreflightOptions = {
	/** The root of the OpenAI-compatible API, without a trailing slash. */
	baseUrl: string;
	/** The `id` that the endpoint must publish for this run. */
	model: string;
	/** The fetch to use. Absent means the global `fetch`. */
	fetchImpl?: typeof fetch;
	/** The wall-clock budget of the check, in milliseconds. */
	timeoutMs?: number;
};

/** The discriminated result of the preflight. A failure carries exit code `2`. */
export type PreflightResult =
	| {
			ok: true;
			id: string;
			/**
			 * `data[i].multimodal` of the matched entry, or null when it is
			 * absent.
			 */
			multimodal: boolean | null;
	  }
	| { ok: false; exitCode: 2; message: string };

function failure(message: string): PreflightResult {
	return { ok: false, exitCode: 2, message };
}

function preview(text: string): string {
	return text.slice(0, BODY_PREVIEW);
}

/** The line that names the prerequisite, shared by every failure message. */
const PREREQUISITE =
	"Check that an OpenAI-compatible service runs at --base-url, and that --model is an id it publishes.";

type ModelEntry = { id?: unknown; multimodal?: unknown };

/**
 * Run `GET <base-url>/models` and resolve the exact `id` of `--model`.
 *
 * The rules, in order:
 *
 * 1. The connection throws or the status is not 2xx: a failure with the URL and
 *    the error text.
 * 2. The body is not a JSON object with a `data` array: a failure with the URL and
 *    the first 200 characters received.
 * 3. `data[]` holds no entry whose `id` equals `--model`: a failure with the
 *    requested id and the available ids, comma-separated. An empty list says
 *    that the endpoint names no model.
 * 4. Otherwise success, carrying the exact `id` string that matched and the
 *    `multimodal` capability of that entry. The capability is reported, never
 *    enforced.
 *
 * Extra fields, unknown values, and more than one entry are tolerated: the
 * reference service lists two models.
 */
export async function checkEndpoint(
	options: PreflightOptions
): Promise<PreflightResult> {
	const url = `${options.baseUrl}${MODELS_ROUTE}`;
	const fetchImpl = options.fetchImpl ?? fetch;
	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(),
		options.timeoutMs ?? 10000
	);

	let response: Response;
	try {
		response = await fetchImpl(url, {
			method: "GET",
			signal: controller.signal
		});
	} catch (error) {
		clearTimeout(timer);
		const text = (error as Error)?.message ?? String(error);
		return failure(
			`The endpoint at ${url} is unreachable: ${text}. ${PREREQUISITE}`
		);
	}

	let raw: string;
	try {
		raw = await response.text();
	} catch (error) {
		clearTimeout(timer);
		const text = (error as Error)?.message ?? String(error);
		return failure(
			`The endpoint at ${url} did not return its model list: ${text}. ${PREREQUISITE}`
		);
	}
	clearTimeout(timer);

	if (!response.ok) {
		return failure(
			`The endpoint at ${url} answered ${response.status}: ${preview(raw)}. ${PREREQUISITE}`
		);
	}

	let body: unknown;
	try {
		body = JSON.parse(raw);
	} catch {
		return failure(
			`The endpoint at ${url} did not return JSON. First ${BODY_PREVIEW} characters received: ${preview(raw)}. ${PREREQUISITE}`
		);
	}

	if (
		body === null ||
		typeof body !== "object" ||
		!Array.isArray((body as { data?: unknown }).data)
	) {
		return failure(
			`The endpoint at ${url} returned no model list: the body is not a JSON object with a "data" array. First ${BODY_PREVIEW} characters received: ${preview(raw)}. ${PREREQUISITE}`
		);
	}

	const entries = (body as { data: unknown[] }).data;
	const models = entries.filter(
		(entry): entry is ModelEntry =>
			entry !== null && typeof entry === "object"
	);
	const ids = models
		.map((entry) => entry.id)
		.filter((id): id is string => typeof id === "string");

	if (ids.length === 0) {
		return failure(
			`The endpoint at ${url} names no model. The requested model is "${options.model}". ${PREREQUISITE}`
		);
	}

	const matched = models.find((entry) => entry.id === options.model);
	if (matched === undefined) {
		return failure(
			`The endpoint at ${url} does not publish the requested model "${options.model}". Available ids: ${ids.join(", ")}. ${PREREQUISITE}`
		);
	}

	const multimodal =
		matched.multimodal === true
			? true
			: matched.multimodal === false
				? false
				: null;
	return { ok: true, id: matched.id as string, multimodal };
}
