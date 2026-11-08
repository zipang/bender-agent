// The hand-set contour knots, one list per view, in the plate's own metres.
//
// This file is the SOURCE of the contour. `viewer/knots.js` reads it, joins the knots by lines or by
// a smooth curve, and the contour line and the volume are both built from that join. The traced
// `CONTOURS` in `body-hull.js` is only the starting set: when a view is absent here, its knots are
// the on-curve vertices of the traced path.
//
// A knot is a point the outline passes through. Add one where the shape turns, remove one on a
// straight run, drag one to move the line.
//
//   {
//     left: { mode: "bezier", knots: [[u, v], ...] },
//   }
//
// `mode` is "poly" (straight lines between the knots) or "bezier" (a smooth curve through them). The
// file is written by the viewer's save command; it is empty until the first save.

export const KNOTS = {};
