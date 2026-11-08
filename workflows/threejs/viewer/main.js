// The viewer page: one page, every scene.
//
// It reads `?scene=`, asks the API for the merged document, imports the model module that document
// names, and wires the parts together. Nothing here knows the name of a subject, a view, a
// dimension or a coefficient.
//
// Before this file existed, a scene WAS a page: `scenes/<subject>/scene.js` held the renderer, the
// lights, the calque, the measurement, the control surface and the model import in 975 lines. A
// second subject meant copying it, and the copy drifted the moment anything changed. The parts are
// now `camera.js`, `calque.js`, `picker.js`, `stage.js` and the pure `measure.js` / `frame.js`; this
// file is only the composition.

import * as THREE from "three";
import { loadScene, sceneParam, showFailure } from "./api.js";
import { frameFrom } from "./frame.js";
import { createCameraRig } from "./camera.js";
import { createCalque } from "./calque.js";
import { createPicker } from "./picker.js";
import { createStage } from "./stage.js";
import { checkDocument, checkModel, describe as describeContract } from "./contract.js";
import { buildContourVolume } from "./volume.js";

const params = new URLSearchParams(location.search);
const SHOT = params.get("shot") === "1";
if (SHOT) document.body.classList.add("shot");

// The document is loaded before anything is built: the frame depends on it, and a scene that cannot
// load must fail with its reason on screen rather than render a plausible model with one field
// silently wrong.
let document_;
try {
  document_ = await loadScene(sceneParam());
} catch (error) {
  showFailure(error);
  throw error;
}

const documentProblems = checkDocument(document_);
if (documentProblems.length > 0) {
  const error = new Error(describeContract(documentProblems));
  showFailure(error);
  throw error;
}

const views = document_.views;
const frame = frameFrom(document_);

// The view a page opens on, and the fallback for a name that does not exist. It is the first
// perspective view, because that is the one that shows a mass; an elevation is a projection and
// hides everything the other axis carries. Derived, so no subject's view name is written here.
const DEFAULT_VIEW = Object.keys(views).find((name) => views[name].perspective) ?? Object.keys(views)[0];

// The page is shared, so its title and its HUD header are the scene's, not the viewer's.
if (document_.scene.name) {
  document.title = `${document_.scene.name} — scene`;
  const heading = document.querySelector("#hud h1");
  if (heading) heading.textContent = document_.scene.name;
}

// The model module comes from the API, so a scene backed by a `.glb` can return a loader stub later
// without touching this file. The plan's contract is `build()`; `buildBody()` is the name the
// current R5 module uses, and both are accepted so the module could be renamed gradually.
const modelModule = await import(document_.scene.model);
const { build, problems: modelProblems } = checkModel(modelModule, document_.scene.model);
if (!build) {
  const error = new Error(describeContract(modelProblems));
  showFailure(error);
  throw error;
}
const root = build();

const measureModel = modelModule.measure ?? (() => ({ size: [0, 0, 0], triangles: 0, meshes: 0 }));
// `target()` asks nothing; `deviation(object)` measures the built root. A model that exports only
// `meta.report(root)` gets both from one call.
const targetOf = modelModule.target ?? (() => modelModule.meta?.report?.(root)?.target ?? null);
const deviationOf = modelModule.deviation ?? ((object) => modelModule.meta?.report?.(object)?.deviation ?? null);

// ------------------------------------------------------------------ stage and camera

// The rig needs the canvas, and the stage needs the rig for its loop. One explicit indirection is
// cheaper than either a circular constructor or a detached canvas.
const rigRef = { current: null };
const stage = createStage({
  frame,
  shot: SHOT,
  report: () => measureDrawn(),
  rigRef,
});
stage.setRoot(root);

let currentView = params.get("view") ?? DEFAULT_VIEW;

const rig = createCameraRig({
  views,
  frame,
  element: stage.renderer.domElement,
  onManual: () => {
    if (currentView === "custom") return;
    currentView = "custom";
    syncButtons();
showLayerState();
  },
});
rigRef.current = rig;

