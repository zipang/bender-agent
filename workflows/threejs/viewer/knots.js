// The contour as a list of knots the art director controls.
//
// Why this exists. A traced contour carries one point per pixel of the boundary. That is exact, and
// it is too many to judge: the outline and the surface it extrudes keep the pixel staircase, and no
// single number removes it without also moving the shape. The answer is to keep FEWER points, chosen
// where the shape turns, and to join them by lines or by a smooth curve.
//
// The model is one list of knots per view, in the plate's own metres. Everything else is a reading
// of that list:
//
//   the contour line    `pathFromKnots` joins the knots, then `flattenPath` samples the join
//   the volume prism    extrudes the same flattened ring along the view normal
//   the reduce          Douglas-Peucker on the knots, to get from many points to few
//
// A knot is a point the outline passes through. It is not an off-curve handle: the two join modes
// read the same knots, so switching between lines and curve moves the line between two knots and
// never a knot itself.

import { pathFromKnots } from "./path.js";

export { pathFromKnots };

/** The on-curve vertices of a traced path: the points its curve actually passes through. */
export function ringOf(path) {
  if (!path || !Array.isArray(path.start)) return [];
  const out = [[path.start[0], path.start[1]]];
  for (const segment of path.segments ?? []) {
    if (!Array.isArray(segment)) continue;
    if (segment[0] === "L" && segment.length >= 3) out.push([segment[1], segment[2]]);
    else if (segment[0] === "C" && segment.length >= 7) out.push([segment[5], segment[6]]);
  }
  // A closed traced path repeats its first point as its last; the knot list must not.
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) out.pop();
  }
  return out;
}

function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

/**
 * Douglas-Peucker on a closed ring, at a chord tolerance in the ring's own units.
 *
 * This is the reduce: it drops every knot whose removal moves the line by less than the tolerance.
 * The result is a subset of the input points, so no knot is ever invented and the outline only ever
 * loses detail, never gains a corner that was not on the trace.
 */
export function simplifyRing(points, tolerance) {
  const ring = points ?? [];
  const count = ring.length;
  if (count < 4 || !(tolerance > 0)) return ring.map((p) => [p[0], p[1]]);

  // A ring has no ends, so it is opened at the point farthest from its centre and walked once
  // around, ending on the same corner. The two ends coincide, which is what lets one recursion serve
  // the whole loop.
  let cx = 0;
  let cy = 0;
  for (const p of ring) { cx += p[0]; cy += p[1]; }
  cx /= count;
  cy /= count;
  let first = 0;
  let farthest = -1;
  for (let i = 0; i < count; i += 1) {
    const d = (ring[i][0] - cx) ** 2 + (ring[i][1] - cy) ** 2;
    if (d > farthest) { farthest = d; first = i; }
  }
  const order = [];
  for (let step = 0; step <= count; step += 1) order.push((first + step) % count);

  const keep = new Set([0, count]);
  const stack = [[0, count]];
  while (stack.length > 0) {
    const [head, tail] = stack.pop();
    if (tail - head < 2) continue;
    const a = ring[order[head]];
    const b = ring[order[tail]];
    let worst = -1;
    let at = -1;
    for (let offset = head + 1; offset < tail; offset += 1) {
      const d = distanceToSegment(ring[order[offset]], a, b);
      if (d > worst) { worst = d; at = offset; }
    }
    if (worst <= tolerance || at < 0) continue;
    keep.add(at);
    stack.push([head, at]);
    stack.push([at, tail]);
  }
  // The last kept index repeats the first point, so it is dropped from the closed ring.
  return [...keep].sort((a, b) => a - b).slice(0, -1).map((i) => [ring[order[i]][0], ring[order[i]][1]]);
}

/** The index of the knot nearest to a point, and its distance. `null` when the list is empty. */
export function nearestKnot(knots, point) {
  if (!knots?.length) return null;
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < knots.length; i += 1) {
    const d = Math.hypot(knots[i][0] - point[0], knots[i][1] - point[1]);
    if (d < bestDistance) { bestDistance = d; best = i; }
  }
  return { index: best, distance: bestDistance };
}

/**
 * Where a click lands on the outline: the segment it is nearest to, and the position on that segment.
 *
 * A new knot is inserted there, so a click adds a knot ON the line rather than beside it. The
 * segment index is the one the caller inserts AFTER.
 */
export function nearestOnRing(knots, point) {
  if (!knots || knots.length < 2) return null;
  const count = knots.length;
  let best = null;
  for (let i = 0; i < count; i += 1) {
    const a = knots[i];
    const b = knots[(i + 1) % count];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length2 = dx * dx + dy * dy;
    let t = length2 === 0 ? 0 : ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2;
    t = Math.max(0, Math.min(1, t));
    const at = [a[0] + t * dx, a[1] + t * dy];
    const distance = Math.hypot(point[0] - at[0], point[1] - at[1]);
    if (!best || distance < best.distance) best = { after: i, at, distance };
  }
  return best;
}

