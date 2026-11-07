// R5 TL 1972 — the accessories: every part that is not the body volume.
//
// Stage 2 of volume modelling models the body ALONE. It is the volume that holds the subject
// together, and it is what remains when every separate part is removed. Stage 3 adds each
// accessory, one per pass, measured alone then placed on the body.
//
// So these parts are kept here and are NOT mounted. `model.js` builds the body, the scene shows the
// body, and this file is the record of what still has to go on it. Nothing here is deleted: stage 3
// re-measures each part against the rebuilt body and places it as its own named node.
//
// What counts as an accessory is not a judgement call, it is a definition: a part that has its own
// volume, its own name, or its own pivot. A bumper, a lamp, a pane, a wheel, and the dark plate that
// closes a wheel arch all qualify. The two things that do not are `Body` and `Cabin`.
//
// Units: metres. Axis: +Y up, +Z forward (the nose). Same frame as `model.js`.

import * as THREE from "three";
import { DIM, cabinHalfWidthAt, clamp01, createMaterials, archShape } from "./model.js";

// ---------------------------------------------------------------- geometry helpers

function quad(a, b, c, d) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    ...a, ...b, ...c,
    ...a, ...c, ...d,
  ]), 3));
  const ab = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a));
  const ac = new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a));
  const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
  const normals = new Float32Array(18);
  for (let i = 0; i < 6; i += 1) normals.set([normal.x, normal.y, normal.z], i * 3);
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(
    new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2,
  ));
  return geometry;
}

// Push a quad out along its own normal, so a pane sits on a surface instead of in it.
function offsetQuad(a, b, c, d, distance) {
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dy, dz) || 1;
  const n = [0, (dz / length) * distance, (-dy / length) * distance];
  const push = (p) => [p[0], p[1] + n[1], p[2] + n[2]];
  return quad(push(a), push(b), push(c), push(d));
}

function box(w, h, d, x, y, z, material, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

// ---------------------------------------------------------------- parts

// A dark plate inside each arch, just inboard of the tyre. It closes the tunnel so the arch never
// shows the background through it. Not body volume: it is a plate, and it is its own two nodes.
function buildWells(materials) {
  const group = new THREE.Group();
  group.name = "Wells";
  for (const [label, z] of [["F", DIM.axleFront], ["R", DIM.axleRear]]) {
    const shape = archShape({
      z, y: DIM.wheelRadius, radius: DIM.archRadius - 0.004, floor: DIM.sill,
    });
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateY(-Math.PI / 2);
    for (const side of [1, -1]) {
      const mesh = new THREE.Mesh(geometry, materials.well);
      mesh.name = `Well_${label}${side > 0 ? "R" : "L"}`;
      mesh.position.x = side * 0.545;
      group.add(mesh);
    }
  }
  return group;
}

function buildGlazing(materials) {
  const group = new THREE.Group();
  group.name = "Glazing";

  // Windshield: on the cabin's front slope. The pane is 12 mm narrower than the surface at each
  // side, which is the black weatherstrip the reference draws around every window.
  group.add(new THREE.Mesh(offsetQuad(
    [-0.62, 1.0, 0.735], [0.62, 1.0, 0.735], [0.55, 1.505, 0.216], [-0.55, 1.505, 0.216], 0.006,
  ), materials.glass)).name = "Windshield";

  // Hatch glass: on the cabin's rear slope.
  group.add(new THREE.Mesh(offsetQuad(
    [-0.56, 1.51, -0.96], [0.56, 1.51, -0.96], [0.6, 0.99, -1.6], [-0.6, 0.99, -1.6], 0.006,
  ), materials.glass)).name = "HatchGlass";

  // Side glass, in the (Z, Y) plane, stood on both flanks. The gap between the two panes is the
  // B-pillar; the pane that stops short of the tail leaves the C-pillar.
  const shapes = [
    { name: "Window_Front", points: [[0.7, 1.02], [-0.06, 1.02], [-0.06, 1.42], [0.34, 1.42]] },
    { name: "Window_Rear", points: [[-0.16, 1.02], [-1.12, 1.02], [-1.02, 1.45], [-0.16, 1.45]] },
  ];

  for (const side of [1, -1]) {
    for (const { name, points } of shapes) {
      const shape = new THREE.Shape();
      points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateY(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, materials.glass);
      mesh.name = `${name}_${side > 0 ? "R" : "L"}`;
      // Lay the pane on the tapered flank at the pane's own mid-height.
      mesh.position.x = side * (cabinHalfWidthAt(1.23) - 0.004);
      group.add(mesh);
    }
  }

  return group;
}

function buildWheel(materials, name) {
  // A Group whose origin is the hub: the pivot is the axis of rotation.
  const group = new THREE.Group();
  group.name = name;

  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(DIM.wheelRadius, DIM.wheelRadius, DIM.wheelWidth, 24, 1),
    materials.rubber,
  );
  tyre.geometry.rotateZ(Math.PI / 2);
  tyre.name = `${name}_Tyre`;
  group.add(tyre);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.165, DIM.wheelWidth + 0.006, 24, 1),
    materials.rim,
  );
  rim.geometry.rotateZ(Math.PI / 2);
  rim.name = `${name}_Rim`;
  group.add(rim);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, DIM.wheelWidth - 0.012, 12, 1),
    materials.trim,
  );
  hub.geometry.rotateZ(Math.PI / 2);
  hub.name = `${name}_Hub`;
  group.add(hub);

  return group;
}