// ------------------------------------------------------------------ calque and picker

let refreshPanel = () => {};

const calque = createCalque({
  scene: stage.scene,
  views,
  document: document_,
  contours: modelModule.CONTOURS ?? null,
  onChange: () => {
    stage.updateHud(currentView);
    showLayerState();
    refreshPanel();
  },
});
calque.followCamera(() => rig.matchingView());

const picker = createPicker({
  rig,
  calque,
  views,
  document: document_,
  renderer: stage.renderer,
  element: stage.renderer.domElement,
  root,
});
refreshPanel = () => picker.render();

// ------------------------------------------------------------------ view buttons

const bar = document.getElementById("views");
if (bar) {
  for (const name of Object.keys(views)) {
    const button = document.createElement("button");
    button.textContent = name;
    button.setAttribute("aria-pressed", String(name === currentView));
    button.addEventListener("click", () => setView(name));
    bar.appendChild(button);
  }
}

function syncButtons() {
  if (!bar) return;
  for (const button of bar.children) {
    button.setAttribute("aria-pressed", String(button.textContent === currentView));
  }
}

// ------------------------------------------------------------------ the contour volume

// The body, rebuilt in the page from the three contours and nothing else.
//
// The offline tracer reduces the PHOTOGRAPH to a volume, on its own lattice, and the contour is a
// second artifact beside it. That order cannot answer the only question a contour raises: does
// simplifying this line change the surface? Here the volume IS the intersection of the three drawn
// paths, so moving a line moves the solid. Both are kept, and both can be shown, because a
// disagreement between them is a measurement.
//
// It is built once, on load, and rebuilt only when the reading changes. Nothing else in the page
// mutates a path, so a rebuild on every frame would be work with no input.
const volumeGroup = new THREE.Group();
volumeGroup.name = "ContourVolume";
volumeGroup.visible = false;
stage.scene.add(volumeGroup);

const volumeMaterial = new THREE.MeshStandardMaterial({
  name: "contour-volume",
  // A solid, mid-tone surface. It has to read against the near-white capture field AND the pale
  // page background, where the first version -- a translucent light blue-grey -- was invisible. The
  // contour line draws with `depthTest: false`, so an opaque volume never hides the line.
  color: 0x6f7f8f,
  roughness: 0.5,
  metalness: 0.0,
  side: THREE.DoubleSide,
});

let volumeInfo = { built: false, read: [], skipped: [], triangles: 0, size_mm: null };

function rebuildVolume() {
  for (const child of [...volumeGroup.children]) {
    volumeGroup.remove(child);
    child.geometry?.dispose?.();
  }
  const mode = calque.info().contour.mode;
  // The volume reads the path the way the page draws it: one division per segment is the angular
  // reading, and it must give the angular volume, or the two layers would show two shapes.
  const divisions = mode === "poly" ? 1 : 8;
  let result = null;
  try {
    result = buildContourVolume({
      document: document_,
      views,
      contours: modelModule.CONTOURS ?? null,
      used: modelModule.TRACE?.views_used ?? [],
      divisions,
    });
  } catch (error) {
    showFailure(error);
    volumeInfo = { built: false, read: [], skipped: [], triangles: 0, size_mm: null, error: String(error?.message ?? error) };
    return volumeInfo;
  }
  if (!result) {
    volumeInfo = { built: false, read: [], skipped: [], triangles: 0, size_mm: null };
    return volumeInfo;
  }
  const mesh = new THREE.Mesh(result.geometry, volumeMaterial);
  mesh.name = "ContourVolumeBody";
  volumeGroup.add(mesh);

  const box = new THREE.Box3().setFromBufferAttribute(result.geometry.getAttribute("position"));
  const size = box.getSize(new THREE.Vector3());
  const triangles = (result.geometry.index?.count ?? result.geometry.getAttribute("position").count) / 3;
  volumeInfo = {
    built: true,
    mode,
    divisions,
    read: result.read,
    skipped: result.skipped,
    triangles: Math.round(triangles),
    size_mm: [size.x, size.y, size.z].map((v) => Number((v * 1000).toFixed(1))),
  };
  showLayerState();
  return volumeInfo;
}

