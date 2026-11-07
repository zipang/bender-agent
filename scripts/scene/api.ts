// The scene API. One request returns everything the viewer needs, already merged and in
// millimetres, so the client never assembles a path and never reconciles two data sources.
//
// Why this exists. The viewer used to do this:
//
//   fetch("./scene.json")            -> the subject directory
//   fetch("/repo/" + subject + "/dimensions.json")   -> real dimensions, calibrated scales
//   fetch("/repo/" + subject + "/cropped/manifest.json") -> pixel boxes
//   then: join them, derive kx and ky, and check that the two sources agree
//
// Every silent fault of the last two passes was born in that join. A path kept "../../" and asked
// for a file outside the repository. A dimension read as a number was `{ value, source }` and
// became NaN. The pixel box was in the source image while the plane was built on the crop. The
// scale was built on the crop, margin included, and made every measurement 0.3 percent short.
//
// Four sources now meet in one function, on the server, with a name for each failure.

import { readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

type Json = Record<string, any>;

export type ApiContext = {
  root: string;
  /** Called with the absolute subject directory of every scene that loads. The server watches it,
   *  so a change to a crop or to dimensions.json reloads the page. */
  onSubject?: (absolute: string) => void;
};

// ---------------------------------------------------------------- helpers

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readJson<T = Json>(path: string): Promise<T | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    return (await file.json()) as T;
  } catch {
    return null;
  }
}

// The default axis names are the vehicle mapping. `dimensions.json` may declare its own, which is
// what lets a character say "depth" where a car says "length".
const DEFAULT_ROLES: Record<"x" | "y" | "z", string> = { x: "width", y: "height", z: "length" };

function toMillimetres(value: number, unit: string | undefined): number {
  if (unit === "mm") return value;
  if (unit === "cm") return value * 10;
  if (unit === "in") return value * 25.4;
  return value * 1000; // metres, the default of every scene so far
}

// ---------------------------------------------------------------- scene resolution

type Scene = {
  dirAbs: string;
  dirRel: string;
  id: string;
  manifest: Json;
  subjectAbs: string;
  subjectRel: string;
  dimensions: Json;
  crops: Json | null;
};

async function loadScene(
  root: string,
  requested: string,
): Promise<{ scene?: Scene; problems: string[]; status?: number }> {
  // A bare directory name is accepted, because that is what a human types: `?scene=r5-tl-1972`.
  const asPath = requested.startsWith("scenes/") ? requested : join("scenes", requested);
  const dirAbs = resolve(root, asPath);

  if (!isInside(join(root, "scenes"), dirAbs)) {
    return { problems: [`scene resolves outside scenes/: ${requested}`], status: 403 };
  }

  const manifest = await readJson(join(dirAbs, "scene.json"));
  if (!manifest) {
    return { problems: [`no scene.json at ${relative(root, dirAbs)}`], status: 404 };
  }

  const problems: string[] = [];

  const subject = typeof manifest.subject === "string" ? manifest.subject : null;
  if (!subject) {
    problems.push("scene.json has no `subject`. It names the blueprint directory.");
    return { problems, status: 200 };
  }

  const subjectAbs = resolve(root, subject);
  if (!isInside(join(root, "blueprints"), subjectAbs)) {
    return { problems: [`subject resolves outside blueprints/: ${subject}`], status: 403 };
  }

  const dimensions = await readJson<Json>(join(subjectAbs, "dimensions.json"));
  if (!dimensions) {
    problems.push(`no dimensions.json in ${subject}. Stage 1 has not run, or its file is missing.`);
  }

  const crops = await readJson<Json>(join(subjectAbs, "cropped", "manifest.json"));

  return {
    scene: {
      dirAbs,
      dirRel: relative(root, dirAbs),
      id: manifest.id ?? relative(join(root, "scenes"), dirAbs),
      manifest,
      subjectAbs,
      subjectRel: relative(root, subjectAbs),
      dimensions: dimensions ?? {},
      crops,
    },
    problems,
    status: 200,
  };
}

// ---------------------------------------------------------------- the merged document

