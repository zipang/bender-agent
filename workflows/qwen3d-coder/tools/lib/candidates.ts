// The candidate counter and the write of one candidate file.
//
// The counter is per folder. `--01` is the first number of an empty folder, and `--04` follows
// `--03`. A write never overwrites an existing file, and no function in this module removes or
// moves a file: a rejected candidate stays as evidence.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The fixed prefix of every candidate of this workflow. */
export const CANDIDATE_PREFIX = "qwen3d-coder-scene";

/**
 * The persistent counter of the folder. It stops a deleted number from coming
 * back.
 */
export const COUNTER_FILE = ".qwen3d-coder-scene.counter";

const SUFFIX = ".html";
const PATTERN = new RegExp(
	`^${CANDIDATE_PREFIX}--(\\d+)${SUFFIX.replace(".", "\\.")}$`
);

/** The documented name of one candidate, zero padded to two digits. */
export function candidateFileName(n: number): string {
	if (!Number.isInteger(n) || n < 1) {
		throw new Error(
			`A candidate number is a positive integer, got "${n}".`
		);
	}
	return `${CANDIDATE_PREFIX}--${String(n).padStart(2, "0")}${SUFFIX}`;
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
 * The next number of a folder.
 *
 * It is `max(counter, maximum present) + 1`, or 1 when the folder holds
 * neither. The counter keeps a deleted number out of use, and a missing folder
 * counts as empty.
 */
export function nextNumber(dir: string): number {
	const counter = readCounter(dir);
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return (counter ?? 0) + 1;
	}
	let max = 0;
	for (const name of names) {
		const match = PATTERN.exec(name);
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
export function writeCandidate(dir: string, html: string): string {
	mkdirSync(dir, { recursive: true });
	for (let attempt = 0; attempt < 1000; attempt += 1) {
		const number = nextNumber(dir);
		const path = join(dir, candidateFileName(number));
		try {
			writeFileSync(path, html, { flag: "wx" });
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
