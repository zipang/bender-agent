// R5 TL 1972 — the body volume. Stage 2 of volume modelling, started from zero.
//
// NOTHING HERE IS TRACED YET. This file is the frame the tracing will fill, and it is deliberately
// almost empty. The previous body was built before any measuring instrument existed, and every one
// of its numbers had to be guessed from a picture by eye; by the time the instruments were ready it
// had become impossible to say why any vertex was where it was. So it is gone. `563c7ce` still has
// it, for reference only: do not copy numbers out of it.
//
// The rules this file exists to enforce:
//
//   1. The body is ONE closed volume. No hole. Wheel arches, window openings and lamp recesses are
//      cut in stage 3, when the part that fills each one has been measured. A hole changes the
//      silhouette, and the silhouette is what the gate measures.
//   2. Every number carries the measurement that produced it. A value with no source is a guess
//      with good manners, and there is no room for one.
//   3. Nothing is placed by eye. Steps 1 to 3 of the method give a metric frame; the calque
//      (`scene.json` -> `/repo/.../cropped/`) puts the reference in it; and a point is read in that
//      frame, not in a screenshot.
//
// Units: metres. Axis: +Y up, +Z forward (the nose). Origin: the centre of the base, so the subject
// stands on Y = 0.
//
// This file is a pure ES module: no DOM, no renderer, no network, and no sibling import.

import * as THREE from "three";

// The real dimensions: an INPUT. They come from the manufacturer's sheet for a Renault 5 TL (1972)
// and they are mirrored in `dimensions.json` under `real`. They are never read from the views that
// the model is checked against, because that check would be circular: every error would be
// normalized away and every gate would pass.
export const REAL = {
  length: 3.521,
  width: 1.525,
  height: 1.4,
};

// The body as it stands: a plain box at the right overall size, and nothing else.
//
// It is a placeholder with a purpose. It gives the calque a visible object to occlude, it puts the
// scene's camera framing on the right volume, and it makes the first silhouette comparison honest:
// the numbers will be obviously wrong, so the difference between them and the next pass will be
// visibly the work done, not the noise of a model that looks close by accident.
//
// Replace it section by section, in this order, and re-run `compare_silhouette.py` after each one:
//   a. the side elevation profile, traced on `left` with kx 2.824 / ky 2.651 mm per pixel
//   b. the plan profile, traced on `top`
//   c. the cross-sections, read off `front` and `back`
export const SECTIONS = [];

// ---------------------------------------------------------------- materials

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

// ---------------------------------------------------------------- helpers used by stage 3

// A closed polygon in the (Z, Y) plane, extruded across X and centred on X = 0.
// Unused at stage 2, where the body is not yet a profile. Kept because stage 3 cuts the arches.
export function extrudeAcrossX(points, width, holes = []) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  shape.closePath();
  shape.holes.push(...holes);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: false, curveSegments: 24,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  return geometry;
}

// The wheel arch, as a filled shape: a circular segment whose chord lies on the body's underside.
// Stage 3 cuts the arch with it. Stage 2 has no arch.
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

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------- the body

function buildPlaceholder(materials) {
  // The real box, centred on X = 0 and Z = 0, sitting on Y = 0. Ground clearance belongs to the
  // wheels, which are stage 3, so the box starts at the ground and reaches the real height.
  const geometry = new THREE.BoxGeometry(REAL.width, REAL.height, REAL.length);
  const mesh = new THREE.Mesh(geometry, materials.paint);
  mesh.name = "Body";
  mesh.position.set(0, REAL.height / 2, 0);
  return mesh;
}

export function buildBody(materials = createMaterials()) {
  const root = new THREE.Group();
  root.name = "R5_TL_1972";
  root.add(buildPlaceholder(materials));
  root.userData.real = REAL;
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
// Height is measured FROM THE GROUND, not from the lowest vertex. This matters: at stage 2 the
// wheels are not mounted, so the body's lowest point is the sill, which is not zero. A bounding box
// would report the body as short by exactly the ground clearance, and a later pass would "fix" the
// roof downwards to compensate for a wheel that was merely absent.
export function deviation(object) {
  const { min, max, size } = measure(object);
  return {
    length: Number(((size[2] - REAL.length) * 1000).toFixed(1)),
    height: Number((max[1] * 1000 - REAL.height * 1000).toFixed(1)),
    width: Number(((size[0] - REAL.width) * 1000).toFixed(1)),
    sill: Number((min[1] * 1000).toFixed(1)),
  };
}
