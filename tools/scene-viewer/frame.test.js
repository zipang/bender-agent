// The frame of a bounding box: the stage, the disc, the shadow, and the perspective distance.
//
// The stage is a ground made of whole metre cells, sized from the asset: a chair and a car each get
// a grid that fits them, in even whole metres so the metre lines fall on the integers. The
// orthographic height keeps its one coefficient of `max`, because the art director accepted the
// 100 % frame; the stage adapts behind it. The perspective camera has no zoom factor, so its 100 %
// is a distance computed from the disc and the viewport, not a multiple of the asset.
//
// The disc is measured to the CORNER of the grid, so the grid never touches its rim, and the two
// grid layers are a contract of this module: the metre lines are darker and at full alpha, because
// WebGL ignores `linewidth` above 1.

import { describe, expect, test } from "bun:test";
import {
	ORTHO_COEFFICIENT,
	STAGE_RULES,
	frameFrom,
	freeDistance,
	gridLayers,
	stageFrom
} from "./frame.js";

describe("STAGE_RULES", () => {
	test("is the frozen rule table of the stage", () => {
		expect(STAGE_RULES).toEqual({
			gridRatio: 3,
			gridMinSize: 2,
			groundMargin: 0.5,
			gridStep: 1,
			gridSubStep: 0.5,
			fill: 0.8,
			fov: 26
		});
		expect(Object.isFrozen(STAGE_RULES)).toBe(true);
	});

	test("keeps the orthographic coefficient of the first accepted frame", () => {
		expect(ORTHO_COEFFICIENT).toBe(1.25);
	});
});

describe("stageFrom", () => {
	// `max` (m), `gridSize` (m), `groundRadius` (m), `shadowHalf` (m). The radius is measured to the
	// CORNER of the grid: `(gridSize / 2) * sqrt(2) + 0.5`, so the disc clears every corner by the
	// ground margin and clears the middle of every side by more.
	const ROWS = [
		[0.1, 2, 1.914, 0.957],
		[1.0, 4, 3.328, 1.664],
		[1.1, 4, 3.328, 1.664],
		[1.6, 4, 3.328, 1.664],
		[1.7, 6, 4.743, 2.371],
		[4.3, 12, 8.985, 4.493],
		[8.0, 24, 17.471, 8.735]
	];

	test("sizes the grid in whole even metres, the disc around it, and the shadow inside it", () => {
		for (const [max, gridSize, groundRadius, shadowHalf] of ROWS) {
			const stage = stageFrom([max, max, max]);

			expect(stage.max).toBe(max);
			expect(stage.gridSize).toBe(gridSize);
			expect(stage.groundRadius).toBeCloseTo(groundRadius, 3);
			expect(stage.shadowHalf).toBeCloseTo(shadowHalf, 3);
		}
	});

	test("always answers an even integer of at least two metres", () => {
		for (const [max] of ROWS) {
			const { gridSize } = stageFrom([max, 1, 1]);

			expect(Number.isInteger(gridSize)).toBe(true);
			expect(gridSize % 2).toBe(0);
			expect(gridSize).toBeGreaterThanOrEqual(STAGE_RULES.gridMinSize);
		}
	});

	test("clears every corner of the grid by the ground margin", () => {
		// The margin is a property, not a coincidence of one row: the half-diagonal of a square of
		// side `g` is `(g / 2) * sqrt(2)`, by Pythagoras.
		for (const [max] of ROWS) {
			const stage = stageFrom([max, max, max]);

			expect(
				stage.groundRadius - (stage.gridSize / 2) * Math.SQRT2
			).toBeCloseTo(0.5, 12);
			expect(
				stage.groundRadius - (stage.gridSize / 2) * Math.SQRT2
			).toBeCloseTo(STAGE_RULES.groundMargin, 12);
			expect(stage.shadowHalf).toBeCloseTo(stage.groundRadius / 2, 10);
		}
	});

	test("keeps the two-metre floor on a one-centimetre asset", () => {
		const stage = stageFrom([0.01, 0.01, 0.01]);

		expect(stage.gridSize).toBe(2);
		expect(stage.groundRadius).toBeCloseTo(1.914, 3);
	});

	test("takes the largest side of the asset", () => {
		const stage = stageFrom([1, 1.7, 0.4]);

		expect(stage.max).toBe(1.7);
		expect(stage.gridSize).toBe(6);
	});

	test("throws on an asset with no measurable size", () => {
		expect(() => stageFrom([0, 0, 0])).toThrow(
			"frame: the asset has no measurable size"
		);
		expect(() => stageFrom([Number.POSITIVE_INFINITY, 1, 1])).toThrow(
			"frame: the asset has no measurable size"
		);
		expect(() => stageFrom([Number.NaN, 1, 1])).toThrow(
			"frame: the asset has no measurable size"
		);
	});
});

