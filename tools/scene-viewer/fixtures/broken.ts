// One asset with a syntax error.
//
// The real candidate `qwen3D-01.ts` held `new THREE.Mesh[]`, and the art director repaired it by
// hand. This fixture keeps the failure so the catalogue, the error box and the server all show
// what a broken candidate really produces. A syntax error is reported, never repaired.

import * as THREE from "three";

export default function build(): THREE.Object3D {
	const parts: THREE.Mesh[] = new THREE.Mesh[];

	return new THREE.Group().add(...parts);
}
