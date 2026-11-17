// The camera rig: two cameras, two controls, seven named views, and the spin.
//
// Why two cameras. A flat view is a projection: parallel edges must stay parallel, so an orthographic
// camera is the only camera that can show a silhouette. The free view shows a mass, and a mass needs
// perspective. Both read the same `state`, so a preset and a hand-moved camera cannot disagree about
// what the page shows.
//
// Why two controls. `OrbitControls` takes its camera in the constructor and the documentation names
// no supported way to re-target it, so one instance per camera is the only supported shape. Both
// listen on the same canvas, and `enabled` is the switch: exactly one is enabled at a time, and
// `applyCamera()` does the swap. This is what gives the flat views the same wheel, the same drags,
// the same inertia and the same zoom-to-cursor as the free view, because it is the same library
// doing it. No wheel listener, no zoom clamp and no pan vector is written here.
//
// The rig knows nothing about the DOM beyond the element `OrbitControls` listens on, and nothing
// about the asset beyond the frame the caller passes in.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STAGE_RULES, freeDistance } from "./frame.js";
import { nextAzimuth } from "./spin.js";

/**
 * The screen basis of a named view, without a camera: `right` is what the
 * frame's +x maps to in the world, `up` its +y, `dir` points from the asset
 * toward the camera.
 */
export function viewBasis(views, name) {
	const view = views[name];
	if (!view) throw new Error(`viewBasis: no view named "${name}"`);
	const az = THREE.MathUtils.degToRad(view.azimuth);
	const el = THREE.MathUtils.degToRad(view.elevation);
	const dir = new THREE.Vector3(
		Math.cos(el) * Math.cos(az),
		Math.sin(el),
		Math.cos(el) * Math.sin(az)
	).normalize();
	const up = new THREE.Vector3(...(view.up ?? [0, 1, 0])).normalize();
	const right = new THREE.Vector3().crossVectors(up, dir).normalize();
	const trueUp = new THREE.Vector3().crossVectors(dir, right).normalize();
	return { right, up: trueUp, dir };
}

// One frozen table configures BOTH instances, so parity is a property of the table and not of what
// each projection happens to read. A pair the projection ignores is still written: the orthographic
// limits are inert on the perspective instance and the reverse, and one object stays one object. The
// distance range is the one pair that is NOT in this table: it follows the free distance, and
// `syncDistanceLimits` writes it to both instances whenever that distance changes.
//
// A left drag moves the view on both families. The middle keeps the library default, the dolly. The
// right button is bound to no action: `null` matches no case in `OrbitControls`' own switch, so a
// right press leaves the state at NONE and the button stays free for the context menu.
//
// The behaviour below that is NOT in the documentation: `OrbitControls` swaps the ROTATE and PAN
// actions when `ctrlKey`, `metaKey` or `shiftKey` is held, in `onMouseDown`. So `LEFT: PAN` with
// `enableRotate: true` gives the free view a Shift-held orbit, and `LEFT: PAN` with
// `enableRotate: false` leaves a flat view with no camera rotation at all. Pinned to r187.
const SHARED = {
	enableDamping: true,
	dampingFactor: 0.08,
	enableZoom: true,
	enablePan: true,
	zoomSpeed: 1,
	panSpeed: 1,
	rotateSpeed: 1,
	zoomToCursor: true,
	screenSpacePanning: true,
	minZoom: 0.1,
	maxZoom: 10, // orthographic only: the 10 % floor, the 1000 % cap
	maxPolarAngle: Math.PI / 2,
	mouseButtons: {
		LEFT: THREE.MOUSE.PAN,
		MIDDLE: THREE.MOUSE.DOLLY,
		RIGHT: null
	}
};

function configure(controls) {
	for (const [key, value] of Object.entries(SHARED)) {
		// `mouseButtons` and `touches` are objects: each instance gets its own copy, so no later
		// mutation of one can reach the other.
		controls[key] =
			value && typeof value === "object" ? { ...value } : value;
	}
}

