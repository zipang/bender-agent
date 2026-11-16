// The `/v1/chat/completions` call of the local llama.cpp server, streamed.
//
// The model is not an agent. This module sends one request and reads one SSE stream. Every sampling
// value comes from the model card, and the fields that are absent stay absent.

/** The output guard of decision D5. `--max-tokens -1` removes the cap. */
export const DEFAULT_MAX_TOKENS = 16384;

/** The sampling values of the model card, at the deterministic end of every range. */
export const SAMPLING = {
	temperature: 0.6,
	top_p: 0.95,
	top_k: 20,
	repeat_penalty: 1.0,
} as const;

export type ChatImage = {
	/** The media type, for example `image/png`. */
	mime: string;
	/** The base64 bytes, without the data URL prefix. */
	data: string;
};

export type BuildRequestOptions = {
	alias: string;
	system: string;
	user: string;
	maxTokens?: number;
	seed?: number | null;
	image?: ChatImage | null;
};

export type StreamChatOptions = BuildRequestOptions & {
	port: number;
	/** The wall-clock budget of the whole call, in milliseconds. */
	timeoutMs: number;
	fetchImpl?: typeof fetch;
	onDelta?: (text: string) => void;
};

export type ChatResult = {
	content: string;
	tokens: number;
	tokensPerSecond: number;
	seconds: number;
};

/** A request that the server refused, or that the network dropped. Exit code 3. */
export class RequestError extends Error {
	readonly exitCode = 3;
	readonly status: number;

	constructor(message: string, status = 0) {
		super(message);
		this.name = "RequestError";
		this.status = status;
	}
}

/** The call passed its timeout. Exit code 3. */
export class TimeoutError extends RequestError {
	constructor(timeoutMs: number) {
		super(`The request did not complete within ${timeoutMs / 1000} s.`);
		this.name = "TimeoutError";
	}
}

class DeadlineReached extends Error {}

/** The documented loopback endpoint of the OpenAI-compatible API. */
export function endpoint(port: number, path = "/v1/chat/completions"): string {
	return `http://127.0.0.1:${port}${path}`;
}

/**
 * Build the request body of section 5.
 *
 * `min_p`, `typical_p`, the XTC pair, `dynatemp_range`, the two OpenAI penalties, and `seed` are
 * absent on purpose. The server default applies to each one, and the effective values are recorded
 * in the workflow `README.md`.
 */
export function buildRequestBody(options: BuildRequestOptions): Record<string, unknown> {
	const content = options.image
		? [
				{ type: "text", text: options.user },
				{
					type: "image_url",
					image_url: { url: `data:${options.image.mime};base64,${options.image.data}` },
				},
			]
		: options.user;

	const body: Record<string, unknown> = {
		model: options.alias,
		messages: [
			{ role: "system", content: options.system },
			{ role: "user", content },
		],
		temperature: SAMPLING.temperature,
		top_p: SAMPLING.top_p,
		top_k: SAMPLING.top_k,
		repeat_penalty: SAMPLING.repeat_penalty,
		max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
		stream: true,
	};

	if (options.seed !== undefined && options.seed !== null) body.seed = options.seed;
	return body;
}

type Timings = {
	predicted_n?: number;
	predicted_per_second?: number;
};

type Frame = {
	delta: string;
	done: boolean;
	timings: Timings | null;
};

const EMPTY_FRAME: Frame = { delta: "", done: false, timings: null };

function parseFrame(frame: string): Frame {
	const payload = frame
		.split("\n")
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice(5).trimStart())
		.join("\n");

	if (!payload) return EMPTY_FRAME;
	if (payload === "[DONE]") return { ...EMPTY_FRAME, done: true };

	let json: {
		choices?: Array<{ delta?: { content?: unknown } }>;
		timings?: Timings;
	};
	try {
		json = JSON.parse(payload) as typeof json;
	} catch {
		// A broken frame is skipped. The frames around it stay readable.
		return EMPTY_FRAME;
	}

	const rawDelta = json.choices?.[0]?.delta?.content;
	const delta = typeof rawDelta === "string" ? rawDelta : "";
	const timings = json.timings && typeof json.timings === "object" ? json.timings : null;
	return { delta, done: false, timings };
}

function readWithin(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	deadline: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
	const remaining = deadline - Date.now();
	if (remaining <= 0) return Promise.reject(new DeadlineReached());
	return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
		const timer = setTimeout(() => reject(new DeadlineReached()), remaining);
		reader.read().then(
			(result) => {
				clearTimeout(timer);
				resolve(result);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

/**
 * Send one streamed request and return the whole content.
 *
 * The deltas concatenate in order. `data: [DONE]` ends the read. A broken frame is skipped. The
 * call aborts at `timeoutMs`, and the error carries exit code 3.
 */
export async function streamChat(options: StreamChatOptions): Promise<ChatResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs);
	const started = performance.now();
	const deadline = Date.now() + options.timeoutMs;

	let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

	try {
		let response: Response;
		try {
			response = await fetchImpl(endpoint(options.port), {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(buildRequestBody(options)),
				signal: controller.signal,
			});
		} catch (error) {
			if (controller.signal.aborted || (error as Error)?.name === "AbortError") {
				throw new TimeoutError(options.timeoutMs);
			}
			throw new RequestError(
				`The request to ${endpoint(options.port)} failed: ${(error as Error).message}`,
			);
		}

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			throw new RequestError(
				`The server answered ${response.status}: ${body.slice(0, 200)}`,
				response.status,
			);
		}
		if (!response.body) throw new RequestError("The server answered without a body.");

		reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let content = "";
		let frames = 0;
		let timings: Timings | null = null;
		let finished = false;

		while (!finished) {
			const { value, done } = await readWithin(reader, deadline);
			if (value) buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

			for (;;) {
				const separator = buffer.indexOf("\n\n");
				if (separator < 0) break;
				const frame = buffer.slice(0, separator);
				buffer = buffer.slice(separator + 2);

				const parsed = parseFrame(frame);
				if (parsed.timings) timings = parsed.timings;
				if (parsed.delta) {
					content += parsed.delta;
					frames += 1;
					options.onDelta?.(parsed.delta);
				}
				if (parsed.done) {
					finished = true;
					break;
				}
			}

			if (done) break;
		}

		const seconds = Math.max((performance.now() - started) / 1000, 0);
		// Without `timings`, the count is the non-empty delta frames, not tokens. The documented
		// request asks for `timings`; only a server that omits it falls back to the frame count.
		const count = timings?.predicted_n ?? frames;
		const rate = timings?.predicted_per_second ?? (seconds > 0 ? count / seconds : 0);
		return { content, tokens: count, tokensPerSecond: rate, seconds };
	} catch (error) {
		if (error instanceof RequestError) throw error;
		if (error instanceof DeadlineReached || controller.signal.aborted)
			throw new TimeoutError(options.timeoutMs);
		if ((error as Error)?.name === "AbortError") throw new TimeoutError(options.timeoutMs);
		throw new RequestError(`The stream failed: ${(error as Error).message}`);
	} finally {
		clearTimeout(timer);
		controller.abort();
		try {
			reader?.releaseLock();
		} catch {
			// The reader is already closed.
		}
	}
}
