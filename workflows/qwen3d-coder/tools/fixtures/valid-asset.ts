import * as THREE from "three";

/** A valid asset: one-two-metre group that holds one mesh, on the ground. */
export default function build(): THREE.Object3D {
	const group = new THREE.Group();
	group.name = "fixture";

	const geometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
	const cube = new THREE.Mesh(geometry, material);
	cube.name = "Cube";
	cube.position.y = 0.5;

	group.add(cube);
	return group;
}
