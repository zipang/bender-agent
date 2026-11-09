// Measurement, as pure functions. No THREE, no DOM, no network.
//
// What lives here is the arithmetic that a tracing pass depends on, so it can be tested without a
// browser, and so the same rule is used by any viewer page built from this base.
//
// The one number that used to be a comment is `2.8`: "the image itself is 2.8 on left". It was
// right for one view of one subject, and wrong for every other view and every other subject. The
// API publishes the scale of each reference as `kx_mm` and `ky_mm`, built on the subject box, so
// the panel reads it instead of repeating a constant that only the R5 happens to satisfy.

/**
 * Millimetres of world per screen pixel, at the depth the camera is aimed at. Exact everywhere for
 * an orthographic camera; for a perspective one it is the value at the target plane.
 *
 * `zoom` is the orthographic zoom factor (`OrthographicCamera.zoom`, default 1). It scales the
 * visible height, so the frame height is divided by it. It is ignored by the perspective camera,
 * which has no zoom factor.
 *
 * @param {{ perspective: boolean, orthoHeight: number, zoom?: number, distance: number, fov: number, height: number }} camera
 */
export function mmPerScreenPx(camera) {
  const { perspective, orthoHeight, distance, fov, height } = camera;
  const zoom = camera.zoom ?? 1;
  if (!height) return Number.NaN;
  if (!perspective) return (orthoHeight * 1000) / (height * zoom);
  const worldHeight = 2 * distance * Math.tan((fov * Math.PI) / 180 / 2);
  return (worldHeight * 1000) / height;
}

/** The two model axes a view spans, as an array: `"zy"` becomes `["z", "y"]`. */
export function axesOf(viewSpec) {
  return viewSpec?.axes ? String(viewSpec.axes).split("") : ["x", "y"];
}

/** A picked point, read on the two axes of its view, in millimetres. */
export function readPoint(point, axes) {
  const [a, b] = axes;
  const value = (axis) => ({ x: point[0], y: point[1], z: point[2] })[axis] * 1000;
  return {
    [a]: Number(value(a).toFixed(1)),
    [b]: Number(value(b).toFixed(1)),
  };
}

/** The distance between two picked points, in millimetres, broken down per axis. */
export function betweenPoints(from, to, axes) {
  const index = ["x", "y", "z"];
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  return {
    axes,
    delta_mm: Object.fromEntries(axes.map((axis) => [
      axis, Number((d[index.indexOf(axis)] * 1000).toFixed(1)),
    ])),
    length_mm: Number((Math.hypot(...d) * 1000).toFixed(1)),
  };
}

/**
 * The scale of a view's reference image, in millimetres per image pixel, horizontal. It comes from
 * the API document, never from a constant in this file.
 *
 * Returns null when the view has no reference, which is the case for a perspective view.
 */
export function imageScaleMm(document_, view) {
  const reference = document_?.views?.[view]?.reference;
  const kx = reference?.kx_mm;
  return typeof kx === "number" && Number.isFinite(kx) ? kx : null;
}

/**
 * The lines the measurement panel shows. Pure: it formats numbers and never touches the scene.
 *
 * @param {{ active: boolean, mmPerPx: number, imageKx: number|null, imageView: string|null,
 *           points: Array<{ axes: string[], read: Record<string, number>, source: string }>,
 *           between: { delta_mm: Record<string, number>, length_mm: number }|null }} panel
 */
export function panelLines(panel) {
  const { active, mmPerPx, imageKx, imageView, points, between } = panel;
  const lines = [
    `measure  ${active ? "click to place a point, shift-click to pick the model" : "idle"}`,
    `precision ${mmPerPx.toFixed(2)} mm per screen px  ` +
      (imageKx === null
        ? "(no reference plate shown)"
        : `(the image itself is ${imageKx.toFixed(2)} mm/px on ${imageView})`),
  ];

  const pad = (value) => String(value).padStart(7);
  points.forEach((point, index) => {
    const [a, b] = point.axes;
    lines.push(
      `  ${String(index + 1).padStart(2)}  ${a.toUpperCase()} ${pad(point.read[a])} mm   ` +
      `${b.toUpperCase()} ${pad(point.read[b])} mm   ${point.source}`,
    );
  });

  if (points.length >= 2 && between) {
    const parts = Object.entries(between.delta_mm)
      .map(([axis, value]) => `d${axis.toUpperCase()} ${value >= 0 ? "+" : ""}${value}`);
    lines.push(`  delta  ${parts.join("   ")}   length ${between.length_mm} mm`);
  }
  return lines;
}
