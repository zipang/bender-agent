// The frame of a bounding box: the stage, the disc, the shadow, and the perspective distance.
//
// Every length the viewer uses is either a fixed multiple of the asset's largest real dimension or
// a rule of the ground. Before the Three.js viewer had this module, six numbers were written into one
// scene -- 10.5, 4.4, 9, 12, 4.5 and 0.7 -- measured once on one subject. They described a car, not a
// frame. A viewer that only works at one scale is a screenshot.
//
//   orthographic height    1.250 x max(width, height, depth)   -- the 100 % frame of a flat view
//   grid size              about 3 x max(...), in even whole metres, at least 2 m
//   ground radius          (grid size / 2) * sqrt(2) + 0.5 m
//   shadow half-size       ground radius / 2
//   perspective distance   computed from the disc and the viewport, not from the asset
//
// The radius is measured to the CORNER of the grid, not to the middle of a side: the half-diagonal
// of a square of side `g` is `(g / 2) * sqrt(2)`, so 0.5 m of disc lies beyond every corner and more
// than that beyond the middle of every side. A radius of `g / 2 + 0.5` would let the four corners
// poke out of the disc, because `sqrt(2)` is 1.414.
//
// The two grid layers are a contract of this module, not a drawing choice of `stage.js`: WebGL
// ignores `linewidth` above 1 on nearly every driver, so a grid line cannot be drawn thicker, and
// only its colour and its alpha can make a metre line read stronger than a half-metre line.
//
// The grid is whole even metres for a mechanical reason: `GridHelper` lays its lines from `-size/2`
// at a step of `size / divisions`. An odd size puts every line on a half-metre, so no line reads as
// a metre line. An even size puts the metre lines on the integers: 1 m cells, 0.5 m sub-cells, and
// every line at a whole or half metre. The orthographic 100 % keeps its coefficient because the art
// director accepted it; the stage is the backdrop that adapts.
//
// The perspective camera has no zoom factor, so its 100 % is a distance. The ground is a horizontal
// disc, so its horizontal extent is the full diameter, and the diameter must fit the smaller
// viewport dimension: a landscape window is limited by its height, a portrait one by its width.
//
// The centre comes from the geometry, not from a declared height: the asset contract puts the
// base at `y = 0`, but it does not promise that the mass is centred on the vertical axis.

export const STAGE_RULES = Object.freeze({
	gridRatio: 3, // the grid is about three times the largest dimension
	gridMinSize: 2, // metres, and an even integer
	groundMargin: 0.5, // metres of disc around the grid
	gridStep: 1, // metres between the darker lines
	gridSubStep: 0.5, // metres between the lighter lines
	fill: 0.8, // the disc occupies 80 % of the smaller viewport dimension
	fov: 26
});

export const ORTHO_COEFFICIENT = 1.25;

/**
 * The stage of an asset: the square grid, the disc around it, and the shadow
 * that stays inside the disc.
 *
 * @param {number[]} size The bounding-box size, in metres
 * @returns {{
 * 	max: number;
 * 	gridSize: number;
 * 	groundRadius: number;
 * 	shadowHalf: number;
 * }}
 *   All lengths in metres; `gridSize` is an even integer
 */
export function stageFrom(size) {
	const max = Math.max(...size);
	// A group with no mesh has an infinite box: `Box3.setFromObject` starts at ±Infinity and never
	// unions anything finite. A zero size is a flat or empty asset. Neither can be framed, and a
	// NaN that reaches the camera turns the whole page white with no reason on screen.
	if (!Number.isFinite(max) || max <= 0)
		throw new Error("frame: the asset has no measurable size");

	const gridSize = Math.max(
		STAGE_RULES.gridMinSize,
		2 * Math.round((STAGE_RULES.gridRatio / 2) * max)
	);
	// The margin is past the corner, not past the middle of a side: the half-diagonal of the grid
	// square is `(gridSize / 2) * sqrt(2)`, by Pythagoras.
	const groundRadius = (gridSize / 2) * Math.SQRT2 + STAGE_RULES.groundMargin;
	return { max, gridSize, groundRadius, shadowHalf: groundRadius / 2 };
}

/**
 * The two grid layers of a stage, in draw order: the half-metre lines first and
 * faint, then the metre lines at full alpha and slightly higher.
 *
 * @param {{ gridSize: number }} stage From `stageFrom`
 * @returns {Array<{
 * 	size: number;
 * 	divisions: number;
 * 	color: number;
 * 	opacity: number;
 * 	y: number;
 * }>}
 */
export function gridLayers(stage) {
	// Exactly two layers, in draw order: the sub layer at 45 % alpha over the light background
	// reads fainter than the metre layer, and `depthWrite` off there keeps the coincident metre
	// lines visible. Only an opacity is added; the two colours are the ones the stage already uses.
	return [
		{
			size: stage.gridSize,
			divisions: stage.gridSize * 2,
			color: 0xcdd2d7,
			opacity: 0.45,
			y: 0.001
		},
		{
			size: stage.gridSize,
			divisions: stage.gridSize,
			color: 0xb0b6bd,
			opacity: 1,
			y: 0.0018
		}
	];
}

/**
 * The frame of an asset: its stage, its centre, and the height of the
 * orthographic 100 % frame.
 *
 * @param {{ size: number[]; target: number[] }} measured From `measureObject`:
 *   the bounding-box size and centre, in metres
 * @returns {{
 * 	max: number;
 * 	target: number[];
 * 	orthoHeight: number;
 * 	gridSize: number;
 * 	groundRadius: number;
 * 	shadowHalf: number;
 * }}
 *   All lengths in metres
 */
export function frameFrom({ size, target }) {
	const stage = stageFrom(size);
	return {
		...stage,
		target: [...target],
		orthoHeight: ORTHO_COEFFICIENT * stage.max
	};
}

/**
 * The distance at which the whole ground disc fits the smaller viewport
 * dimension, inside `fill` of it.
 *
 * @param {object} options
 * @param {number} options.groundRadius The disc radius, in metres
 * @param {number} options.aspect The viewport aspect ratio, width / height
 * @param {number} [options.fov] The vertical field of view, in degrees
 * @param {number} [options.fill] The fraction of the smaller dimension the disc
 *   may use
 * @returns {number} The camera distance from the target, in metres
 */
export function freeDistance({
	groundRadius,
	aspect,
	fov = STAGE_RULES.fov,
	fill = STAGE_RULES.fill
}) {
	// A NaN distance reaches the camera and turns the page blank with no reason on screen, so both
	// inputs are checked before any arithmetic.
	if (!Number.isFinite(groundRadius) || groundRadius <= 0)
		throw new Error("freeDistance: the disc or the viewport has no size");
	if (!Number.isFinite(aspect) || aspect <= 0)
		throw new Error("freeDistance: the disc or the viewport has no size");
	return (
		(2 * groundRadius) /
		(fill * 2 * Math.tan(((fov / 2) * Math.PI) / 180) * Math.min(1, aspect))
	);
}
