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
// The view table comes from `viewer/views.json`, not from a constant in this file.
//
// It used to be a constant here, and `shot.ts`, `check.ts`, `compare_silhouette.py` and the vcad
// exporter each held their own copy of it. Five tables, five chances to disagree, and adding a view
// meant five edits. The table also records the two coordinate frames: the viewer is +Y up with +Z
// forward, the vcad kernel is +Z up with +Y forward, and they are 90 degrees apart.
//
// It is loaded before anything else, because `placeCamera` runs at module end.
const VIEWS = await (async () => {
  const response = await fetch("/viewer/views.json");
  if (!response.ok) throw new Error(`views: ${response.status} on /viewer/views.json`);
  const table = await response.json();
  if (!table.views) throw new Error("views: /viewer/views.json has no `views` object");
  return table.views;
})();

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

// ------------------------------------------------------------------ calque

// The reference views, inserted into the scene as planes, the way a Blender user drops a
// front/side/back image in and traces it. This is the whole point: a model traced against a calque
// cannot drift from the reference, because the reference is in the same space as the model.
//
// Three things make the calque trustworthy, and each one is a measurement rather than a guess:
//
//   1. It is sized in METRES, from the real dimensions and the subject's pixel box. A view's two
//      scales differ -- the generated images are stretched -- so the plane is stretched by kx on one
//      axis and ky on the other. A single scale would put a 1400 mm roof at 1470.
//   2. It is placed on the subject's box, not on the image centre. The cropped images carry a 2 px
//      margin, so the two are not the same point, and anchoring on the wrong one shifts every
//      trace by that margin.
//   3. It shows only from its own view. An elevation is a projection down one axis: seen from 20
//      degrees off, it is a picture of a car that is not there. So a plate is masked by default and
//      appears only when the camera is on the axis that drew it.
//
// The `depth` option is the difference between the two tracing habits:
//
//   behind  the plate sits behind the model, opaque. The model occludes it, and the edge you chase
//           is where the model silhouette leaves the reference silhouette.
//   front   the plate sits in front, translucent. You see the reference line over the model, which
//           is how a stray vertex is caught before the silhouette hides it.

const plates = new THREE.Group();
plates.name = "Calque";
plates.renderOrder = -1;
scene.add(plates);

const calque = {
  meta: null,     // dimensions.json and cropped/manifest.json, loaded once
  view: null,     // the view whose plate is shown, or null
  opacity: 1,
  depth: "behind",
  loaded: new Map(),
};

async function calqueLoad(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`calque: ${response.status} on ${url}`);
  return response.json();
}

async function calqueMeta() {
  if (calque.meta) return calque.meta;
  const config = await fetch("./scene.json").then((r) => r.json());
  const subject = config.subject;
  const [dimensions, manifest] = await Promise.all([
    calqueLoad(`/repo/${subject}/dimensions.json`),
    calqueLoad(`/repo/${subject}/cropped/manifest.json`),
  ]);
  calque.meta = { subject, dimensions, manifest };
  return calque.meta;
}

// The screen basis of a named view, without a camera: `right` is what the frame's +x maps to in
// the world, `up` its +y, `dir` points from the subject toward the camera.
function viewBasis(view) {
  const v = VIEWS[view];
  const az = THREE.MathUtils.degToRad(v.azimuth);
  const el = THREE.MathUtils.degToRad(v.elevation);
  const dir = new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az),
  ).normalize();
  const up = new THREE.Vector3(...(v.up ?? [0, 1, 0])).normalize();
  const right = new THREE.Vector3().crossVectors(up, dir).normalize();
  const trueUp = new THREE.Vector3().crossVectors(dir, right).normalize();
  return { right, up: trueUp, dir };
}

