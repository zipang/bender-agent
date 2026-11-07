// Capture every named view of a live scene to disk.
//
// The dev loop needs one thing that a browser tab cannot give: files. This script drives the
// page through agent-browser, asks the scene to place its camera on each named view, and writes
// one WebP per view. The page does the rendering; the script only presses the shutter.
//
// Usage, from the repository root (the dev server must run):
//
//   bun run workflows/threejs/tools/shot.ts \
//     --out blueprints/vehicules/r5-tl-1972/model \
//     --prefix r5-L3 \
//     --scene r5-tl-1972
//
// It writes <out>/<prefix>-<view>.webp and prints the measured bounds and triangle count.
//
// The page is shared, so the scene is a parameter: the script opens /?scene=<dir>, which the server
// redirects to the viewer. Without --scene, the server's own --scene is used, which is what the
// single-scene dev loop wants. Point it elsewhere with --url when the server runs on another port.

import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { VIEW_TABLE } from "./paths";

// The view list comes from `viewer/views.json`, the one table the page and every tool share.
// It used to be a constant here, and it listed `bottom`, which the page could not place: the
// capture asked for a view the scene did not have and failed after writing a file.
const VIEWS_TABLE = await Bun.file(VIEW_TABLE).json();
const VIEWS: string[] = Object.keys(VIEWS_TABLE.views);

type Options = {
  url: string;
  scene: string | null;
  out: string;
  prefix: string;
  views: string[];
  width: number;
  height: number;
  quality: number;
  session: string;
};

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const prefix = value("prefix");
  if (!prefix) throw new Error("--prefix <name> is required, for example r5-L3");
  const out = value("out");
  if (!out) throw new Error("--out <directory> is required");

  const views = (value("views") ?? VIEWS.join(","))
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const unknown = views.filter((v) => !VIEWS.includes(v));
  if (unknown.length > 0) {
    throw new Error(`Unknown view: ${unknown.join(", ")}. Valid: ${VIEWS.join(", ")}`);
  }

  return {
    url: value("url") ?? "http://127.0.0.1:5180/",
    scene: value("scene"),
    out: resolve(value("out")!),
    prefix,
    views,
    width: Number(value("width") ?? 1400),
    height: Number(value("height") ?? 1000),
    quality: Number(value("quality") ?? 92),
    session: value("session") ?? `scene-${prefix}`,
  };
}

// agent-browser prints one status line per command; a failure sets a non-zero exit code.
async function ab(args: string[]): Promise<string> {
  const proc = Bun.spawn(["agent-browser", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`agent-browser ${args[0]} failed (${code}): ${(stderr || stdout).trim().slice(0, 300)}`);
  }
  return stdout;
}

async function evalJson(script: string, session: string): Promise<unknown> {
  const text = (await ab(["eval", script, "--session", session])).trim();
  if (!text) return null;
  // The CLI prints the value as JSON when the script returns an object.
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function waitFor(script: string, session: string, label: string, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    const value = await evalJson(script, session);
    if (value === true) return;
    await Bun.sleep(150);
  }
  // A page that failed to load never becomes ready, and "timed out" alone sends the reader looking
  // at the timing. The viewer records its reason in `window.__error`; quote it.
  const reason = await evalJson("window.__error ?? null", session).catch(() => null);
  throw new Error(
    `timed out waiting for ${label}` + (reason ? `\n  the page reports: ${reason}` : ""),
  );
}

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));
  await mkdir(options.out, { recursive: true });
  const scratch = `/tmp/opencode/shot-${options.prefix}`;
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });

  // The scene travels in the query, because the page is shared. The server redirect keeps it, so the
  // root URL stays the entry point and no script has to know the viewer's path.
  const query = new URLSearchParams({ shot: "1" });
  if (options.scene) query.set("scene", options.scene);
  const url = `${options.url.replace(/\/$/, "")}/?${query.toString()}`;
  const s = options.session;

  const written: string[] = [];
  let stats: Record<string, unknown> | null = null;

  // The browser is closed from here on, including the case where the page never loads. A scene that
  // fails to load is the most likely failure, so the guard must start before the first request.
  try {
    // One page, reused for every view: the scene builds once.
    await ab(["open", url, "--session", s]);
    // Device scale 1 keeps the screenshot at the CSS size, which the references match.
    await ab(["set", "viewport", String(options.width), String(options.height), "1", "--session", s]);
    await waitFor("window.__ready === true", s, "the first frame");

    for (const view of options.views) {
      await evalJson(`window.__setView(${JSON.stringify(view)}).then(() => true)`, s);
      const pngPath = `${scratch}/${view}.png`;
      await ab(["screenshot", "canvas", pngPath, "--session", s]);
      const png = await Bun.file(pngPath).bytes();
      const webp = await new Bun.Image(png).webp({ quality: options.quality }).bytes();
      const path = `${options.out}/${options.prefix}-${view}.webp`;
      await Bun.write(path, webp);
      console.log(`render  ${path}  ${webp.byteLength} bytes  (${view}, ${png.byteLength} png)`);
      written.push(path);
      if (!stats) stats = (await evalJson("window.__stats()", s)) as Record<string, unknown>;
    }

    if (stats) {
      console.log("");
      console.log(`size     ${(stats.size as number[]).map((v) => v.toFixed(3)).join(" × ")} m`);
      console.log(`bounds   ${JSON.stringify(stats.min)} .. ${JSON.stringify(stats.max)}`);
      console.log(`tris     ${stats.triangles}   meshes ${stats.meshes}   draws ${stats.calls}`);
    }
    console.log(`${written.length} file(s) written`);
  } finally {
    // This script owns the session: it opened the page, so it closes the browser. The dev loop
    // calls it many times per pass, and a browser left per call is how a machine ends up with two
    // hundred processes. A close failure must not hide the files that were already written.
    try {
      await ab(["close", "--session", s]);
    } catch (error) {
      console.warn(`warning: could not close session ${s}: ${String(error).slice(0, 160)}`);
    }
  }
}

await main();
