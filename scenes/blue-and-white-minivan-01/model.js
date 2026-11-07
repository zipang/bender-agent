// The blue and white minivan: a placeholder volume, and nothing else yet.
//
// This file exists to prove one thing: a second subject opens in the shared viewer without a single
// edit outside its own folder. It is NOT a model. Stage 2 has not started, the views have no
// calibrated scale yet (stage 1 has not run), and no silhouette comparison has been made.
//
// The box is the right overall size, seated on the ground, centred on X and Z. It gives the calque
// a volume to occlude and it puts the camera framing on a real subject, which is what the viewer
// needs in order to be judged.

import * as THREE from "three";

// The real dimensions: an INPUT, from the art director, mirrored in `dimensions.json` under `real`.
// They are never read from the views the model will be checked against.
export const REAL = {
  length: 5.3,
  width: 1.9,
  height: 2.0,
};

export const SECTIONS = [];

export function createMaterials() {
  const m = {};
  // The two-tone body of the reference: light blue over white, split by a blue belt line.
  m.upper = new THREE.MeshStandardMaterial({
    name: "upper", color: 0x63b6d8, roughness: 0.5, metalness: 0.04,
  });
  m.lower = new THREE.MeshStandardMaterial({
    name: "lower", color: 0xf2f3f2, roughness: 0.55, metalness: 0.02,
  });
  return m;
}

function buildPlaceholder(materials) {
  const group = new THREE.Group();
  group.name = "Minivan";

  // The upper half and the lower half, split at the belt line, because the two-tone body is an
  // identity feature of this subject. One box would be simpler and would also hide the division
  // that the reference is organised around.
  const belt = REAL.height * 0.55;
  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(REAL.width, belt, REAL.length),
    materials.lower,
  );
  lower.name = "Lower";
  lower.position.set(0, belt / 2, 0);
  group.add(lower);

  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(REAL.width, REAL.height - belt, REAL.length),
    materials.upper,
  );
  upper.name = "Upper";
  upper.position.set(0, belt + (REAL.height - belt) / 2, 0);
  group.add(upper);

  group.userData.real = REAL;
  group.userData.stage = 2;
  return group;
}

// `build()` is the name in the viewer's contract. `buildBody()` is kept because every modelling
// script in this repository speaks of the body, and the viewer accepts either.
export function build(materials = createMaterials()) {
  return buildPlaceholder(materials);
}

export const buildBody = build;

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

export function target() {
  return {
    length: REAL.length * 1000,
    width: REAL.width * 1000,
    height: REAL.height * 1000,
  };
}

// Height is measured FROM THE GROUND: at stage 2 no wheel is mounted, and a bounding box would
// report the body as short by the ground clearance.
export function deviation(object) {
  const { min, max, size } = measure(object);
  return {
    length: Number(((size[2] - REAL.length) * 1000).toFixed(1)),
    height: Number((max[1] * 1000 - REAL.height * 1000).toFixed(1)),
    width: Number(((size[0] - REAL.width) * 1000).toFixed(1)),
    sill: Number((min[1] * 1000).toFixed(1)),
  };
}
