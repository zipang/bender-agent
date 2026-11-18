// The candidate counter and the write of one candidate file.
//
// The counter is per folder. `<name>--01.ts` is the first number of an empty folder, and `--04`
// follows `--03`. A write never overwrites an existing file, and no function in this module removes
// or moves a file: a rejected candidate stays as evidence.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A resolved asset name: kebab case, one or more lowercase words. */
export const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The persistent counter of the folder. It stops a deleted number from coming
 * back.
 */
export const COUNTER_FILE = ".qwen3d-coder-asset.counter";

const SUFFIX = ".ts";

function assertName(name: string): void {
	if (!NAME_PATTERN.test(name)) {
		throw new Error(
			`An asset name is kebab case and matches ${NAME_PATTERN.source}, got "${name}".`
		);
	}
}

/** The escaped pattern of one candidate name, for the folder scan. */
function candidatePattern(name: string): RegExp {
	return new RegExp(`^${name}--(\\d+)${SUFFIX.replace(".", "\\.")}$`);
}

/** The documented name of one candidate, zero padded to two digits. */
export function candidateFileName(name: string, n: number): string {
	assertName(name);
	if (!Number.isInteger(n) || n < 1) {
		throw new Error(
			`A candidate number is a positive integer, got "${n}".`
		);
	}
	return `${name}--${String(n).padStart(2, "0")}${SUFFIX}`;
}

/**
 * Read the persistent counter of a folder.
 *
 * A missing, unreadable, or invalid counter returns null, and the folder
 * maximum decides.
 */
export function readCounter(dir: string): number | null {
	try {
		const text = readFileSync(join(dir, COUNTER_FILE), "utf8").trim();
		if (!/^\d+$/.test(text)) return null;
		const value = Number.parseInt(text, 10);
		return Number.isInteger(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}

/**
 * The next number of one name in a folder.
 *
 * It is `max(counter, maximum present) + 1`, or 1 when the folder holds
 * neither. The counter keeps a deleted number out of use, and a missing folder
 * counts as empty.
 */
export function nextNumber(dir: string, name: string): number {
	assertName(name);
	const counter = readCounter(dir);
	const pattern = candidatePattern(name);
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return (counter ?? 0) + 1;
	}
	let max = 0;
	for (const candidate of names) {
		const match = pattern.exec(candidate);
		if (!match) continue;
		const value = Number.parseInt(match[1]!, 10);
		if (Number.isFinite(value) && value > max) max = value;
	}
	return Math.max(counter ?? 0, max) + 1;
}

/** Record a number in the counter. The counter never goes backwards. */
function writeCounter(dir: string, n: number): void {
	const current = readCounter(dir) ?? 0;
	if (n > current) writeFileSync(join(dir, COUNTER_FILE), `${n}\n`);
}

/**
 * Write one candidate with `O_EXCL`, and return its path.
 *
 * The folder is created when it is missing. An existing file is never
 * overwritten: the counter moves to the next free number and the write is
 * retried. The counter is recorded after a successful write.
 */
export function writeCandidate(
	dir: string,
	name: string,
	source: string
): string {
	assertName(name);
	mkdirSync(dir, { recursive: true });
	for (let attempt = 0; attempt < 1000; attempt += 1) {
		const number = nextNumber(dir, name);
		const path = join(dir, candidateFileName(name, number));
		try {
			writeFileSync(path, source, { flag: "wx" });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
			throw error;
		}
		try {
			writeCounter(dir, number);
		} catch {
			// The counter is an aid. The folder maximum still holds the number of this candidate.
		}
		return path;
	}
	throw new Error(`No free candidate number in ${dir}.`);
}
