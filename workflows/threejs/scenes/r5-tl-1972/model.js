// The R5 TL body, as the intersection of three silhouettes.
//
// The method, and why. Three orthographic silhouettes are measurements: the left view fixes the
// outline in Z and Y, the front view in X and Y, the top view in X and Z. A point belongs to the
// subject only if all three contain it, so the intersection of the three extruded profiles is the
// largest volume consistent with the drawings. `workflows/threejs/tools/trace_hull.py` does that reduction and
// writes `body-hull.js`; this file turns its columns into a mesh, and adds the gate numbers.
//
// What this method can and cannot tell you. It reproduces the three views it was built from by
// construction, so a good silhouette score on `left`, `front` and `top` checks the tracing code,
// not the subject. The views it did NOT use -- `right`, `back`, `bottom` -- are the ones that can
// catch a contradiction, and they are the ones worth comparing against.
//
// What the envelope contains that the body does not: the wheels, and the mirror. They are in the
// reference silhouettes, so the intersection has them. They are not modelled here; stage 3 places
// them as their own nodes and cuts what they need. Until then the envelope is honest about what the
// drawings say, and the deviation report says the same thing.

import * as THREE from "three";
import { CONTOURS, SECTIONS, TRACE } from "./body-hull.js";

// The real dimensions: an INPUT. They come from the manufacturer's sheet for a Renault 5 TL (1972)
// and they are mirrored in `dimensions.json` under `real`. They are never read from the views that
// the model is checked against, because that check would be circular: every error would be
// normalized away and every gate would pass.
export const REAL = {
  length: 3.521,
  width: 1.525,
  height: 1.4,
};

export { CONTOURS, SECTIONS, TRACE };

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
    name: "glass", color: 0x2b3138, roughness: 0.18, metalness: 0.0,
  });
  m.tyre = new THREE.MeshStandardMaterial({
    name: "tyre", color: 0x1b1c1e, roughness: 0.9, metalness: 0.0,
  });
  return m;
}

// ---------------------------------------------------------------- hull mesh

// A hull mesh, from the traced columns.
//
// Every station gives a run of vertical columns, from the bottom of the body to its top at that X.
// The mesh is the two skins of that run -- the roof surface and the underside -- plus the two end
// walls of each run, plus a cap at the front and at the rear.
//
// Winding is written once per face type, not derived: a face whose normal points inward renders
// black, which reads as a modelling error rather than as a triangle-order error.

function hullGeometry(sections) {
  const positions = [];
  const indices = [];
  const lookup = new Map();

  // A vertex is one station, one column, and one of its two heights.
  const vertex = (k, column, top) => {
    const key = `${k}:${column[0]}:${top ? 1 : 0}`;
    const found = lookup.get(key);
    if (found !== undefined) return found;
    const index = positions.length / 3;
    positions.push(column[1], top ? column[3] : column[2], sections[k].z);
    lookup.set(key, index);
    return index;
  };

  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);

  // Each station's run of columns: its map by grid index, and the two indices where it starts and
  // ends. The run is contiguous for a vehicle face; a gap would need its own flanks.
  const stations = sections.map((section) => {
    const byIndex = new Map(section.columns.map((column) => [column[0], column]));
    const keys = [...byIndex.keys()].sort((a, b) => a - b);
    return { z: section.z, byIndex, lo: keys[0] ?? null, hi: keys.at(-1) ?? null };
  });

  // A point of one station, at a grid index. The index is CLAMPED to that station's run: the run
  // ends shift by a column or two between stations, and a lookup that returned undefined there
  // left a vertical slit in the flank -- visible as a gap through the body from a low angle.
  const pointAt = (k, i, top) => {
    const station = stations[k];
    const index = Math.min(station.hi, Math.max(station.lo, i));
    return vertex(k, station.byIndex.get(index), top);
  };

  // 1. The two skins. The index range is the union of the two stations' runs, so the surface
  //    reaches the run edges on both sides instead of stopping at the shorter one.
  for (let k = 1; k < stations.length; k += 1) {
    const a = stations[k - 1];
    const b = stations[k];
    if (a.lo === null || b.lo === null) continue;
    const from = Math.min(a.lo, b.lo);
    const to = Math.max(a.hi, b.hi);

    for (let i = from; i < to; i += 1) {
      // Roof: +Z then +X reads as +Y, so this order faces up.
      quad(pointAt(k - 1, i, true), pointAt(k, i, true),
           pointAt(k, i + 1, true), pointAt(k - 1, i + 1, true));
      // Underside: +X then +Z reads as -Y.
      quad(pointAt(k - 1, i, false), pointAt(k - 1, i + 1, false),
           pointAt(k, i + 1, false), pointAt(k, i, false));
    }

    // 2. The two flanks, as one ribbon per station pair. The ribbon follows the run edges even
    //    when they move, which is exactly where a per-index quad cannot reach.
    //    -X flank: +Z then +Y reads as -X.  +X flank: +Y then +Z reads as +X.
    quad(pointAt(k - 1, a.lo, false), pointAt(k, b.lo, false),
         pointAt(k, b.lo, true), pointAt(k - 1, a.lo, true));
    quad(pointAt(k - 1, a.hi, false), pointAt(k - 1, a.hi, true),
         pointAt(k, b.hi, true), pointAt(k, b.hi, false));
  }

  // 3. A cap at each end, over the cells of the end station. The two ends are a few columns wide,
  //    so one quad per column is exact enough and needs no polygon triangulation.
  const filled = stations.map((station, k) => (station.lo !== null ? k : -1)).filter((k) => k >= 0);
  if (filled.length) {
    for (const [k, tail] of [[filled[0], true], [filled.at(-1), false]]) {
      const station = stations[k];
      for (let i = station.lo; i < station.hi; i += 1) {
        if (tail) {
          // The tail faces -Z: +X then +Y would read as +Z, so the order is reversed.
          quad(pointAt(k, i, false), pointAt(k, i, true),
               pointAt(k, i + 1, true), pointAt(k, i + 1, false));
        } else {
          quad(pointAt(k, i, false), pointAt(k, i + 1, false),
               pointAt(k, i + 1, true), pointAt(k, i, true));
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function buildBody(materials = createMaterials()) {
  const group = new THREE.Group();
  group.name = "R5_TL_1972";

  const mesh = new THREE.Mesh(hullGeometry(SECTIONS), materials.paint);
  mesh.name = "Body";
  group.add(mesh);

  group.userData.real = REAL;
  group.userData.stage = 2;
  return group;
}

// `build()` is the name in the viewer's contract.
export const build = buildBody;

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
// Height is measured FROM THE GROUND, not from the lowest vertex. At stage 2 the wheels are inside
// the envelope but no wheel is mounted as a node, so a bounding box alone would report the body as
// short by whatever stands below it.
export function deviation(object) {
  const { min, max, size } = measure(object);
  return {
    length: Number(((size[2] - REAL.length) * 1000).toFixed(1)),
    height: Number((max[1] * 1000 - REAL.height * 1000).toFixed(1)),
    width: Number(((size[0] - REAL.width) * 1000).toFixed(1)),
    sill: Number((min[1] * 1000).toFixed(1)),
  };
}
