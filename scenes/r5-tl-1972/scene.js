// Viewer for the scene. Owns the renderer, camera and lights; the model comes from model.js.
//
// The dev loop is: edit model.js, the server pushes a reload, the page rebuilds. No build step,
// no watcher library. The same page answers programmatic captures:
//
//   ?view=front-3q   start on a named view
//   ?shot=1          hide the HUD, white background (used by scripts/scene/shot.ts)
//
// and it exposes `window.__setView(name)`, which resolves once the frame is drawn, plus
// `window.__stats()`. That is all the capture script needs.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildBody, measure, target, deviation } from "./model.js";

const params = new URLSearchParams(location.search);
const SHOT = params.get("shot") === "1";
if (SHOT) document.body.classList.add("shot");

// ------------------------------------------------------------------ renderer

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SHOT ? 0xffffff : 0xeef0f2);

// RoomEnvironment is a procedural studio box: PBR materials get reflections without an HDR
// file, so the scene stays a single self-contained directory.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

// ------------------------------------------------------------------ camera

const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.1, 200);

// The blueprint sheets are orthographic elevations, so a perspective shot can never line up with
// one. The flat views therefore use a second camera: an orthographic one, framed on the model.
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 200);
ortho.up.set(0, 1, 0);

// Orientation. The model is +Y up and +Z forward (the nose). Azimuth is measured from +X, and
// the camera looks back at the origin, so:
//
//   azimuth   0  camera at +X  → sees the +X flank, nose on the LEFT of the frame
//   azimuth 180  camera at -X  → sees the -X flank, nose on the RIGHT of the frame
//
// For a car nose-up-north, right = forward × up = (+Z) × (+Y) = -X, so the driver's right hand
// points to -X and the car's LEFT flank faces +X. The left view is therefore azimuth 0, and it
// puts the nose on the left — which is how the corrected blueprint draws it.
//
// This pair is easy to get backwards, and a mirrored silhouette still looks plausible, so a
// mirrored comparison can survive a whole pass. It did: the two reference files carried inverted
// labels, and for three passes the renders were compared against the wrong flank. Check the
// nose side once, in the render and in the reference, before trusting any overlay.
const VIEWS = {
  "front-3q": { azimuth: 60, elevation: 30, perspective: true },
  "rear-3q": { azimuth: 240, elevation: 30, perspective: true },
  front: { azimuth: 90, elevation: 0, perspective: false },
  back: { azimuth: 270, elevation: 0, perspective: false },
  left: { azimuth: 0, elevation: 0, perspective: false },
  right: { azimuth: 180, elevation: 0, perspective: false },
  top: { azimuth: 90, elevation: 89.99, perspective: false, up: [0, 0, -1] },
  iso: { azimuth: 40, elevation: 22, perspective: true },
};

const DISTANCE = 10.5;
let activeCamera = camera;

// One state drives both cameras. A named view is just a preset written into it, so a manual
// `camera({azimuth: 37})` and a named view cannot disagree about what the page is showing.
const state = {
  azimuth: 60,
  elevation: 30,
  distance: DISTANCE,
  target: new THREE.Vector3(0, 0.7, 0),
  perspective: true,
  orthoHeight: 4.4,
  fov: 26,
  up: [0, 1, 0],
};

function frameOrtho() {
  const aspect = window.innerWidth / window.innerHeight;
  const h = state.orthoHeight;
  ortho.left = (-h * aspect) / 2;
  ortho.right = (h * aspect) / 2;
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
  const view = VIEWS[name] ?? VIEWS["front-3q"];
  Object.assign(state, {
    azimuth: view.azimuth,
    elevation: view.elevation,
    distance: DISTANCE,
    perspective: Boolean(view.perspective),
    up: view.up ?? [0, 1, 0],
  });
  applyCamera();
}

const controls = new OrbitControls(camera, renderer.domElement);
// Any manual orbit invalidates the view name: the page is no longer showing `left`, it is showing
// wherever the user dragged it. Without this, a capture could inherit a hand-moved camera and still
// report the view it was told to report.
controls.addEventListener("start", () => {
  if (currentView !== "custom") {
    currentView = "custom";
    syncButtons();
  }
});
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 24;
controls.maxPolarAngle = Math.PI / 2;
controls.enabled = false; // enabled only on the perspective views

// ------------------------------------------------------------------ lights

const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(4.2, 6.4, 5.0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 20;
key.shadow.camera.left = -4.5;
key.shadow.camera.right = 4.5;
key.shadow.camera.top = 4.5;
key.shadow.camera.bottom = -4.5;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.015;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
fill.position.set(-5.0, 3.2, -4.0);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.5);
rim.position.set(0, 2.0, -6.0);
scene.add(rim);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bcc0, 0.35));

// ------------------------------------------------------------------ ground

