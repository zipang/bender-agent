import * as THREE from "three";

/**
 * A broken asset: the default export is a function, but it throws when it is
 * called.
 */
export default function build(): THREE.Object3D {
	throw new Error("boom");
}