describe("frameFrom", () => {
	test("adds the target and the orthographic height to the stage", () => {
		const frame = frameFrom({ size: [1, 2, 4], target: [0, 1, 0] });

		expect(frame.max).toBe(4);
		expect(frame.target).toEqual([0, 1, 0]);
		expect(frame.orthoHeight).toBeCloseTo(ORTHO_COEFFICIENT * 4, 10);
		expect(frame.gridSize).toBe(12);
		expect(frame.groundRadius).toBeCloseTo(8.985, 3);
		expect(frame.shadowHalf).toBeCloseTo(4.493, 3);
		expect(frame.distance).toBeUndefined();
	});

	test("frames a one-metre cube at the known stage", () => {
		const frame = frameFrom({ size: [1, 1, 1], target: [0, 0.5, 0] });

		expect(frame.max).toBe(1);
		expect(frame.orthoHeight).toBeCloseTo(1.25, 10);
		expect(frame.gridSize).toBe(4);
		expect(frame.groundRadius).toBeCloseTo(3.328, 3);
		expect(frame.shadowHalf).toBeCloseTo(1.664, 3);
	});

	test("throws on an object with no measurable size", () => {
		const empty = { size: [0, 0, 0], target: [0, 0, 0] };

		expect(() => frameFrom(empty)).toThrow(
			"frame: the asset has no measurable size"
		);
	});

	test("throws on a non-finite size", () => {
		const infinite = {
			size: [Number.POSITIVE_INFINITY, 1, 1],
			target: [0, 0, 0]
		};

		expect(() => frameFrom(infinite)).toThrow(
			"frame: the asset has no measurable size"
		);
	});
});

describe("freeDistance", () => {
	// disc diameter (m), aspect, distance (m). The formula is `D / (fill * 2 * tan(fov / 2) *
	// min(1, a))`, with `2 * tan(13°) = 0.4617364`, so `k = 0.3693891`.
	const ROWS = [
		[5.0, 16 / 9, 13.536],
		[5.0, 4 / 3, 13.536],
		[5.0, 0.5, 27.072],
		[13.0, 16 / 9, 35.193]
	];

	test("frames the whole disc in the smaller viewport dimension", () => {
		for (const [diameter, aspect, expected] of ROWS) {
			expect(
				freeDistance({ groundRadius: diameter / 2, aspect })
			).toBeCloseTo(expected, 3);
		}
	});

	test("halves the distance of a portrait window, because the width binds", () => {
		const landscape = freeDistance({ groundRadius: 2.5, aspect: 1 });
		const portrait = freeDistance({ groundRadius: 2.5, aspect: 0.5 });

		expect(portrait).toBeCloseTo(landscape * 2, 10);
	});

	test("frames the real stages at 16 / 9", () => {
		// The page's window is a landscape one, so `min(1, aspect)` is 1 and the distance follows the
		// disc alone. These are the stages of A7, not a 5 m disc made by hand.
		const ROWS = [
			[1.0, 4, 18.021],
			[4.3, 12, 48.649],
			[8.0, 24, 94.592]
		];

		for (const [max, gridSize, expected] of ROWS) {
			const stage = stageFrom([max, max, max]);

			expect(stage.gridSize).toBe(gridSize);
			expect(
				freeDistance({
					groundRadius: stage.groundRadius,
					aspect: 16 / 9
				})
			).toBeCloseTo(expected, 3);
		}
	});

	test("throws when the disc or the viewport has no size", () => {
		const message = "freeDistance: the disc or the viewport has no size";

		expect(() => freeDistance({ groundRadius: 0, aspect: 1 })).toThrow(
			message
		);
		expect(() => freeDistance({ groundRadius: -1, aspect: 1 })).toThrow(
			message
		);
		expect(() =>
			freeDistance({ groundRadius: Number.NaN, aspect: 1 })
		).toThrow(message);
		expect(() => freeDistance({ groundRadius: 2.5, aspect: 0 })).toThrow(
			message
		);
		expect(() =>
			freeDistance({
				groundRadius: 2.5,
				aspect: Number.POSITIVE_INFINITY
			})
		).toThrow(message);
	});
});

describe("gridLayers", () => {
	/** The stage of a one-metre cube: a 4 m grid. */
	const STAGE = stageFrom([1, 1, 1]);

	/**
	 * The sum of the three channels: a monotonic, readable stand-in for the
	 * luminance.
	 */
	const brightness = (color) =>
		((color >> 16) & 0xff) + ((color >> 8) & 0xff) + (color & 0xff);

	test("returns exactly the sub layer then the metre layer", () => {
		// A8: WebGL ignores `linewidth` above 1, so the only lever for "smaller lines" is alpha and
		// colour. The array is the contract between `frame.js` and the two `GridHelper`s of `stage.js`.
		expect(gridLayers(STAGE)).toEqual([
			{
				size: 4,
				divisions: 8,
				color: 0xcdd2d7,
				opacity: 0.45,
				y: 0.001
			},
			{
				size: 4,
				divisions: 4,
				color: 0xb0b6bd,
				opacity: 1,
				y: 0.0018
			}
		]);
	});

	test("puts both layers on the same square, the sub layer at twice the divisions", () => {
		for (const max of [0.1, 1, 1.7, 4.3, 8]) {
			const stage = stageFrom([max, max, max]);
			const [sub, metre] = gridLayers(stage);

			expect(sub.size).toBe(stage.gridSize);
			expect(metre.size).toBe(stage.gridSize);
			expect(sub.divisions).toBe(stage.gridSize * 2);
			expect(metre.divisions).toBe(stage.gridSize);
			expect(Number.isInteger(sub.divisions)).toBe(true);
			expect(Number.isInteger(metre.divisions)).toBe(true);
		}
	});

	test("draws the metre layer darker, at full alpha, and higher", () => {
		const [sub, metre] = gridLayers(STAGE);

		expect(brightness(metre.color)).toBeLessThan(brightness(sub.color));
		expect(metre.opacity).toBe(1);
		expect(sub.opacity).toBeLessThan(1);
		expect(sub.opacity).toBeGreaterThan(0);
		// The sub layer is drawn first and lower, so the metre lines paint over the coincident
		// half-metre lines instead of being hidden by them.
		expect(sub.y).toBeLessThan(metre.y);
	});
});
