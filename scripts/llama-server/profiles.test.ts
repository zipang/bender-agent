// T1.1 — the model registry and its reader.
//
// The registry holds runtime facts only: a repository, a quantization, a port, an alias, and a
// context size. It reads no scene, no asset, and no blueprint.

import { describe, expect, test } from "bun:test";
import {
	PROFILES,
	profileNames,
	profilesMain,
	selectProfile,
	UnknownProfileError,
} from "./profiles";

describe("profiles", () => {
	test("a known name returns the six documented fields", () => {
		const profile = selectProfile("3d-coder");
		expect(profile).toEqual({
			repo: "ccore/Qwen3.5-4B-3D-Coder",
			quant: "Q4_K_M",
			port: 9931,
			alias: "local/3d-coder",
			ctx: 65536,
		});
		expect(Object.keys(profile).sort()).toEqual(["alias", "ctx", "port", "quant", "repo"]);
	});

	test("the registry exposes one entry and no 3D vocabulary", () => {
		expect(Object.keys(PROFILES)).toEqual(["3d-coder"]);
		const text = JSON.stringify(PROFILES).toLowerCase();
		for (const word of ["scene", "asset", "blueprint", "mesh"]) {
			expect(text).not.toContain(word);
		}
	});

	test("an unknown name throws, exits 1, and lists the known names", () => {
		let error: unknown;
		try {
			selectProfile("nope");
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(UnknownProfileError);
		const unknown = error as UnknownProfileError;
		expect(unknown.exitCode).toBe(1);
		expect(unknown.message).toContain("nope");
		for (const name of profileNames()) {
			expect(unknown.message).toContain(name);
		}
		expect(profileNames()).toEqual(["3d-coder"]);
	});

	test("the reader prints a known profile and returns 0", () => {
		const lines: string[] = [];
		const code = profilesMain(["3d-coder"], (line) => lines.push(line));
		expect(code).toBe(0);
		const output = lines.join("\n");
		expect(output).toContain("ccore/Qwen3.5-4B-3D-Coder");
		expect(output).toContain("Q4_K_M");
		expect(output).toContain("9931");
		expect(output).toContain("local/3d-coder");
	});

	test("the reader prints the known names to the error stream and returns 1", () => {
		const errors: string[] = [];
		const code = profilesMain(
			["typo"],
			() => {},
			(line) => errors.push(line),
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("3d-coder");
	});

	test("a missing name is invalid input", () => {
		const errors: string[] = [];
		const code = profilesMain(
			[],
			() => {},
			(line) => errors.push(line),
		);
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("3d-coder");
	});
});
