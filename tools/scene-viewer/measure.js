// The measurement of an `Object3D`: triangles, meshes, size and centre.
//
// The asset is not asked for its own numbers. `build()` returns geometry, and the page counts what
// the geometry holds, so a module that declares a size it does not build cannot make the HUD or the
// frame agree with it. All lengths are metres, because one design unit is one metre.

import * as THREE from "three";

/**
 * Count the triangles and meshes of an object, and measure its bounding box.
 *
 * @param {import("three").Object3D} root The object returned by `build()`
 * @returns {{
 * 	triangles: number;
 * 	meshes: number;
 * 	size: [number, number, number];
 * 	target: [number, number, number];
 * }}
 *   The size and the centre of the world-space box, in metres
 */
export function measureObject(root) {
	let triangles = 0;
	let meshes = 0;

	root?.traverse((object) => {
		if (!object.isMesh) return;
		meshes += 1;
		const geometry = object.geometry;
		// An indexed geometry counts its index buffer; a non-indexed one counts vertices. The
		// divisor is three because the unit of the HUD is a triangle, not a vertex.
		const count = geometry?.index
			? geometry.index.count
			: (geometry?.attributes?.position?.count ?? 0);
		triangles += count / 3;
	});

	const box = new THREE.Box3().setFromObject(root);
	return {
		triangles: Math.round(triangles),
		meshes,
		size: box.getSize(new THREE.Vector3()).toArray(),
		// The centre, not the base: a preset orbits a point in the middle of the mass, and the
		// base stays where the asset puts it, at `y = 0`.
		target: box.getCenter(new THREE.Vector3()).toArray()
	};
}
