// The view table: seven presets, one order, and the default.
//
// The order of the keys is the order of the view bar. A later ticket merges the Three.js table into
// this one, so the order is asserted here rather than deduced from a screenshot.

import { describe, expect, test } from "bun:test";
import { DEFAULT_VIEW, VIEWS } from "./views.js";

describe("the view table", () => {
	test("holds the seven presets in bar order", () => {
		expect(Object.keys(VIEWS)).toEqual([
			"left",
			"right",
			"front",
			"back",
			"top",
			"bottom",
			"free"
		]);
	});

	test("is frozen", () => {
		expect(Object.isFrozen(VIEWS)).toBe(true);
	});

	test("puts the six orthographic presets on the frame axes", () => {
		expect(VIEWS.left).toEqual({
			azimuth: 0,
			elevation: 0,
			perspective: false
		});
		expect(VIEWS.right).toEqual({
			azimuth: 180,
			elevation: 0,
			perspective: false
		});
		expect(VIEWS.front).toEqual({
			azimuth: 90,
			elevation: 0,
			perspective: false
		});
		expect(VIEWS.back).toEqual({
			azimuth: 270,
			elevation: 0,
			perspective: false
		});
	});

	test("flips the up vector on the two pole views", () => {
		expect(VIEWS.top).toEqual({
			azimuth: 90,
			elevation: 89.99,
			perspective: false,
			up: [0, 0, -1]
		});
		expect(VIEWS.bottom).toEqual({
			azimuth: 90,
			elevation: -89.99,
			perspective: false,
			up: [0, 0, -1]
		});
	});

	test("opens on the one free view", () => {
		expect(VIEWS.free).toEqual({
			azimuth: 60,
			elevation: 30,
			perspective: true
		});
		expect(DEFAULT_VIEW).toBe("free");
		expect(DEFAULT_VIEW in VIEWS).toBe(true);
	});

	test("leaves exactly one view in perspective", () => {
		const perspective = Object.keys(VIEWS).filter(
			(name) => VIEWS[name].perspective
		);
		expect(perspective).toEqual(["free"]);
	});
});
