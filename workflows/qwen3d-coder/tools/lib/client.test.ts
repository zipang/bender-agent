// T1.7 and T1.8 — the request body and the stream.
//
// The body is captured from an in-process `Bun.serve` on port 0, so nothing leaves the loopback
// interface and no model is loaded. The SSE fixtures are recorded frames, replayed through an
// injected fetch.

import { describe, expect, test } from "bun:test";
import {
	buildRequestBody,
	DEFAULT_MAX_TOKENS,
	endpoint,
	RequestError,
	streamChat,
	TimeoutError,
} from "./client";

const SYSTEM = "system prompt, byte for byte";
const USER = "Subject: a box\nStyle: flat";

const SSE_OK = [
	'data: {"choices":[{"delta":{"content":"<!DOCTYPE html>"}}]}',
	"",
	'data: {"choices":[{"delta":{"content":"<html></html>"}}]}',
	"",
	"data: [DONE]",
	"",
	'data: {"choices":[{"delta":{"content":"IGNORED"}}]}',
	"",
	"",
].join("\n");

describe("buildRequestBody", () => {
	test("holds every documented field and no absent key", () => {
		const body = buildRequestBody({ model: "qwen3.5-4b-3d-coder", system: SYSTEM, user: USER });
		expect(body).toEqual({
			model: "qwen3.5-4b-3d-coder",
			messages: [
				{ role: "system", content: SYSTEM },
				{ role: "user", content: USER },
			],
			temperature: 0.6,
			top_p: 0.95,
			top_k: 20,
			repeat_penalty: 1.0,
			max_tokens: DEFAULT_MAX_TOKENS,
			stream: true,
			chat_template_kwargs: { enable_thinking: false },
		});
		expect(DEFAULT_MAX_TOKENS).toBe(16384);
		for (const key of [
			"min_p",
			"typical_p",
			"xtc_probability",
			"xtc_threshold",
			"dynatemp_range",
			"presence_penalty",
			"frequency_penalty",
			"seed",
		]) {
			expect(body).not.toHaveProperty(key);
		}
	});

	test("max_tokens changes alone", () => {
		const base = buildRequestBody({ model: "qwen3.5-4b-3d-coder", system: SYSTEM, user: USER });
		const capped = buildRequestBody({
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			maxTokens: 512,
		});
		expect(capped).toEqual({ ...base, max_tokens: 512 });
	});

	test("--seed 42 adds seed and changes nothing else", () => {
		const base = buildRequestBody({ model: "qwen3.5-4b-3d-coder", system: SYSTEM, user: USER });
		const seeded = buildRequestBody({
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			seed: 42,
		});
		expect(seeded).toEqual({ ...base, seed: 42 });
		expect(Object.keys(seeded)).toEqual([...Object.keys(base), "seed"]);
	});

	test("an image is an image_url content part with a data URL", () => {
		const body = buildRequestBody({
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			image: { mime: "image/png", data: "QUJD" },
		});
		const messages = body.messages as Array<{ role: string; content: unknown }>;
		expect(messages[1]!.content).toEqual([
			{ type: "text", text: USER },
			{ type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } },
		]);
	});

	test("the endpoint is the chat route of the given base URL", () => {
		expect(endpoint("http://127.0.0.1:9931/v1")).toBe(
			"http://127.0.0.1:9931/v1/chat/completions",
		);
		expect(endpoint("https://gateway.example/api/v1")).toBe(
			"https://gateway.example/api/v1/chat/completions",
		);
	});
});

describe("the body on the wire", () => {
	test("the server receives every field as JSON", async () => {
		let captured: Record<string, unknown> | null = null;
		const server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch: async (request) => {
				captured = (await request.json()) as Record<string, unknown>;
				return new Response(SSE_OK, { headers: { "content-type": "text/event-stream" } });
			},
		});
		try {
			const result = await streamChat({
				baseUrl: `http://127.0.0.1:${server.port}/v1`,
				model: "qwen3.5-4b-3d-coder",
				system: SYSTEM,
				user: USER,
				timeoutMs: 5000,
			});
			expect(result.content).toBe("<!DOCTYPE html><html></html>");
			expect(captured).not.toBeNull();
			expect(captured).toEqual(
				buildRequestBody({ model: "qwen3.5-4b-3d-coder", system: SYSTEM, user: USER }),
			);
		} finally {
			server.stop(true);
		}
	});
});

