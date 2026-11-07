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
export function createCalque({ scene, views, document: sceneDocument, contours, onChange }) {
  const group = new THREE.Group();
  group.name = "Calque";
  group.renderOrder = -1;
  scene.add(group);

  // The outline lives in its own group, not under the plate. They are three separate layers to
  // compare -- picture, contour, volume -- and a contour that vanishes with the picture cannot be
  // compared against the volume alone, which is exactly the case it exists for.
  const contourGroup = new THREE.Group();
  contourGroup.name = "Contour";
  scene.add(contourGroup);

  const calque = {
    view: null,     // the view whose plate is shown, or null
    opacity: 1,
    depth: "behind",
    // The user's own switch, separate from "is there a plate for this axis". `sync` runs on every
    // view change and sets visibility from the camera, so without this flag an eye toggle would be
    // undone the next time the camera moved a degree.
    enabled: true,
    // The traced outline is a THIRD thing to look at: the reference picture, the contour the hull
    // was built from, and the volume that came out. All three must sit on the same plane, or the
    // comparison is a guess, so the contour is a child of the plate and inherits its transform.
    contour: {
      enabled: true,
      views: Object.keys(contours ?? {}),
    },
    loaded: new Map(),
    contours: new Map(),
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

    mesh.position
      .copy(centre)
      .addScaledVector(basis.right, dx)
      .addScaledVector(basis.up, dy);

    // The depth of the plate, and why a plan view cannot use the same rule as an elevation.
    //
    // An elevation is a wall: 5 m behind the model or 20 mm in front of it, both are free space.
    // A plan view is a sheet parallel to the ground, and the viewer has a ground disc at Y = 0.
    // Offsetting along `dir` puts a `top` plate at Y = -6, UNDER that disc, where it draws nothing
    // at all -- while `bottom` lands at Y = +6 and looks correct by accident. So a plan view is
    // placed by height above the ground instead, and the two cases are written apart.
    if (view === "top" || view === "bottom") {
      mesh.position.y = calque.depth === "behind"
        ? 0.002                      // just above the ground: the body hides it where they overlap
        : realHeight + 0.5;          // above the roof, for tracing on the plate
    } else {
      const depth = calque.depth === "behind" ? -5 : 0.02;
      mesh.position.addScaledVector(basis.dir, depth);
    }

    mesh.userData.metrics = {
      kx_mm: kx * 1000, ky_mm: ky * 1000,
      plane_m: [width, height],
      subject_box_mm: [spanH * kx * 1000, spanV * ky * 1000],
    };
    return mesh;
  }

  /**
   * One traced outline, in the plate's own local metres: `u` to the right, `v` up, origin at the
   * image centre. The placement is `placeContour`, which copies the plate's matrix.
   */
  function buildContour(view) {
    const entry = contours?.[view];
    if (!entry || !Array.isArray(entry.points) || entry.points.length < 6) return null;
    const flat = entry.points;
    const positions = new Float32Array((flat.length / 2) * 3);
    for (let i = 0; i < flat.length / 2; i += 1) {
      positions[i * 3] = flat[i * 2];
      positions[i * 3 + 1] = flat[i * 2 + 1];
      // A hair in front of the picture, and no depth test: the contour must be readable over the
      // reference whether the plate is tracing behind the model or in front of it.
      positions[i * 3 + 2] = 0.0005;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Two outlines, two meanings. Solid and magenta is a view the hull was built from: the volume
    // reproduces it by construction, so it is a diagnosis of the tracing, not of the subject.
    // Dashed and cyan is a WITNESS -- a view the intersection never saw. A gap there is a real
    // disagreement between the views, which is the only check of this method worth having.
    const witness = entry.used === false;
    const material = new THREE.LineBasicMaterial({
      color: witness ? 0x18c8d8 : 0xff29c8,
      transparent: true, opacity: 0.95, depthTest: false, depthWrite: false,
      toneMapped: false,
    });
    const line = witness
      ? new THREE.LineSegments(dashSegments(positions), material)
      : new THREE.LineLoop(geometry, material);
    line.name = `Contour_${view}`;
    line.userData.witness = witness;
    line.renderOrder = 30;
    return line;
  }

  /**
   * A flat position array split into short segments, for a dashed witness outline.
   *
   * `LineDashedMaterial` would need `computeLineDistances` and a pixel-space dash scale that
   * changes with zoom; cutting the ring into fixed-length pieces keeps the dash the same size on
   * the screen at any zoom, which is what makes a witness outline readable at trace scale.
   */
  function dashSegments(positions, on = 0.012, off = 0.009) {
    const out = [];
    const count = positions.length / 3;
    let carried = 0;
    let drawing = true;
    for (let i = 0; i < count - 1; i += 1) {
      const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
      const bx = positions[(i + 1) * 3], by = positions[(i + 1) * 3 + 1], bz = positions[(i + 1) * 3 + 2];
      const length = Math.hypot(bx - ax, by - ay, bz - az);
      if (length === 0) continue;
      const period = drawing ? on : off;
      if (carried + length < period) {
        carried += length;
        if (drawing) out.push(ax, ay, az, bx, by, bz);
        continue;
      }
      if (drawing) out.push(ax, ay, az, bx, by, bz);
      carried = 0;
      drawing = !drawing;
    }
    return new THREE.BufferAttribute(new Float32Array(out), 3);
  }

  /**
   * Place an outline where its plate would be. The points are already in plate-local metres, so
   * copying the plate's position and rotation is the whole placement: recomputing it from the
   * subject box and the crop offset would be a second chance to land a few millimetres off the
   * picture the contour was traced from.
   */
  function placeContour(line, plate) {
    line.position.copy(plate.position);
    line.quaternion.copy(plate.quaternion);
    line.scale.copy(plate.scale);
  }

  /** Show or hide every traced outline, without touching the plates or the model. */
  function setContourEnabled(value) {
    calque.contour.enabled = Boolean(value);
    contourGroup.visible = calque.contour.enabled;
    onChange?.();
    return calque.contour.enabled;
  }

  async function showPlate(view) {
    calque.view = view;
    // Detach, never dispose. The cached mesh is reused on every later call, so releasing its GPU
    // buffers here leaves a plate that loads, parents cleanly, and draws nothing at all.
    for (const child of [...group.children]) group.remove(child);
    for (const child of [...contourGroup.children]) contourGroup.remove(child);
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

    // The contour follows the plate's transform but not its visibility: `placeContour` copies the
    // matrix, and the two groups are switched independently.
    let line = calque.contours.get(view);
    if (line === undefined) {
      line = buildContour(view);
      calque.contours.set(view, line);
    }
    if (line) {
      placeContour(line, mesh);
      contourGroup.add(line);
      contourGroup.visible = calque.contour.enabled;
    }
    onChange?.();
    return mesh;
  }

  /** Follow the camera: show the plate of the axis it is on, and hide it otherwise. */
  function sync() {
    const plateView = rigView();
    if (plateView !== calque.view) {
      showPlate(plateView).catch((error) => console.warn(String(error)));
    }
    group.visible = calque.enabled && Boolean(plateView);
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
    // The outlines are cached apart from the plates, so they need the same release: a depth or
    // opacity change rebuilds every plate, and keeping the old lines would double them.
    for (const line of calque.contours.values()) {
      if (!line) continue;
      line.geometry.dispose();
      line.material.dispose();
    }
    calque.contours.clear();
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
      for (const child of [...contourGroup.children]) contourGroup.remove(child);
      onChange?.();
      return null;
    }
    if (typeof options.opacity === "number") calque.opacity = options.opacity;
    if (options.depth) calque.depth = options.depth;
    if (options.opacity !== undefined || options.depth !== undefined) disposeLoaded();

    const view = options.view ?? calque.view ?? rigView();
    await showPlate(view);
    calque.enabled = true;
    group.visible = true;
    onChange?.();
    return current();
  }

  /**
   * Turn the plates on or off without forgetting which one is loaded. A hidden plate is detached
   * from the scene, not disposed: `shownView()` keeps answering, so the measurement panel still
   * quotes the right reference scale when the plate comes back.
   */
  function setEnabled(value) {
    calque.enabled = Boolean(value);
    group.visible = calque.enabled && Boolean(calque.view);
    onChange?.();
    return calque.enabled;
  }

  function info() {
    return {
      enabled: calque.enabled,
      contour: {
        enabled: calque.contour.enabled,
        views: calque.contour.views,
        drawn: contourGroup.children.map((child) => child.name),
      },
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
    setEnabled,
    setContourEnabled,
    info,
  };
}
