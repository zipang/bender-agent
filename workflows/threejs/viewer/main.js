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
import {
  pathFromKnots, ringOf, simplifyRing, nearestKnot, nearestOnRing,
  insertKnot, removeKnot, moveKnot,
} from "./knots.js";

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

// The wheel and the pan on a flat view change the zoom, and the HUD must show it as it happens.
// Only the flat instance is wired: on a perspective view the zoom row is a dash whatever the
// pointer does.
rig.flat.addEventListener("change", () => {
  stage.updateHud(currentView);
});

// ------------------------------------------------------------------ contour knots

// The contour as a list of knots the art director controls.
//
// `modelModule.CONTOURS` is the traced fit, and it stays the DEFAULT: a view nobody edited keeps its
// traced path, so this is non-destructive. The moment a view is edited, its knots are seeded from
// the traced path's own on-curve vertices and the effective path is rebuilt from the knots.
const tracedContours = modelModule.CONTOURS ?? {};
const savedKnots = modelModule.KNOTS ?? {};
const knots = {};        // view -> { mode, knots }: the views edited this session
const discarded = new Set(); // views reset to the traced path, so a stale saved list is not re-read

// The effective knot set of a view: what the art director edited this session, else what the saved
// file holds, else nothing (the view keeps its traced path).
function knotSetFor(view) {
  if (knots[view]) return knots[view];
  if (discarded.has(view)) return null;
  const saved = savedKnots[view];
  if (saved?.knots?.length >= 3) {
    return { mode: saved.mode === "bezier" ? "bezier" : "poly", knots: saved.knots };
  }
  return null;
}

// The knots of a view, edited or traced. The handles and the editor read this.
function knotsOf(view) {
  const set = knotSetFor(view);
  return set ? set.knots : ringOf(tracedContours[view]?.path);
}

function modeOf(view) {
  const set = knotSetFor(view);
  return set ? set.mode : "poly";
}

function isEdited(view) {
  return Boolean(knotSetFor(view));
}

// Seed the working knots of a view. Called by the first edit, so an untouched view never carries a
// copy of a list nobody changed.
function ensureKnots(view) {
  if (knots[view]) return knots[view];
  const set = knotSetFor(view);
  // The join of a fresh seed defaults to `poly`. The knots are the traced path's own on-curve
  // vertices, and straight lines through them reproduce the accepted fit to within its tolerance; a
  // Catmull-Rom through the same points would bulge past it. The art director switches to `bezier`
  // once the knots are chosen.
  knots[view] = set
    ? { mode: set.mode, knots: set.knots.map((p) => [p[0], p[1]]) }
    : { mode: "poly", knots: ringOf(tracedContours[view]?.path) };
  return knots[view];
}

// The contours the calque and the volume read: the traced ones, with each edited view rebuilt from
// its knots. One object, mutated in place, so the two readers always see the current paths.
const effectiveContours = {};
function refreshContours() {
  for (const [view, entry] of Object.entries(tracedContours)) {
    const set = knotSetFor(view);
    effectiveContours[view] = set
      ? { ...entry, path: pathFromKnots(set.knots, set.mode), knots: set.knots, edited: true }
      : entry;
  }
}
refreshContours();

// ------------------------------------------------------------------ calque and picker

let refreshPanel = () => {};

