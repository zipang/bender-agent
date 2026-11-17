// The frame of a bounding box.
//
// Every distance the viewer uses to look at an asset is a fixed multiple of the asset's largest
// real dimension. Before the Three.js viewer had this module, six numbers were written into one
// scene -- 10.5, 4.4, 9, 12, 4.5 and 0.7 -- measured once on one subject. They described a car, not
// a frame. A viewer that only works at one scale is a screenshot.
//
// The coefficients are the measured ratios of that first accepted frame, so that subject keeps its
// pictures. A different subject gets a frame that fits it, with no edit.
//
//   perspective distance   2.982 x max(width, height, depth)
//   orthographic height    1.250 x max(...)
//   ground radius          2.556 x max(...)
//   grid size              3.408 x max(...)
//   shadow half-size       1.278 x max(...)
//
// The centre comes from the geometry, not from a declared height: the asset contract puts the
// base at `y = 0`, but it does not promise that the mass is centred on the vertical axis.

export const FRAME_COEFFICIENTS = Object.freeze({
	distance: 2.982,
	orthoHeight: 1.25,
	groundRadius: 2.556,
	gridSize: 3.408,
	shadowHalf: 1.278
});

/**
 * The frame of an asset.
 *
 * @param {{ size: number[]; target: number[] }} measured From `measureObject`:
 *   the bounding-box size and centre, in metres
 * @returns {{
 * 	max: number;
 * 	target: number[];
 * 	distance: number;
 * 	orthoHeight: number;
 * 	groundRadius: number;
 * 	gridSize: number;
 * 	shadowHalf: number;
 * }}
 *   All lengths in metres
 */
export function frameFrom({ size, target }) {
	const max = Math.max(...size);
	// A group with no mesh has an infinite box: `Box3.setFromObject` starts at ±Infinity and never
	// unions anything finite. A zero size is a flat or empty asset. Neither can be framed, and a
	// NaN that reaches the camera turns the whole page white with no reason on screen.
	if (!Number.isFinite(max) || max <= 0)
		throw new Error("frame: the asset has no measurable size");

	const c = FRAME_COEFFICIENTS;
	return {
		max,
		target: [...target],
		distance: c.distance * max,
		orthoHeight: c.orthoHeight * max,
		groundRadius: c.groundRadius * max,
		gridSize: c.gridSize * max,
		shadowHalf: c.shadowHalf * max
	};
}
