// The camera rig: two cameras, two controls, seven named views, and the spin.
//
// The rig is tested without a browser. `OrbitControls` needs an element to listen on, not a real
// canvas: a fake element with the handful of members the library reads is enough, and the same fake
// proves the one field that makes `bottom` work. `flat.maxPolarAngle` is `Math.PI`, not `Math.PI/2`,
// because `update()` clamps the polar angle -- under `Math.PI/2` a camera below the target snaps up
// to the horizon, and the bottom view silently becomes a degenerate elevation.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as THREE from "three";
import { createCameraRig, viewBasis } from "./camera.js";
import { frameFrom } from "./frame.js";
import { VIEWS } from "./views.js";

/** The frame of a one-metre cube, so the numbers below are the known ones. */
const FRAME = frameFrom({ size: [1, 1, 1], target: [0, 0.5, 0] });

/**
 * The members `OrbitControls` touches on the element it listens on. A real
 * canvas adds a rendering context, which none of these tests need.
 */
function fakeCanvas() {
	const listeners = new Map();
	return {
		style: { removeProperty() {} },
		clientWidth: 800,
		clientHeight: 600,
		ownerDocument: {
			addEventListener() {},
			removeEventListener() {}
		},
		addEventListener(type, handler) {
			listeners.set(type, handler);
		},
		removeEventListener(type) {
			listeners.delete(type);
		},
		getBoundingClientRect() {
			return { left: 0, top: 0, width: 800, height: 600 };
		},
		setPointerCapture() {},
		releasePointerCapture() {},
		listeners
	};
}

/** A stub `window`: the rig reads the viewport, never the document. */
const fakeWindow = {
	innerWidth: 800,
	innerHeight: 600,
	devicePixelRatio: 1,
	addEventListener() {},
	removeEventListener() {}
};

let savedWindow;

beforeAll(() => {
	savedWindow = globalThis.window;
	globalThis.window = fakeWindow;
});

afterAll(() => {
	globalThis.window = savedWindow;
});

/** Round a vector for a readable assertion. */
function rounded(vector) {
	// `+ 0` folds `-0` into `0`: the two are equal, and a strict deep equal can say otherwise.
	return vector.toArray().map((value) => Number(value.toFixed(6)) + 0);
}

describe("viewBasis", () => {
	test("puts the left eye on +X, with the screen up on +Y", () => {
		const basis = viewBasis(VIEWS, "left");

		expect(rounded(basis.dir)).toEqual([1, 0, 0]);
		expect(rounded(basis.right)).toEqual([0, 0, -1]);
		expect(rounded(basis.up)).toEqual([0, 1, 0]);
	});

	test("puts the front eye on +Z, because the asset faces +Z", () => {
		const basis = viewBasis(VIEWS, "front");

		expect(rounded(basis.dir)).toEqual([0, 0, 1]);
		expect(rounded(basis.right)).toEqual([1, 0, 0]);
		expect(rounded(basis.up)).toEqual([0, 1, 0]);
	});

	test("turns the screen up toward -Z on the top view", () => {
		const basis = viewBasis(VIEWS, "top");

		expect(basis.dir.y).toBeCloseTo(1, 4);
		// At 89.99° the basis is 0.0002 rad off the axis, so the components are close, not exact.
		expect(basis.right.x).toBeCloseTo(1, 4);
		expect(basis.right.y).toBeCloseTo(0, 4);
		expect(basis.up.z).toBeCloseTo(-1, 4);
		expect(basis.up.y).toBeCloseTo(0, 3);
	});

	test("throws on a view that is not in the table", () => {
		expect(() => viewBasis(VIEWS, "isometric")).toThrow(
			'viewBasis: no view named "isometric"'
		);
	});
});

