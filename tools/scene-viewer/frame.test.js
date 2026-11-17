// The frame of a bounding box: five lengths, all a coefficient times the largest side.
//
// Every distance the viewer uses to look at an asset is a fixed multiple of that asset's largest
// real dimension, so one page serves a chair and a car. The coefficients are the measured ratios of
// the first accepted frame, and they are frozen here exactly as the Three.js viewer holds them.

import { describe, expect, test } from "bun:test";
import { FRAME_COEFFICIENTS, frameFrom } from "./frame.js";

describe("FRAME_COEFFICIENTS", () => {
	test("are the five measured ratios", () => {
		expect(FRAME_COEFFICIENTS).toEqual({
			distance: 2.982,
			orthoHeight: 1.25,
			groundRadius: 2.556,
			gridSize: 3.408,
			shadowHalf: 1.278
		});
		expect(Object.isFrozen(FRAME_COEFFICIENTS)).toBe(true);
	});
});

describe("frameFrom", () => {
	test("multiplies the largest side by each coefficient", () => {
		const frame = frameFrom({ size: [1, 2, 4], target: [0, 1, 0] });

		expect(frame.max).toBe(4);
		expect(frame.target).toEqual([0, 1, 0]);
		expect(frame.distance).toBeCloseTo(2.982 * 4, 10);
		expect(frame.orthoHeight).toBeCloseTo(1.25 * 4, 10);
		expect(frame.groundRadius).toBeCloseTo(2.556 * 4, 10);
		expect(frame.gridSize).toBeCloseTo(3.408 * 4, 10);
		expect(frame.shadowHalf).toBeCloseTo(1.278 * 4, 10);
	});

	test("frames a one-metre cube at the five known lengths", () => {
		const frame = frameFrom({ size: [1, 1, 1], target: [0, 0.5, 0] });

		expect(frame.max).toBe(1);
		expect(frame.distance).toBeCloseTo(2.982, 10);
		expect(frame.orthoHeight).toBeCloseTo(1.25, 10);
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
