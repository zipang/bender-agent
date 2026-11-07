// The contract checks are the last line before a blank page, so they are tested as data.

import { describe, expect, test } from "bun:test";
import { checkDocument, checkModel, describe as describeProblems } from "./contract.js";

const document_ = {
  ok: true,
  scene: { id: "r5", dir: "scenes/r5", name: "R5", model: "/api/model?scene=scenes/r5" },
  subject: { dir: "blueprints/vehicules/r5" },
  views: { left: { azimuth: 0 } },
  real: { length: { mm: 3521 }, height: { mm: 1400 } },
  roles: { y: "height", z: "length" },
};

describe("checkDocument", () => {
  test("a complete document has no problems", () => {
    expect(checkDocument(document_)).toEqual([]);
  });

  test("ok:false is reported, even when the fields are present", () => {
    expect(checkDocument({ ...document_, ok: false })).toContain(
      "the server reported ok:false; see its problems list",
    );
  });

  test("a missing field is named, one message each", () => {
    const problems = checkDocument({ ...document_, scene: { id: "r5", dir: "d", model: "m" } });
    expect(problems).toContain("scene.name is missing");
  });

  test("empty real dimensions are refused: nothing to frame or check against", () => {
    const problems = checkDocument({ ...document_, real: {} });
    expect(problems.some((p) => p.startsWith("real is empty"))).toBe(true);
  });

  test("a role with no dimension behind it is refused", () => {
    const problems = checkDocument({
      ...document_,
      roles: { x: "width", y: "height" },
      real: { height: { mm: 1400 } },
    });
    expect(problems).toContain('role "width" for axis x is not in real');
  });

  test("a non-object is a single named failure", () => {
    expect(checkDocument(null)).toEqual(["the scene document is not an object"]);
  });
});

describe("checkModel", () => {
  test("build() is accepted", () => {
    const { build, problems } = checkModel({ build: () => ({}) });
    expect(typeof build).toBe("function");
    expect(problems).toEqual([]);
  });

  test("buildBody() is accepted while the base migrates", () => {
    const { build } = checkModel({ buildBody: () => ({}) });
    expect(typeof build).toBe("function");
  });

  test("a module with neither export is refused by name", () => {
    const { build, problems } = checkModel({ measure: () => 1 }, "scenes/x/model.js");
    expect(build).toBeNull();
    expect(problems[0]).toBe("scenes/x/model.js exports none of: build, buildBody");
  });
});

describe("describe", () => {
  test("no problems is null, so a caller can branch once", () => {
    expect(describeProblems([])).toBeNull();
  });

  test("problems become one message with one bullet each", () => {
    expect(describeProblems(["a", "b"])).toBe("the scene does not satisfy its contract:\n  - a\n  - b");
  });
});
