// The reference asset: one metre, on the ground, inside a named group.
//
// This file is the shape the viewer expects and the shape T0016 must emit: one default export,
// no argument, one synchronous `Object3D`, the base at `y = 0`, one unit per metre. The `interface`
// is deliberate: the browser must receive JavaScript with the type gone, so the served bytes prove
// that the server transpiled this file instead of handing the source to the page.

import * as THREE from "three";

interface CubePart {
	name: string;
	size: number;
}

export default function build(): THREE.Object3D {
	const group = new THREE.Group();
	group.name = "cube";

	const part: CubePart = { name: "CubeBody", size: 1 };
	const body = new THREE.Mesh(
		new THREE.BoxGeometry(part.size, part.size, part.size),
		new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 })
	);
	body.name = part.name;
	body.position.y = part.size / 2;
	group.add(body);

	return group;
}
