// R5 TL 1972 — the body volume. Authoring source for stage 2 of volume modelling.
//
// This file is the body and nothing else. The body is the volume that holds the subject together,
// and it is what remains when every separate part is removed. Every accessory -- bumper, lamp,
// pane, strip, mirror, wheel, and the plate that closes a wheel arch -- lives in `accessories.js`
// and is NOT mounted here. Stage 2 is judged on this volume alone; stage 3 puts the parts back on.
//
// This file is a pure ES module: no DOM, no renderer, no network, and no sibling import. The viewer
// imports it in the browser, and a script imports it in Bun to measure it. One source, one truth.
//
// Units: metres. 1 unit = 1 m, the game-asset convention. Axis: +Y up, +Z forward (the nose).
// Origin: the centre of the base, so the tyres touch Y = 0 when they are mounted.
//
// Method. No CSG. Each volume is a side profile extruded across X, then tapered so it is not a
// slab. The wheel arches are holes in the lower profile, so one shape carries the whole silhouette.
//
// The proportions are MEASURED, not estimated. `dimensions.json` holds the real dimensions and the
// two scales of every view; `scripts/measure/` reads distances on the reference images. The numbers
// below come from those runs, and each comment names the measurement it answers to.

import * as THREE from "three";

// The real dimensions: an INPUT, and the only thing the gates measure against. They come from the
// manufacturer's sheet for a Renault 5 TL (1972) and are mirrored in `dimensions.json` under `real`.
// They are never read from the views that the model is checked against: that check would be
// circular, every error would be normalized away, and every gate would pass.
export const REAL = {
  length: 3.521,
  width: 1.525,
  height: 1.4,
};

// How the model is authored, in metres. These are geometry values, not targets: some of them are
// still the picture's figures and stage 2 replaces them one measurement at a time.
export const DIM = {
  length: 3.52,
  width: 1.53,

  // NOT the car's height, and stage 2 replaces it first. 1.542 was obtained by dividing the height
  // in pixels by the SAME scale as the length, which assumes the picture is not stretched. It is
  // stretched, by 6 to 9 %, so that number describes the image and nothing else. The real height is
  // 1.400 m, from the manufacturer sheet, and it is recorded in `dimensions.json`.
  height: 1.542, // picture height; superseded by 1.400 in stage 2

  wheelRadius: 0.265, // tyre diameter 530 mm, measured tyre, both flank views
  wheelWidth: 0.17,
  track: 0.665, // wheel centre, so the outer face sits just inside the flank
  axleFront: 1.18, // measured: front axle 580 mm from the nose

  // -1.19 gives a wheelbase of 2.370 m. The measured wheelbase is 2.414 m, rim centre to rim
  // centre on the left view, and the manufacturer sheet says 2.420. Stage 2 moves this to -1.234.
  axleRear: -1.19,

  bodyHalfLength: 1.76,
  bodyHalfWidth: 0.765,
  cabinHalfWidth: 0.666, // the greenhouse is 0.87 of the body width at the belt
  cabinRoofHalfWidth: 0.474, // and 0.62 of it at the roof: the tumblehome
  sill: 0.265, // measured underside
  belt: 0.985, // measured glass bottom, steady from the cowl to the tail
  archRadius: 0.315,
};

// The side profile of the lower body, in (Z, Y). Measured upper edge from the nose:
//   0 -> 520   150 -> 660   320 -> 900   640 -> 1000   1010 -> 1025 (cowl)
// then the belt line at 985 runs to the tail, and the tail panel closes at 3521.
export const BODY_PROFILE = [
  [1.76, 0.3],
  [1.66, 0.265],
  [-1.68, 0.265],
  [-1.76, 0.32],
  [-1.76, 0.72],
  [-1.68, 0.985],
  [0.75, 0.985],
  [0.75, 1.025],
  [1.12, 1.0],
  [1.44, 0.9],
  [1.61, 0.66],
  [1.76, 0.52],
];

