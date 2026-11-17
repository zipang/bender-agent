// T1.14 — the `/v1/models` preflight.
//
// `fetch` is injected, so no socket opens and no service runs. The rules and their order are the
// four rows of the ticket's section 3.

import { describe, expect, test } from "bun:test";
import { checkEndpoint } from "./endpoint";

const BASE_URL = "http://127.0.0.1:9931/v1";
const MODELS_URL = "http://127.0.0.1:9931/v1/models";
const MODEL = "qwen3.5-4b-3d-coder";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" }
	});
}

describe("checkEndpoint", () => {
	test("a refused connection exits 2 and names the URL", async () => {
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () => {
				throw new TypeError("fetch failed");
			}
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.exitCode).toBe(2);
		expect(result.message).toContain(MODELS_URL);
		expect(result.message).toContain("fetch failed");
		expect(result.message).toContain("--base-url");
	});

	test("a non-2xx status exits 2 with the URL and the error text", async () => {
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () =>
				new Response("service unavailable", { status: 503 })
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.exitCode).toBe(2);
		expect(result.message).toContain(MODELS_URL);
		expect(result.message).toContain("503");
		expect(result.message).toContain("service unavailable");
	});

	test("a body without data[] exits 2 and quotes the first 200 characters", async () => {
		const body = `{"models":[]}`;
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () => new Response(body)
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.exitCode).toBe(2);
		expect(result.message).toContain(MODELS_URL);
		expect(result.message).toContain(body.slice(0, 200));
	});

	test("a body that is not JSON exits 2 and quotes what it received", async () => {
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () => new Response("<html>not the api</html>")
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.exitCode).toBe(2);
		expect(result.message).toContain("<html>not the api</html>");
	});

	test("a long body is quoted up to 200 characters, no further", async () => {
		const long = "x".repeat(400);
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () => new Response(long)
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.message).toContain("x".repeat(200));
		expect(result.message).not.toContain("x".repeat(201));
	});

	test("a list without the requested id exits 2 and prints the available ids", async () => {
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () =>
				jsonResponse({
					data: [{ id: "qwen3.5-2b" }, { id: "another-model" }]
				})
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.exitCode).toBe(2);
		expect(result.message).toContain(MODEL);
		expect(result.message).toContain("qwen3.5-2b, another-model");
	});

	test("an empty list exits 2 and says the endpoint names no model", async () => {
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () => jsonResponse({ data: [] })
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.exitCode).toBe(2);
		expect(result.message).toContain("names no model");
	});

	test("a list that holds the id resolves to that exact string", async () => {
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () =>
				jsonResponse({
					data: [
						{ id: "qwen3.5-2b", status: { value: "unloaded" } },
						{ id: MODEL, status: { value: "unloaded" }, extra: 1 }
					]
				})
		});
		expect(result).toEqual({ ok: true, id: MODEL });
	});

	test("a single-entry list is enough, and unknown fields are tolerated", async () => {
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async () =>
				jsonResponse({
					data: [{ id: MODEL, owned_by: "local" }],
					object: "list"
				})
		});
		expect(result).toEqual({ ok: true, id: MODEL });
	});

	test("the check addresses GET <base-url>/models and no other route", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const result = await checkEndpoint({
			baseUrl: BASE_URL,
			model: MODEL,
			fetchImpl: async (input, init) => {
				calls.push({ url: String(input), init });
				return jsonResponse({ data: [{ id: MODEL }] });
			}
		});
		expect(result.ok).toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0]!.url).toBe(MODELS_URL);
		expect(calls[0]!.init?.method).toBe("GET");
	});
});
