import * as THREE from "three";

// One path, flattened into a ring of positions. Used by the contour, by the volume, and by the
// witness dash cutter, because a second flattening is a second place the outline can drift.
//
// `divisions` is how many samples a curve segment contributes. `1` keeps only the segment's end,
// which turns every curve back into the straight line between the points it was fitted through:
// that is the angular reading. A larger number samples the curve: the smooth one. Both come from
// the same control points, so neither can drift from the trace the other describes.
export function flattenPath(path, divisions) {
  const start = path?.start;
  if (!Array.isArray(start) || start.length < 2) return null;
  const out = [start[0], start[1]];
  let cursor = [start[0], start[1]];
  for (const segment of path.segments ?? []) {
    if (!Array.isArray(segment) || segment.length < 3) continue;
    const kind = segment[0];
    if (kind === "L") {
      cursor = [segment[1], segment[2]];
      out.push(cursor[0], cursor[1]);
    } else if (kind === "C" && segment.length >= 7) {
      const c1 = [segment[1], segment[2]];
      const c2 = [segment[3], segment[4]];
      const end = [segment[5], segment[6]];
      const steps = Math.max(1, Math.round(divisions));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const s = 1 - t;
        out.push(
          s * s * s * cursor[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t * t * t * end[0],
          s * s * s * cursor[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t * t * t * end[1],
        );
      }
      cursor = end;
    }
  }
  return out;
}

/**
 * A closed path from an ordered list of knots, joined one of two ways.
 *
 * The knots are the points the art director kept or placed on the contour. They are the source: the
 * two join modes read the SAME knots, so a switch between them cannot move a knot, only the line
 * between two knots.
 *
 *   "poly"    straight segments through the knots -- the angular reading.
 *   "bezier"  cubics through the knots, with the tangents of a Catmull-Rom spline: the curve passes
 *             through every knot and joins smoothly, so a knot is a point the outline reaches.
 *
 * The output is the same shape as a traced path, so `flattenPath`, the contour line and the volume
 * prism read it without knowing where it came from.
 */
export function pathFromKnots(knots, mode = "poly") {
  const count = knots?.length ?? 0;
  if (count < 3) return null;
  const at = (index) => knots[((index % count) + count) % count];
  const round = (value) => Number(value.toFixed(5));
  const start = [round(knots[0][0]), round(knots[0][1])];
  const segments = [];
  if (mode === "bezier") {
    for (let i = 0; i < count; i += 1) {
      const previous = at(i - 1);
      const from = at(i);
      const to = at(i + 1);
      const next = at(i + 2);
      const c1 = [from[0] + (to[0] - previous[0]) / 6, from[1] + (to[1] - previous[1]) / 6];
      const c2 = [to[0] - (next[0] - from[0]) / 6, to[1] - (next[1] - from[1]) / 6];
      segments.push(["C", round(c1[0]), round(c1[1]), round(c2[0]), round(c2[1]),
                     round(to[0]), round(to[1])]);
    }
  } else {
    for (let i = 1; i < count; i += 1) segments.push(["L", round(knots[i][0]), round(knots[i][1])]);
    segments.push(["L", start[0], start[1]]);
  }
  return { start, segments };
}

/**
 * A `THREE.Shape` from a flattened ring, in the ring's own units.
 *
 * The ring may arrive in either winding, and `ExtrudeGeometry` takes only one. The orientation is
 * read from the signed area instead of assumed, so a view whose pixels were walked the other way
 * still extrudes a solid instead of an inside-out shell.
 */
export function shapeFromRing(flat) {
  const points = [];
  for (let i = 0; i + 1 < flat.length; i += 2) points.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (points.length < 3) return null;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) points.reverse();
  return new THREE.Shape(points);
}
