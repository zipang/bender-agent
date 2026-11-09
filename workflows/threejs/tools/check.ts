// One command that answers the only question a modelling pass has: how far is the model from the
// reference, right now?
//
// A pass used to cost five separate calls — screenshot, convert, overlay, measure, read two
// images — and each one was a chance to compare the wrong pair of files. This script runs the
// whole chain and prints one report:
//
//   1. capture every view of the live scene to WebP
//   2. overlay each render on the matching reference silhouette
//   3. measure both side views and print the deltas in millimetres
//   4. check that the two images face the same way before it trusts any number
//
// Usage, from the repository root (the dev server must run):
//
//   bun run workflows/threejs/tools/check.ts --subject blueprints/vehicules/r5-tl-1972 --prefix r5-L3
//
// Exit code 1 when the model is outside the tolerance, so a loop can gate on it.
//
// Every step prints one timestamped line as it is entered, and each child's own output reaches the
// terminal as it is written. A run used to be silent for 45 s and read as a hang; the clock and the
// streamed children are what tell a slow step from a wedged one.

import { mkdir, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { ROOT, REPORTS, SCENES, TOOLS, VIEW_TABLE, toRepoPath } from "./paths";

type Options = {
  subject: string;
  scene: string | null;
  prefix: string;
  views: string[];
  out: string;
  tolerance: number;
  skipShot: boolean;
  port: number;
};

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const subject = value("subject");
  const prefix = value("prefix");
  if (!subject) throw new Error("--subject <subject directory> is required");
  if (!prefix) throw new Error("--prefix <name> is required, for example r5-L3");
  return {
    subject: resolve(subject),
    scene: value("scene"),
    prefix,
    views: (value("views") ?? "left,right,front,back,top").split(",").map((v) => v.trim()).filter(Boolean),
    out: resolve(value("out") ?? `${subject}/model`),
    tolerance: Number(value("tolerance") ?? 40),
    skipShot: argv.includes("--no-shot"),
    port: Number(value("port") ?? 5180),
  };
}

/** The scene name whose scene.json names this subject. */
async function findScene(root: string, subject: string): Promise<string | null> {
  const wanted = relative(root, subject);
  let names: string[] = [];
  try {
    names = await readdir(SCENES, { withFileTypes: true }).then((list) =>
      list.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    );
  } catch {
    return null;
  }
  for (const name of names.sort()) {
    const file = Bun.file(join(SCENES, name, "scene.json"));
    if (!(await file.exists())) continue;
    const manifest = await file.json().catch(() => null);
    if (manifest?.subject && relative(ROOT, resolve(ROOT, manifest.subject)) === wanted) {
      return name;
    }
  }
  return null;
}

// ------------------------------------------------------------------ the clock

const START = Date.now();

// One colour per step kind, so a long run can be scanned without reading every word. Colour is
// emitted only on a terminal: a pipe or a log file stays plain, because escape codes in a captured
// log are noise. `NO_COLOR` turns it off, and `Bun.enableANSIColors` already reflects it.
const COLOUR = Boolean(process.stdout.isTTY) && !("NO_COLOR" in process.env) && Bun.enableANSIColors !== false;

const STEP_COLOUR: Record<string, string> = {
  scene: "36",   // cyan
  capture: "34", // blue
  overlay: "35", // magenta
  orient: "33",  // yellow
  measure: "32", // green
};

function paint(code: string, text: string): string {
  return COLOUR ? `\u001b[${code}m${text}\u001b[0m` : text;
}

/** The elapsed seconds since the run began, right-aligned to five columns. */
function clock(): string {
  return ((Date.now() - START) / 1000).toFixed(1).padStart(5);
}

/** One progress line: `[  0.1s] capture   6 view(s)`. It flushes, so a reader sees it live. */
function say(step: string, message: string): void {
  const label = paint(STEP_COLOUR[step] ?? "0", step.padEnd(10));
  process.stdout.write(`[${clock()}s] ${label}${message}\n`);
}

/** Seconds since a mark taken with `Date.now()`, to one decimal. */
function since(mark: number): string {
  return `${((Date.now() - mark) / 1000).toFixed(1)} s`;
}

