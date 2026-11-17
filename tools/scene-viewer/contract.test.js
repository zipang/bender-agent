// The asset contract: one default function, one `Object3D` with a mesh and a size.
//
// A viewer that accepts anything renders something plausible and fails much later, in a place that
// no longer knows what went wrong. The failures this repository has paid for are a missing export
// and an object that builds nothing, so each gets a name here and the name reaches the error box.
//
// The check reads the module's default export only. That is what makes a named function re-exported
// as the default (`export const build = …; export default build;`) pass, and it keeps a module that
// exports a second helper from failing for it.

import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
	checkAsset,
	checkRoot,
	describe as describeContract
} from "./contract.js";

/** A root that satisfies the contract: one mesh with a real box. */
function goodRoot() {
	const group = new THREE.Group();
	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.MeshStandardMaterial()
	);
	group.add(mesh);
	return group;
}

describe("checkAsset", () => {
	test("accepts a module whose default export is a function", () => {
		const result = checkAsset({ default: () => goodRoot() }, "cube.ts");

		expect(result.build).toBeTypeOf("function");
		expect(result.problems).toEqual([]);
	});

	test("accepts a named function re-exported as the default", () => {
		const build = () => goodRoot();

		const result = checkAsset({ build, default: build }, "cube.ts");

		expect(result.build).toBe(build);
		expect(result.problems).toEqual([]);
	});

	test("names the file and the missing default export", () => {
		const result = checkAsset({ build: () => goodRoot() }, "candidate.ts");

		expect(result.build).toBeNull();
		expect(result.problems).toHaveLength(1);
		expect(result.problems[0]).toContain("candidate.ts");
		expect(result.problems[0]).toContain("default");
	});

	test("rejects a default export that is not a function", () => {
		const result = checkAsset(
			{ default: new THREE.Group() },
			"candidate.ts"
		);

		expect(result.build).toBeNull();
		expect(result.problems[0]).toContain("candidate.ts");
		expect(result.problems[0]).toContain("function");
	});

	test("rejects a value that is not a module", () => {
		const result = checkAsset(null, "candidate.ts");

		expect(result.build).toBeNull();
		expect(result.problems[0]).toContain("candidate.ts");
	});
});

describe("checkRoot", () => {
	test("accepts an object with one mesh and a finite size", () => {
		expect(checkRoot(goodRoot())).toEqual([]);
	});

	test("rejects a return that is not an Object3D", () => {
		const problems = checkRoot({ name: "not a node" });

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("Object3D");
	});

	test("rejects a group with no mesh", () => {
		const problems = checkRoot(new THREE.Group());

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("mesh");
	});

	test("rejects a mesh with a non-finite size", () => {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(
				[Number.POSITIVE_INFINITY, 0, 0, 1, 0, 0, 0, 1, 0],
				3
			)
		);
		const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());

		const problems = checkRoot(mesh);

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("size");
	});
});

describe("describe", () => {
	test("answers null when there is no problem", () => {
		expect(describeContract([])).toBeNull();
	});

	test("joins the problems with a newline and a two-space bullet", () => {
		const message = describeContract(["one", "two"]);

		expect(message).toBe(
			"the asset does not satisfy its contract:\n  - one\n  - two"
		);
	});
});