const calque = createCalque({
  scene: stage.scene,
  views,
  document: document_,
  contours: effectiveContours,
  knotsOf,
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

// ------------------------------------------------------------------ knot editor

// The editing surface. It lives here because it composes three parts that already exist -- the rig,
// the calque plate and the knots -- and a module that reached into all three would be the
// composition root under another name.
//
//   click the line      add a knot on it, at the nearest point of the current outline
//   click a knot        remove it
//   drag a knot         move it
//
// A drag rebuilds the contour line only; the volume is rebuilt on release, because the boolean
// intersection costs about two seconds and cannot run at pointer speed.
const knotUI = {
  panel: document.getElementById("knots"),
  edit: document.getElementById("knot-edit"),
  poly: document.getElementById("knot-poly"),
  bezier: document.getElementById("knot-bezier"),
  tol: document.getElementById("knot-tol"),
  reduce: document.getElementById("knot-reduce"),
  reset: document.getElementById("knot-reset"),
  save: document.getElementById("knot-save"),
  info: document.getElementById("knot-info"),
};

const editor = { active: false, dragging: -1, view: null, moved: false, fresh: false };

function mmPerScreenPx() {
  return picker.state().mmPerScreenPx || 1;
}

function platePoint(nx, ny) {
  const hit = picker.pickAt(nx, ny, "calque");
  return hit && hit.view ? { view: hit.view, uv: [hit.u, hit.v] } : null;
}

/** The view being edited: the plate in the scene, or the last one touched. */
function editorView() {
  return calque.shownView() ?? editor.view;
}

function updateKnotInfo() {
  if (!knotUI.info) return;
  const view = calque.shownView();
  if (!view) {
    knotUI.info.textContent = "—";
    return;
  }
  const list = knotsOf(view);
  knotUI.info.textContent = `${view}: ${list.length}${isEdited(view) ? "" : " (traced)"}`;
  updateJoinButtons();
}

/** The join buttons show the mode of the view on screen, not the last mode that was set. */
function updateJoinButtons() {
  const view = calque.shownView();
  if (!view) return;
  const mode = modeOf(view);
  knotUI.poly?.setAttribute("aria-pressed", String(mode === "poly"));
  knotUI.bezier?.setAttribute("aria-pressed", String(mode === "bezier"));
}

/** Rebuild the outline and, unless a drag is in progress, the volume. */
async function applyEdit(view, { volume = true } = {}) {
  refreshContours();
  calque.invalidate();
  await calque.showPlate(calque.shownView() ?? null);
  if (volume && volumeGroup.visible) rebuildVolume();
  updateKnotInfo();
  return stage.nextFrame();
}

function setJoinMode(mode, view = editorView()) {
  if (!view) return null;
  const entry = ensureKnots(view);
  entry.mode = mode === "bezier" ? "bezier" : "poly";
  knotUI.poly?.setAttribute("aria-pressed", String(entry.mode === "poly"));
  knotUI.bezier?.setAttribute("aria-pressed", String(entry.mode === "bezier"));
  applyEdit(view);
  return entry.mode;
}

/**
 * The reduce: Douglas-Peucker on the TRACED ring, at a tolerance in millimetres. It re-derives the
 * knots from the trace every time, so two reduces in a row give the same answer as one and a manual
 * knot that was placed between them is not silently kept as if it were on the trace.
 */
function reduceKnots(tolerance_mm, view = editorView()) {
  if (!view) return null;
  // An empty or zero field is not a choice: a tolerance of zero keeps every point, which is exactly
  // the state this control exists to leave. Fall back to a default and show it in the field, so the
  // button always does something visible.
  const requested = Number(tolerance_mm);
  const value = Number.isFinite(requested) && requested > 0 ? requested : 12;
  if (knotUI.tol) knotUI.tol.value = String(value);
  const entry = ensureKnots(view);
  const ring = ringOf(tracedContours[view]?.path);
  const before = entry.knots.length;
  entry.knots = simplifyRing(ring, value / 1000);
  applyEdit(view);
  return { view, tolerance_mm: value, before, after: entry.knots.length };
}

function resetKnots(view = editorView()) {
  if (!view) return null;
  delete knots[view];
  discarded.add(view);
  applyEdit(view);
  return view;
}

async function saveKnots() {
  // The union of what the file already held and what was edited this session, minus the views that
  // were reset. Writing `knots` alone would drop every view that was loaded but not touched.
  const payload = {};
  for (const [view, entry] of Object.entries(savedKnots)) {
    if (discarded.has(view) || !(entry?.knots?.length >= 3)) continue;
    payload[view] = { mode: entry.mode === "bezier" ? "bezier" : "poly", knots: entry.knots };
  }
  for (const [view, entry] of Object.entries(knots)) {
    if (discarded.has(view)) continue;
    payload[view] = { mode: entry.mode, knots: entry.knots };
  }
  const scene = document_.scene?.id;
  try {
    const response = await fetch("/api/contours", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scene, knots: payload }),
    });
    const result = await response.json().catch(() => null);
    if (knotUI.info) knotUI.info.textContent = result?.written ? `saved ${Object.keys(payload).length}` : "save failed";
    return result;
  } catch (error) {
    if (knotUI.info) knotUI.info.textContent = "save failed";
    return { ok: false, problems: [String(error?.message ?? error)] };
  }
}

