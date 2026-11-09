// The camera rig: two cameras, two controls, and the named views.
//
// Why two cameras. The reference sheets are orthographic elevations, so a perspective picture can
// never line up with one. Every flat view therefore uses an orthographic camera; the three-quarter
// views use a perspective one. Both read the same `state`, so a preset and a manual camera cannot
// disagree about what the page shows.
//
// Why two controls. `OrbitControls` takes its camera in the constructor and the documentation names
// no supported way to re-target it, so one instance per camera is the only supported shape. Both
// listen on the same canvas, and `enabled` -- "Whether the controls responds to user input or not" --
// is the switch: exactly one is enabled at a time, and `applyCamera()` does the swap. This is what
// gives the flat views the same wheel, the same drags, the same inertia and the same zoom-to-cursor
// as the free ones, because it is the same library doing it.
//
// The rig knows nothing about the DOM beyond the element OrbitControls listens on, and nothing
// about the subject beyond the frame the caller passes in.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * The screen basis of a named view, without a camera: `right` is what the frame's +x maps to in the
 * world, `up` its +y, `dir` points from the subject toward the camera.
 */
export function viewBasis(views, name) {
  const view = views[name];
  if (!view) throw new Error(`viewBasis: no view named "${name}"`);
  const az = THREE.MathUtils.degToRad(view.azimuth);
  const el = THREE.MathUtils.degToRad(view.elevation);
  const dir = new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az),
  ).normalize();
  const up = new THREE.Vector3(...(view.up ?? [0, 1, 0])).normalize();
  const right = new THREE.Vector3().crossVectors(up, dir).normalize();
  const trueUp = new THREE.Vector3().crossVectors(dir, right).normalize();
  return { right, up: trueUp, dir };
}

// One frozen table configures BOTH instances, so parity is a property of the table and not of what
// each projection happens to read. A pair the projection ignores is still written: the orthographic
// limits are inert on the perspective instance and the reverse, and one object stays one object.
//
// A left drag moves the view on both families. The middle keeps the library default, the dolly. The
// right button is bound to no action: `null` matches no case in `OrbitControls`' own switch, so a
// right press leaves the state at NONE and the button stays free for the context menu.
//
// The one behaviour below that is NOT in the documentation: `OrbitControls` swaps the ROTATE and
// PAN actions when `ctrlKey`, `metaKey` or `shiftKey` is held, in `onMouseDown`. So `LEFT: PAN` with
// `enableRotate: true` gives a free view a Shift-held orbit, and `LEFT: PAN` with
// `enableRotate: false` leaves a flat view with no camera rotation at all. Pinned to r187;
// `tools/check_zoom.ts` asserts the swap so a version bump fails loudly.
const SHARED = {
  enableDamping: true,   dampingFactor: 0.08,
  enableZoom: true,      enablePan: true,
  zoomSpeed: 1,          panSpeed: 1,           rotateSpeed: 1,
  zoomToCursor: true,
  screenSpacePanning: true,
  minZoom: 1,            maxZoom: 10,           // orthographic only: the 100 % floor, the 1000 % cap
  minDistance: 3,        maxDistance: 24,       // perspective only
  maxPolarAngle: Math.PI / 2,
  mouseButtons: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null },
};

function configure(controls) {
  for (const [key, value] of Object.entries(SHARED)) {
    // `mouseButtons` and `touches` are objects: each instance gets its own copy, so no later
    // mutation of one can reach the other.
    controls[key] = value && typeof value === "object" ? { ...value } : value;
  }
}

/**
 * @param {object} options
 * @param {Record<string, any>} options.views      the view table, `viewer/views.json` -> `views`
 * @param {object} options.frame                   from `frame.js`: distance, orthoHeight, target
 * @param {HTMLElement} options.element            the canvas, for OrbitControls
 * @param {() => void} [options.onManual]          called when the user orbits by hand
 */
