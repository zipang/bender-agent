// The body volume, built in the page from the three contours.
//
// Why this exists. The tracer already reduces three silhouettes to a volume, but it does that
// offline, from the opened pixel intervals of the photograph. The contour is a second artifact, and
// a contour edited or tuned in the page could not move the volume it is drawn on. That is the wrong
// order for judging a contour: the shape of the surface is what tells an art director whether a
// simplification is safe, so the surface has to follow the line.
//
// What this module does. It extrudes each contour along its own view normal and intersects the
// three solids. The result is, by construction, the largest volume consistent with the lines that
// are on screen -- no photograph, no lattice, no second sampling. Change a path, and the volume is a
// different solid; that is the point.
//
// What it is not. It is not the body. The contour follows the outer silhouette, so the volume
// contains the accessories the silhouette contains. It is a reading of the drawing, and it says
// nothing about a part the drawing does not separate.

import * as THREE from "three";
import { Brush, Evaluator, INTERSECTION } from "three-bvh-csg";
import { realMetres } from "./api.js";
import { plateFrame } from "./plate.js";
import { flattenPath, shapeFromRing } from "./path.js";

const evaluator = new Evaluator();
// Only the two attributes a shaded surface needs. Carrying `uv` through three boolean passes costs
// time and memory, and no contour carries a texture.
evaluator.attributes = ["position", "normal"];

/**
 * The prism one view carves: its contour, extruded along the view normal, centred on the plate.
 *
 * The depth only has to be large enough to cross the whole subject, because the intersection with
 * the other two prisms decides where the solid ends. It is taken from the real dimensions, so it
 * scales with the subject and never clips a longer one.
 */
function prismFor({ document: sceneDocument, views, view, contours, divisions, depth }) {
  const entry = contours?.[view];
  const flat = entry?.path ? flattenPath(entry.path, divisions) : null;
  if (!flat || flat.length < 6) return null;

  const frame = plateFrame({ document: sceneDocument, views, view });
  const shape = shapeFromRing(flat);
  if (!shape) return null;

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  // The extrusion runs from z = 0 to z = depth along the plate normal. Centring it puts the plate
  // plane itself in the middle of the prism, which is where the picture is drawn.
  geometry.translate(0, 0, -depth / 2);
  geometry.applyMatrix4(frame.matrix);
  geometry.deleteAttribute("uv");
  return geometry;
}

/**
 * The intersection of the extrusions of the used views.
 *
 * @param {object} options
 * @param {object} options.document   the `/api/scene` document
 * @param {Record<string, any>} options.views   `viewer/views.json` -> `views`
 * @param {object} options.contours   `CONTOURS`, one path per view
 * @param {string[]} options.used     the views the volume may read
 * @param {number} [options.divisions]  samples per curved segment
 * @returns {{ geometry: THREE.BufferGeometry, read: string[], skipped: string[] } | null}
 */
export function buildContourVolume({
  document: sceneDocument, views, contours, used, divisions = 8,
}) {
  // A depth that clears the subject on every axis. It is a construction constant, not a tuning
  // value: a smaller one would clip, and the result would be a function of it instead of a function
  // of the contours.
  const largest = Math.max(
    ...["x", "y", "z"].map((axis) => Number(realMetresOf(sceneDocument, axis) ?? 0)),
  ) || 1;
  const depth = largest * 3;

  const read = [];
  const skipped = [];
  let solid = null;

  for (const view of used ?? []) {
    const geometry = prismFor({ document: sceneDocument, views, view, contours, divisions, depth });
    if (!geometry) {
      skipped.push(view);
      continue;
    }
    read.push(view);
    const brush = new Brush(geometry);
    brush.updateMatrixWorld();
    solid = solid ? evaluator.evaluate(solid, brush, INTERSECTION) : brush;
  }

  if (!solid) return null;
  const geometry = solid.geometry;
  geometry.computeVertexNormals();
  return { geometry, read, skipped };
}

/** The real dimension behind one model axis, in metres, or null when the document does not say it. */
function realMetresOf(sceneDocument, axis) {
  const role = sceneDocument.roles?.[axis];
  return role ? realMetres(sceneDocument, role) : null;
}
