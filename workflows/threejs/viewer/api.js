// The client for the scene API.
//
// One fetch, one document, and no knowledge of the file tree. The server resolves the subject,
// merges the four data sources, and returns everything in millimetres, so nothing here builds a
// path and nothing here converts a unit or reconciles two scales.
//
// That is the whole point of this module. The previous client did this:
//
//   const subject = (await fetch("./scene.json").json()).subject;
//   const dimensions = await fetch(`/repo/${subject}/dimensions.json`);
//   const manifest = await fetch(`/repo/${subject}/cropped/manifest.json`);
//   const kx = dimensions.real.length.value / (subject_box[2] - subject_box[0] + 1);
//
// Four opportunities for a silent error, and three of them happened.

const SCENE_PARAM = "scene";

/** The scene directory this page is showing: `?scene=` first, then the page's own declaration. */
export function sceneParam() {
  const fromUrl = new URLSearchParams(location.search).get(SCENE_PARAM);
  if (fromUrl) return fromUrl;
  const declared = document.body?.dataset?.scene;
  if (declared) return declared;
  throw new Error(
    "no scene selected. Open the viewer as /?scene=scenes/<name>, or set data-scene on <body>.",
  );
}

/** A failing request is named, with the endpoint and the server's own reason. */
async function requestJson(url, what) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    throw new Error(`${what}: cannot reach ${url} (${error.message})`);
  }
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${what}: ${response.status} on ${url} — the server did not answer with JSON`);
  }
  return { response, body };
}

/**
 * Load the scene document. Throws with every problem the server reported, because a half-loaded
 * scene produces a plausible model rather than an obvious failure, and that is the expensive case.
 */
export async function loadScene(param = sceneParam()) {
  const url = `/api/scene?scene=${encodeURIComponent(param)}`;
  const { response, body } = await requestJson(url, "scene");

  if (!body.ok) {
    const problems = Array.isArray(body.problems) ? body.problems : [String(response.status)];
    throw new Error(`scene "${param}" is not loadable:\n  - ${problems.join("\n  - ")}`);
  }
  for (const warning of body.warnings ?? []) console.warn(`scene: ${warning}`);
  return body;
}

/** The URL of a view's cropped reference. The server wrote it; the client only carries it. */
export function referenceUrl(document_, view) {
  const reference = document_.views?.[view]?.reference;
  if (!reference) throw new Error(`view "${view}" has no reference image`);
  return reference.url;
}

/** Metres per pixel on each axis of a reference image. */
export function referenceScale(reference) {
  if (!reference?.kx_mm || !reference?.ky_mm) {
    throw new Error("reference has no scale; the server could not derive it");
  }
  return { kx: reference.kx_mm / 1000, ky: reference.ky_mm / 1000 };
}

/** A real dimension, in metres. The API reports millimetres; the model works in metres. */
export function realMetres(document_, role) {
  const entry = document_.real?.[role];
  if (!entry) throw new Error(`no real dimension for role "${role}"`);
  return entry.mm / 1000;
}

/** Show a load failure in the page, so the reason survives a screenshot. */
export function showFailure(error) {
  window.__error = String(error?.message ?? error);
  const box = document.createElement("pre");
  box.id = "scene-error";
  box.style.cssText = [
    "position:fixed", "inset:24px auto auto 24px", "z-index:100", "max-width:70ch",
    "padding:16px 18px", "background:#2a0d0d", "color:#ffd7d7", "border:1px solid #7a2a2a",
    "border-radius:8px", "font:12px/1.5 ui-monospace,monospace", "white-space:pre-wrap",
  ].join(";");
  box.textContent = `scene did not load\n\n${window.__error}`;
  document.body.appendChild(box);
}