// ------------------------------------------------------------------ layer switches

// Two eyes, top right: the model and the reference plate. A modelling pass needs to look at the
// plate alone -- the reference IS the subject -- and at the model alone, without the plate hiding
// a silhouette that is being judged. Both states are plain visibility flags on the scene graph, so
// a capture that toggles them sees exactly what the eye sees.
const layers = {
  model: document.getElementById("layer-model"),
  volume: document.getElementById("layer-volume"),
  contour: document.getElementById("layer-contour"),
  calque: document.getElementById("layer-calque"),
};

function showLayerState() {
  if (layers.model) layers.model.setAttribute("aria-pressed", String(root.visible));
  if (layers.volume) layers.volume.setAttribute("aria-pressed", String(volumeGroup.visible));
  if (layers.contour) layers.contour.setAttribute("aria-pressed", String(calque.info().contour.enabled));
  if (layers.calque) layers.calque.setAttribute("aria-pressed", String(calque.info().enabled));
}

function setLayer(name, visible) {
  if (name === "model") root.visible = Boolean(visible);
  else if (name === "volume") {
    // The volume is built on demand, and the button is the only path that reaches this without the
    // CLI. Flipping the flag on an empty group shows nothing, which reads as a broken button: the
    // group must exist before it is shown. `rebuildVolume` is a no-op once built.
    if (visible && !volumeInfo.built) rebuildVolume();
    volumeGroup.visible = Boolean(visible);
  } else if (name === "contour") calque.setContourEnabled(visible);
  else if (name === "calque") calque.setEnabled(visible);
  showLayerState();
  // The HUD counts what is drawn, and this just changed it. Without this line a volume-only frame
  // still reports the model's triangle count, which is a number about a layer that is switched off.
  stage.updateHud(currentView);
  return stage.nextFrame();
}

if (layers.model) {
  layers.model.addEventListener("click", () => setLayer("model", !root.visible));
}
if (layers.volume) {
  layers.volume.addEventListener("click", () => setLayer("volume", !volumeGroup.visible));
}
if (layers.contour) {
  layers.contour.addEventListener("click", () => setLayer("contour", !calque.info().contour.enabled));
}
if (layers.calque) {
  layers.calque.addEventListener("click", () => setLayer("calque", !calque.info().enabled));
}

// ------------------------------------------------------------------ script API

function setView(name) {
  currentView = name in views ? name : DEFAULT_VIEW;
  rig.placeCamera(currentView);
  syncButtons();
  stage.updateHud(currentView);
  calque.sync();
  return stage.nextFrame();
}

function ctlCamera(options = {}) {
  for (const field of ["azimuth", "elevation", "distance", "fov", "orthoHeight"]) {
    if (typeof options[field] === "number") rig.state[field] = options[field];
  }
  if (typeof options.perspective === "boolean") rig.state.perspective = options.perspective;
  if (Array.isArray(options.up)) rig.state.up = options.up;
  if (options.target) {
    rig.state.target.set(
      options.target.x ?? rig.state.target.x,
      options.target.y ?? rig.state.target.y,
      options.target.z ?? rig.state.target.z,
    );
  }
  if (options.reset) rig.reset();
  currentView = "custom";
  syncButtons();
  rig.applyCamera();
  stage.updateHud("custom");
  calque.sync();
  return stage.nextFrame();
}

function ctlOrtho(options = {}) {
  // `enabled: true` asks for the orthographic camera; without it, the projection is toggled.
  const perspective =
    options.enabled === true ? false : options.enabled === false ? true : !rig.state.perspective;
  return ctlCamera({
    perspective,
    orthoHeight: typeof options.height === "number" ? options.height : rig.state.orthoHeight,
  });
}

function ctlReset() {
  stage.ctl.reset();
  return setView(params.get("view") ?? DEFAULT_VIEW);
}