// The greenhouse. Measured: windshield base at 1010 mm, roof from 1560 to 2800, hatch slope down to
// 890 at 3400. The roof sits at 1.515-1.529, and that is the picture's height, not the car's: the
// real roof line is 1.400. Stage 2 lowers it here rather than by scaling the whole volume.
export const CABIN_PROFILE = [
  [0.75, 0.985],
  [0.2, 1.515],
  [-1.0, 1.529],
  [-1.64, 0.94],
];

// ---------------------------------------------------------------- materials

// The body's own materials. An accessory brings the ones it needs from the same table, so the paint
// on a bumper matches the paint on the flank by construction.
export function createMaterials() {
  const m = {};
  m.paint = new THREE.MeshStandardMaterial({
    name: "paint", color: 0xd8601f, roughness: 0.45, metalness: 0.04,
  });
  m.trim = new THREE.MeshStandardMaterial({
    name: "trim", color: 0xb3ab9c, roughness: 0.75, metalness: 0.0,
  });
  m.glass = new THREE.MeshStandardMaterial({
    name: "glass", color: 0x2f3a44, roughness: 0.05, metalness: 0.4,
    side: THREE.DoubleSide,
  });
  m.rubber = new THREE.MeshStandardMaterial({
    name: "rubber", color: 0x191a1c, roughness: 0.93, metalness: 0.0, flatShading: true,
  });
  m.rim = new THREE.MeshStandardMaterial({
    name: "rim", color: 0xa6a6a0, roughness: 0.4, metalness: 0.7, flatShading: true,
  });
  m.dark = new THREE.MeshStandardMaterial({
    name: "dark", color: 0x27272a, roughness: 0.85, metalness: 0.1,
  });
  m.lamp = new THREE.MeshStandardMaterial({
    name: "lamp", color: 0xd8d8d2, roughness: 0.12, metalness: 0.65,
  });
  m.tail = new THREE.MeshStandardMaterial({
    name: "tail", color: 0xa81f18, roughness: 0.32, metalness: 0.1,
    emissive: 0x360502, emissiveIntensity: 1.0,
  });
  m.amber = new THREE.MeshStandardMaterial({
    name: "amber", color: 0xc86a12, roughness: 0.35, metalness: 0.1,
  });
  m.well = new THREE.MeshStandardMaterial({
    name: "well", color: 0x121214, roughness: 1.0, metalness: 0.0,
    side: THREE.DoubleSide,
  });
  return m;
}

// ---------------------------------------------------------------- geometry helpers

// The wheel arch, as a filled shape: a circular segment whose chord lies on the body's underside.
// Not used in stage 2 -- the body is not cut yet. It is here because stage 3 cuts the arch with it.
export function archShape({ z, y, radius, floor }) {
  const chord = Math.sqrt(Math.max(radius * radius - (y - floor) ** 2, 0.0001));
  const shape = new THREE.Shape();
  shape.moveTo(z - chord, floor);
  shape.lineTo(z - radius, y);
  shape.absarc(z, y, radius, Math.PI, 0, true);
  shape.lineTo(z + chord, floor);
  shape.closePath();
  return shape;
}

// Multiply each vertex's X by a function of its Y and Z. This is how a constant-section extrusion
// becomes a tapered one: the tumblehome of the greenhouse, and the narrowing of the body ends.
// Without it, every car is a slab with a roof.
export function taper(geometry, { byY, byZ } = {}) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    let factor = 1;
    if (byY) factor *= byY(y);
    if (byZ) factor *= byZ(z);
    position.setX(i, x * factor);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// A closed polygon in the (Z, Y) plane, extruded across X and centred on X = 0.
export function extrudeAcrossX(points, width, holes = []) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  shape.closePath();
  shape.holes.push(...holes);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  return geometry;
}

// The half-width of the greenhouse at a given height, so a pane can be laid on its surface.
export function cabinHalfWidthAt(y) {
  const ratio = DIM.cabinRoofHalfWidth / DIM.cabinHalfWidth;
  return DIM.cabinHalfWidth * (1 - (1 - ratio) * clamp01((y - DIM.belt) / 0.545));
}

