// T1.6 — the candidate counter.
//
// The counter is per folder. `--01` is the first number, `--04` follows `--03`, and an existing
// file is never overwritten. No code path deletes or renames a candidate.

import { describe, expect, test, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	CANDIDATE_PREFIX,
	COUNTER_FILE,
	candidateFileName,
	nextNumber,
	writeCandidate,
} from "./candidates";

const roots: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "qwen3d-candidates-"));
	roots.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("candidateFileName", () => {
	test("is the documented name, zero padded to two digits", () => {
		expect(CANDIDATE_PREFIX).toBe("qwen3d-coder-scene");
		expect(candidateFileName(1)).toBe("qwen3d-coder-scene--01.html");
		expect(candidateFileName(4)).toBe("qwen3d-coder-scene--04.html");
	});

	test("rejects a number below one", () => {
		expect(() => candidateFileName(0)).toThrow();
		expect(() => candidateFileName(-2)).toThrow();
	});
});

describe("nextNumber", () => {
	test("is 1 in an empty folder", () => {
		expect(nextNumber(tempDir())).toBe(1);
	});

	test("is the maximum plus one, not the first hole", () => {
		const dir = tempDir();
		writeFileSync(join(dir, candidateFileName(1)), "a");
		writeFileSync(join(dir, candidateFileName(3)), "c");
		expect(nextNumber(dir)).toBe(4);
	});

	test("ignores a file with another name", () => {
		const dir = tempDir();
		writeFileSync(join(dir, "scene.json"), "{}");
		writeFileSync(join(dir, "qwen3d-coder-scene--xx.html"), "nope");
		expect(nextNumber(dir)).toBe(1);
	});

	test("a missing folder counts as empty", () => {
		expect(nextNumber(join(tempDir(), "missing"))).toBe(1);
	});
});

describe("writeCandidate", () => {
	test("writes --01, then --02, then --03", () => {
		const dir = tempDir();
		const first = writeCandidate(dir, "one");
		const second = writeCandidate(dir, "two");
		const third = writeCandidate(dir, "three");
		expect(first.endsWith(candidateFileName(1))).toBe(true);
		expect(second.endsWith(candidateFileName(2))).toBe(true);
		expect(third.endsWith(candidateFileName(3))).toBe(true);
		expect(readFileSync(first, "utf8")).toBe("one");
		expect(readFileSync(third, "utf8")).toBe("three");
	});

	test("creates the folder when it is missing", () => {
		const dir = join(tempDir(), "generated");
		const path = writeCandidate(dir, "x");
		expect(existsSync(path)).toBe(true);
		expect(readdirSync(dir).sort()).toEqual([COUNTER_FILE, candidateFileName(1)].sort());
	});

	test("never overwrites an existing file", () => {
		const dir = tempDir();
		const existing = join(dir, candidateFileName(1));
		writeFileSync(existing, "the first run");
		const path = writeCandidate(dir, "a second run");
		expect(path.endsWith(candidateFileName(2))).toBe(true);
		expect(readFileSync(existing, "utf8")).toBe("the first run");
		expect(readdirSync(dir).sort()).toEqual(
			[COUNTER_FILE, candidateFileName(1), candidateFileName(2)].sort(),
		);
	});

	test("a candidate produced by this module is left alone by the next write", () => {
		const dir = tempDir();
		writeCandidate(dir, "one");
		writeCandidate(dir, "two");
		const listing = readdirSync(dir).sort();
		writeCandidate(dir, "three");
		const after = readdirSync(dir)
			.filter((name) => listing.includes(name))
			.sort();
		expect(after).toEqual(listing);
	});

	test("the module holds no delete and no rename path", () => {
		const source = readFileSync(join(import.meta.dir, "candidates.ts"), "utf8");
		for (const call of ["unlink", "rmSync", "rmdir", "rename", "truncate"]) {
			expect(source).not.toContain(call);
		}
	});
});

describe("the persistent counter", () => {
	test("the counter file records the last number written", () => {
		const dir = tempDir();
		writeCandidate(dir, "one");
		expect(readFileSync(join(dir, COUNTER_FILE), "utf8").trim()).toBe("1");
		writeCandidate(dir, "two");
		expect(readFileSync(join(dir, COUNTER_FILE), "utf8").trim()).toBe("2");
	});

	test("a deleted number is never reused", () => {
		const dir = tempDir();
		writeCandidate(dir, "one");
		writeCandidate(dir, "two");
		const third = writeCandidate(dir, "three");
		expect(third.endsWith(candidateFileName(3))).toBe(true);

		rmSync(third);

		const fourth = writeCandidate(dir, "four");
		expect(fourth.endsWith(candidateFileName(4))).toBe(true);
		expect(nextNumber(dir)).toBe(5);
	});

	test("an unreadable counter falls back to the folder maximum", () => {
		const dir = tempDir();
		writeFileSync(join(dir, candidateFileName(2)), "two");
		writeFileSync(join(dir, COUNTER_FILE), "not a number");
		expect(nextNumber(dir)).toBe(3);
	});

	test("a stale counter never goes backwards", () => {
		const dir = tempDir();
		writeFileSync(join(dir, COUNTER_FILE), "1\n");
		writeFileSync(join(dir, candidateFileName(2)), "two");
		expect(nextNumber(dir)).toBe(3);
	});
});
