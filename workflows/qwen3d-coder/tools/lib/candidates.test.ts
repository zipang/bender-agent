// T16.2 — the candidate counter and its names.
//
// The counter is per folder. `<name>--01.ts` is the first number, `--04` follows `--03`, and an
// existing file is never overwritten. No code path deletes or renames a candidate.

import { describe, expect, test, afterEach } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	COUNTER_FILE,
	candidateFileName,
	NAME_PATTERN,
	nextNumber,
	writeCandidate
} from "./candidates";

const roots: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "qwen3d-candidates-"));
	roots.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of roots.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

describe("candidateFileName", () => {
	test("is the asset name, zero padded to two digits, with a .ts suffix", () => {
		expect(candidateFileName("chair", 1)).toBe("chair--01.ts");
		expect(candidateFileName("red-sportster", 4)).toBe(
			"red-sportster--04.ts"
		);
	});

	test("the counter file is the asset counter", () => {
		expect(COUNTER_FILE).toBe(".qwen3d-coder-asset.counter");
	});

	test("a name outside kebab case throws", () => {
		for (const name of [
			"Chair",
			"red_sportster",
			"-chair",
			"chair-",
			"a b",
			""
		]) {
			expect(() => candidateFileName(name, 1)).toThrow();
		}
	});

	test("the name pattern is the documented kebab case", () => {
		expect(NAME_PATTERN.test("chair")).toBe(true);
		expect(NAME_PATTERN.test("red-sportster")).toBe(true);
		expect(NAME_PATTERN.test("red--sportster")).toBe(false);
	});

	test("rejects a number below one", () => {
		expect(() => candidateFileName("chair", 0)).toThrow();
		expect(() => candidateFileName("chair", -2)).toThrow();
	});
});

describe("nextNumber", () => {
	test("is 1 in an empty folder", () => {
		expect(nextNumber(tempDir(), "chair")).toBe(1);
	});

	test("is the maximum of this name plus one, not the first hole", () => {
		const dir = tempDir();
		writeFileSync(join(dir, candidateFileName("chair", 1)), "a");
		writeFileSync(join(dir, candidateFileName("chair", 3)), "c");
		expect(nextNumber(dir, "chair")).toBe(4);
	});

	test("ignores a file with another name", () => {
		const dir = tempDir();
		writeFileSync(join(dir, "scene.json"), "{}");
		writeFileSync(join(dir, candidateFileName("table", 5)), "nope");
		expect(nextNumber(dir, "chair")).toBe(1);
	});

	test("a missing folder counts as empty", () => {
		expect(nextNumber(join(tempDir(), "missing"), "chair")).toBe(1);
	});

	test("a name outside kebab case throws", () => {
		expect(() => nextNumber(tempDir(), "Bad Name")).toThrow();
	});
});

describe("writeCandidate", () => {
	test("writes --01, then --02, then --03", () => {
		const dir = tempDir();
		const first = writeCandidate(dir, "chair", "one");
		const second = writeCandidate(dir, "chair", "two");
		const third = writeCandidate(dir, "chair", "three");
		expect(first.endsWith(candidateFileName("chair", 1))).toBe(true);
		expect(second.endsWith(candidateFileName("chair", 2))).toBe(true);
		expect(third.endsWith(candidateFileName("chair", 3))).toBe(true);
		expect(readFileSync(first, "utf8")).toBe("one");
		expect(readFileSync(third, "utf8")).toBe("three");
	});

	test("creates the folder when it is missing", () => {
		const dir = join(tempDir(), "generated");
		const path = writeCandidate(dir, "chair", "x");
		expect(existsSync(path)).toBe(true);
		expect(readdirSync(dir).sort()).toEqual(
			[COUNTER_FILE, candidateFileName("chair", 1)].sort()
		);
	});

	test("never overwrites an existing file, and keeps the first one byte identical", () => {
		const dir = tempDir();
		const existing = join(dir, candidateFileName("chair", 1));
		writeFileSync(existing, "the first run");
		const before = readFileSync(existing, "utf8");

		const path = writeCandidate(dir, "chair", "a second run");
		expect(path.endsWith(candidateFileName("chair", 2))).toBe(true);
		expect(readFileSync(existing, "utf8")).toBe(before);
		expect(readdirSync(dir).sort()).toEqual(
			[
				COUNTER_FILE,
				candidateFileName("chair", 1),
				candidateFileName("chair", 2)
			].sort()
		);
	});

	test("a candidate produced by this module is left alone by the next write", () => {
		const dir = tempDir();
		writeCandidate(dir, "chair", "one");
		writeCandidate(dir, "chair", "two");
		const listing = readdirSync(dir).sort();
		writeCandidate(dir, "chair", "three");
		const after = readdirSync(dir)
			.filter((name) => listing.includes(name))
			.sort();
		expect(after).toEqual(listing);
	});

	test("the module holds no delete and no rename path", () => {
		const source = readFileSync(
			join(import.meta.dir, "candidates.ts"),
			"utf8"
		);
		for (const call of [
			"unlink",
			"rmSync",
			"rmdir",
			"rename",
			"truncate"
		]) {
			expect(source).not.toContain(call);
		}
	});
});

describe("the persistent counter", () => {
	test("the counter file records the last number written", () => {
		const dir = tempDir();
		writeCandidate(dir, "chair", "one");
		expect(readFileSync(join(dir, COUNTER_FILE), "utf8").trim()).toBe("1");
		writeCandidate(dir, "chair", "two");
		expect(readFileSync(join(dir, COUNTER_FILE), "utf8").trim()).toBe("2");
	});

	test("a deleted number is never reused", () => {
		const dir = tempDir();
		writeCandidate(dir, "chair", "one");
		writeCandidate(dir, "chair", "two");
		const third = writeCandidate(dir, "chair", "three");
		expect(third.endsWith(candidateFileName("chair", 3))).toBe(true);

		rmSync(third);

		const fourth = writeCandidate(dir, "chair", "four");
		expect(fourth.endsWith(candidateFileName("chair", 4))).toBe(true);
		expect(nextNumber(dir, "chair")).toBe(5);
	});

	test("an unreadable counter falls back to the folder maximum", () => {
		const dir = tempDir();
		writeFileSync(join(dir, candidateFileName("chair", 2)), "two");
		writeFileSync(join(dir, COUNTER_FILE), "not a number");
		expect(nextNumber(dir, "chair")).toBe(3);
	});

	test("a stale counter never goes backwards", () => {
		const dir = tempDir();
		writeFileSync(join(dir, COUNTER_FILE), "1\n");
		writeFileSync(join(dir, candidateFileName("chair", 2)), "two");
		expect(nextNumber(dir, "chair")).toBe(3);
	});
});