async function sceneDocument(context: ApiContext, requested: string): Promise<Response> {
  const { root } = context;
  const { scene, problems, status } = await loadScene(root, requested);
  if (!scene) return reply({ ok: false, problems }, status ?? 400);
  context.onSubject?.(scene.subjectAbs);

  const warnings: string[] = [];
  const { dimensions, crops, manifest } = scene;

  const unit: string = dimensions.unit ?? "m";
  const roles: Record<string, string> = { ...DEFAULT_ROLES, ...(dimensions.axes ?? {}) };
  const realIn: Json = dimensions.real ?? {};

  const real: Record<string, { mm: number; source: string }> = {};
  for (const [name, entry] of Object.entries(realIn)) {
    const value = (entry as Json).value;
    if (typeof value !== "number") {
      problems.push(`dimensions.real.${name} has no numeric value`);
      continue;
    }
    real[name] = { mm: toMillimetres(value, unit), source: (entry as Json).source ?? "unknown" };
  }

  // Every role a view names must exist, or the span of that view is unknown and every measurement
  // on it would be built on a missing number.
  for (const [axis, role] of Object.entries(roles)) {
    if (!(role in real)) problems.push(`role "${role}" for axis ${axis} is not in dimensions.real`);
  }

  const viewTable = await readJson<Json>(join(root, "viewer", "views.json"));
  if (!viewTable?.views) return reply({ ok: false, problems: ["viewer/views.json is missing or invalid"] }, 500);

  const views: Json = {};
  for (const [name, spec] of Object.entries<Json>(viewTable.views)) {
    const view: Json = {
      azimuth: spec.azimuth,
      elevation: spec.elevation,
      perspective: Boolean(spec.perspective),
      axes: spec.axes ?? null,
      plate: Boolean(spec.plate),
      required: spec.required !== false,
      anchor: spec.anchor ?? "center",
    };
    if (spec.up) view.up = spec.up;

    if (spec.axes) {
      const [axisH, axisV] = String(spec.axes).split("");
      const roleH = roles[axisH];
      const roleV = roles[axisV];
      view.span = {
        h: roleH && real[roleH] ? { role: roleH, mm: real[roleH].mm } : null,
        v: roleV && real[roleV] ? { role: roleV, mm: real[roleV].mm } : null,
      };
      if (!view.span.h) problems.push(`${name}: no real dimension for axis ${axisH}`);
      if (!view.span.v) problems.push(`${name}: no real dimension for axis ${axisV}`);
    }

    if (spec.plate) {
      const crop = crops?.views?.[name];
      if (!crop) {
        const message = `${name}: no crop. Run scripts/scene/crop_reference.py.`;
        if (view.required) problems.push(message);
        else warnings.push(message + " The view is optional, so it informs and does not decide.");
        view.reference = null;
      } else {
        const [sx0, sy0, sx1, sy1] = crop.subject_box;
        const spanH = sx1 - sx0 + 1;
        const spanV = sy1 - sy0 + 1;
        const kx = view.span?.h ? view.span.h.mm / spanH : null;
        const ky = view.span?.v ? view.span.v.mm / spanV : null;

        // The calibrated scale in dimensions.json was written from the same subject box. If the two
        // disagree, the crop and the calibration no longer describe the same rectangle, and every
        // trace would carry the difference. 0.2 percent is the rounding of two divisions.
        const declared = dimensions.views?.[name]?.scale_mm_per_px;
        if (declared && kx !== null && ky !== null) {
          const dx = Math.abs((kx / declared.horizontal - 1) * 100);
          const dy = Math.abs((ky / declared.vertical - 1) * 100);
          if (dx > 0.2 || dy > 0.2) {
            warnings.push(
              `${name}: crop scale differs from dimensions.json by ` +
              `${dx.toFixed(2)} % / ${dy.toFixed(2)} %. Re-run view_scale.py or crop_reference.py.`,
            );
          }
        }

        view.reference = {
          url: `/api/asset?scene=${encodeURIComponent(scene.dirRel)}&view=${encodeURIComponent(name)}`,
          size_px: crop.size_px,
          subject_box: crop.subject_box,
          offset: crop.offset,
          // Not rounded. A scale rounded to four decimals moves a 3521 mm span by 0.02 mm, which
          // is invisible to the eye and visible to a byte comparison of two renders.
          kx_mm: kx,
          ky_mm: ky,
          gate: dimensions.views?.[name]?.gate ?? "unknown",
        };
      }
    }

    views[name] = view;
  }

  return reply({
    ok: problems.length === 0,
    scene: {
      id: scene.id,
      dir: scene.dirRel,
      name: manifest.name ?? scene.id,
      model: `/api/model?scene=${encodeURIComponent(scene.dirRel)}`,
    },
    subject: {
      dir: scene.subjectRel,
      category: relative(join(root, "blueprints"), scene.subjectAbs).split(sep)[0] ?? null,
    },
    unit: "mm",
    roles,
    real,
    views,
    gates: { scales: dimensions.scales ?? null, g1: dimensions.g1 ?? null },
    anchors: dimensions.anchors ?? {},
    problems,
    warnings,
  });
}