describe("streamChat", () => {
	test("the deltas concatenate in order", async () => {
		const result = await streamChat({
			baseUrl: "http://127.0.0.1:9931/v1",
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			timeoutMs: 1000,
			fetchImpl: async () =>
				new Response(SSE_OK, { headers: { "content-type": "text/event-stream" } }),
		});
		expect(result.content).toBe("<!DOCTYPE html><html></html>");
	});

	test("data: [DONE] ends the read", async () => {
		const result = await streamChat({
			baseUrl: "http://127.0.0.1:9931/v1",
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			timeoutMs: 1000,
			fetchImpl: async () => new Response(SSE_OK),
		});
		expect(result.content).not.toContain("IGNORED");
	});

	test("a broken frame is skipped and the rest is kept", async () => {
		const fixture = [
			'data: {"choices":[{"delta":{"content":"a"}}]}',
			"",
			"data: {this is not json}",
			"",
			'data: {"choices":[{"delta":{"content":"b"}}]}',
			"",
			"data: [DONE]",
			"",
			"",
		].join("\n");
		const result = await streamChat({
			baseUrl: "http://127.0.0.1:9931/v1",
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			timeoutMs: 1000,
			fetchImpl: async () => new Response(fixture),
		});
		expect(result.content).toBe("ab");
	});

	test("a frame split across two chunks is joined", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"con'));
				controller.enqueue(encoder.encode('tent":"ab"}}]}\n\ndata: [DONE]\n\n'));
				controller.close();
			},
		});
		const result = await streamChat({
			baseUrl: "http://127.0.0.1:9931/v1",
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			timeoutMs: 1000,
			fetchImpl: async () => new Response(stream),
		});
		expect(result.content).toBe("ab");
	});

	test("a last frame with no trailing blank line is still read", async () => {
		const result = await streamChat({
			baseUrl: "http://127.0.0.1:9931/v1",
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			timeoutMs: 1000,
			fetchImpl: async () =>
				new Response('data: {"choices":[{"delta":{"content":"<html></html>"}}]}'),
		});
		expect(result.content).toBe("<html></html>");
	});

	test("the server timings give the token count and the rate", async () => {
		const fixture = [
			'data: {"choices":[{"delta":{"content":"a"}}]}',
			"",
			'data: {"choices":[{"delta":{"content":"b"}}],"timings":{"predicted_n":7,"predicted_per_second":14.5}}',
			"",
			"data: [DONE]",
			"",
			"",
		].join("\n");
		const result = await streamChat({
			baseUrl: "http://127.0.0.1:9931/v1",
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			timeoutMs: 1000,
			fetchImpl: async () => new Response(fixture),
		});
		expect(result.tokens).toBe(7);
		expect(result.tokensPerSecond).toBe(14.5);
	});

	test("without server timings the content frames are counted", async () => {
		const result = await streamChat({
			baseUrl: "http://127.0.0.1:9931/v1",
			model: "qwen3.5-4b-3d-coder",
			system: SYSTEM,
			user: USER,
			timeoutMs: 1000,
			fetchImpl: async () => new Response(SSE_OK),
		});
		expect(result.tokens).toBe(2);
		expect(result.tokensPerSecond).toBeGreaterThan(0);
	});

	test("a stalled read aborts at the timeout with exit code 3", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					encoder.encode('data: {"choices":[{"delta":{"content":"a"}}]}\n\n'),
				);
				// Never closed: the read must be bounded by the timeout, not by the server.
			},
		});
		const started = performance.now();
		let error: unknown;
		try {
			await streamChat({
				baseUrl: "http://127.0.0.1:9931/v1",
				model: "qwen3.5-4b-3d-coder",
				system: SYSTEM,
				user: USER,
				timeoutMs: 25,
				fetchImpl: async () => new Response(stream),
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(TimeoutError);
		expect((error as TimeoutError).exitCode).toBe(3);
		expect(performance.now() - started).toBeLessThan(2000);
	});

	test("a non-200 answer is a request failure with exit code 3", async () => {
		let error: unknown;
		try {
			await streamChat({
				baseUrl: "http://127.0.0.1:9931/v1",
				model: "qwen3.5-4b-3d-coder",
				system: SYSTEM,
				user: USER,
				timeoutMs: 1000,
				fetchImpl: async () => new Response("model not found", { status: 404 }),
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(RequestError);
		expect((error as RequestError).exitCode).toBe(3);
		expect((error as Error).message).toContain("404");
	});

	test("a refused connection is a request failure with exit code 3", async () => {
		let error: unknown;
		try {
			await streamChat({
				baseUrl: "http://127.0.0.1:9931/v1",
				model: "qwen3.5-4b-3d-coder",
				system: SYSTEM,
				user: USER,
				timeoutMs: 1000,
				fetchImpl: async () => {
					throw new TypeError("fetch failed");
				},
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(RequestError);
		expect((error as RequestError).exitCode).toBe(3);
	});
});
