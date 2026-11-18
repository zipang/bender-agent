// The validation of one written candidate.
//
// The drafter imports what it wrote, calls `build()`, and checks the result against the asset
// contract of T0015 §1. It never edits, moves, or deletes the file: a broken candidate stays as
// evidence. It does not inject the `three` import: the contract requires it in the asset, so a
// candidate that omits it is `invalid: THREE is not defined`.

import { pathToFileURL } from "node:url";
import * as THREE from "three";

export type Validation = { ok: true } | { ok: false; reason: string };

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Validate one candidate file.
 *
 * The module must default-export a function. It is called once, without an
 * argument. The result must be a `THREE.Object3D`, must hold at least one mesh,
 * and must have a finite, positive size on all three axes.
 */
export async function validateAsset(path: string): Promise<Validation> {
	let module_: Record<string, unknown>;
	try {
		module_ = await import(pathToFileURL(path).href);
	} catch (error) {
		return { ok: false, reason: messageOf(error) };
	}

	const build = module_.default;
	if (typeof build !== "function") {
		return {
			ok: false,
			reason: "the module has no default export that is a function"
		};
	}

	let root: unknown;
	try {
		root = (build as () => unknown)();
	} catch (error) {
		return { ok: false, reason: messageOf(error) };
	}

	if ((root as { isObject3D?: boolean })?.isObject3D !== true) {
		return { ok: false, reason: "build() returned no Object3D" };
	}

	const object = root as THREE.Object3D;
	let meshes = 0;
	object.traverse((node) => {
		if ((node as THREE.Mesh).isMesh) meshes += 1;
	});
	if (meshes === 0) {
		return {
			ok: false,
			reason: "the asset has no mesh, so there is nothing to draw"
		};
	}

	const size = new THREE.Box3()
		.setFromObject(object)
		.getSize(new THREE.Vector3());
	if (
		![size.x, size.y, size.z].every(
			(value) => Number.isFinite(value) && value > 0
		)
	) {
		return {
			ok: false,
			reason: `the asset has no measurable size on all three axes: ${size.x} × ${size.y} × ${size.z} metres`
		};
	}

	return { ok: true };
}
