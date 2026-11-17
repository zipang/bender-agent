// The asset contract, checked in one place with one message per failure.
//
// An asset is one standalone TypeScript module: `export default function build(): THREE.Object3D`,
// no argument, one synchronous return, one unit per metre, the base at `y = 0`, and the front along
// `+Z`. T0016 writes that contract into the prompt, and this module is where a delivered file is
// checked against it.
//
// The module's default export is the only export read. A named `build` re-exported as the default
// passes, because the check asks the module what it exports rather than asking for a name.

import * as THREE from "three";

/**
 * Check an imported asset module.
 *
 * @param {object} module_ The namespace object of the imported module
 * @param {string} [file] The repository path, for the message
 * @returns {{ build: Function | null; problems: string[] }}
 */
export function checkAsset(module_, file = "the asset") {
	const problems = [];
	if (!module_ || typeof module_ !== "object") {
		return { build: null, problems: [`${file} did not load as a module`] };
	}
	const build = module_.default;
	if (typeof build !== "function") {
		problems.push(
			`${file} has no default export that is a function; the asset contract is \`export default function build(): THREE.Object3D\``
		);
		return { build: null, problems };
	}
	return { build, problems };
}

/**
 * Check what `build()` returned.
 *
 * @param {unknown} object The value `build()` returned
 * @returns {string[]} Problems, empty when the object can be drawn
 */
export function checkRoot(object) {
	const problems = [];
	if (object?.isObject3D !== true) {
		problems.push(
			"the asset did not return a THREE.Object3D; a multi-part asset returns a THREE.Group"
		);
		return problems;
	}

	let meshes = 0;
	object.traverse((node) => {
		if (node.isMesh) meshes += 1;
	});
	if (meshes === 0) {
		problems.push("the asset has no mesh, so there is nothing to draw");
		return problems;
	}

	// The frame cannot be derived from an infinite or flat box, and a NaN that reaches the camera
	// shows a white page with no reason on screen. This check names it before the frame does.
	const size = new THREE.Box3()
		.setFromObject(object)
		.getSize(new THREE.Vector3());
	if (
		![size.x, size.y, size.z].every(
			(value) => Number.isFinite(value) && value > 0
		)
	) {
		problems.push(
			`the asset has no measurable size on all three axes: ${size.x} × ${size.y} × ${size.z} metres`
		);
	}
	return problems;
}

/** One message for the page, or null when everything is usable. */
export function describe(problems) {
	if (problems.length === 0) return null;
	return `the asset does not satisfy its contract:\n  - ${problems.join("\n  - ")}`;
}
