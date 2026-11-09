// T8.1 — the report render, tested from recorded data.
//
// The presentation of `check.ts` is a pure function of the measurement, so it is tested from a
// recorded fixture — the `profile_mm` of `r5-L3` on `left` — and not from a full `bun run check`.
// A presentation test that costs 17 s is not run; this one costs about 20 ms.
//
// The fixture is the exact JSON `scripts/blueprint/measure_view.py --json` printed for that pair.
// The expected block is the one T0008 draws, with its bar rule applied: one mark per 5 mm of
// `|delta|`, the tolerance mark at a fixed column, drawn over the bar so a bar that reaches it
// visibly crosses it.

import { describe, expect, test } from "bun:test";
import { renderReport } from "./check";

const REFERENCE = { height_mm: 1490.4, ratio: 0.4234 };
const RENDER = { height_mm: 1404.5, ratio: 0.399 };
const DELTA = { height_mm: -85.9 };

// `r5-L3` on `left`, recorded once from `measure_view.py --json`. The station is the distance from
// the nose in millimetres; `reference` and `render` are the roof height above the ground.
const PROFILE = [
  { at_mm: 0, reference: 556, render: 527, delta: -29 },
  { at_mm: 176, reference: 875, render: 830, delta: -46 },
  { at_mm: 352, reference: 920, render: 873, delta: -47 },
  { at_mm: 528, reference: 951, render: 900, delta: -52 },
  { at_mm: 704, reference: 968, render: 917, delta: -51 },
  { at_mm: 880, reference: 982, render: 930, delta: -52 },
  { at_mm: 1056, reference: 1050, render: 992, delta: -58 },
  { at_mm: 1232, reference: 1174, render: 1106, delta: -68 },
  { at_mm: 1408, reference: 1338, render: 1264, delta: -74 },
  { at_mm: 1584, reference: 1462, render: 1383, delta: -80 },
  { at_mm: 1760, reference: 1473, render: 1391, delta: -82 },
  { at_mm: 1936, reference: 1482, render: 1400, delta: -82 },
  { at_mm: 2112, reference: 1485, render: 1400, delta: -85 },
  { at_mm: 2288, reference: 1485, render: 1400, delta: -85 },
  { at_mm: 2464, reference: 1482, render: 1400, delta: -82 },
  { at_mm: 2640, reference: 1473, render: 1391, delta: -82 },
  { at_mm: 2816, reference: 1465, render: 1383, delta: -82 },
  { at_mm: 2992, reference: 1355, render: 1277, delta: -78 },
  { at_mm: 3168, reference: 1143, render: 1080, delta: -64 },
  { at_mm: 3344, reference: 977, render: 922, delta: -55 },
  { at_mm: 3520, reference: 565, render: 535, delta: -29 },
];

const EXPECTED = [
  "check     r5-L3   against blueprints/vehicules/r5-tl-1972",
  "side      left     length 3520 mm     tolerance ±40 mm",
  "",
  "silhouette   height            reference  1490.4 mm    model  1404.5 mm    delta  -85.9 mm   -5.8 %",
  "             height / length   reference    0.4234     model    0.3990     delta  -0.0244   -5.8 %",
  "",
  "Roof height above the ground, from the nose to the tail.  All values in millimetres.",
  "delta = model - reference.  A negative delta is a model that sits lower than the reference.",
  "The bar is one mark per 5 mm.  | is the tolerance limit, 40 mm.  A bar that reaches it fails.",
  "",
  "   station    reference       model       delta",
  "      0 mm      556 mm       527 mm      -29 mm   ------ |                         ok",
  "    176 mm      875 mm       830 mm      -46 mm   -------|-                        OUT",
  "    352 mm      920 mm       873 mm      -47 mm   -------|-                        OUT",
  "    528 mm      951 mm       900 mm      -52 mm   -------|--                       OUT",
  "    704 mm      968 mm       917 mm      -51 mm   -------|--                       OUT",
  "    880 mm      982 mm       930 mm      -52 mm   -------|--                       OUT",
  "   1056 mm     1050 mm       992 mm      -58 mm   -------|----                     OUT",
  "   1232 mm     1174 mm      1106 mm      -68 mm   -------|------                   OUT",
  "   1408 mm     1338 mm      1264 mm      -74 mm   -------|-------                  OUT",
  "   1584 mm     1462 mm      1383 mm      -80 mm   -------|--------                 OUT",
  "   1760 mm     1473 mm      1391 mm      -82 mm   -------|--------                 OUT",
  "   1936 mm     1482 mm      1400 mm      -82 mm   -------|--------                 OUT",
  "   2112 mm     1485 mm      1400 mm      -85 mm   -------|---------                OUT",
  "   2288 mm     1485 mm      1400 mm      -85 mm   -------|---------                OUT",
  "   2464 mm     1482 mm      1400 mm      -82 mm   -------|--------                 OUT",
  "   2640 mm     1473 mm      1391 mm      -82 mm   -------|--------                 OUT",
  "   2816 mm     1465 mm      1383 mm      -82 mm   -------|--------                 OUT",
  "   2992 mm     1355 mm      1277 mm      -78 mm   -------|--------                 OUT",
  "   3168 mm     1143 mm      1080 mm      -64 mm   -------|-----                    OUT",
  "   3344 mm      977 mm       922 mm      -55 mm   -------|---                      OUT",
  "   3520 mm      565 mm       535 mm      -29 mm   ------ |                         ok",
  "",
  "21 stations   2 within tolerance   19 outside   worst -85 mm at 2112 mm",
  "overlays      test-reports/silhouette/<view>.png    red = reference only, blue = model only",
  "renders       blueprints/vehicules/r5-tl-1972/model/r5-L3-<view>.webp",
  "status        NEEDS WORK",
].join("\n");

function fixture(overrides: Partial<Parameters<typeof renderReport>[0]> = {}) {
  return {
    prefix: "r5-L3",
    subject: "blueprints/vehicules/r5-tl-1972",
    side: "left",
    tolerance: 40,
    reference: REFERENCE,
    render: RENDER,
    delta: DELTA,
    profile: PROFILE,
    overlays: "test-reports/silhouette",
    renders: "blueprints/vehicules/r5-tl-1972/model",
    ...overrides,
  };
}

describe("renderReport", () => {
  test("the recorded left profile renders the exact report", () => {
    expect(renderReport(fixture())).toBe(EXPECTED);
  });

  test("the tolerance marker sits at one fixed column on every row", () => {
    const dataLines = renderReport(fixture()).split("\n").slice(11, 32);
    const columns = new Set(dataLines.map((line) => line.indexOf("|")));
    expect(columns.size).toBe(1);
  });

  test("a delta at the tolerance is ok, past it is OUT", () => {
    const report = renderReport(
      fixture({
        profile: [
          { at_mm: 0, reference: 1000, render: 960, delta: -40 },
          { at_mm: 176, reference: 1000, render: 959, delta: -41 },
        ],
      }),
    );
    const rows = report.split("\n").filter((line) => line.endsWith("ok") || line.endsWith("OUT"));
    expect(rows[0].endsWith("ok")).toBe(true);
    expect(rows[1].endsWith("OUT")).toBe(true);
  });

  test("a delta past the field is clamped and says OVER", () => {
    const report = renderReport(
      fixture({ profile: [{ at_mm: 0, reference: 2000, render: 1800, delta: -200 }] }),
    );
    expect(report).toContain("OVER");
    // A clamped bar fills the field: 30 cells, the tolerance mark drawn over the 8th.
    expect(report).toContain("-------|" + "-".repeat(22));
  });
});