async function buildPlate(view) {
  const { subject, dimensions, manifest } = await calqueMeta();
  const entry = manifest.views[view];
  if (!entry) throw new Error(`calque: no cropped reference for "${view}" -- run crop_reference.py`);

  const real = dimensions.real;
  // Which real dimension the image spans on each axis. The VIEW says which model axes it spans
  // (`axes: "zy"`); the SUBJECT says what those axes are called (`roles: { z: "length" }`). A car
  // declares length where a character declares depth, and no table here has to know the difference.
  //
  // The default keeps an old dimensions.json readable; it is the vehicle mapping.
  const roles = dimensions.axes ?? { x: "width", y: "height", z: "length" };
  const [axisH, axisV] = VIEWS[view].axes.split("");
  const realH = (real[roles[axisH]] ?? real.width).value;
  const realV = (real[roles[axisV]] ?? real.height).value;

  // The scale is built on the SUBJECT, never on the cropped file. The crop keeps a margin, and
  // mapping the whole file to the real length makes the subject shorter than the real subject by
  // twice that margin: 4 px, 11 mm on the left view, carried by every point traced afterwards.
  const [sx0, sy0, sx1, sy1] = entry.subject_box;
  const spanH = sx1 - sx0 + 1;
  const spanV = sy1 - sy0 + 1;
  const [offsetX, offsetY] = entry.offset;
  const kx = realH / spanH;            // metres per image pixel, horizontally
  const ky = realV / spanV;            // and vertically, a different number
  const [imgW, imgH] = entry.size_px;

  // The calque is checked against the scales stage 1 wrote. If they disagree, the crop and the
  // calibration were made from different boxes, and every trace would carry the difference.
  const declared = dimensions.views[view]?.scale_mm_per_px;
  if (declared) {
    // dimensions.json was written from the same subject box, so these must now agree to rounding.
    // A tolerance of 0.2 % is the rounding of two independent divisions, nothing more.
    const dx = Math.abs(kx * 1000 / declared.horizontal - 1) * 100;
    const dy = Math.abs(ky * 1000 / declared.vertical - 1) * 100;
    if (dx > 0.2 || dy > 0.2) {
      console.warn(
        `calque ${view}: scale differs from dimensions.json by ${dx.toFixed(2)} % / ` +
        `${dy.toFixed(2)} %. The crop and the calibration disagree; re-run view_scale.py.`,
      );
    }
  }

  const texture = await new THREE.TextureLoader().loadAsync(`/repo/${entry.file}`);
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

  const basis = viewBasis(view);
  // real.height is an object -- { value, source } -- because every real dimension carries where it
  // came from. Reading it as a number yields NaN, and a NaN position makes the plane undrawable
  // while every other field still looks correct.
  const realHeight = (real[roles.y] ?? real.height).value;
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
  // buffers here leaves a plate that loads, parenting cleanly, and draws nothing at all.
  for (const child of [...plates.children]) plates.remove(child);
  if (!view) return null;

  let mesh = calque.loaded.get(view);
  if (!mesh) {
    mesh = await buildPlate(view);
    calque.loaded.set(view, mesh);
  }
  mesh.material.opacity = calque.opacity;
  mesh.material.depthWrite = calque.depth === "behind";
  mesh.material.depthTest = calque.depth === "behind";
  plates.add(mesh);
  return mesh;
}

// A plate belongs to one axis, and the mask tests the AXIS, not the name of the view.
//
// This distinction is load-bearing. Masking on `currentView` looked right and broke tracing: zooming
// in for precision sets the view to "custom", so the plate vanished exactly when it was needed. An
// elevation seen from 20 degrees off is a picture of a car that is not there, but the same elevation
// seen from the same axis at a different zoom is the same projection, and it stays valid.
function matchingView() {
  if (state.perspective) return null;
  for (const [name, view] of Object.entries(VIEWS)) {
    if (view.perspective) continue;
    const dAz = Math.abs(((state.azimuth - view.azimuth + 540) % 360) - 180);
    const dEl = Math.abs(state.elevation - view.elevation);
    if (dAz < 0.5 && dEl < 0.5) return name;
  }
  return null;
}

function syncPlate() {
  const plateView = matchingView();
  if (plateView !== calque.view) {
    showPlate(plateView).catch((error) => console.warn(String(error)));
  }
  plates.visible = Boolean(plateView);
}

// ------------------------------------------------------------------ measure in model units

