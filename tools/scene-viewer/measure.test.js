// The measurement of an `Object3D`: triangles, meshes, size and centre.
//
// The HUD reads these four numbers and the frame is derived from two of them. They are counted
// from the built object, never declared by the asset: an asset that lies about its triangle count
// must be caught by the viewer, not believed.

import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { measureObject } from "./measure.js";

/** One box as a mesh, at a position, with an optional shift of the group. */
function box(size, position = [0, 0, 0]) {
	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry(...size),
		new THREE.MeshStandardMaterial()
	);
	mesh.position.set(...position);
	return mesh;
}

describe("measureObject", () => {
	test("counts the triangles and meshes of two boxes", () => {
		const group = new THREE.Group();
		group.add(box([1, 1, 1], [0, 0.5, 0]));
		group.add(box([1, 1, 1], [2, 0.5, 0]));

		const measured = measureObject(group);

		// A BoxGeometry is indexed: 36 indices, 12 triangles.
		expect(measured.triangles).toBe(24);
		expect(measured.meshes).toBe(2);
	});

	test("counts a non-indexed geometry by its position attribute", () => {
		const mesh = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
			new THREE.MeshStandardMaterial()
		);

		expect(measureObject(mesh).triangles).toBe(12);
	});

	test("reports the size and the centre of an offset object", () => {
		const mesh = box([1, 2, 3], [0, 1, 0]);

		const measured = measureObject(mesh);

		expect(measured.size).toEqual([1, 2, 3]);
		expect(measured.target).toEqual([0, 1, 0]);
	});

	test("ignores a node that is not a mesh", () => {
		const group = new THREE.Group();
		const empty = new THREE.Group();
		empty.add(new THREE.Object3D());
		group.add(empty);
		group.add(box([1, 1, 1], [0, 0.5, 0]));

		expect(measureObject(group).meshes).toBe(1);
	});

	test("returns a zero box for an object without a mesh", () => {
		// `Box3` is empty here, and `getSize` / `getCenter` answer `[0, 0, 0]` for an empty box.
		// That is the value `frameFrom` rejects, so the asset fails with a named reason.
		const measured = measureObject(new THREE.Group());

		expect(measured.triangles).toBe(0);
		expect(measured.meshes).toBe(0);
		expect(measured.size).toEqual([0, 0, 0]);
		expect(measured.target).toEqual([0, 0, 0]);
	});
});