/** A copy of the knot list with a point inserted after `after`. */
export function insertKnot(knots, after, point) {
  const out = knots.map((p) => [p[0], p[1]]);
  out.splice(after + 1, 0, [point[0], point[1]]);
  return out;
}

/** A copy of the knot list without the knot at `index`. */
export function removeKnot(knots, index) {
  const out = knots.map((p) => [p[0], p[1]]);
  out.splice(index, 1);
  return out;
}

/** A copy of the knot list with the knot at `index` moved to `point`. */
export function moveKnot(knots, index, point) {
  const out = knots.map((p) => [p[0], p[1]]);
  if (out[index]) out[index] = [point[0], point[1]];
  return out;
}

/** How many straight lines the join needs, for a report. */
export function joinCount(path) {
  return (path?.segments ?? []).length;
}

// ------------------------------------------------------------------ selection
//
// The knot editor acts on a REGION of an outline as one object: a rectangle picks a set of knots, a
// vector moves the whole set, and a delete removes it. All four readings are arithmetic on a list
// of points, so they live here, pure: they return new arrays and never mutate an argument. The
// editor, the `__ctl` commands and the unit tests call the same functions, so the gesture and the
// check cannot disagree about what a selection is.

/**
 * Indices of the knots inside a rectangle, inclusive, in the plate's own metres.
 *
 * `rect` is `[u0, v0, u1, v1]` in any corner order: the two corners are normalized first. A knot
 * exactly on an edge is inside. A degenerate rectangle (zero width or zero height) selects nothing:
 * a `Shift` click with no movement is not a selection of the line it landed on.
 */
export function indicesInRect(knots, rect) {
  const list = knots ?? [];
  if (list.length === 0 || !Array.isArray(rect) || rect.length < 4) return [];
  const [u0, v0, u1, v1] = rect;
  const uMin = Math.min(u0, u1);
  const uMax = Math.max(u0, u1);
  const vMin = Math.min(v0, v1);
  const vMax = Math.max(v0, v1);
  if (uMin === uMax || vMin === vMax) return [];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const [u, v] = list[i];
    if (u >= uMin && u <= uMax && v >= vMin && v <= vMax) out.push(i);
  }
  return out;
}

/**
 * The union of a selection and a set of indices: ascending, no duplicate, out of range dropped.
 *
 * `count` is the current knot count. An index that is not an integer, is negative, or is `>= count`
 * is ignored, so a stale selection cannot address a knot that a reduce has removed.
 */
export function addIndices(selection, indices, count) {
  const max = Number.isInteger(count) ? count : Infinity;
  const out = new Set();
  const push = (value) => {
    if (!Number.isInteger(value)) return;
    if (value < 0 || value >= max) return;
    out.add(value);
  };
  for (const value of selection ?? []) push(value);
  for (const value of indices ?? []) push(value);
  return [...out].sort((a, b) => a - b);
}

/**
 * A copy of the knot list with every selected knot moved by the same vector.
 *
 * One vector for the group, never a per-knot offset: the selection is one object, and the outline
 * follows the pointer by the vector the pointer moved. An index outside the list is ignored, and
 * every point is copied, so the caller's list is untouched.
 */
export function moveKnotsBy(knots, indices, delta) {
  const out = (knots ?? []).map((p) => [p[0], p[1]]);
  const [du, dv] = Array.isArray(delta) ? delta : [0, 0];
  for (const index of new Set(indices ?? [])) {
    if (!Number.isInteger(index) || index < 0 || index >= out.length) continue;
    out[index] = [out[index][0] + du, out[index][1] + dv];
  }
  return out;
}

/**
 * A copy of the knot list without every selected knot, or a refusal below `minCount`.
 *
 * The delete is atomic: when fewer than `minCount` knots would remain, nothing is removed and the
 * call reports `refused: true` with `reason: "minimum"`. An empty set of indices is a no-op, not a
 * refusal. An index outside the list and any duplicate are ignored.
 */
export function removeKnots(knots, indices, minCount = 3) {
  const copy = (knots ?? []).map((p) => [p[0], p[1]]);
  const drop = new Set();
  for (const index of indices ?? []) {
    if (!Number.isInteger(index) || index < 0 || index >= copy.length) continue;
    drop.add(index);
  }
  const removed = [...drop].sort((a, b) => a - b);
  if (removed.length === 0) return { knots: copy, removed: [], refused: false };
  if (copy.length - removed.length < minCount) {
    return { knots: copy, removed: [], refused: true, reason: "minimum" };
  }
  return { knots: copy.filter((_, i) => !drop.has(i)), removed, refused: false, reason: null };
}
