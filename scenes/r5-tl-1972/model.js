// R5 TL 1972 — authoring source.
//
// This file is the model. It is a pure ES module: no DOM, no renderer, no network. The viewer
// imports it in the browser, and `scripts/scene/model-info.ts` imports it in Bun to measure and
// export. One source, one truth.
//
// Units: metres. 1 unit = 1 m, the game-asset convention. Axis: +Y up, +Z forward (the nose).
// Origin: the centre of the base, so the wheels touch Y = 0.
//
// Method. No CSG. The body is a side profile extruded across X, with the wheel arches cut out as
// holes in that profile. That one idea carries the whole silhouette. Every other volume is a
// primitive placed on top. Parts are named, and each movable part is a Group whose origin sits
// on its pivot.
//
// The proportions are MEASURED, not estimated. `scripts/scene/read_reference.py` reduces the
// locked left view to a silhouette and prints the upper edge, the belt line and the wheel
// centres in millimetres from the nose. The numbers below come from that run, and the comments
// give the measurement each one answers to.

import * as THREE from "three";

// All figures in metres, read from the reference at a scale of 1 unit = 1 m.
// The reference is a stylized figurine 3.52 m long; its proportions are the target.
export const DIM = {
  length: 3.52,
  width: 1.53,
  height: 1.542, // measured: 535 px tall over 1221 px long, at 2.883 mm/px
  wheelRadius: 0.265, // measured tyre diameter 530 mm
  wheelWidth: 0.17,
  track: 0.665, // wheel centre, so the outer face sits just inside the flank
  axleFront: 1.18, // measured front axle 580 mm from the nose
  axleRear: -1.19, // measured rear axle 2950 mm from the nose
  bodyHalfLength: 1.76,
  bodyHalfWidth: 0.765,
  cabinHalfWidth: 0.666, // the greenhouse is 0.87 of the body width at the belt
  cabinRoofHalfWidth: 0.474, // and 0.62 of it at the roof: the tumblehome
  sill: 0.265, // measured underside
  belt: 0.985, // measured glass bottom, steady from the cowl to the tail
  archRadius: 0.315,
};

// The side profile of the lower body, in (Z, Y). Measured upper edge from the nose:
//   0 → 520   150 → 660   320 → 900   640 → 1000   1010 → 1025 (cowl)
// then the belt line at 985 runs to the tail, and the tail panel closes at 3520.
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

// The greenhouse. Measured: windshield base at 1010 mm, roof from 1560 to 2800 at 1515–1539,
// hatch slope down to 890 at 3400.
export const CABIN_PROFILE = [
  [0.75, 0.985],
  [0.2, 1.515],
  [-1.0, 1.529],
  [-1.64, 0.94],
];

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

// ---------------------------------------------------------------- geometry helpers

// The wheel arch, as a filled shape: a circular segment whose chord lies on the body's underside.
function archShape({ z, y, radius, floor }) {
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
function taper(geometry, { byY, byZ } = {}) {
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

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// A closed polygon in the (Z, Y) plane, extruded across X and centred on X = 0.
function extrudeAcrossX(points, width, holes = []) {
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

function buildLowerBody(materials) {
  const holes = [
    archShape({ z: DIM.axleFront, y: DIM.wheelRadius, radius: DIM.archRadius, floor: DIM.sill }),
    archShape({ z: DIM.axleRear, y: DIM.wheelRadius, radius: DIM.archRadius, floor: DIM.sill }),
  ];
  const geometry = extrudeAcrossX(BODY_PROFILE, DIM.width, holes);
  // The body tucks in at both ends: the reference's plan view narrows to about 0.9 of full width.
  taper(geometry, {
    byZ: (z) => 1 - 0.09 * clamp01((Math.abs(z) - 1.15) / 0.61),
    byY: (y) => 1 - 0.05 * clamp01((y - DIM.sill) / (DIM.belt - DIM.sill)),
  });
  const mesh = new THREE.Mesh(geometry, materials.paint);
  mesh.name = "Body";
  return mesh;
}

// A dark plate inside each arch, just inboard of the tyre. It closes the tunnel so the arch never
// shows the background through it.
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

// The half-width of the greenhouse at a given height, so a pane can be laid on its surface.
function cabinHalfWidthAt(y) {
  const ratio = DIM.cabinRoofHalfWidth / DIM.cabinHalfWidth;
  return DIM.cabinHalfWidth * (1 - (1 - ratio) * clamp01((y - DIM.belt) / 0.545));
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

export function buildCar(materials = createMaterials()) {
  const root = new THREE.Group();
  root.name = "R5_TL_1972";

  root.add(buildLowerBody(materials));
  root.add(buildWells(materials));
  root.add(buildCabin(materials));
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

  root.userData.dimensions = DIM;
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