export function createCameraRig({ views, frame, element, onManual }) {
  const aspect = () => window.innerWidth / window.innerHeight;

  const camera = new THREE.PerspectiveCamera(26, aspect(), 0.1, 200);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 200);
  ortho.up.set(0, 1, 0);

  // One state drives both cameras. A named view is a preset written into it. `zoom` is a MIRROR of
  // `ortho.zoom` -- the field OrbitControls writes -- so the rest of the page reads one number and
  // there is no second source to disagree.
  const state = {
    azimuth: 60,
    elevation: 30,
    distance: frame.distance,
    target: new THREE.Vector3(...frame.target),
    perspective: true,
    orthoHeight: frame.orthoHeight,
    zoom: 1,
    fov: 26,
    up: [0, 1, 0],
  };

  let activeCamera = camera;

  const orbit = new OrbitControls(camera, element);
  const flat = new OrbitControls(ortho, element);
  configure(orbit);
  configure(flat);
  // The single documented difference: a free view orbits, a flat view never does. This one field
  // turns `Shift` + left drag into the orbit the plain left drag gave up on `orbit`, and makes the
  // same gesture a no-op on `flat`, where the knot editor owns it.
  orbit.enableRotate = true;
  flat.enableRotate = false;
  // The stylesheet owns the cursor: `body.pan-ready` and `body.pan-dragging` decide it. But
  // `OrbitControls` writes an inline `cursor: auto` on its element when it connects, and an inline
  // style beats a stylesheet rule. Remove it once, so the page's own rules are the only source. The
  // default `cursorStyle` is `'auto'`, so the library never writes it again.
  element.style.removeProperty("cursor");
  // Any manual orbit invalidates the view name: the page is no longer showing `left`, it is showing
  // wherever the user dragged it. A pan and a zoom are not a manual orbit, so only `orbit` is wired:
  // `flat` never rotates, and neither `setZoom` nor `panBy` reaches this listener.
  orbit.addEventListener("start", () => onManual?.());
  orbit.enabled = false; // enabled only on the perspective views
  flat.enabled = true;

  // The mirror. `OrbitControls` writes `ortho.zoom` and moves `flat.target`; both are read here, so
  // the HUD, `__ctl` and the picker see the wheel and the pan as they happen.
  flat.addEventListener("change", () => {
    state.zoom = ortho.zoom;
    state.target.copy(flat.target);
  });

  // The documented `change` event of the ACTIVE instance is the signal that the camera moved, and it
  // fires again on every frame while `enableDamping` decays the inertia. One subscription here
  // follows the flat/perspective swap in `applyCamera()`, so the page's loop wakes on the active
  // camera's motion and never on the disabled instance's.
  const changeListeners = new Set();
  let changeTarget = orbit;
  const emitChange = () => { for (const listener of changeListeners) listener(); };
  changeTarget.addEventListener("change", emitChange);

  function rebindChange() {
    const next = state.perspective ? orbit : flat;
    if (next === changeTarget) return;
    changeTarget.removeEventListener("change", emitChange);
    changeTarget = next;
    changeTarget.addEventListener("change", emitChange);
  }

  /** Subscribe to the active instance's `change` event. Returns an unsubscribe function. */
  function onChange(listener) {
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  }

  function frameOrtho() {
    const h = state.orthoHeight;
    const a = window.innerWidth / window.innerHeight;
    ortho.left = (-h * a) / 2;
    ortho.right = (h * a) / 2;
    ortho.top = h / 2;
    ortho.bottom = -h / 2;
    // `ortho.zoom` is OrbitControls' field now and is NOT divided here: the frustum is the 100 %
    // frame, and the zoom is applied on top of it by the projection matrix.
    ortho.updateProjectionMatrix();
  }

  /**
   * Drop the inertia the library is still carrying, so a framing that follows a gesture is the
   * frame and not the frame plus the leftover of the drag. `enableDamping` is the documented switch
   * ("Set to `true` to enable damping (inertia)"); with it off, one `update()` applies the whole
   * remaining pan offset and the library zeroes it, then damping is restored. There is no
   * documented way to clear `_panOffset` directly, and this uses only the public surface.
   */
  function clearInertia(controls) {
    if (!controls.enableDamping) return;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
  }

  function applyCamera() {
    const az = THREE.MathUtils.degToRad(state.azimuth);
    const el = THREE.MathUtils.degToRad(state.elevation);
    const t = state.target;
    const position = new THREE.Vector3(
      t.x + state.distance * Math.cos(el) * Math.cos(az),
      t.y + state.distance * Math.sin(el),
      t.z + state.distance * Math.cos(el) * Math.sin(az),
    );

    activeCamera = state.perspective ? camera : ortho;
    // The active instance changed: the `change` listener moves with it, so the loop follows the
    // camera that can actually move.
    rebindChange();
    activeCamera.up.set(...state.up);
    activeCamera.position.copy(position);
    activeCamera.lookAt(t);

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
      orbit.target.copy(t);
      orbit.update();
    } else {
      clearInertia(flat);
      flat.target.copy(t);
      flat.update();
    }
    return activeCamera;
  }

  function placeCamera(name) {
    const view = views[name];
    if (!view) throw new Error(`placeCamera: no view named "${name}"`);
    // A named view is the canonical frame: 100 %, centred on `frame.target`. Resetting first keeps
    // a capture reproducible and `bun run check` comparable, whatever the pointer did before.
    resetFraming();
    Object.assign(state, {
      azimuth: view.azimuth,
      elevation: view.elevation,
      distance: frame.distance,
      perspective: Boolean(view.perspective),
      up: view.up ?? [0, 1, 0],
    });
    applyCamera();
  }

  // A plate belongs to one axis, and the mask tests the AXIS, not the name of the view.
  //
  // This distinction is load-bearing. Masking on the view name looked right and broke tracing:
  // zooming in for precision sets the view to "custom", so the plate vanished exactly when it was
  // needed. An elevation seen from 20 degrees off is a picture of a car that is not there, but the
  // same elevation seen from the same axis at a different zoom is the same projection.
  function matchingView() {
    if (state.perspective) return null;
    for (const [name, view] of Object.entries(views)) {
      if (view.perspective) continue;
      const dAz = Math.abs(((state.azimuth - view.azimuth + 540) % 360) - 180);
      const dEl = Math.abs(state.elevation - view.elevation);
      if (dAz < 0.5 && dEl < 0.5) return name;
    }
    return null;
  }

  // ------------------------------------------------------------------ zoom and pan

  /** The zoom as an integer percentage, 100..1000. */
  function zoomPercent() {
    return Math.round(ortho.zoom * 100);
  }

  /**
   * Set the zoom, clamped to the documented range through the instance's own limits. The float is
   * clamped in percent space and divided by 100, so a programmatic call cannot leave `[minZoom,
   * maxZoom]`. Cursor anchoring is not here: it belongs to the wheel, and `zoomToCursor` provides it.
   */
  function setZoom(percent) {
    const raw = Number(percent);
    const value = Number.isFinite(raw) ? raw : 100;
    ortho.zoom = Math.min(flat.maxZoom * 100, Math.max(flat.minZoom * 100, value)) / 100;
    ortho.updateProjectionMatrix();
    flat.update();
    state.zoom = ortho.zoom;
    return state.zoom;
  }

  /**
   * Move the flat view by a pixel offset. `OrbitControls.pan(deltaX, deltaY)` is the only pan
   * implementation; this is a rename with the sign convention of a drag already handled by the
   * library.
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
    state.fov = 26;
    state.distance = frame.distance;
    resetFraming();
  }

  function resize() {
    camera.aspect = aspect();
    camera.updateProjectionMatrix();
    frameOrtho();
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
    matchingView,
    onChange,
    zoomPercent,
    setZoom,
    panBy,
    resetFraming,
    reset,
    resize,
    get activeCamera() {
      return activeCamera;
    },
    get activeControls() {
      return state.perspective ? orbit : flat;
    },
  };
}