// ------------------------------------------------------------------ children

/**
 * Run a child and wait for it.
 *
 * `capture: false` (the default) inherits the child's stdout and stderr, so `shot.ts`'s `render …`
 * lines and `silhouette.ts`'s progress reach the terminal as they are written. `capture: true` reads
 * the child's stdout and returns it; the `measure` step is the only caller that needs it, because
 * its stdout is JSON.
 *
 * `timeoutMs` bounds the child. On expiry it is killed and the error names the label and the
 * elapsed time. This is what turns a wedged child from a silent forever-wait into a loud failure.
 */
async function run(
  cmd: string[],
  label: string,
  options: { capture?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const { capture = false, timeoutMs = 180_000 } = options;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const proc = Bun.spawn(cmd, {
    stdout: capture ? "pipe" : "inherit",
    stderr: "inherit",
    signal: controller.signal,
  });
  try {
    const stdout = capture ? await new Response(proc.stdout).text() : "";
    const code = await proc.exited;
    if (code !== 0) {
      if (controller.signal.aborted) {
        throw new Error(`${label} timed out after ${((Date.now() - started) / 1000).toFixed(1)} s`);
      }
      throw new Error(`${label} failed (${code})`);
    }
    return stdout;
  } finally {
    clearTimeout(timer);
  }
}

// The two images must show the same flank. A reliable probe: on a hatchback the greenhouse sits
// behind the middle of the car, so the upper third of the silhouette is heavier on the tail side.
// If that heavier side falls on opposite sides of the two images, one of them is mirrored, and
// every measurement below would be meaningless.
//
// The result is named after what it measures — which side carries the roof mass — and never after
// the nose. Inferring "the nose is here" needs a handedness convention, and a convention that is
// off by one turns a working check into a confident lie.
//
// The background fill is run propagation, not a one-pixel-per-iteration dilation. The old fill grew
// by one pixel a pass and needed `w + h - 1` passes — 2143 on a 1376 x 768 image — each a full
// dilation over a megapixel, because the background surrounds the subject and the far corner is the
// last pixel reached. Run propagation reaches the same fixed point in a handful of passes: within a
// row, every pixel in the same contiguous candidate run as a seeded pixel is marked, and a
// horizontal pass alternated with a vertical pass converges to the same 4-connected component.
//
// A forward `maximum.accumulate` unioned with a backward one is NOT enough on its own: the running
// maximum carries a seed across a gap in the mask and marks a pixel the fill would never reach. The
// exact form compares two running maxima — the last seed at or before the pixel, and the last
// non-candidate at or before it. A pixel is reachable when the last seed is the more recent of the
// two, which is true exactly when a seed sits in the pixel's own run. The result is identical to
// the dilation fill, which is the point: the verdict must not move.
async function roofMassSide(path: string): Promise<"mass-left" | "mass-right"> {
  const script = `
import sys
import numpy as np
from PIL import Image
pixels = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.int16)
h, w, _ = pixels.shape

def reach(cand, seed):
    # The 4-connected component of \`seed\` in \`cand\`, by run propagation.
    idx = np.arange(w)
    col = np.arange(h).reshape(h, 1)
    reg = np.zeros((h, w), dtype=bool)
    reg[seed] = True
    for _ in range(h + w):
        before = reg
        # Horizontal runs: forward and backward.
        blocker = np.maximum.accumulate(np.where(cand, -1, idx), axis=1)
        seed_at = np.maximum.accumulate(np.where(reg, idx, -1), axis=1)
        right = seed_at > blocker
        blocker = np.maximum.accumulate(np.where(cand[:, ::-1], -1, idx), axis=1)[:, ::-1]
        seed_at = np.maximum.accumulate(np.where(reg[:, ::-1], idx, -1), axis=1)[:, ::-1]
        reg = (right | (seed_at > blocker)) & cand
        # Vertical runs: forward and backward.
        blocker = np.maximum.accumulate(np.where(cand, -1, col), axis=0)
        seed_at = np.maximum.accumulate(np.where(reg, col, -1), axis=0)
        down = seed_at > blocker
        blocker = np.maximum.accumulate(np.where(cand[::-1, :], -1, col), axis=0)[::-1, :]
        seed_at = np.maximum.accumulate(np.where(reg[::-1, :], col, -1), axis=0)[::-1, :]
        reg = (down | (seed_at > blocker)) & cand
        if np.array_equal(reg, before):
            return reg
    raise RuntimeError("run propagation did not converge within w + h passes")

bg = np.zeros((h, w), dtype=bool)
for seed in [(0,0),(0,w-1),(h-1,0),(h-1,w-1)]:
    cand = np.abs(pixels - pixels[seed]).max(axis=2) < 26
    bg |= reach(cand, seed)
m = ~bg
rows = np.where(m.any(axis=1))[0]; cols = np.where(m.any(axis=0))[0]
top, bottom, left, right = rows[0], rows[-1], cols[0], cols[-1]
h_px = bottom - top + 1
# Upper third only: the roof and the glass, which sit rearward of centre on this body shape.
band = m[top:top + h_px // 3, left:right + 1]
weights = band.sum(axis=0).astype(float)
xs = np.arange(weights.size)
centre = float((weights * xs).sum() / max(weights.sum(), 1)) / max(weights.size - 1, 1)
print("mass-left" if centre < 0.5 else "mass-right")
`.trim();
  const proc = Bun.spawn(["python3", "-c", script, path], { stdout: "pipe", stderr: "pipe" });
  const text = (await new Response(proc.stdout).text()).trim();
  await proc.exited;
  if (text === "mass-left" || text === "mass-right") return text;
  throw new Error(`could not read the roof-mass side of ${path}: ${text.slice(0, 200)}`);
}

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));
  await mkdir(options.out, { recursive: true });
  const root = ROOT;

  // 1. Capture. One page, every view, WebP on disk.
  if (!options.skipShot) {
    // The page is shared, so the capture names the scene. `--scene` wins; otherwise the scene whose
    // `scene.json` claims this subject. A subject without a scene is an error, not a silent
    // capture of whichever scene the server happened to start with.
    const scene = options.scene ?? (await findScene(root, options.subject));
    if (!scene) {
      throw new Error(
        `no scene in ${toRepoPath(SCENES)}/ has subject "${relative(root, options.subject)}". ` +
          `Add one, or pass --scene.`,
      );
    }
    say("scene", scene);
    // The capture list comes from the shared view table. A view is captured when the caller asked
    // for it, or when it is a perspective view: those are the ones that judge a mass, so a pass
    // always wants them, and no list here has to be kept in step with the page.
    const table = await Bun.file(VIEW_TABLE).json();
    const capture = Object.entries(table.views as Record<string, { perspective?: boolean }>)
      .filter(([name, view]) => options.views.includes(name) || view.perspective)
      .map(([name]) => name);
    say("capture", `${capture.length} view(s): ${capture.join(",")}`);
    const mark = Date.now();
    await run([
      "bun", "run", join(TOOLS, "shot.ts"),
      "--out", options.out,
      "--prefix", options.prefix,
      "--views", capture.join(","),
      "--scene", scene,
      "--url", `http://127.0.0.1:${options.port}/`,
    ], "capture");
    say("capture", `done in ${since(mark)}`);
  } else {
    say("scene", "skipped (--no-shot)");
  }

  // 2. Overlay, so the eye gets a picture as well as a table.
  say("overlay", `${options.views.length} view(s)`);
  const overlayMark = Date.now();
  await run([
    "bun", "run", join(TOOLS, "silhouette.ts"),
    "--subject", options.subject,
    "--render", options.out,
    "--prefix", options.prefix,
    "--views", options.views.join(","),
  ], "silhouette");
  say("overlay", `done in ${since(overlayMark)}`);

  // 3. Orientation guard, before any number is trusted.
  const problems: string[] = [];
  for (const view of ["left", "right"]) {
    if (!options.views.includes(view)) continue;
    const referencePath = `${options.subject}/${view}/reference.png`;
    if (!(await Bun.file(referencePath).exists())) continue;
    const renderPath = `${options.out}/${options.prefix}-${view}.webp`;
    say("orient", `${view} reference`);
    const mark = Date.now();
    const a = await roofMassSide(referencePath);
    say("orient", `${view} reference  ${a}  (${since(mark)})`);
    say("orient", `${view} render`);
    const renderMark = Date.now();
    const b = await roofMassSide(renderPath);
    say("orient", `${view} render  ${b}  (${since(renderMark)})`);
    if (a !== b) {
      problems.push(
        `${view}: reference has ${a} but the render has ${b} — one of them is mirrored`,
      );
    }
  }

  // 4. Measurements on the side view.
  const side = ["left", "right"].find((v) => options.views.includes(v)) ?? "left";
  const maybeline = `${options.subject}/${side}/reference.png`;
  let profile: Array<{ at_mm: number; reference: number; render: number; delta: number }> = [];
  let summary = "";
  if (await Bun.file(maybeline).exists()) {
    say("measure", side);
    const mark = Date.now();
    const output = await run([
      "python3", join(ROOT, "scripts/blueprint/measure_view.py"),
      maybeline, `${options.out}/${options.prefix}-${side}.webp`,
      "--json",
    ], "measure", { capture: true });
    say("measure", `done in ${since(mark)}`);
    const data = JSON.parse(output) as {
      reference: { height_mm: number; ratio: number };
      render: { height_mm: number; ratio: number };
      delta: { height_mm: number };
      profile_mm: typeof profile;
    };
    profile = data.profile_mm;
    summary = [
      `height    ${data.reference.height_mm} mm reference   ${data.render.height_mm} mm render   ` +
        `${data.delta.height_mm >= 0 ? "+" : ""}${data.delta.height_mm} mm`,
      `ratio     ${data.reference.ratio.toFixed(4)} reference   ${data.render.ratio.toFixed(4)} render`,
    ].join("\n");
  } else {
    say("measure", `skipped (no ${side} reference)`);
  }

  // 5. One report.
  console.log("");
  console.log(`check     ${options.prefix}   against ${toRepoPath(options.subject)}`);
  console.log("");
  if (summary) console.log(summary);
  console.log("");

  const worst = profile.reduce(
    (acc, p) => (Math.abs(p.delta) > Math.abs(acc.delta) ? p : acc),
    { at_mm: 0, reference: 0, render: 0, delta: 0 },
  );
  if (profile.length > 0) {
    console.log(`  ${"at mm".padStart(7)} ${"ref".padStart(7)} ${"model".padStart(7)} ${"delta".padStart(7)}`);
    for (const point of profile) {
      const bar = (point.delta > 0 ? "+" : "-").repeat(
        Math.min(Math.round(Math.abs(point.delta) / 20), 28),
      );
      console.log(
        `  ${point.at_mm.toFixed(0).padStart(7)} ${point.reference.toFixed(0).padStart(7)} ` +
        `${point.render.toFixed(0).padStart(7)} ${(point.delta >= 0 ? "+" : "") + point.delta.toFixed(0)}`.padEnd(20) +
        bar,
      );
    }
  }

  const outOfTolerance = Math.abs(worst.delta) > options.tolerance;
  console.log("");
  console.log(`worst     ${worst.delta >= 0 ? "+" : ""}${worst.delta.toFixed(0)} mm at ${worst.at_mm.toFixed(0)} mm from the nose ` +
    `(tolerance ${options.tolerance} mm)`);
  for (const problem of problems) console.log(`WARNING   ${problem}`);
  console.log("");
  console.log(`images    ${toRepoPath(join(REPORTS, "silhouette"))}/<view>.png    red = reference only, blue = model only`);
  console.log(`renders   ${toRepoPath(options.out)}/${options.prefix}-<view>.webp`);
  console.log(outOfTolerance || problems.length > 0 ? "status    NEEDS WORK" : "status    within tolerance");

  // The header has always promised it: exit 1 when the model is outside the tolerance. The status
  // line says so, and the exit code now agrees. Orientation findings keep their exit 1 too.
  if (outOfTolerance || problems.length > 0) process.exit(1);
}

await main();
