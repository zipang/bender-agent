// The camera rig: two cameras, two controls, seven named views, and the spin.
//
// The rig is tested without a browser. `OrbitControls` needs an element to listen on, not a real
// canvas: a fake element with the handful of members the library reads is enough, and the same fake
// proves the one field that makes `bottom` work. `flat.maxPolarAngle` is `Math.PI`, not `Math.PI/2`,
// because `update()` clamps the polar angle -- under `Math.PI/2` a camera below the target snaps up
// to the horizon, and the bottom view silently becomes a degenerate elevation.
//
// The flat views zoom from 10 % to 1000 %, and the free view's 100 % is `freeDistance`: the distance
// that puts the whole ground disc inside the smaller viewport dimension.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as THREE from "three";
import { createCameraRig, viewBasis } from "./camera.js";
import { frameFrom, freeDistance } from "./frame.js";
import { VIEWS } from "./views.js";

/** The frame of a one-metre cube, so the numbers below are the known ones. */
const FRAME = frameFrom({ size: [1, 1, 1], target: [0, 0.5, 0] });

/** The 100 % distance of the free view for the stubbed window, 800 x 600. */
const REFERENCE = freeDistance({
	groundRadius: FRAME.groundRadius,
	aspect: 800 / 600
});

/** The distance from `target` to the active camera. */
function radius(rig) {
	return rig.activeCamera.position.distanceTo(
		new THREE.Vector3(...FRAME.target)
	);
}

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
		// The flat zoom runs from 10 % to 1000 %, the same range as the free dolly.
		expect(rig.controls.minZoom).toBe(0.1);
		expect(rig.controls.maxZoom).toBe(10);
		expect(rig.flat.minZoom).toBe(0.1);
		expect(rig.flat.maxZoom).toBe(10);
		// The dolly follows the free distance, so both projections share one range.
		expect(rig.controls.minDistance).toBeCloseTo(REFERENCE / 10, 10);
		expect(rig.controls.maxDistance).toBeCloseTo(REFERENCE * 10, 10);
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

	test("starts on the free view at the disc distance", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		// 18.021 m for a 6.657 m disc on an 800 x 600 window: the whole disc fits the height. A7 made
		// the disc clear the corners of the grid, so the cube's disc grew from 5 m to 6.657 m and this
		// reference moved from 13.5359 m to 18.0213 m.
		expect(rig.state.distance).toBeCloseTo(REFERENCE, 10);
		expect(rig.state.distance).toBeCloseTo(18.021, 3);
	});

	test("places the free view at the distance that frames the disc", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		rig.placeCamera("free");

		expect(rig.state.perspective).toBe(true);
		expect(radius(rig)).toBeCloseTo(REFERENCE, 6);
		expect(rig.controls.minDistance).toBeCloseTo(REFERENCE / 10, 10);
		expect(rig.controls.maxDistance).toBeCloseTo(REFERENCE * 10, 10);
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
		// The orthographic camera stands on the named axis at the disc distance, which is inside the
		// 10 %-1000 % dolly range, so the library clamps nothing.
		expect(rig.ortho.position.x).toBeCloseTo(REFERENCE, 6);
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
			FRAME.target[1] - REFERENCE,
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

	test("derives the dolly range from the disc, at any scale", () => {
		const cube = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});
		// A 10 cm asset: its disc is 3.828 m (the two-metre grid floor, cleared at the corners), so its
		// free distance is smaller than the cube's, and the range follows it.
		const smallFrame = frameFrom({
			size: [0.1, 0.1, 0.1],
			target: [0, 0.05, 0]
		});
		const small = createCameraRig({
			views: VIEWS,
			frame: smallFrame,
			element: fakeCanvas()
		});
		const smallReference = freeDistance({
			groundRadius: smallFrame.groundRadius,
			aspect: 800 / 600
		});

		expect(cube.controls.minDistance).toBeCloseTo(REFERENCE / 10, 10);
		expect(cube.controls.maxDistance).toBeCloseTo(REFERENCE * 10, 10);
		expect(small.controls.minDistance).toBeCloseTo(smallReference / 10, 10);
		expect(small.controls.maxDistance).toBeCloseTo(smallReference * 10, 10);
		expect(
			small.controls.maxDistance / small.controls.minDistance
		).toBeCloseTo(100, 6);
	});

	test("reads the free view's zoom from the radius, in the same 10 %..1000 % range", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		rig.placeCamera("free");
		expect(rig.zoomPercent()).toBe(100);

		const offset = () => rig.camera.position.clone().sub(rig.state.target);
		// The direction is read BEFORE the position is overwritten: `offset()` after the copy is the
		// zero vector, and normalizing it leaves the camera on the target.
		const place = (radius) => {
			const direction = offset().normalize();
			rig.camera.position
				.copy(rig.state.target)
				.addScaledVector(direction, radius);
		};

		const reference = offset().length();

		// Half the reference radius: the zoom doubles. Twice it: the zoom halves.
		place(reference / 2);
		expect(rig.zoomPercent()).toBe(200);
		place(reference * 2);
		expect(rig.zoomPercent()).toBe(50);

		// Past both dolly limits: the row never leaves 10 %..1000 %.
		place(reference / 100);
		expect(rig.zoomPercent()).toBe(1000);
		place(reference * 100);
		expect(rig.zoomPercent()).toBe(10);
	});

	test("clamps the flat zoom to 10 % and 1000 %", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		// The zoom row reads the active projection, so the test has to be in one: a rig starts on
		// the free view, where the row is the dolly ratio.
		rig.placeCamera("left");

		expect(rig.setZoom(5)).toBeCloseTo(0.1, 10);
		expect(rig.zoomPercent()).toBe(10);
		expect(rig.setZoom(2000)).toBeCloseTo(10, 10);
		expect(rig.zoomPercent()).toBe(1000);
		expect(rig.setZoom(100)).toBeCloseTo(1, 10);
	});

	test("keeps the dolly ratio the user set across a resize", () => {
		const width = fakeWindow.innerWidth;
		const height = fakeWindow.innerHeight;
		try {
			// A portrait window: the disc distance is twice the landscape one.
			fakeWindow.innerWidth = 400;
			fakeWindow.innerHeight = 800;
			const rig = createCameraRig({
				views: VIEWS,
				frame: FRAME,
				element: fakeCanvas()
			});
			const portrait = freeDistance({
				groundRadius: FRAME.groundRadius,
				aspect: 0.5
			});

			// The user dollies halfway in.
			rig.state.distance = portrait / 2;
			expect(rig.state.distance / portrait).toBeCloseTo(0.5, 10);

			fakeWindow.innerWidth = 800;
			fakeWindow.innerHeight = 600;
			rig.resize();

			const landscape = freeDistance({
				groundRadius: FRAME.groundRadius,
				aspect: 4 / 3
			});
			expect(rig.state.distance).toBeCloseTo(landscape / 2, 10);
			expect(rig.state.distance / landscape).toBeCloseTo(0.5, 10);
			// The limits follow the new distance, so the dolly range stays 10 %-1000 %.
			expect(rig.controls.minDistance).toBeCloseTo(landscape / 20, 10);
			expect(rig.controls.maxDistance).toBeCloseTo(landscape * 5, 10);
		} finally {
			fakeWindow.innerWidth = width;
			fakeWindow.innerHeight = height;
		}
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
		const radiusFromTarget = 5;
		rig.camera.position.set(
			FRAME.target[0] +
				radiusFromTarget * Math.cos(elevation) * Math.cos(azimuth),
			FRAME.target[1] + radiusFromTarget * Math.sin(elevation),
			FRAME.target[2] +
				radiusFromTarget * Math.cos(elevation) * Math.sin(azimuth)
		);
		const before = rig.camera.position.clone();

		rig.spinStart();
		rig.spinStep(0);

		expect(rig.camera.position.distanceTo(before)).toBeLessThan(1e-6);
	});

	test("starts the spin from the current elevation and radius, not the preset", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});
		rig.placeCamera("free");

		// A hand orbit to another elevation AND a wheel dolly: neither touches the state, and the
		// preset elevation (30 deg) is not the one the camera is at.
		const azimuth = THREE.MathUtils.degToRad(200);
		const elevation = THREE.MathUtils.degToRad(64);
		const radiusFromTarget = FRAME.groundRadius * 0.7;
		rig.camera.position.set(
			FRAME.target[0] +
				radiusFromTarget * Math.cos(elevation) * Math.cos(azimuth),
			FRAME.target[1] + radiusFromTarget * Math.sin(elevation),
			FRAME.target[2] +
				radiusFromTarget * Math.cos(elevation) * Math.sin(azimuth)
		);
		const before = rig.camera.position.clone();

		rig.spinStart();
		rig.spinStep(0);

		expect(rig.camera.position.distanceTo(before)).toBeLessThan(1e-6);
		expect(rig.state.elevation).toBeCloseTo(64, 6);
		expect(rig.state.distance).toBeCloseTo(radiusFromTarget, 6);
	});

	test("does not inherit the pole up vector when the spin leaves a flat view", () => {
		for (const pole of ["top", "bottom"]) {
			const rig = createCameraRig({
				views: VIEWS,
				frame: FRAME,
				element: fakeCanvas()
			});
			rig.placeCamera(pole);

			// The preset is drawn with `up: [0, 0, -1]`: an orthographic camera at the pole cannot
			// use the world Y. The perspective camera must not keep it, or the ground lies on its
			// side and `OrbitControls` swaps the orbit axes once the spin stops.
			expect(rig.flat.object.up.toArray()).toEqual([0, 0, -1]);
			rig.spinStart();
			expect(rig.state.up).toEqual([0, 1, 0]);
			expect(rig.camera.up.toArray()).toEqual([0, 1, 0]);
			rig.spinStop();
			expect(rig.camera.up.toArray()).toEqual([0, 1, 0]);
		}
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

	test("turns the azimuth back on a tick without moving the target", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});
		// The page places the opening view before the user can press `spin`; without it the camera is
		// still at the origin and the read-back would carry no useful azimuth.
		rig.placeCamera("free");

		rig.spinStart();
		const before = rig.state.azimuth;
		rig.spinStep(3_000);

		// Counter-clockwise: 30° per second is subtracted, and the free view starts at 60°.
		expect(rig.state.azimuth).toBeCloseTo((before - 90 + 360) % 360, 6);
		expect(rig.state.azimuth).toBeCloseTo(330, 6);
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

describe("the depth range", () => {
	// A 96 m asset: a 288 m grid, a 204.147 m disc and a free distance of 1105.32 m on the stubbed
	// window. A fixed `far = 200` clips the whole stage, and it clips it in BOTH projections: the flat
	// camera stands at `state.distance` on its own axis with the same 200 m frustum.
	const BIG = frameFrom({ size: [96, 96, 96], target: [0, 48, 0] });

	/**
	 * The perspective `far` the contract states: ten references, because
	 * `maxDistance` is `state.distance * 10`, plus two disc radii for the far
	 * side of the disc.
	 */
	const farBound = (rig, frame) =>
		Math.max(200, rig.state.distance * 10 + frame.groundRadius * 2);

	test("keeps the near plane and the 200 m floor on a stage that fits inside them", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: FRAME,
			element: fakeCanvas()
		});

		expect(rig.camera.near).toBe(0.1);
		expect(rig.camera.far).toBeGreaterThanOrEqual(200);
		expect(rig.camera.far).toBe(200);
	});

	test("puts the farthest dolly of the free view inside the perspective frustum", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: BIG,
			element: fakeCanvas()
		});

		expect(rig.state.distance).toBeGreaterThan(200);
		// `maxDistance` is ten references away: a 3 x far plane would clip the subject a user
		// dollied out to.
		expect(rig.camera.far).toBeGreaterThanOrEqual(
			rig.state.distance * 10 + BIG.groundRadius
		);
		expect(rig.camera.far).toBeCloseTo(farBound(rig, BIG), 6);
	});

	test("brackets the disc in the flat frustum", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: BIG,
			element: fakeCanvas()
		});

		rig.placeCamera("left");

		// The flat camera sits at `state.distance` and its wheel changes `ortho.zoom`, never its
		// position, so its depth range must bracket the target and the whole disc around it.
		expect(rig.ortho.far).toBeGreaterThan(
			rig.state.distance + BIG.groundRadius
		);
		expect(rig.ortho.near).toBeLessThan(
			rig.state.distance - BIG.groundRadius
		);
		expect(rig.ortho.near).toBeCloseTo(rig.state.distance / 10, 6);
		expect(rig.ortho.far).toBeCloseTo(
			rig.state.distance + BIG.groundRadius * 2,
			6
		);
	});

	test("is rewritten wherever the distance changes", () => {
		const rig = createCameraRig({
			views: VIEWS,
			frame: BIG,
			element: fakeCanvas()
		});
		const width = fakeWindow.innerWidth;
		const height = fakeWindow.innerHeight;

		try {
			rig.placeCamera("free");
			expect(rig.camera.far).toBeCloseTo(farBound(rig, BIG), 6);
			expect(rig.ortho.far).toBeCloseTo(
				rig.state.distance + BIG.groundRadius * 2,
				6
			);

			// A portrait window doubles the free distance, and both ranges have to grow with it.
			fakeWindow.innerWidth = 400;
			fakeWindow.innerHeight = 800;
			rig.resize();
			expect(rig.camera.far).toBeCloseTo(farBound(rig, BIG), 6);
			expect(rig.ortho.near).toBeCloseTo(rig.state.distance / 10, 6);
			expect(rig.ortho.far).toBeCloseTo(
				rig.state.distance + BIG.groundRadius * 2,
				6
			);
		} finally {
			fakeWindow.innerWidth = width;
			fakeWindow.innerHeight = height;
		}

		rig.reset();
		expect(rig.camera.far).toBeCloseTo(farBound(rig, BIG), 6);
		expect(rig.ortho.far).toBeCloseTo(
			rig.state.distance + BIG.groundRadius * 2,
			6
		);
	});
});