// The calque is in the scene at the model's own scale, so a point on it IS a model coordinate:
// there is no pixels-to-millimetres conversion left to get wrong. A raycast against the plate
// returns world metres directly, and the two in-plane axes of the view are the two numbers the
// model file wants.
//
// The honest limit is not the unit, it is the SCREEN. A click resolves to one screen pixel, and the
// subject covers as many screen pixels as the current zoom gives it. So the panel always prints the
// current millimetres per screen pixel: trace at a zoom where that number is close to the image's
// own scale (2.8 mm/px on the left view), or the tool will be coarser than the picture it shows.

const measurement = {
  active: false,
  points: [],   // { source, view, world: [x,y,z], u, v, mmPerPx }
};

// The two model axes a view's plane spans come from the view itself: `axes: "zy"` is ["z", "y"].
// This used to be a second table, which said the same thing in a different shape.

function viewOfPlate() {
  return plates.children[0]?.userData.view ?? null;
}

// Millimetres of world per screen pixel, at the depth the camera is aimed at. For an orthographic
// camera this is exact everywhere; for a perspective one it is the value at the target.
function mmPerScreenPx() {
  const height = renderer.domElement.height;
  if (!state.perspective) return (state.orthoHeight * 1000) / height;
  const distance = state.distance;
  const worldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(state.fov) / 2);
  return (worldHeight * 1000) / height;
}

// Pick at a normalised device coordinate -- (-1,-1) is the bottom left, (1,1) the top right -- so a
// caller can test the chain without synthesising a mouse event.
function pickAt(nx, ny, source) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), activeCamera);

  if (source === "model") {
    const hit = raycaster.intersectObject(car, true)[0];
    if (!hit) return null;
    return { source: "model", view: null, world: hit.point.toArray() };
  }

  // The plate, even when the model is in front of it: measurement is about the reference, and the
  // model must not be able to block the point you are trying to read.
  const plate = plates.children[0];
  if (!plate) return null;
  const hit = raycaster.intersectObject(plate, false)[0];
  if (!hit) return null;

  const local = plate.worldToLocal(hit.point.clone());
  return {
    source: "calque",
    view: plate.userData.view,
    world: hit.point.toArray().map((v) => Number(v.toFixed(4))),
    u: local.x,
    v: local.y,
  };
}

function measureRecord(point) {
  const axes = point.view ? VIEWS[point.view].axes.split("") : ["x", "y"];
  const [a, b] = axes;
  const value = (p, axis) => ({ x: p[0], y: p[1], z: p[2] })[axis] * 1000;
  return {
    ...point,
    mmPerPx: Number(mmPerScreenPx().toFixed(3)),
    axes,
    read: {
      [a]: Number(value(point.world, a).toFixed(1)),
      [b]: Number(value(point.world, b).toFixed(1)),
    },
  };
}

function measurePoint(nx, ny, source = "calque") {
  const point = pickAt(nx, ny, source);
  if (!point) return null;
  const record = measureRecord(point);
  measurement.points.push(record);
  pcbRender();
  return record;
}

// The distance between two picks, in model units and broken down per axis.
function measureBetween(i, j) {
  const a = measurement.points[i];
  const b = measurement.points[j];
  if (!a || !b) return null;
  const d = [b.world[0] - a.world[0], b.world[1] - a.world[1], b.world[2] - a.world[2]];
  const axes = a.axes ?? ["x", "y"];
  return {
    from: i,
    to: j,
    axes,
    delta_mm: Object.fromEntries(axes.map((axis, k) => [
      axis, Number((d[["x", "y", "z"].indexOf(axis)] * 1000).toFixed(1)),
    ])),
    length_mm: Number((Math.hypot(...d) * 1000).toFixed(1)),
  };
}

// ------------------------------------------------------------------ measure panel

let pcb = null;