function buildTrim(materials) {
  const group = new THREE.Group();
  group.name = "Trim";

  // The bumpers wrap the ends and define the 3.52 m length.
  group.add(box(1.42, 0.26, 0.16, 0, 0.44, 1.68, materials.trim, "Bumper_F"));
  group.add(box(1.42, 0.26, 0.16, 0, 0.44, -1.68, materials.trim, "Bumper_R"));

  // Front: the grille sits between the headlamps, all of it above the bumper.
  group.add(box(0.72, 0.13, 0.05, 0, 0.63, 1.745, materials.dark, "Grille"));
  for (const side of [1, -1]) {
    group.add(box(0.27, 0.14, 0.05, side * 0.45, 0.71, 1.742, materials.lamp,
      `Headlight_${side > 0 ? "R" : "L"}`));
  }
  for (const side of [1, -1]) {
    group.add(box(0.09, 0.07, 0.05, side * 0.5, 0.4, 1.755, materials.amber,
      `Indicator_${side > 0 ? "R" : "L"}`));
  }

  // Rear: vertical lamps at the tail corners, and the plate recess.
  for (const side of [1, -1]) {
    group.add(box(0.1, 0.3, 0.05, side * 0.58, 0.79, -1.735, materials.tail,
      `Taillight_${side > 0 ? "R" : "L"}`));
  }
  group.add(box(0.5, 0.14, 0.05, 0, 0.62, -1.74, materials.dark, "Plate_R"));

  // The rubbing strip along the flank.
  for (const side of [1, -1]) {
    group.add(box(0.016, 0.05, 2.4, side * 0.752, 0.5, 0.1, materials.trim,
      `Strip_${side > 0 ? "R" : "L"}`));
  }

  // Mirrors: on the front doors, at the belt.
  for (const side of [1, -1]) {
    const arm = box(0.09, 0.03, 0.03, side * 0.735, 1.0, 0.66, materials.dark,
      `MirrorArm_${side > 0 ? "R" : "L"}`);
    const head = box(0.05, 0.11, 0.14, side * 0.79, 1.0, 0.66, materials.trim,
      `Mirror_${side > 0 ? "R" : "L"}`);
    group.add(arm, head);
  }

  return group;
}

// ---------------------------------------------------------------- assembly

// Every accessory in one group, unmounted. Stage 3 does not use this function as it stands: it adds
// one part per pass, validates it alone, then places it. The group is here so the record is
// complete and so a future pass can diff the rebuilt set against it.
export function buildAccessories(materials = createMaterials()) {
  const root = new THREE.Group();
  root.name = "Accessories";

  root.add(buildWells(materials));
  root.add(buildGlazing(materials));
  root.add(buildTrim(materials));

  const wheels = [
    ["Wheel_FL", -DIM.track, DIM.axleFront],
    ["Wheel_FR", DIM.track, DIM.axleFront],
    ["Wheel_RL", -DIM.track, DIM.axleRear],
    ["Wheel_RR", DIM.track, DIM.axleRear],
  ];
  for (const [name, x, z] of wheels) {
    const wheel = buildWheel(materials, name);
    wheel.position.set(x, DIM.wheelRadius, z);
    root.add(wheel);
  }

  return root;
}

// The names stage 3 has to place, in the order the record holds them.
export const ACCESSORY_NAMES = [
  "Bumper_F", "Bumper_R", "Grille",
  "Headlight_L", "Headlight_R", "Indicator_L", "Indicator_R",
  "Taillight_L", "Taillight_R", "Plate_R",
  "Strip_L", "Strip_R",
  "MirrorArm_L", "MirrorArm_R", "Mirror_L", "Mirror_R",
  "Windshield", "HatchGlass",
  "Window_Front_L", "Window_Front_R", "Window_Rear_L", "Window_Rear_R",
  "Well_FL", "Well_FR", "Well_RL", "Well_RR",
  "Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR",
];
