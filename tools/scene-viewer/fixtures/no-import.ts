// One valid asset that forgets the `three` import.
//
// A model writes this file and omits the line the contract requires. The viewer still draws it:
// the server prepends `import * as THREE from "three";` before the transpile. Nothing here names
// the module, so a test can prove the prelude came from the server and not from the file.

export default function build(): THREE.Object3D {
	const group = new THREE.Group();
	group.name = "slab";

	const slab = new THREE.Mesh(
		new THREE.BoxGeometry(1, 0.25, 1),
		new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7 })
	);
	slab.name = "Slab";
	slab.position.y = 0.125;
	group.add(slab);

	return group;
}