// The orthographic frame in millimetres per pixel, and the pixel size it maps to. A silhouette
// comparison needs these: without them the render is just a picture and cannot be laid on the
// reference in metric space.
function orthoFrame() {
  return {
    mmPerPx: rig.state.perspective ? null : (rig.state.orthoHeight * 1000) / window.innerHeight,
    viewport: [window.innerWidth, window.innerHeight],
    orthoHeight: rig.state.perspective ? null : rig.state.orthoHeight,
    target: [rig.state.target.x, rig.state.target.y, rig.state.target.z],
    azimuth: rig.state.azimuth,
    elevation: rig.state.elevation,
    perspective: rig.state.perspective,
  };
}

// What was actually drawn. The sidecar beside a capture has to describe the pixels in that
// capture, and a layer that is switched off contributed none of them: measuring `root` alone made a
// volume-only capture claim the body's height and put every later comparison off by the wheels.
function measureDrawn() {
  const picked = [];
  if (root.visible) picked.push(root);
  if (volumeGroup.visible) picked.push(volumeGroup);
  if (picked.length === 0) return measureModel(root);

  // Two boxes expanded in place, never a clone of the scene graph: a clone doubles the geometry on
  // every capture and measures a copy instead of the thing on screen.
  const box = new THREE.Box3();
  let triangles = 0;
  let meshes = 0;
  for (const object of picked) {
    box.union(new THREE.Box3().setFromObject(object));
    const measured = measureModel(object);
    triangles += measured.triangles;
    meshes += measured.meshes;
  }
  return {
    min: box.min.toArray().map((v) => Number(v.toFixed(3))),
    max: box.max.toArray().map((v) => Number(v.toFixed(3))),
    size: box.getSize(new THREE.Vector3()).toArray().map((v) => Number(v.toFixed(3))),
    triangles,
    meshes,
  };
}

function stats() {
  return {
    ...measureDrawn(),
    layers: {
      model: root.visible,
      volume: volumeGroup.visible,
      contour: calque.info().contour.enabled,
      calque: calque.info().enabled,
    },
    frame: orthoFrame(),
    // What the body is checked against, and where it stands. Millimetres, because that is the unit
    // of the gates: G2 allows 100 mm or 3 % of the largest dimension, whichever is smaller.
    target: targetOf(),
    deviation: deviationOf(root),
    calls: stage.renderer.info.render.calls,
    view: currentView,
    viewport: [window.innerWidth, window.innerHeight],
  };
}

window.__setView = setView;
window.__views = Object.keys(views);
window.__stats = stats;

