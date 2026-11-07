// The measurement arithmetic has no browser in it, so it is tested without one.
//
// These are the numbers a tracing pass trusts: the precision it reads, the scale of the reference,
// and the distance between two picks. A regression here is silent -- the panel still prints a
// number, it is just the wrong one -- which is how "2.8 on left" survived so long.

import { describe, expect, test } from "bun:test";
import {
  axesOf, betweenPoints, imageScaleMm, mmPerScreenPx, panelLines, readPoint,
} from "./measure.js";

describe("mmPerScreenPx", () => {
  test("orthographic: exact everywhere, the frame height over the viewport height", () => {
    const value = mmPerScreenPx({
      perspective: false, orthoHeight: 4.4, distance: 0, fov: 0, height: 577,
    });
    expect(value).toBeCloseTo(7.6256, 3);
  });

  test("perspective: the world height at the target plane, over the viewport height", () => {
    // 2 * d * tan(fov / 2) with d = 10.5 m and fov = 26 degrees, at 577 px.
    const value = mmPerScreenPx({
      perspective: true, orthoHeight: 0, distance: 10.5, fov: 26, height: 577,
    });
    expect(value).toBeCloseTo((2 * 10.5 * Math.tan((26 * Math.PI) / 360) * 1000) / 577, 6);
  });

  test("no viewport height is NaN, never Infinity", () => {
    expect(
      Number.isNaN(mmPerScreenPx({ perspective: false, orthoHeight: 4.4, distance: 0, fov: 0, height: 0 })),
    ).toBe(true);
  });
});

describe("axesOf", () => {
  test("reads the view's own axes", () => {
    expect(axesOf({ axes: "zy" })).toEqual(["z", "y"]);
    expect(axesOf({ axes: "xz" })).toEqual(["x", "z"]);
  });

  test("falls back to x and y when the view has no axes", () => {
    expect(axesOf(null)).toEqual(["x", "y"]);
    expect(axesOf({})).toEqual(["x", "y"]);
  });
});

describe("readPoint", () => {
  test("reports millimetres on the two axes of the view", () => {
    expect(readPoint([0.02, 1.14, 1.4641], ["z", "y"])).toEqual({ z: 1464.1, y: 1140 });
  });
});

describe("betweenPoints", () => {
  test("the distance along one axis of a side view is that axis's millimetres", () => {
    const between = betweenPoints([0.02, 1.14, 1.4641], [0.02, 1.14, -0.9761], ["z", "y"]);
    expect(between.delta_mm).toEqual({ z: -2440.2, y: 0 });
    expect(between.length_mm).toBeCloseTo(2440.2, 1);
  });

  test("a diagonal reads both axes and the true length", () => {
    const between = betweenPoints([0, 0, 0], [0.003, 0.004, 0], ["x", "y"]);
    expect(between.delta_mm).toEqual({ x: 3, y: 4 });
    expect(between.length_mm).toBeCloseTo(5, 1);
  });
});

describe("imageScaleMm", () => {
  test("reads the scale the API published, not a constant", () => {
    const document_ = { views: { left: { reference: { kx_mm: 2.8235765838011226 } } } };
    expect(imageScaleMm(document_, "left")).toBeCloseTo(2.8235765838011226, 9);
  });

  test("a view without a reference has no scale", () => {
    expect(imageScaleMm({ views: { "three-quarter": {} } }, "three-quarter")).toBeNull();
    expect(imageScaleMm(null, "left")).toBeNull();
  });
});

describe("panelLines", () => {
  const base = { active: true, mmPerPx: 7.6256, imageKx: null, imageView: null, points: [], between: null };

  test("a plate quotes its own scale, with the view name", () => {
    const lines = panelLines({ ...base, imageKx: 2.8235765, imageView: "left" });
    expect(lines[1]).toBe("precision 7.63 mm per screen px  (the image itself is 2.82 mm/px on left)");
  });

  test("no plate says so instead of quoting another view's scale", () => {
    const lines = panelLines(base);
    expect(lines[1]).toBe("precision 7.63 mm per screen px  (no reference plate shown)");
  });

  test("the delta line appears only after two points", () => {
    const point = { axes: ["z", "y"], read: { z: 1464.1, y: 1140 }, source: "calque" };
    const one = panelLines({ ...base, points: [point], between: null });
    expect(one.some((line) => line.includes("delta"))).toBe(false);
    const two = panelLines({
      ...base,
      points: [point, point],
      between: { delta_mm: { z: -2440.2, y: 0 }, length_mm: 2440.2 },
    });
    expect(two.at(-1)).toBe("  delta  dZ -2440.2   dY +0   length 2440.2 mm");
  });
});