// --- pointer editing

function editorDown(nx, ny) {
  const hit = platePoint(nx, ny);
  if (!hit) return null;
  const view = hit.view;
  editor.view = view;
  const entry = ensureKnots(view);
  // 10 screen pixels, in the plate's metres. The plate's own scale is what makes a handle grabbable
  // at the zoom the art director is working at.
  const threshold = (10 * mmPerScreenPx()) / 1000;
  const near = nearestKnot(entry.knots, hit.uv);
  if (near && near.distance <= threshold) {
    // A press on a knot grabs it. A press and release with no movement removes it -- that is what
    // makes "click a knot to remove it" and "drag a knot to move it" the same gesture.
    editor.dragging = near.index;
    editor.moved = false;
    editor.fresh = false;
    return { action: "grab", view, index: near.index };
  }
  // An insert must land ON the line. A click in the empty plate that snapped to the nearest ring
  // point would add a knot far from where the art director pointed, and a second click at the same
  // place would add the same knot again.
  const on = nearestOnRing(entry.knots, hit.uv);
  if (!on || on.distance > threshold) return null;
  entry.knots = insertKnot(entry.knots, on.after, on.at);
  editor.dragging = on.after + 1;
  editor.moved = false;
  editor.fresh = true; // a just-inserted knot is not removed by the release
  applyEdit(view);
  return { action: "insert", view, index: on.after + 1 };
}

function editorDrag(nx, ny) {
  if (editor.dragging < 0 || !editor.view) return null;
  const hit = platePoint(nx, ny);
  if (!hit) return null;
  const entry = knots[editor.view];
  if (!entry) return null;
  editor.moved = true;
  entry.knots = moveKnot(entry.knots, editor.dragging, hit.uv);
  applyEdit(editor.view, { volume: false });
  return { action: "move", view: editor.view, index: editor.dragging };
}

function editorUp() {
  const index = editor.dragging;
  const view = editor.view;
  const remove = index >= 0 && !editor.moved && !editor.fresh;
  editor.dragging = -1;
  editor.moved = false;
  editor.fresh = false;
  if (remove && view && knots[view]) {
    knots[view].knots = removeKnot(knots[view].knots, index);
    applyEdit(view);
    return { action: "remove", view, index };
  }
  if (index >= 0 && view && volumeGroup.visible) rebuildVolume();
  return { action: index >= 0 ? "release" : "none", view, index };
}

