// The two contracts a scene has to satisfy, checked in one place and with one message each.
//
// A viewer that accepts anything renders something plausible and fails much later, in a place that
// no longer knows what went wrong. The failures this repository has actually paid for are missing
// fields, not wrong types: a document without `real`, a model module without `build`, a scene
// without a subject. Each is cheap to name here.

const REQUIRED_SCENE = ["id", "dir", "name", "model"];
const REQUIRED_MODEL_EXPORTS = ["build", "buildBody"];

/**
 * Check the merged document from `/api/scene`.
 * @returns {string[]} problems, empty when the document is usable
 */
export function checkDocument(document_) {
  const problems = [];
  if (!document_ || typeof document_ !== "object") return ["the scene document is not an object"];

  if (document_.ok !== true) problems.push("the server reported ok:false; see its problems list");

  for (const field of REQUIRED_SCENE) {
    if (!document_.scene?.[field]) problems.push(`scene.${field} is missing`);
  }
  if (!document_.subject?.dir) problems.push("subject.dir is missing");
  if (!document_.views || typeof document_.views !== "object") {
    problems.push("views is missing");
  } else if (Object.keys(document_.views).length === 0) {
    problems.push("views is empty");
  }
  if (!document_.real || Object.keys(document_.real).length === 0) {
    problems.push("real is empty: no subject dimension to frame or check against");
  }
  if (!document_.roles || typeof document_.roles !== "object") {
    problems.push("roles is missing: no axis is named");
  } else if (document_.real) {
    for (const [axis, role] of Object.entries(document_.roles)) {
      if (!(role in document_.real)) problems.push(`role "${role}" for axis ${axis} is not in real`);
    }
  }
  return problems;
}

/**
 * Check a model module. The first export name found wins, so a module may still be named
 * `buildBody` while the rest of the base moves to `build`.
 * @returns {{ build: Function|null, problems: string[] }}
 */
export function checkModel(module, label = "the model module") {
  const problems = [];
  if (!module || typeof module !== "object") {
    return { build: null, problems: [`${label} is not a module`] };
  }
  const build = REQUIRED_MODEL_EXPORTS.map((name) => module[name]).find(
    (value) => typeof value === "function",
  );
  if (!build) problems.push(`${label} exports none of: ${REQUIRED_MODEL_EXPORTS.join(", ")}`);
  return { build: build ?? null, problems };
}

/** One message for the page, or null when everything is usable. */
export function describe(problems) {
  if (problems.length === 0) return null;
  return `the scene does not satisfy its contract:\n  - ${problems.join("\n  - ")}`;
}