// ---------------------------------------------------------------- asset, model, list

async function asset(root: string, sceneParam: string | null, view: string | null): Promise<Response> {
  if (!sceneParam || !view) return reply({ ok: false, problems: ["scene and view are required"] }, 400);
  const { scene, problems, status } = await loadScene(root, sceneParam);
  if (!scene) return reply({ ok: false, problems }, status ?? 400);

  const crop = scene.crops?.views?.[view];
  if (!crop?.file) {
    return reply({ ok: false, problems: [`no crop for view "${view}"`] }, 404);
  }
  // `file` is repo-relative, written by crop_reference.py. The client never sees it; it only ever
  // receives the URL below. That is the point: one place resolves a path.
  const path = resolve(root, crop.file);
  if (!isInside(join(root, "blueprints"), path)) {
    return reply({ ok: false, problems: ["crop path escapes blueprints/"] }, 403);
  }
  const file = Bun.file(path);
  if (!(await file.exists())) return reply({ ok: false, problems: [`missing file: ${crop.file}`] }, 404);

  return new Response(file, {
    headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": "no-store",
    },
  });
}

async function model(root: string, sceneParam: string | null): Promise<Response> {
  if (!sceneParam) return reply({ ok: false, problems: ["scene is required"] }, 400);
  const { scene, problems, status } = await loadScene(root, sceneParam);
  if (!scene) return reply({ ok: false, problems }, status ?? 400);

  const modulePath = scene.manifest.model ?? "./model.js";
  const path = resolve(scene.dirAbs, modulePath);
  if (!isInside(scene.dirAbs, path)) {
    return reply({ ok: false, problems: ["model path escapes the scene directory"] }, 403);
  }
  const file = Bun.file(path);
  if (!(await file.exists())) return reply({ ok: false, problems: [`missing model: ${modulePath}`] }, 404);

  // A redirect, not the bytes. The module may import its own neighbours -- `./body-hull.js` holds
  // the traced sections -- and a relative specifier resolves against the module's final URL. Served
  // from `/api/model`, every such import would look for `/api/body-hull.js` and fail with nothing
  // on screen: the import rejects before any of the page's own error handling runs.
  const target = `/${scene.dirRel}/${modulePath.replace(/^\.\//, "")}`;
  return new Response(null, {
    status: 302,
    headers: { location: target, "cache-control": "no-store" },
  });
}

async function scenes(root: string): Promise<Response> {
  const base = join(root, "scenes");
  let entries: string[] = [];
  try {
    entries = await readdir(base, { withFileTypes: true }).then((list) =>
      list.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    );
  } catch {
    return reply({ ok: false, problems: ["no scenes/ directory"] }, 500);
  }

  const out: Json[] = [];
  for (const name of entries.sort()) {
    const manifest = await readJson(join(base, name, "scene.json"));
    if (!manifest) continue;
    out.push({
      id: name,
      dir: `scenes/${name}`,
      name: manifest.name ?? name,
      subject: manifest.subject ?? null,
    });
  }
  return reply({ ok: true, scenes: out });
}

// ---------------------------------------------------------------- measurement

async function saveMeasurement(request: Request, root: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { subject?: string; document?: unknown } | null;
  if (!body?.subject || !body.document) {
    return reply({ ok: false, problems: ["expected { subject, document }"] }, 400);
  }
  const target = join(root, body.subject, "measurements.json");
  if (!isInside(join(root, "blueprints"), target)) {
    return reply({ ok: false, problems: ["subject must live under blueprints/"] }, 403);
  }
  await Bun.write(target, JSON.stringify(body.document, null, 2) + "\n");
  return reply({ ok: true, written: relative(root, target) });
}

// ---------------------------------------------------------------- entry

export async function handleApi(request: Request, context: ApiContext): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  const { root } = context;

  if (url.pathname === "/api/scene") {
    return sceneDocument(context, url.searchParams.get("scene") ?? "");
  }
  if (url.pathname === "/api/asset") {
    return asset(root, url.searchParams.get("scene"), url.searchParams.get("view"));
  }
  if (url.pathname === "/api/model") {
    return model(root, url.searchParams.get("scene"));
  }
  if (url.pathname === "/api/scenes") {
    return scenes(root);
  }
  if (url.pathname === "/api/measure" && request.method === "POST") {
    return saveMeasurement(request, root);
  }

  return reply({ ok: false, problems: [`unknown endpoint: ${url.pathname}`] }, 404);
}