const canvas = stage.renderer.domElement;
function pointerNdc(event) {
  const rect = canvas.getBoundingClientRect();
  return [
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  ];
}
canvas.addEventListener("pointerdown", (event) => {
  if (!editor.active || event.button !== 0) return;
  const result = editorDown(...pointerNdc(event));
  if (result) canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!editor.active || editor.dragging < 0) return;
  editorDrag(...pointerNdc(event));
});
canvas.addEventListener("pointerup", (event) => {
  if (!editor.active) return;
  editorUp();
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

// --- the cursor
//
// One state, one place. `syncCursor` reads the page and writes the body classes; it never sets
// `canvas.style.cursor` directly, so a later feature can add a state without rewriting the others.
// A view at rest is `pan-ready` -- every view pans with a left drag now -- and `pan-dragging` closes
// the hand while a left drag is in progress. T0004 adds `marquee-armed` between the two.
function syncCursor() {
  document.body.classList.add("pan-ready");
}

// `pan-dragging` is set from this file's own pointerdown with `button === 0`, which it receives only
// when the editor did not claim the press. Cleared on release, cancel and blur, so the hand never
// stays closed after the pointer leaves.
canvas.addEventListener("pointerdown", (event) => {
  if (event.button === 0) document.body.classList.add("pan-dragging");
});
const endPanDrag = () => document.body.classList.remove("pan-dragging");
canvas.addEventListener("pointerup", endPanDrag);
canvas.addEventListener("pointercancel", endPanDrag);
window.addEventListener("blur", endPanDrag);

// --- the panel

function setEditMode(on) {
  editor.active = Boolean(on);
  knotUI.edit?.setAttribute("aria-pressed", String(editor.active));
  if (editor.active) {
    // Editing needs a plate, and a perspective view has none: `edit` on `front-3q` used to open an
    // editor with no line, where every control silently did nothing. Put the camera on a flat view.
    const view = calque.shownView() ?? rig.matchingView() ?? flatView();
    if (view) {
      editor.view = view;
      if (view !== currentView) setView(view);
      else calque.showPlate(view);
    }
  }
  calque.setHandles(editor.active);
  updateKnotInfo();
  stage.nextFrame();
  return editor.active;
}

/** The flat view to edit on: one already edited, else the first flat view in the table. */
function flatView() {
  const edited = Object.keys(knots)[0];
  if (edited) return edited;
  return Object.keys(views).find((name) => !views[name].perspective) ?? null;
}

knotUI.edit?.addEventListener("click", () => setEditMode(!editor.active));
knotUI.poly?.addEventListener("click", () => setJoinMode("poly"));
knotUI.bezier?.addEventListener("click", () => setJoinMode("bezier"));
knotUI.reduce?.addEventListener("click", () => reduceKnots(knotUI.tol?.value));
knotUI.reset?.addEventListener("click", () => resetKnots());
knotUI.save?.addEventListener("click", () => saveKnots());

// The panel follows the plate: `refreshPanel` already runs on every plate change, so the knot count
// and the join buttons describe the view on screen.
refreshPanel = () => {
  picker.render();
  updateKnotInfo();
};

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
      contours: effectiveContours,
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
  syncCursor();
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
  syncCursor();
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
    // The orthographic zoom factor. `orthoHeight` stays the 100 % frame height, so a reader can
    // compute the visible height at any zoom; a capture is always prepared at zoom 1.
    zoom: rig.ortho.zoom,
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

// The fields of one OrbitControls instance, side by side with the other. Every knob that makes the
// two gestures feel alike is here, so `__ctl.controls()` compares the configuration rather than a
// promise. The last three are live readouts the checks need, not configuration.
function describeControls(controls) {
  return {
    enableDamping: controls.enableDamping,
    dampingFactor: controls.dampingFactor,
    enableZoom: controls.enableZoom,
    enablePan: controls.enablePan,
    enableRotate: controls.enableRotate,
    zoomSpeed: controls.zoomSpeed,
    panSpeed: controls.panSpeed,
    rotateSpeed: controls.rotateSpeed,
    zoomToCursor: controls.zoomToCursor,
    screenSpacePanning: controls.screenSpacePanning,
    minZoom: controls.minZoom,
    maxZoom: controls.maxZoom,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
    maxPolarAngle: controls.maxPolarAngle,
    mouseButtons: { ...controls.mouseButtons },
    touches: { ...controls.touches },
    azimuth: controls.getAzimuthalAngle(),
    distance: controls.getDistance(),
    camera: controls.object.position.toArray(),
    target: controls.target.toArray(),
  };
}

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
    zoomPercent: rig.zoomPercent(),
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
  // How the knots are joined: `poly` draws straight lines through them, `bezier` a smooth curve.
  // Both read the SAME knots, so the outline cannot move when the join changes -- only the line
  // between two knots. This is the art director's join control.
  contourMode: async (mode, view) => {
    setJoinMode(mode, view ?? editorView());
    return stage.nextFrame().then(() => modeOf(view ?? editorView() ?? ""));
  },
  // The contour knots: the source the outline and the volume are read from.
  knots: () => ({
    shown: calque.shownView(),
    edited: Object.fromEntries(
      Object.entries(knots).map(([view, entry]) => [view, { mode: entry.mode, count: entry.knots.length }]),
    ),
    counts: Object.fromEntries(
      Object.keys(tracedContours).map((view) => [view, knotsOf(view).length]),
    ),
    positions: knotsOf(calque.shownView())?.map((p) => [Number(p[0].toFixed(4)), Number(p[1].toFixed(4))]) ?? null,
  }),
  knotEdit: (on) => setEditMode(on),
  // What a click at a normalised device coordinate would do: the pick, the nearest knot, and the
  // grab threshold. It is how the pointer path is tested without a mouse.
  knotProbe: (nx, ny) => {
    const hit = platePoint(nx, ny);
    if (!hit) return null;
    const list = knotsOf(hit.view);
    const near = nearestKnot(list, hit.uv);
    return {
      view: hit.view,
      uv: hit.uv.map((v) => Number(v.toFixed(4))),
      threshold_mm: Number(((10 * mmPerScreenPx())).toFixed(2)),
      nearest_index: near?.index ?? null,
      nearest_mm: near ? Number((near.distance * 1000).toFixed(2)) : null,
      grab: Boolean(near && near.distance <= (10 * mmPerScreenPx()) / 1000),
      editing: editor.active,
    };
  },
  knotAdd: async (view, uv) => {
    const entry = ensureKnots(view);
    const on = nearestOnRing(entry.knots, uv);
    if (!on) return null;
    entry.knots = insertKnot(entry.knots, on.after, on.at);
    await applyEdit(view);
    return { view, index: on.after + 1, count: entry.knots.length };
  },
  knotRemove: async (view, index) => {
    const entry = ensureKnots(view);
    entry.knots = removeKnot(entry.knots, index);
    await applyEdit(view);
    return { view, count: entry.knots.length };
  },
  knotMove: async (view, index, uv) => {
    const entry = ensureKnots(view);
    entry.knots = moveKnot(entry.knots, index, uv);
    await applyEdit(view);
    return { view, count: entry.knots.length };
  },
  knotReduce: async (view, mm) => {
    const result = reduceKnots(mm, view);
    await stage.nextFrame();
    return result;
  },
  knotReset: async (view) => {
    resetKnots(view);
    await stage.nextFrame();
    return { view, count: knotsOf(view).length, edited: isEdited(view) };
  },
  knotSave: () => saveKnots(),
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
  // The zoom of the orthographic views. The value is the camera's own, and `setZoom` clamps it
  // through the instance's limits. On a perspective view there is no zoom factor, so a set is a
  // no-op and `applied` is false.
  zoom: (percent) => {
    if (typeof percent === "number" && !rig.state.perspective) {
      rig.setZoom(percent);
      stage.updateHud(currentView);
    }
    const ortho = !rig.state.perspective;
    const visibleHeight = ortho ? rig.state.orthoHeight / rig.state.zoom : null;
    return {
      percent: rig.zoomPercent(),
      applied: ortho,
      mmPerPx: ortho
        ? (visibleHeight * 1000) / window.innerHeight
        : picker.state().mmPerScreenPx,
      visibleHeight,
    };
  },
  // Programmatic pan, in pixels, as documented. `panBy` is `OrbitControls.pan` with the sign
  // convention of a drag already handled by the library.
  pan: (dx, dy) => {
    rig.panBy(dx, dy);
    stage.updateHud(currentView);
    return {
      target: [rig.state.target.x, rig.state.target.y, rig.state.target.z],
      percent: rig.zoomPercent(),
    };
  },
  // The two control instances, field by field, so the check proves the parity instead of trusting a
  // paragraph. `azimuth`, `distance` and `camera` are live readouts, not configuration.
  controls: () => ({ orbit: describeControls(rig.controls), flat: describeControls(rig.flat) }),
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
syncCursor();

// The dev server pushes one message per file change. A full reload is enough here: the model is
// rebuilt from source, and it costs a fraction of a second.
new EventSource("/__reload").onmessage = () => location.reload();
