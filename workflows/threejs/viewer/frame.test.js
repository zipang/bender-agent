// The frame is arithmetic over the real dimensions, so it is tested without a renderer.
//
// The gate for this module is that the R5 keeps the six numbers its scene was built with. A
// coefficient that drifts produces a plausible picture at the wrong scale, which no silhouette
// comparison can catch when the scale is applied on both sides.

import { describe, expect, test } from "bun:test";
import { FRAME_COEFFICIENTS, frameFrom } from "./frame.js";

const r5 = {
  roles: { x: "width", y: "height", z: "length" },
  real: {
    length: { mm: 3521 },
    width: { mm: 1525 },
    height: { mm: 1400 },
  },
};

describe("frameFrom", () => {
  test("reproduces the six numbers of the R5 frame", () => {
    const frame = frameFrom(r5);
    expect(frame.target[1]).toBeCloseTo(0.7, 9);
    expect(frame.distance).toBeCloseTo(10.5, 3);
    expect(frame.orthoHeight).toBeCloseTo(4.4, 2);
    expect(frame.groundRadius).toBeCloseTo(9.0, 2);
    expect(frame.gridSize).toBeCloseTo(12.0, 2);
    expect(frame.shadowHalf).toBeCloseTo(4.5, 3);
  });

  test("the target sits at half the height, not at half the largest dimension", () => {
    const tall = { roles: { y: "height" }, real: { height: { mm: 1800 }, width: { mm: 600 }, length: { mm: 200 } } };
    expect(frameFrom(tall).target).toEqual([0, 0.9, 0]);
  });

  test("a second subject is framed by its own largest dimension", () => {
    const van = { roles: { y: "height" }, real: { width: { mm: 1900 }, height: { mm: 2000 }, length: { mm: 4800 } } };
    const frame = frameFrom(van);
    expect(frame.max).toBeCloseTo(4.8, 9);
    expect(frame.distance).toBeCloseTo(4.8 * FRAME_COEFFICIENTS.distance, 9);
    expect(frame.orthoHeight).toBeCloseTo(4.8 * FRAME_COEFFICIENTS.orthoHeight, 9);
  });

  test("a subject whose vertical role is named differently still frames", () => {
    const character = { roles: { y: "stature" }, real: { stature: { mm: 1750 }, depth: { mm: 300 } } };
    expect(frameFrom(character).target).toEqual([0, 0.875, 0]);
  });

  test("no real dimensions is a named failure, not a frame of zero", () => {
    expect(() => frameFrom({ real: {} })).toThrow(/no real dimensions/);
    expect(() => frameFrom(null)).toThrow(/no real dimensions/);
  });

  test("a missing vertical role is a named failure", () => {
    expect(() => frameFrom({ real: { width: { mm: 1500 } } })).toThrow(/vertical role "height"/);
  });
});