function pcbRender() {
  if (!pcb) {
    pcb = document.createElement("div");
    pcb.id = "measure-panel";
    pcb.style.cssText = [
      "position:fixed", "left:16px", "bottom:16px", "z-index:20",
      "background:#1118", "color:#e7e9ee", "border:1px solid #2e333c", "border-radius:6px",
      "padding:8px 10px", "font:12px/1.5 ui-monospace,monospace", "max-width:520px",
      "white-space:pre", "pointer-events:none", "display:none",
    ].join(";");
    document.body.appendChild(pcb);
  }
  if (!measurement.active && measurement.points.length === 0) {
    pcb.style.display = "none";
    return;
  }
  pcb.style.display = "block";
  const lines = [
    `measure  ${measurement.active ? "click to place a point, shift-click to pick the model" : "idle"}`,
    `precision ${mmPerScreenPx().toFixed(2)} mm per screen px  (the image itself is 2.8 on left)`,
  ];
  measurement.points.forEach((p, i) => {
    const [a, b] = p.axes;
    lines.push(`  ${String(i + 1).padStart(2)}  ${a.toUpperCase()} ${String(p.read[a]).padStart(7)} mm   ` +
               `${b.toUpperCase()} ${String(p.read[b]).padStart(7)} mm   ${p.source}`);
  });
  if (measurement.points.length >= 2) {
    const last = measureBetween(measurement.points.length - 2, measurement.points.length - 1);
    const parts = Object.entries(last.delta_mm).map(([k, v]) => `d${k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`);
    lines.push(`  delta  ${parts.join("   ")}   length ${last.length_mm} mm`);
  }
  pcb.textContent = lines.join("\n");
}

function measureOn() {
  measurement.active = true;
  pcbRender();
  return nextFrame();
}

function measureOff() {
  measurement.active = false;
  pcbRender();
  return nextFrame();
}

function measureClear() {
  measurement.points.length = 0;
  pcbRender();
  return nextFrame();
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!measurement.active) return;
  if (event.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  measurePoint(nx, ny, event.shiftKey ? "model" : "calque");
});

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
  syncPlate();
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
  syncPlate();
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
  // The calque: show a reference view as a plane, or take it away.
  //   calque({ view: "left" })                 show it, opaque, behind the model
  //   calque({ depth: "front", opacity: 0.35 })  trace over the model
  //   calque({ off: true })                    hide
  calque: async (options = {}) => {
    if (options.off) {
      calque.view = null;
      plates.visible = false;
      for (const child of [...plates.children]) plates.remove(child);
      return nextFrame();
    }
    if (typeof options.opacity === "number") calque.opacity = options.opacity;
    if (options.depth) calque.depth = options.depth;
    if (options.opacity !== undefined || options.depth !== undefined) {
      for (const mesh of calque.loaded.values()) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      calque.loaded.clear();
    }
    const view = options.view ?? calque.view ?? currentView;
    await showPlate(view);
    plates.visible = true;
    updateHud(currentView);
    return nextFrame();
  },
  calqueDebug: () => {
    const mesh = plates.children[0];
    if (!mesh) return { children: plates.children.length, plateVisible: plates.visible };
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    return {
      plateVisible: plates.visible,
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
      cameraPosition: activeCamera.position.toArray().map((v) => Number(v.toFixed(2))),
    };
  },
  calqueInfo: () => ({
    shown: plates.visible ? calque.view : null,
    depth: calque.depth,
    opacity: calque.opacity,
    plates: plates.children.map((child) => ({
      view: child.userData.view,
      metrics: child.userData.metrics,
    })),
  }),
  // Measurement in model units. A point on the calque is a model coordinate, because the plate is
  // already at the model's scale and in its frame.
  measure: (options = {}) => {
    if (options.off) return measureOff();
    if (options.clear) return measureClear();
    if (options.on) return measureOn();
    return nextFrame();
  },
  measurePoints: () => ({
    active: measurement.active,
    mmPerScreenPx: Number(mmPerScreenPx().toFixed(3)),
    points: measurement.points,
    between: measurement.points.length >= 2
      ? measureBetween(0, measurement.points.length - 1)
      : null,
  }),
  // Pick programmatically, at a normalised device coordinate. This is what lets the chain be tested
  // without a mouse: pick the two ends of the calibrated plate and check the distance in metres.
  measurePick: (nx, ny, source = "calque") => {
    const record = measurePoint(nx, ny, source);
    if (!record) return null;
    return {
      ...record,
      between: measurement.points.length >= 2
        ? measureBetween(measurement.points.length - 2, measurement.points.length - 1)
        : null,
    };
  },
  reset: ctlReset,
  wait: () => nextFrame(),
};

placeCamera(currentView);
syncButtons();

