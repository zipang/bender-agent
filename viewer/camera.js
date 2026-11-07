// The camera rig: two cameras, one state, and the named views.
//
// Why two cameras. The reference sheets are orthographic elevations, so a perspective picture can
// never line up with one. Every flat view therefore uses an orthographic camera; the three-quarter
// views use a perspective one. Both read the same `state`, so a preset and a manual camera cannot
// disagree about what the page shows.
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

  // One state drives both cameras. A named view is a preset written into it.
  const state = {
    azimuth: 60,
    elevation: 30,
    distance: frame.distance,
    target: new THREE.Vector3(...frame.target),
    perspective: true,
    orthoHeight: frame.orthoHeight,
    fov: 26,
    up: [0, 1, 0],
  };

  let activeCamera = camera;

  function frameOrtho() {
    const h = state.orthoHeight;
    const a = window.innerWidth / window.innerHeight;
    ortho.left = (-h * a) / 2;
    ortho.right = (h * a) / 2;
    ortho.top = h / 2;
    ortho.bottom = -h / 2;
    ortho.updateProjectionMatrix();
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
    activeCamera.up.set(...state.up);
    activeCamera.position.copy(position);
    activeCamera.lookAt(t);

    if (state.perspective) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    } else {
      frameOrtho();
    }

    controls.enabled = Boolean(state.perspective);
    if (state.perspective) {
      controls.target.copy(t);
      controls.update();
    }
    return activeCamera;
  }

  function placeCamera(name) {
    const view = views[name];
    if (!view) throw new Error(`placeCamera: no view named "${name}"`);
    Object.assign(state, {
      azimuth: view.azimuth,
      elevation: view.elevation,
      distance: frame.distance,
      perspective: Boolean(view.perspective),
      up: view.up ?? [0, 1, 0],
    });
    applyCamera();
  }

  const controls = new OrbitControls(camera, element);
  // Any manual orbit invalidates the view name: the page is no longer showing `left`, it is showing
  // wherever the user dragged it. Without this, a capture could inherit a hand-moved camera and still
  // report the view it was told to report.
  controls.addEventListener("start", () => onManual?.());
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI / 2;
  controls.enabled = false; // enabled only on the perspective views

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

  function reset() {
    state.target.set(...frame.target);
    state.up = [0, 1, 0];
    state.orthoHeight = frame.orthoHeight;
    state.fov = 26;
    state.distance = frame.distance;
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
    controls,
    frameOrtho,
    applyCamera,
    placeCamera,
    matchingView,
    reset,
    resize,
    get activeCamera() {
      return activeCamera;
    },
  };
}