window.__ctl = {
  view: setView,
  views: () => Object.keys(views),
  defaultView: () => DEFAULT_VIEW,
  camera: ctlCamera,
  ortho: ctlOrtho,
  wireframe: stage.ctl.wireframe,
  isolate: stage.ctl.isolate,
  visible: stage.ctl.visible,
  background: stage.ctl.background,
  grid: stage.ctl.grid,
  ground: stage.ctl.ground,
  shadows: stage.ctl.shadows,
  exposure: stage.ctl.exposure,
  nodes: stage.ctl.nodes,
  stats,
  state: () => ({
    ...rig.state,
    // The view NAME, so a caller can prove the page is on the view it asked for. `camera` and the
    // orbit controls both set this to "custom", so a hand-moved camera can never claim to be `left`.
    view: currentView,
    target: [rig.state.target.x, rig.state.target.y, rig.state.target.z],
  }),
  // The calque: show a reference view as a plane, or take it away.
  //   calque({ view: "left" })                 show it, opaque, behind the model
  //   calque({ depth: "front", opacity: 0.35 })  trace over the model
  //   calque({ off: true })                    hide
  calque: async (options = {}) => {
    await calque.set(options);
    return stage.nextFrame();
  },
  calqueDebug: () => {
    const mesh = calque.current();
    if (!mesh) return { children: calque.group.children.length, plateVisible: calque.group.visible };
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    return {
      plateVisible: calque.group.visible,
      meshVisible: mesh.visible,
      inScene: Boolean(mesh.parent && mesh.parent.parent),
      position: mesh.position.toArray().map((v) => Number(v.toFixed(3))),
      quaternion: mesh.quaternion.toArray().map((v) => Number(v.toFixed(3))),
      worldBox: { min: box.min.toArray().map((v) => Number(v.toFixed(2))),
                  max: box.max.toArray().map((v) => Number(v.toFixed(2))) },
      geometry: mesh.geometry.parameters,
      hasMap: Boolean(mesh.material.map),
      mapImage: mesh.material.map ? [mesh.material.map.image?.width, mesh.material.map.image?.height] : null,
      opacity: mesh.material.opacity,
      transparent: mesh.material.transparent,
      depthTest: mesh.material.depthTest,
      renderOrder: mesh.renderOrder,
      cameraPosition: rig.activeCamera.position.toArray().map((v) => Number(v.toFixed(2))),
    };
  },
  calqueInfo: () => calque.info(),
  // How the traced outline is read: `poly` joins the points it was fitted through, `bezier` samples
  // the curve. Both come from one path, so the outline does not move when the reading changes.
  contourMode: async (mode) => {
    calque.setContourMode(mode);
    await calque.showPlate(calque.shownView() ?? null);
    if (volumeInfo.built) rebuildVolume();
    return stage.nextFrame().then(() => calque.info().contour);
  },
  // The volume the three contours describe, and the numbers it reached. `rebuild` redoes the
  // intersection, which is the only way to see a change in the paths.
  volume: async (options = {}) => {
    if (options.rebuild || !volumeInfo.built) rebuildVolume();
    if (typeof options.show === "boolean") await setLayer("volume", options.show);
    await stage.nextFrame();
    return volumeInfo;
  },
  // The two eyes, from the shell: `__ctl.layers({ model: false })` is a plate-only frame, and
  // `__ctl.layers({ calque: false })` is a bare model. Both resolve on the next drawn frame, so a
  // screenshot taken after them shows the state that was asked for.
  layers: async (options = {}) => {
    if (typeof options.model === "boolean") await setLayer("model", options.model);
    if (typeof options.volume === "boolean") {
      if (options.volume && !volumeInfo.built) rebuildVolume();
      await setLayer("volume", options.volume);
    }
    if (typeof options.contour === "boolean") await setLayer("contour", options.contour);
    if (typeof options.calque === "boolean") await setLayer("calque", options.calque);
    return {
      model: root.visible,
      volume: volumeGroup.visible,
      contour: calque.info().contour.enabled,
      calque: calque.info().enabled,
    };
  },
  // Measurement in model units. A point on the calque is a model coordinate, because the plate is
  // already at the model's scale and in its frame.
  measure: async (options = {}) => {
    if (options.off) picker.off();
    else if (options.clear) picker.clear();
    else if (options.on) picker.on();
    return stage.nextFrame();
  },
  measurePoints: () => picker.state(),
  // Pick programmatically, at a normalised device coordinate. This is what lets the chain be tested
  // without a mouse: pick the two ends of the calibrated plate and check the distance in metres.
  measurePick: (nx, ny, source = "calque") => {
    const entry = picker.pick(nx, ny, source);
    if (!entry) return null;
    return { ...entry, between: picker.lastBetween() };
  },
  reset: ctlReset,
  wait: () => stage.nextFrame(),
};

// ------------------------------------------------------------------ start

stage.readyOnSecondFrame(() => {
  stage.updateHud(currentView);
  window.__ready = true;
});

// Start where the page says, without building a calque: the first frame writes the HUD, and a
// capture that asks for `calque({ off: true })` must not race a texture that is still loading.
currentView = currentView in views ? currentView : DEFAULT_VIEW;
rig.placeCamera(currentView);
syncButtons();

// The dev server pushes one message per file change. A full reload is enough here: the model is
// rebuilt from source, and it costs a fraction of a second.
new EventSource("/__reload").onmessage = () => location.reload();
