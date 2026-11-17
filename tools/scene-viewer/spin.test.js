// The spin: one pure function, one turn in twelve seconds.
//
// The page owns the state machine -- press, stop, pointer -- but the angle a tick produces is a
// number with a rule, and a rule is tested without a browser. A turn takes 12 s, so the camera moves
// 30° per second; anything else makes two candidates impossible to compare by eye.

import { describe, expect, test } from "bun:test";
import { SPIN_PERIOD_MS, nextAzimuth } from "./spin.js";

describe("the spin period", () => {
	test("is twelve seconds", () => {
		expect(SPIN_PERIOD_MS).toBe(12_000);
	});
});

describe("nextAzimuth", () => {
	test("returns the azimuth unchanged when the interval is not a positive number", () => {
		expect(nextAzimuth(42, 0)).toBe(42);
		expect(nextAzimuth(42, -16)).toBe(42);
		expect(nextAzimuth(42, Number.NaN)).toBe(42);
		expect(nextAzimuth(42, Number.POSITIVE_INFINITY)).toBe(42);
	});

	test("turns a full period back to the same angle", () => {
		expect(nextAzimuth(0, 12_000)).toBe(0);
		expect(nextAzimuth(0, 720_000)).toBe(0);
	});

	test("moves thirty degrees per second", () => {
		expect(nextAzimuth(0, 3_000)).toBe(90);
		expect(nextAzimuth(0, 1_000)).toBe(30);
	});

	test("normalizes the result into [0, 360)", () => {
		expect(nextAzimuth(350, 600)).toBe(8);
		expect(nextAzimuth(355, 6_000)).toBe(175);
		expect(nextAzimuth(0, 36_000)).toBe(0);
	});

	test("normalizes an azimuth that arrives outside the range", () => {
		expect(nextAzimuth(-30, 0)).toBe(-30);
		expect(nextAzimuth(370, 3_000)).toBe(100);
	});
});
