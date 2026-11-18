// T17.2 — the dimensions line of a blueprint.
//
// The real `dimensions.json` files of the two subjects are the fixtures that matter. The synthetic
// cases cover a missing block, a bad value, the unit fallback, and the trailing-zero trim.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { dimensionsLine } from "./dimensions";

const ROOT = resolve(import.meta.dir, "..", "..", "..", "..");

function realDimensions(subject: string): unknown {
	return JSON.parse(
		readFileSync(
			join(ROOT, "blueprints", "vehicules", subject, "dimensions.json"),
			"utf8"
		)
	);
}

describe("the real blueprints", () => {
	test("r5-tl-1972 is L=3.521 m, h=1.4 m, l=1.525 m", () => {
		expect(dimensionsLine(realDimensions("r5-tl-1972"))).toBe(
			"L=3.521 m, h=1.4 m, l=1.525 m"
		);
	});

	test("blue-and-white-minivan-01 keeps its whole-metre values whole", () => {
		expect(
			dimensionsLine(realDimensions("blue-and-white-minivan-01"))
		).toBe("L=5.3 m, h=2 m, l=1.9 m");
	});
});

describe("the line", () => {
	const real = (values: [number, number, number]) => ({
		real: {
			length: { value: values[0] },
			height: { value: values[1] },
			width: { value: values[2] }
		}
	});

	test("prints the art director's order and notation", () => {
		expect(dimensionsLine({ ...real([3, 1, 1.5]), unit: "m" })).toBe(
			"L=3 m, h=1 m, l=1.5 m"
		);
	});

	test("trims trailing zeros, at most three decimals", () => {
		expect(dimensionsLine(real([3.5, 2, 1.25]))).toBe(
			"L=3.5 m, h=2 m, l=1.25 m"
		);
		expect(dimensionsLine(real([1.23456, 2.1, 0.5]))).toBe(
			"L=1.235 m, h=2.1 m, l=0.5 m"
		);
	});

	test("the unit falls back to m when it is missing or empty", () => {
		expect(dimensionsLine(real([3, 1, 1.5]))).toBe("L=3 m, h=1 m, l=1.5 m");
		expect(dimensionsLine({ ...real([3, 1, 1.5]), unit: "" })).toBe(
			"L=3 m, h=1 m, l=1.5 m"
		);
		expect(dimensionsLine({ ...real([3, 1, 1.5]), unit: "cm" })).toBe(
			"L=3 cm, h=1 cm, l=1.5 cm"
		);
	});

	test("a missing file is a null line, not a throw", () => {
		// A blueprint without dimensions is a normal blueprint.
		expect(dimensionsLine(null)).toBeNull();
	});
});

describe("the null cases", () => {
	test("a missing real block", () => {
		expect(dimensionsLine({ unit: "m" })).toBeNull();
	});

	test("a non-object", () => {
		expect(dimensionsLine("not an object")).toBeNull();
		expect(dimensionsLine(42)).toBeNull();
		expect(dimensionsLine(undefined)).toBeNull();
	});

	test("one bad value", () => {
		const good = {
			real: {
				length: { value: 3 },
				height: { value: 1 },
				width: { value: 1.5 }
			}
		};
		for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "3"]) {
			expect(
				dimensionsLine({
					...good,
					real: { ...good.real, height: { value: bad } }
				})
			).toBeNull();
		}
	});

	test("a missing value", () => {
		expect(
			dimensionsLine({ real: { length: {}, height: {}, width: {} } })
		).toBeNull();
	});
});