// ---------------------------------------------------------------- parts

function buildLowerBody(materials) {
  // NO HOLES. Stage 2 models the body as one closed volume, and the silhouette is the thing the
  // gate measures. A cut-out changes the silhouette, so cutting one now makes the gate unable to
  // measure what it is for. Wheel arches, window openings and lamp recesses are all cut in stage 3,
  // when the part they receive has been measured and is ready to go in.
  const geometry = extrudeAcrossX(BODY_PROFILE, DIM.width);
  // The body tucks in at both ends: the reference's plan view narrows to about 0.9 of full width.
  taper(geometry, {
    byZ: (z) => 1 - 0.09 * clamp01((Math.abs(z) - 1.15) / 0.61),
    byY: (y) => 1 - 0.05 * clamp01((y - DIM.sill) / (DIM.belt - DIM.sill)),
  });
  const mesh = new THREE.Mesh(geometry, materials.paint);
  mesh.name = "Body";
  return mesh;
}

function buildCabin(materials) {
  const geometry = extrudeAcrossX(CABIN_PROFILE, DIM.cabinHalfWidth * 2);
  // Tumblehome: the greenhouse is full width at the belt and 0.712 of it at the roof.
  const ratio = DIM.cabinRoofHalfWidth / DIM.cabinHalfWidth;
  taper(geometry, {
    byY: (y) => 1 - (1 - ratio) * clamp01((y - DIM.belt) / 0.545),
  });
  const mesh = new THREE.Mesh(geometry, materials.paint);
  mesh.name = "Cabin";
  return mesh;
}

// ---------------------------------------------------------------- assembly

// The body volume, and nothing else. Two named nodes, both closed volumes, both paint.
export function buildBody(materials = createMaterials()) {
  const root = new THREE.Group();
  root.name = "R5_TL_1972";
  root.add(buildLowerBody(materials));
  root.add(buildCabin(materials));
  root.userData.dimensions = DIM;
  root.userData.stage = 2;
  return root;
}

// ---------------------------------------------------------------- measurement

export function measure(object) {
  const box = new THREE.Box3().setFromObject(object);
  let triangles = 0;
  let meshes = 0;
  object.traverse((node) => {
    if (!node.isMesh) return;
    meshes += 1;
    const index = node.geometry.getIndex();
    const position = node.geometry.getAttribute("position");
    triangles += index ? index.count / 3 : (position?.count ?? 0) / 3;
  });
  return {
    min: box.min.toArray().map((v) => Number(v.toFixed(3))),
    max: box.max.toArray().map((v) => Number(v.toFixed(3))),
    size: box.getSize(new THREE.Vector3()).toArray().map((v) => Number(v.toFixed(3))),
    triangles: Math.round(triangles),
    meshes,
  };
}

// What stage 2 is checked against, in millimetres, so a report needs no unit conversion.
export function target() {
  return {
    length: REAL.length * 1000,
    width: REAL.width * 1000,
    height: REAL.height * 1000,
  };
}

// The delta between the built body and the real dimensions, per axis, in millimetres.
// A positive delta means the model is too big on that axis.
//
// Height is measured FROM THE GROUND, not from the lowest vertex. This is not a detail: stage 2
// removes the wheels, so the body's lowest point is the sill, 265 mm up. A bounding box would then
// report 1.264 m for a body whose roof is at 1.529, and stage 2 would "fix" the roof downwards by
// 265 mm to compensate for a wheel that is merely not mounted yet.
//
// The asset contract puts the origin at the centre of the base, so the ground is Y = 0 and the
// height of the subject is simply the top of the body.
export function deviation(object) {
  const { min, max, size } = measure(object);
  const real = REAL;
  return {
    length: Number(((size[2] - real.length) * 1000).toFixed(1)),
    height: Number((max[1] * 1000 - real.height * 1000).toFixed(1)),
    width: Number(((size[0] - real.width) * 1000).toFixed(1)),
    // How far the body floats above the ground, which is the ground clearance of the subject.
    sill: Number((min[1] * 1000).toFixed(1)),
  };
}
