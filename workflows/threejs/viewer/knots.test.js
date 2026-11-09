// The pure selection operations of the knot editor, tested without a browser.
//
// The editor acts on a region of an outline as one object: a rectangle selects a set of knots, a
// vector moves the whole set, and a delete removes it. Those three readings are arithmetic on a
// list of points, so they live in `knots.js` with no DOM, no THREE and no state, and they are
// tested here. A regression in one of them is silent: the outline still draws, it is just the wrong
// set of knots that moved.

import { describe, expect, test } from "bun:test";
import { addIndices, indicesInRect, moveKnotsBy, removeKnots } from "./knots.js";

describe("indicesInRect", () => {
  const knots = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]];

  test("the four corner orders give the same set", () => {
    const expected = [0, 1, 2, 3, 4];
    expect(indicesInRect(knots, [0, 0, 1, 1])).toEqual(expected);
    expect(indicesInRect(knots, [1, 1, 0, 0])).toEqual(expected);
    expect(indicesInRect(knots, [0, 1, 1, 0])).toEqual(expected);
    expect(indicesInRect(knots, [1, 0, 0, 1])).toEqual(expected);
  });

  test("the boundary is inclusive", () => {
    // u = 0, u = 1, and v = 0.5 are all edges, and a knot on each is inside.
    expect(indicesInRect(knots, [0, 0, 1, 0.5])).toEqual([0, 1, 4]);
    expect(indicesInRect(knots, [0.5, 0.5, 1, 1])).toEqual([2, 4]);
  });

  test("a knot outside the rectangle is excluded", () => {
    expect(indicesInRect(knots, [0, 0, 0.4, 0.4])).toEqual([0]);
    expect(indicesInRect(knots, [0.6, 0.6, 0.9, 0.9])).toEqual([]);
  });

  test("a degenerate rectangle selects nothing", () => {
    expect(indicesInRect(knots, [0.5, 0.5, 0.5, 0.5])).toEqual([]); // a point
    expect(indicesInRect(knots, [0, 0, 0, 1])).toEqual([]); // zero width
    expect(indicesInRect(knots, [0, 0, 1, 0])).toEqual([]); // zero height
  });

  test("an empty list selects nothing", () => {
    expect(indicesInRect([], [0, 0, 1, 1])).toEqual([]);
  });

  test("the knot list is not mutated", () => {
    const copy = knots.map((p) => [...p]);
    indicesInRect(knots, [0, 0, 1, 1]);
    expect(knots).toEqual(copy);
  });
});

describe("addIndices", () => {
  test("the union is ascending and has no duplicate", () => {
    expect(addIndices([2, 0], [1, 2, 3], 5)).toEqual([0, 1, 2, 3]);
    expect(addIndices([], [3, 1], 5)).toEqual([1, 3]);
  });

  test("a non-integer, a negative and an out-of-range index are dropped", () => {
    expect(addIndices([0], [5, -1, 1.5, 2], 3)).toEqual([0, 2]);
    expect(addIndices([0], [2], 2)).toEqual([0]);
  });

  test("neither argument is mutated", () => {
    const selection = [1];
    const indices = [2];
    addIndices(selection, indices, 5);
    expect(selection).toEqual([1]);
    expect(indices).toEqual([2]);
  });
});

describe("moveKnotsBy", () => {
  const knots = [[0, 0], [1, 0], [2, 0]];

  test("one vector moves every selected knot, and no other", () => {
    expect(moveKnotsBy(knots, [0, 2], [0.1, 0.2])).toEqual([[0.1, 0.2], [1, 0], [2.1, 0.2]]);
  });

  test("an out-of-range index is ignored", () => {
    expect(moveKnotsBy(knots, [9, -1], [1, 1])).toEqual(knots);
  });

  test("the input is not mutated", () => {
    const copy = knots.map((p) => [...p]);
    moveKnotsBy(knots, [0], [1, 1]);
    expect(knots).toEqual(copy);
  });

  test("every point is a deep copy", () => {
    const out = moveKnotsBy(knots, [], [0, 0]);
    out[0][0] = 99;
    expect(knots[0][0]).toBe(0);
  });
});

describe("removeKnots", () => {
  const five = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];

  test("several knots are removed, and the removed list is ascending", () => {
    const result = removeKnots(five, [3, 1], 3);
    expect(result.refused).toBe(false);
    expect(result.removed).toEqual([1, 3]);
    expect(result.knots).toEqual([[0, 0], [2, 0], [4, 0]]);
  });

  test("the input is not mutated", () => {
    const copy = five.map((p) => [...p]);
    removeKnots(five, [0, 1], 3);
    expect(five).toEqual(copy);
  });

  test("an empty set is a no-op", () => {
    const result = removeKnots(five, [], 3);
    expect(result.refused).toBe(false);
    expect(result.removed).toEqual([]);
    expect(result.knots).toEqual(five);
  });

  test("a refusal below the minimum is atomic", () => {
    const four = [[0, 0], [1, 0], [2, 0], [3, 0]];
    const result = removeKnots(four, [0, 1], 3); // 4 - 2 = 2 < 3
    expect(result.refused).toBe(true);
    expect(result.reason).toBe("minimum");
    expect(result.removed).toEqual([]);
    expect(result.knots).toEqual(four);
  });

  test("exactly the minimum remaining is accepted", () => {
    const four = [[0, 0], [1, 0], [2, 0], [3, 0]];
    const result = removeKnots(four, [0], 3); // 4 - 1 = 3
    expect(result.refused).toBe(false);
    expect(result.removed).toEqual([0]);
    expect(result.knots).toEqual([[1, 0], [2, 0], [3, 0]]);
  });

  test("a duplicate and an out-of-range index are ignored", () => {
    const result = removeKnots(five, [1, 1, 9, -1], 3);
    expect(result.removed).toEqual([1]);
    expect(result.knots).toEqual([[0, 0], [2, 0], [3, 0], [4, 0]]);
  });
});
