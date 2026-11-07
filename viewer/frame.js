// Framing derived from the real dimensions.
//
// Every distance the viewer uses to look at a subject is a fixed multiple of the subject's largest
// real dimension. Before this module, six numbers were written into the scene: 10.5, 4.4, 9, 12,
// 4.5 and 0.7. They were measured once, on one subject, and copied into a second scene as if they
// described a car rather than a frame. A viewer that only works at one scale is a screenshot.
//
// The coefficients are the measured ratios of that first frame, so this subject keeps its pictures.
// A different subject gets a frame that fits it, with no edit.
//
//   camera target Y        height / 2
//   perspective distance   2.982 x max(width, height, length)
//   orthographic height    1.250 x max(...)
//   ground radius          2.556 x max(...)
//   grid size              3.408 x max(...)
//   shadow half-size       1.278 x max(...)

export const FRAME_COEFFICIENTS = Object.freeze({
  distance: 2.982,
  orthoHeight: 1.25,
  groundRadius: 2.556,
  gridSize: 3.408,
  shadowHalf: 1.278,
});

/**
 * The frame of a subject.
 *
 * @param {{ real: Record<string, { mm: number }>, roles?: Record<string, string> }} document_
 *   the scene document, whose `real` dimensions are in millimetres. `roles.y` names the height,
 *   which is the one axis a frame treats differently: it is centred, not spanned.
 * @returns {{ target: [number, number, number], distance: number, orthoHeight: number,
 *            groundRadius: number, gridSize: number, shadowHalf: number, max: number }}
 *   all lengths in metres
 */
export function frameFrom(document_) {
  const real = document_?.real ?? {};
  const entries = Object.values(real)
    .map((entry) => entry?.mm)
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (entries.length === 0) throw new Error("frame: the scene document has no real dimensions");

  const max = Math.max(...entries) / 1000;
  const heightRole = document_.roles?.y ?? "height";
  const heightMm = real[heightRole]?.mm;
  if (typeof heightMm !== "number") {
    throw new Error(`frame: no real dimension for the vertical role "${heightRole}"`);
  }

  const c = FRAME_COEFFICIENTS;
  return {
    max,
    target: [0, heightMm / 1000 / 2, 0],
    distance: c.distance * max,
    orthoHeight: c.orthoHeight * max,
    groundRadius: c.groundRadius * max,
    gridSize: c.gridSize * max,
    shadowHalf: c.shadowHalf * max,
  };
}