// In capture mode there is no ground: the blueprint sheets are white field, and a shadow
// would break the comparison. In the viewer the ground gives scale and contact.
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(9, 48),
  new THREE.MeshStandardMaterial({ color: 0xdfe2e6, roughness: 0.95, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.name = "Ground";
ground.visible = !SHOT;
scene.add(ground);

const grid = new THREE.GridHelper(12, 24, 0xb0b6bd, 0xcdd2d7);
grid.position.y = 0.001;
grid.visible = !SHOT;
scene.add(grid);

// ------------------------------------------------------------------ model

// The body only. Every accessory lives in accessories.js and is not mounted: stage 2 is judged on
// this volume alone, and a part that is present hides the volume that the gate is about.
const car = buildBody();
scene.add(car);

// ------------------------------------------------------------------ hud

const hud = {
  view: document.getElementById("hud-view"),
  tris: document.getElementById("hud-tris"),
  meshes: document.getElementById("hud-meshes"),
  draws: document.getElementById("hud-draws"),
  size: document.getElementById("hud-size"),
};

function updateHud(name) {
  const stats = measure(car);
  if (hud.view) hud.view.textContent = name;
  if (hud.tris) hud.tris.textContent = stats.triangles.toLocaleString("en-US");
  if (hud.meshes) hud.meshes.textContent = String(stats.meshes);
  if (hud.draws) hud.draws.textContent = String(renderer.info.render.calls);
  if (hud.size) hud.size.textContent = stats.size.map((v) => v.toFixed(2)).join(" × ");
}

// ------------------------------------------------------------------ view buttons

let currentView = params.get("view") ?? "front-3q";
const bar = document.getElementById("views");
if (bar) {
  for (const name of Object.keys(VIEWS)) {
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

// ------------------------------------------------------------------ loop

let frames = 0;
let waiters = [];

renderer.setAnimationLoop(() => {
  if (activeCamera === camera) controls.update();
  renderer.render(scene, activeCamera);
  frames += 1;
  if (frames === 2) {
    updateHud(currentView);
    window.__ready = true;
  }
  if (waiters.length > 0) {
    // One extra frame so the resolved caller sees the frame that was just drawn.
    const pending = waiters;
    waiters = [];
    requestAnimationFrame(() => pending.forEach((resolve) => resolve({ calls: renderer.info.render.calls })));
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  frameOrtho();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------------ script API

// Resolves once a frame that includes the new camera position has been drawn.
function nextFrame() {
  return new Promise((resolve) => waiters.push(resolve));
}

function setView(name) {
  currentView = name in VIEWS ? name : "front-3q";
  placeCamera(currentView);
  syncButtons();
  updateHud(currentView);
  return nextFrame();
}

// ------------------------------------------------------------------ control surface

// A capture that only knows the eight named views cannot answer the question a modelling pass
// actually asks: "and from here, does it still read?". These commands move the camera freely and
// change what the frame contains, so a pass can be judged from any angle and with the body alone.

const meshesMatching = (name) => {
  const out = [];
  car.traverse((object) => {
    if (!object.isMesh) return;
    if (name && object.name !== name) return;
    out.push(object);
  });
  return out;
};

let savedVisibility = null;

function restoreVisibility() {
  if (!savedVisibility) return;
  for (const [object, visible] of savedVisibility) object.visible = visible;
  savedVisibility = null;
}

function ctlCamera(options = {}) {
  for (const field of ["azimuth", "elevation", "distance", "fov", "orthoHeight"]) {
    if (typeof options[field] === "number") state[field] = options[field];
  }
  if (typeof options.perspective === "boolean") state.perspective = options.perspective;
  if (Array.isArray(options.up)) state.up = options.up;
  if (options.target) {
    state.target.set(
      options.target.x ?? state.target.x,
      options.target.y ?? state.target.y,
      options.target.z ?? state.target.z,
    );
  }
  if (options.reset) {
    state.target.set(0, 0.7, 0);
    state.up = [0, 1, 0];
    state.orthoHeight = 4.4;
    state.fov = 26;
  }
  currentView = "custom";
  syncButtons();
  applyCamera();
  updateHud("custom");
  return nextFrame();
}

function ctlOrtho(options = {}) {
  // `enabled: true` asks for the orthographic camera; without it, the projection is toggled.
  const perspective =
    options.enabled === true ? false : options.enabled === false ? true : !state.perspective;
  return ctlCamera({
    perspective,
    orthoHeight: typeof options.height === "number" ? options.height : state.orthoHeight,
  });
}

function ctlWireframe(options = {}) {
  const enabled = options.enabled !== false;
  const meshes = meshesMatching(options.name ?? null);
  for (const mesh of meshes) {
    for (const material of [].concat(mesh.material)) {
      if (material && "wireframe" in material) material.wireframe = enabled;
    }
  }
  return nextFrame();
}

function ctlIsolate(options = {}) {
  const name = options.name ?? null;
  restoreVisibility();
  if (name === null) return nextFrame();
  const node = car.getObjectByName(name);
  if (!node) throw new Error(`no node named "${name}" in the model`);
  // The map holds every node of the car, so one restore puts the model back exactly as it was.
  savedVisibility = new Map();
  car.traverse((object) => savedVisibility.set(object, object.visible));
  car.traverse((object) => { object.visible = false; });
  node.traverse((object) => { object.visible = true; });
  for (let parent = node.parent; parent; parent = parent.parent) parent.visible = true;
  return nextFrame();
}

function ctlVisible(options = {}) {
  const name = options.name;
  if (!name) throw new Error("visible() needs a name");
  const node = car.getObjectByName(name);
  if (!node) throw new Error(`no node named "${name}" in the model`);
  node.visible = options.visible !== false;
  return nextFrame();
}

function ctlBackground(options = {}) {
  const color = options.color ?? null;
  if (color === null || color === "transparent") {
    scene.background = null;
    renderer.setClearAlpha(0);
  } else {
    scene.background = new THREE.Color(color);
    renderer.setClearAlpha(1);
  }
  return nextFrame();
}

function ctlGrid(options = {}) {
  grid.visible = options.enabled !== false;
  return nextFrame();
}

function ctlGround(options = {}) {
  ground.visible = options.enabled !== false;
  return nextFrame();
}

function ctlShadows(options = {}) {
  const enabled = options.enabled !== false;
  renderer.shadowMap.enabled = enabled;
  key.castShadow = enabled;
  ground.receiveShadow = enabled;
  renderer.shadowMap.needsUpdate = true;
  return nextFrame();
}

function ctlExposure(options = {}) {
  if (typeof options.value === "number") renderer.toneMappingExposure = options.value;
  return nextFrame();
}

function nodeList() {
  const out = [];
  car.traverse((object) => {
    if (!object.name) return;
    out.push({
      name: object.name,
      type: object.type,
      visible: object.visible,
      triangles: object.isMesh && object.geometry?.index
        ? object.geometry.index.count / 3
        : object.isMesh ? (object.geometry?.attributes?.position?.count ?? 0) / 3 : 0,
    });
  });
  return out;
}

function ctlReset() {
  restoreVisibility();
  ctlWireframe({ enabled: false });
  scene.background = new THREE.Color(SHOT ? 0xffffff : 0xeef0f2);
  renderer.setClearAlpha(1);
  grid.visible = !SHOT;
  ground.visible = !SHOT;
  renderer.toneMappingExposure = 1.05;
  return setView(params.get("view") ?? "front-3q");
}

window.__setView = setView;
window.__views = Object.keys(VIEWS);
// The orthographic frame in millimetres per pixel, and the pixel size it maps to. A silhouette
// comparison needs these: without them the render is just a picture and cannot be laid on the
// reference in metric space.
function orthoFrame() {
  const camera_ = activeCamera;
  return {
    mmPerPx: state.perspective
      ? null
      : (state.orthoHeight * 1000) / window.innerHeight,
    viewport: [window.innerWidth, window.innerHeight],
    orthoHeight: state.perspective ? null : state.orthoHeight,
    target: [state.target.x, state.target.y, state.target.z],
    azimuth: state.azimuth,
    elevation: state.elevation,
    perspective: state.perspective,
  };
}

window.__stats = () => ({
  ...measure(car),
  frame: orthoFrame(),
  // What the body is checked against, and where it stands. Millimetres, because that is the unit of
  // the gates: G2 allows 100 mm or 3 % of the largest dimension, whichever is smaller.
  target: target(),
  deviation: deviation(car),
  calls: renderer.info.render.calls,
  view: currentView,
  viewport: [window.innerWidth, window.innerHeight],
});

window.__ctl = {
  view: setView,
  views: () => Object.keys(VIEWS),
  camera: ctlCamera,
  ortho: ctlOrtho,
  wireframe: ctlWireframe,
  isolate: ctlIsolate,
  visible: ctlVisible,
  background: ctlBackground,
  grid: ctlGrid,
  ground: ctlGround,
  shadows: ctlShadows,
  exposure: ctlExposure,
  nodes: nodeList,
  stats: () => window.__stats(),
  state: () => ({
    ...state,
    // The view NAME, so a caller can prove the page is on the view it asked for. `camera` and the
    // orbit controls both set this to "custom", so a hand-moved camera can never claim to be `left`.
    view: currentView,
    target: [state.target.x, state.target.y, state.target.z],
  }),
  reset: ctlReset,
  wait: () => nextFrame(),
};

placeCamera(currentView);
syncButtons();