describe("createCameraRig", () => {
	test("configures the two controls from one table, with the two flat differences", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		expect(rig.controls.enableDamping).toBe(true);
		expect(rig.controls.dampingFactor).toBe(0.08);
		expect(rig.controls.zoomToCursor).toBe(true);
		expect(rig.controls.screenSpacePanning).toBe(true);
		expect(rig.controls.minZoom).toBe(1);
		expect(rig.controls.maxZoom).toBe(10);
		// Derived from the frame, not fixed: the reference's 3 / 24 is the same 8× ratio at its own
		// 2.982 m. The assertion on a 10 cm asset is in the next test.
		expect(rig.controls.minDistance).toBeCloseTo(FRAME.distance, 10);
		expect(rig.controls.maxDistance).toBeCloseTo(FRAME.distance * 8, 10);
		expect(rig.controls.mouseButtons).toEqual({
			LEFT: THREE.MOUSE.PAN,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: null
		});

		expect(rig.controls.enableRotate).toBe(true);
		expect(rig.flat.enableRotate).toBe(false);
		expect(rig.controls.maxPolarAngle).toBe(Math.PI / 2);
		expect(rig.flat.maxPolarAngle).toBe(Math.PI);
	});

	test("places a named view at 100 % and centred on the frame target", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		rig.placeCamera("left");

		expect(rig.state.perspective).toBe(false);
		expect(rig.zoomPercent()).toBe(100);
		expect(rounded(rig.state.target)).toEqual([0, 0.5, 0]);
		// The frame distance is 2.982 m for a 1 m asset, and `minDistance` is the same 2.982, so the
		// library clamps nothing. The camera is on the named axis, at the near end of its range.
		expect(rig.ortho.position.x).toBeCloseTo(FRAME.distance, 6);
		expect(rig.ortho.position.y).toBeCloseTo(0.5, 3);
		expect(rig.ortho.position.z).toBeCloseTo(0, 6);
	});

	test("keeps a bottom camera below the frame target", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		rig.placeCamera("bottom");

		// Under `flat.maxPolarAngle = Math.PI / 2`, `OrbitControls.update()` clamps this camera up to
		// the target (`y = 0.5`). The assertion is the reason for the wider clamp.
		expect(rig.ortho.position.y).toBeLessThan(FRAME.target[1]);
		expect(rig.ortho.position.y).toBeCloseTo(
			FRAME.target[1] - FRAME.distance,
			6
		);
	});

	test("throws on a view that is not in the table", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		expect(() => rig.placeCamera("isometric")).toThrow(
			'placeCamera: no view named "isometric"'
		);
	});

	test("derives the distance limits from the frame, at any scale", () => {
		const cube = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});
		// A 10 cm asset: the frame is ten times smaller, and the limits follow it.
		const smallFrame = frameFrom({
			size: [0.1, 0.1, 0.1],
			target: [0, 0.05, 0]
		});
		const small = createCameraRig({
			views: VIEWS,
			frame: smallFrame,
			element: fakeCanvas()
		});

		expect(cube.controls.minDistance).toBeCloseTo(FRAME.distance, 10);
		expect(cube.controls.maxDistance).toBeCloseTo(FRAME.distance * 8, 10);
		expect(small.controls.minDistance).toBeCloseTo(0.2982, 6);
		expect(small.controls.maxDistance).toBeCloseTo(2.3856, 6);
		expect(
			small.controls.maxDistance / small.controls.minDistance
		).toBeCloseTo(8, 6);
	});

	test("reads a manual camera back before it starts the spin", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});
		rig.placeCamera("free");

		// A hand orbit that changes the azimuth and the distance, at the preset elevation. Without
		// the read-back, `spinStart()` keeps the preset azimuth and the frame distance, and the first
		// `spinStep(0)` snaps the camera back to the preset.
		const azimuth = THREE.MathUtils.degToRad(110);
		const elevation = THREE.MathUtils.degToRad(VIEWS.free.elevation);
		const radius = 5;
		rig.camera.position.set(
			FRAME.target[0] + radius * Math.cos(elevation) * Math.cos(azimuth),
			FRAME.target[1] + radius * Math.sin(elevation),
			FRAME.target[2] + radius * Math.cos(elevation) * Math.sin(azimuth)
		);
		const before = rig.camera.position.clone();

		rig.spinStart();
		rig.spinStep(0);

		expect(rig.camera.position.distanceTo(before)).toBeLessThan(1e-6);
	});

	test("switches to the free view when the spin starts on an orthographic one", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});
		rig.placeCamera("left");

		rig.spinStart();

		expect(rig.state.perspective).toBe(true);
		expect(rig.controls.enabled).toBe(false);
		expect(rig.flat.enabled).toBe(false);
	});

	test("advances the azimuth on a tick without moving the target", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		rig.spinStart();
		const before = rig.state.azimuth;
		rig.spinStep(3_000);

		expect(rig.state.azimuth).toBeCloseTo((before + 90) % 360, 6);
		expect(rounded(rig.state.target)).toEqual([0, 0.5, 0]);
	});

	test("re-enables the current projection and copies the target back on stop", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		rig.spinStart();
		rig.spinStep(1_000);
		rig.spinStop();

		expect(rig.controls.enabled).toBe(true);
		expect(rig.flat.enabled).toBe(false);
		expect(rounded(rig.controls.target)).toEqual([0, 0.5, 0]);
	});
});
