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
import { buildCar, measure } from "./model.js";

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
const target = new THREE.Vector3(0, 0.7, 0);

// The blueprint sheets are orthographic elevations, so a perspective shot can never line up with
// one. The flat views therefore use a second camera: an orthographic one, framed on the model.
const orthoHeight = 4.4;
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

function frameOrtho() {
  const aspect = window.innerWidth / window.innerHeight;
  ortho.left = (-orthoHeight * aspect) / 2;
  ortho.right = (orthoHeight * aspect) / 2;
  ortho.top = orthoHeight / 2;
  ortho.bottom = -orthoHeight / 2;
  ortho.updateProjectionMatrix();
}

function placeCamera(name) {
  const view = VIEWS[name] ?? VIEWS["front-3q"];
  const az = THREE.MathUtils.degToRad(view.azimuth);
  const el = THREE.MathUtils.degToRad(view.elevation);
  const position = new THREE.Vector3(
    target.x + DISTANCE * Math.cos(el) * Math.cos(az),
    target.y + DISTANCE * Math.sin(el),
    target.z + DISTANCE * Math.cos(el) * Math.sin(az),
  );

  activeCamera = view.perspective ? camera : ortho;
  activeCamera.up.set(...(view.up ?? [0, 1, 0]));
  activeCamera.position.copy(position);
  activeCamera.lookAt(target);

  controls.enabled = Boolean(view.perspective);
  if (view.perspective) {
    controls.target.copy(target);
    controls.update();
  } else {
    frameOrtho();
  }
}

const controls = new OrbitControls(camera, renderer.domElement);
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
if (!SHOT) {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.MeshStandardMaterial({ color: 0xdfe2e6, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "Ground";
  scene.add(ground);

  const grid = new THREE.GridHelper(12, 24, 0xb0b6bd, 0xcdd2d7);
  grid.position.y = 0.001;
  scene.add(grid);
}

// ------------------------------------------------------------------ model

const car = buildCar();
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

window.__setView = setView;
window.__views = Object.keys(VIEWS);
window.__stats = () => ({
  ...measure(car),
  calls: renderer.info.render.calls,
  view: currentView,
  viewport: [window.innerWidth, window.innerHeight],
});

placeCamera(currentView);
syncButtons();
