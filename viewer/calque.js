// The reference plates: the blueprint views inserted into the scene as planes, the way a Blender
// user drops a front/side image in and traces it. A model traced against a calque cannot drift from
// the reference, because the reference is in the same space as the model.
//
// Three things make the calque trustworthy, and each one is a measurement rather than a guess:
//
//   1. It is sized in METRES, from the real dimensions and the subject's pixel box. A view's two
//      scales differ -- a generated image is stretched -- so the plane is stretched by kx on one
//      axis and ky on the other. A single scale would put a 1400 mm roof at 1470.
//   2. It is placed on the subject's box, not on the image centre. The cropped images carry a
//      margin, so the two are not the same point, and anchoring on the wrong one shifts every
//      trace by that margin.
//   3. It shows only from its own view. An elevation is a projection down one axis: seen from 20
//      degrees off, it is a picture of a car that is not there. So a plate is masked, and appears
//      only when the camera is on the axis that drew it.
//
// Both scales and both boxes come from the API document. This module never builds a path, never
// divides two pixel counts, and never carries a number that belongs to one subject.

import * as THREE from "three";
import { realMetres, referenceScale } from "./api.js";
import { viewBasis } from "./camera.js";

/**
 * @param {object} options
 * @param {THREE.Scene} options.scene
 * @param {Record<string, any>} options.views      `viewer/views.json` -> `views`
 * @param {object} options.document                the `/api/scene` document
 * @param {() => void} [options.onChange]          called after the plate set changes
 */
export function createCalque({ scene, views, document: sceneDocument, onChange }) {
  const group = new THREE.Group();
  group.name = "Calque";
  group.renderOrder = -1;
  scene.add(group);

  const calque = {
    view: null,     // the view whose plate is shown, or null
    opacity: 1,
    depth: "behind",
    loaded: new Map(),
  };

  async function buildPlate(view) {
    const reference = sceneDocument.views?.[view]?.reference;
    if (!reference) {
      throw new Error(`calque: no cropped reference for "${view}" -- run crop_reference.py`);
    }

    // The scale comes from the server. It built it on the SUBJECT box, and it warned if the result
    // disagreed with the calibration stage 1 wrote. Building it here a second time is exactly how
    // the 0.3 percent error happened: the crop keeps a margin, and mapping the whole file to the
    // real length made the subject a few pixels short, on every measurement after that.
    const { kx, ky } = referenceScale(reference);
    const [imgW, imgH] = reference.size_px;
    const [sx0, sy0, sx1, sy1] = reference.subject_box;
    const spanH = sx1 - sx0 + 1;
    const spanV = sy1 - sy0 + 1;
    const [offsetX, offsetY] = reference.offset;

    const texture = await new THREE.TextureLoader().loadAsync(reference.url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    // Sizes and offset are in metres, so the plane lives in the model's own coordinates.
    const width = imgW * kx;
    const height = imgH * ky;
    const geometry = new THREE.PlaneGeometry(width, height);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: calque.opacity,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthWrite: calque.depth === "behind",
      depthTest: calque.depth === "behind",
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Calque_${view}`;
    mesh.userData.view = view;
    // `behind` must lose the depth test against the model; `front` must win it, or the model paints
    // over the reference and the tracing aid disappears exactly when it is needed.
    mesh.renderOrder = calque.depth === "behind" ? -1 : 10;

    const basis = viewBasis(views, view);
    // The API reports millimetres as numbers, so there is no { value, source } object left to read
    // as a string. That unwrap produced NaN twice, and a NaN position draws nothing while every
    // other field of the plate still looks correct.
    const realHeight = realMetres(sceneDocument, sceneDocument.roles.y);
    const centre = new THREE.Vector3(0, realHeight / 2, 0);
    // A plan view is a plane at the ground, not a wall through the middle of the subject.
    if (view === "top" || view === "bottom") centre.set(0, 0, 0);

    // Subject box centre inside the cropped image, as an offset in screen coordinates.
    const dx = (offsetX + spanH / 2 - imgW / 2) * kx;
    const dy = -(offsetY + spanV / 2 - imgH / 2) * ky;

    const orientation = new THREE.Matrix4().makeBasis(basis.right, basis.up, basis.dir);
    mesh.quaternion.setFromRotationMatrix(orientation);

    const behind = view === "top" || view === "bottom" ? 6 : 5;
    const depth = calque.depth === "behind" ? -behind : 0.02;
    mesh.position
      .copy(centre)
      .addScaledVector(basis.right, dx)
      .addScaledVector(basis.up, dy)
      .addScaledVector(basis.dir, depth);

    mesh.userData.metrics = {
      kx_mm: kx * 1000, ky_mm: ky * 1000,
      plane_m: [width, height],
      subject_box_mm: [spanH * kx * 1000, spanV * ky * 1000],
    };
    return mesh;
  }

  async function showPlate(view) {
    calque.view = view;
    // Detach, never dispose. The cached mesh is reused on every later call, so releasing its GPU
    // buffers here leaves a plate that loads, parents cleanly, and draws nothing at all.
    for (const child of [...group.children]) group.remove(child);
    if (!view) {
      onChange?.(); // no plate: the panel must stop quoting the last view's scale
      return null;
    }

    let mesh = calque.loaded.get(view);
    if (!mesh) {
      mesh = await buildPlate(view);
      calque.loaded.set(view, mesh);
    }
    mesh.material.opacity = calque.opacity;
    mesh.material.depthWrite = calque.depth === "behind";
    mesh.material.depthTest = calque.depth === "behind";
    group.add(mesh);
    onChange?.();
    return mesh;
  }

  /** Follow the camera: show the plate of the axis it is on, and hide it otherwise. */
  function sync() {
    const plateView = rigView();
    if (plateView !== calque.view) {
      showPlate(plateView).catch((error) => console.warn(String(error)));
    }
    group.visible = Boolean(plateView);
    return plateView;
  }

  // Set by the composition root; `sync` needs the current camera axis and nothing else.
  let rigView = () => null;
  function followCamera(fn) {
    rigView = fn;
  }

  /** The plate currently in the scene, or null. */
  function current() {
    return group.children[0] ?? null;
  }

  /** The view name of the plate in the scene, or null. */
  function shownView() {
    return current()?.userData.view ?? null;
  }

  function disposeLoaded() {
    for (const mesh of calque.loaded.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    calque.loaded.clear();
  }

  /**
   * The `calque()` command of the control surface.
   *   calque({ view: "left" })                    show it, behind the model
   *   calque({ depth: "front", opacity: 0.35 })   trace over the model
   *   calque({ off: true })                       hide
   */
  async function set(options = {}) {
    if (options.off) {
      calque.view = null;
      group.visible = false;
      for (const child of [...group.children]) group.remove(child);
      onChange?.();
      return null;
    }
    if (typeof options.opacity === "number") calque.opacity = options.opacity;
    if (options.depth) calque.depth = options.depth;
    if (options.opacity !== undefined || options.depth !== undefined) disposeLoaded();

    const view = options.view ?? calque.view ?? rigView();
    await showPlate(view);
    group.visible = true;
    onChange?.();
    return current();
  }

  function info() {
    return {
      shown: group.visible ? calque.view : null,
      depth: calque.depth,
      opacity: calque.opacity,
      plates: group.children.map((child) => ({
        view: child.userData.view,
        metrics: child.userData.metrics,
      })),
    };
  }

  return {
    group,
    calque,
    showPlate,
    sync,
    followCamera,
    current,
    shownView,
    set,
    info,
  };
}