/**
 * @param {object} options
 * @param {Record<string, any>} options.views The fixed view table of `views.js`
 * @param {object} options.frame From `frame.js`: orthoHeight, groundRadius,
 *   target
 * @param {HTMLElement} options.element The canvas, for `OrbitControls`
 * @param {() => void} [options.onManual] Called when the user orbits by hand
 */
export function createCameraRig({ views, frame, element, onManual }) {
	const aspect = () => window.innerWidth / window.innerHeight;
	// The 100 % of the perspective camera: the distance that fits the whole ground disc in the
	// smaller viewport dimension. The orthographic 100 % is `frame.orthoHeight` instead.
	const referenceDistance = () =>
		freeDistance({ groundRadius: frame.groundRadius, aspect: aspect() });

	const camera = new THREE.PerspectiveCamera(
		STAGE_RULES.fov,
		aspect(),
		0.1,
		200
	);
	const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 200);
	ortho.up.set(0, 1, 0);

	// The reference the user's dolly is measured against. `resize` scales `state.distance` by the
	// ratio of the two references, so a window resize never undoes a dolly.
	let lastReference = referenceDistance();

	// One state drives both cameras. A named view is a preset written into it. `zoom` is a MIRROR of
	// `ortho.zoom` -- the field `OrbitControls` writes -- so the rest of the page reads one number
	// and there is no second source to disagree.
	const state = {
		azimuth: 60,
		elevation: 30,
		distance: lastReference,
		target: new THREE.Vector3(...frame.target),
		perspective: true,
		orthoHeight: frame.orthoHeight,
		zoom: 1,
		fov: STAGE_RULES.fov,
		up: [0, 1, 0]
	};

	let activeCamera = camera;

	const orbit = new OrbitControls(camera, element);
	const flat = new OrbitControls(ortho, element);
	configure(orbit);
	configure(flat);

	// The distance range follows the free distance: 10 % to 1000 %, the same range as the flat zoom.
	// Both instances get both numbers, so the pair stays one pair, and `resize` keeps it in step with
	// the window.
	function syncDistanceLimits() {
		orbit.minDistance = state.distance / 10;
		orbit.maxDistance = state.distance * 10;
		flat.minDistance = orbit.minDistance;
		flat.maxDistance = orbit.maxDistance;
	}

	// Depth ranges. The stage scales with the asset, so a fixed `far = 200` clips the ground of a
	// large subject, in BOTH projections. The perspective camera keeps a fixed near plane -- the
	// closest dolly is `state.distance / 10`, and a perspective near plane clips only what is in
	// front of the camera -- and its `far` covers the FARTHEST dolly, not the 100 % framing:
	// `maxDistance` is ten references away, so a 3 x plane clips a subject the user dollied out to.
	// The flat camera sits at `state.distance` and never moves along its axis: its wheel changes
	// `ortho.zoom`, not the position. Its depth range therefore brackets the target and the disc
	// around it, and 200 m is the floor the small stages were tuned with.
	function syncClipping() {
		camera.near = 0.1;
		camera.far = Math.max(
			200,
			state.distance * 10 + frame.groundRadius * 2
		);
		camera.updateProjectionMatrix();

		ortho.near = Math.max(0.01, state.distance / 10);
		ortho.far = state.distance + frame.groundRadius * 2;
		ortho.updateProjectionMatrix();
	}
	syncDistanceLimits();
	syncClipping();
	// The first documented difference: a free view orbits, a flat view never does. This one field
	// turns `Shift` + left drag into the orbit the plain left drag gave up, and makes the same
	// gesture a no-op on `flat`, where a flat view only zooms and pans.
	orbit.enableRotate = true;
	flat.enableRotate = false;
	// The second difference, and it is load-bearing: `OrbitControls.update()` clamps the polar angle.
	// A `bottom` preset sits at -89.99°, below the target, and under the shared `π/2` it snaps up to
	// the horizon -- measured on r187, a camera at `y = -2` with a target at `y = 0.5` moves to
	// `y = 0.5, z = 2.5`. With `π` it stays at `y = -2`. The flat controls never rotate, so the
	// wider clamp is unreachable by a gesture.
	orbit.maxPolarAngle = Math.PI / 2;
	flat.maxPolarAngle = Math.PI;
	// The stylesheet owns the cursor: `body.pan-ready` and `body.pan-dragging` decide it. But
	// `OrbitControls` writes an inline `cursor: auto` on its element when it connects, and an inline
	// style beats a stylesheet rule. Remove it once, so the page's own rules are the only source.
	element.style.removeProperty("cursor");
	// Any manual orbit invalidates the view name: the page is no longer showing `left`, it is
	// showing wherever the user dragged it. A pan and a zoom are not a manual orbit, so only `orbit`
	// is wired: `flat` never rotates, and neither `setZoom` nor `panBy` reaches this listener.
	orbit.addEventListener("start", () => onManual?.());
	orbit.enabled = false; // enabled only on the free view
	flat.enabled = true;

	// The mirror. `OrbitControls` writes `ortho.zoom` and moves `flat.target`; both are read here, so
	// the HUD sees the wheel and the pan as they happen.
	flat.addEventListener("change", () => {
		state.zoom = ortho.zoom;
		state.target.copy(flat.target);
	});

	// The documented `change` event of the ACTIVE instance is the signal that the camera moved, and
	// it fires again on every frame while `enableDamping` decays the inertia. One subscription here
	// follows the flat/perspective swap in `applyCamera()`, so the page's loop wakes on the active
	// camera's motion and never on the disabled instance's.
	const changeListeners = new Set();
	let changeTarget = orbit;
	const emitChange = () => {
		for (const listener of changeListeners) listener();
	};
	changeTarget.addEventListener("change", emitChange);

	function rebindChange() {
		const next = state.perspective ? orbit : flat;
		if (next === changeTarget) return;
		changeTarget.removeEventListener("change", emitChange);
		changeTarget = next;
		changeTarget.addEventListener("change", emitChange);
	}

	/**
	 * Subscribe to the active instance's `change` event. Returns an unsubscribe
	 * function.
	 */
	function onChange(listener) {
		changeListeners.add(listener);
		return () => changeListeners.delete(listener);
	}

	/**
	 * The camera position a state describes: `state.target` plus the spherical
	 * offset.
	 */
	function positionFromState() {
		const az = THREE.MathUtils.degToRad(state.azimuth);
		const el = THREE.MathUtils.degToRad(state.elevation);
		const t = state.target;
		return new THREE.Vector3(
			t.x + state.distance * Math.cos(el) * Math.cos(az),
			t.y + state.distance * Math.sin(el),
			t.z + state.distance * Math.cos(el) * Math.sin(az)
		);
	}

	function frameOrtho() {
		const h = state.orthoHeight;
		const a = window.innerWidth / window.innerHeight;
		ortho.left = (-h * a) / 2;
		ortho.right = (h * a) / 2;
		ortho.top = h / 2;
		ortho.bottom = -h / 2;
		// `ortho.zoom` is `OrbitControls`' field now and is NOT divided here: the frustum is the
		// 100 % frame, and the zoom is applied on top of it by the projection matrix.
		ortho.updateProjectionMatrix();
	}

	/**
	 * Drop the inertia the library is still carrying, so a framing that follows
	 * a gesture is the frame and not the frame plus the leftover of the drag.
	 * `enableDamping` is the documented switch ("Set to `true` to enable
	 * damping (inertia)"); with it off, one `update()` applies the whole
	 * remaining pan offset and the library zeroes it, then damping is restored.
	 * There is no documented way to clear `_panOffset` directly, and this uses
	 * only the public surface.
	 */
	function clearInertia(controls) {
		if (!controls.enableDamping) return;
		controls.enableDamping = false;
		controls.update();
		controls.enableDamping = true;
	}

	function applyCamera() {
		const position = positionFromState();

		activeCamera = state.perspective ? camera : ortho;
		// The active instance changed: the `change` listener moves with it, so the loop follows the
		// camera that can actually move.
		rebindChange();
		activeCamera.up.set(...state.up);
		activeCamera.position.copy(position);
		activeCamera.lookAt(state.target);

		if (state.perspective) {
			camera.fov = state.fov;
			camera.updateProjectionMatrix();
		} else {
			frameOrtho();
		}

		orbit.enabled = Boolean(state.perspective);
		flat.enabled = !state.perspective;
		if (state.perspective) {
			clearInertia(orbit);
			orbit.target.copy(state.target);
			orbit.update();
		} else {
			clearInertia(flat);
			flat.target.copy(state.target);
			flat.update();
		}
		return activeCamera;
	}

	function placeCamera(name) {
		const view = views[name];
		if (!view) throw new Error(`placeCamera: no view named "${name}"`);
		// A named view is the canonical frame: 100 %, centred on `frame.target`. Resetting first
		// keeps the view reproducible whatever the pointer did before.
		resetFraming();
		// The distance of a named view is the free distance for the current window: the perspective
		// camera frames the disc with it, and the orthographic camera uses it as a safe standoff on
		// its own axis.
		lastReference = referenceDistance();
		state.distance = lastReference;
		syncDistanceLimits();
		syncClipping();
		Object.assign(state, {
			azimuth: view.azimuth,
			elevation: view.elevation,
			perspective: Boolean(view.perspective),
			up: view.up ?? [0, 1, 0]
		});
		applyCamera();
	}

	// ------------------------------------------------------------------ zoom and pan

	/**
	 * The zoom as an integer percentage, 10..1000, in BOTH projections.
	 *
	 * The flat view reads its own `ortho.zoom`. The free view has no zoom
	 * factor, so it reads the ratio of the reference distance to the radius the
	 * camera actually sits at: 100 % is the 100 % framing, and the dolly limits
	 * (`state.distance / 10`, `state.distance * 10`) are the same 10 %..1000 %
	 * the flat view allows. The clamp guards the rounding at both ends and a
	 * gesture the library applied past a limit that was just rewritten.
	 */
	function zoomPercent() {
		if (!state.perspective) return Math.round(ortho.zoom * 100);
		const radius = camera.position.distanceTo(orbit.target);
		if (!Number.isFinite(radius) || radius <= 0) return 100;
		const percent = (state.distance / radius) * 100;
		return Math.round(Math.min(1000, Math.max(10, percent)));
	}

	/**
	 * Set the zoom, clamped to the documented range through the instance's own
	 * limits. The float is clamped in percent space and divided by 100, so a
	 * programmatic call cannot leave `[minZoom, maxZoom]`. Cursor anchoring is
	 * not here: it belongs to the wheel, and `zoomToCursor` provides it.
	 */
	function setZoom(percent) {
		const raw = Number(percent);
		const value = Number.isFinite(raw) ? raw : 100;
		ortho.zoom =
			Math.min(flat.maxZoom * 100, Math.max(flat.minZoom * 100, value)) /
			100;
		ortho.updateProjectionMatrix();
		flat.update();
		state.zoom = ortho.zoom;
		return state.zoom;
	}

	/**
	 * Move the flat view by a pixel offset. `OrbitControls.pan(deltaX, deltaY)`
	 * is the only pan implementation; this is a rename with the sign convention
	 * of a drag already handled by the library.
	 */
	function panBy(dxPx, dyPx) {
		flat.pan(dxPx, dyPx);
		flat.update();
		return { target: flat.target.toArray(), percent: zoomPercent() };
	}

	/** Restore the 100 % frame: zoom 1, the frame height and the frame target. */
	function resetFraming() {
		clearInertia(flat);
		state.orthoHeight = frame.orthoHeight;
		state.target.set(...frame.target);
		ortho.zoom = 1;
		flat.target.copy(state.target);
		frameOrtho();
		flat.update();
		state.zoom = ortho.zoom;
	}

	function reset() {
		state.up = [0, 1, 0];
		state.fov = STAGE_RULES.fov;
		lastReference = referenceDistance();
		state.distance = lastReference;
		syncDistanceLimits();
		syncClipping();
		resetFraming();
	}

	function resize() {
		// The reference of the new window. `state.distance` is scaled by the ratio of the two
		// references, so the dolly the user set survives the resize; starting the distance from the
		// new reference would undo it.
		const nextReference = referenceDistance();
		state.distance *= nextReference / lastReference;
		lastReference = nextReference;
		syncDistanceLimits();
		camera.aspect = aspect();
		// Both depth ranges follow the new distance, and `syncClipping` updates the two
		// projection matrices.
		syncClipping();
		frameOrtho();
	}

	// ------------------------------------------------------------------ spin

	/**
	 * Take the camera off the controls and start the spin. A flat view has no
	 * azimuth a hand can turn, so an orthographic current view switches to the
	 * free view first: the alternative is a spin that does nothing, which reads
	 * as a broken button.
	 */
	function spinStart() {
		// The spin starts exactly where the camera is, in either projection: the azimuth, the
		// elevation and the radius are read from the ACTIVE camera before anything moves. A manual
		// orbit or a wheel dolly moved the camera without touching the state, so without this read
		// the first `spinStep` snaps it back to the last preset -- sideways and vertically, and at
		// the preset distance -- and the spin jumps on its first frame.
		const offset = activeCamera.position.clone().sub(state.target);
		const radius = offset.length();
		if (radius > 0) {
			state.azimuth = THREE.MathUtils.radToDeg(
				Math.atan2(offset.z, offset.x)
			);
			state.elevation = THREE.MathUtils.radToDeg(
				Math.asin(THREE.MathUtils.clamp(offset.y / radius, -1, 1))
			);
			state.distance = radius;
		}
		// A flat view cannot orbit. The spin keeps its direction and its standoff and takes the
		// projection that turns around the vertical axis of the target; `applyCamera()` is the one
		// place that swaps the active camera and rebinds the change listener.
		if (!state.perspective) {
			state.perspective = true;
			// The two pole presets carry `up: [0, 0, -1]`, because an orthographic camera looking
			// straight down cannot use the world Y as its up. A perspective camera must not inherit
			// it: `OrbitControls` builds its spherical from `camera.up`, so the rolled vector turns
			// the grid on its side and swaps the orbit axes the moment the spin stops. The free view
			// is upright by definition.
			state.up = [0, 1, 0];
			applyCamera();
		}
		clearInertia(orbit);
		// Both instances: the wheel is inert during a spin, and the press that stops the spin
		// re-enables them before `OrbitControls` sees the same gesture.
		orbit.enabled = false;
		flat.enabled = false;
	}

	/**
	 * Advance the azimuth and place the perspective camera from the state.
	 * `OrbitControls.update()` is deliberately not called: the library would
	 * read the camera it last saw and undo the step.
	 */
	function spinStep(dtMs) {
		state.azimuth = nextAzimuth(state.azimuth, dtMs);
		state.perspective = true;
		activeCamera = camera;
		camera.up.set(...state.up);
		camera.position.copy(positionFromState());
		camera.lookAt(state.target);
		return state.azimuth;
	}

	/**
	 * Give the camera back to the controls where it stopped. `orbit.target` is
	 * copied from the state and `update()` runs once, so the next drag starts
	 * from the spun position rather than unwinding to where the spin began.
	 */
	function spinStop() {
		orbit.enabled = state.perspective;
		flat.enabled = !state.perspective;
		orbit.target.copy(state.target);
		orbit.update();
	}

	return {
		camera,
		ortho,
		state,
		controls: orbit,
		flat,
		frameOrtho,
		applyCamera,
		placeCamera,
		onChange,
		zoomPercent,
		setZoom,
		panBy,
		resetFraming,
		reset,
		resize,
		spinStart,
		spinStep,
		spinStop,
		get activeCamera() {
			return activeCamera;
		},
		get activeControls() {
			return state.perspective ? orbit : flat;
		}
	};
}
