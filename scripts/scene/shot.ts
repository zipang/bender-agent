// Capture every named view of a live scene to disk.
//
// The dev loop needs one thing that a browser tab cannot give: files. This script drives the
// page through agent-browser, asks the scene to place its camera on each named view, and writes
// one WebP per view. The page does the rendering; the script only presses the shutter.
//
// Usage, from the repository root (the dev server must run):
//
//   bun run scripts/scene/shot.ts \
//     --out blueprints/vehicules/r5-tl-1972/model \
//     --prefix r5-L3
//
// It writes <out>/<prefix>-<view>.webp and prints the measured bounds and triangle count.
//
// The scene is not a parameter: the script talks to a page, and the page already is the scene.
// Point it elsewhere with --url when the server runs on another port.

import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

// The view list comes from `viewer/views.json`, the one table the page and every tool share.
// It used to be a constant here, and it listed `bottom`, which the page could not place: the
// capture asked for a view the scene did not have and failed after writing a file.
const VIEWS_TABLE = await Bun.file(resolve(import.meta.dir, "../../viewer/views.json")).json();
const VIEWS: string[] = Object.keys(VIEWS_TABLE.views);

type Options = {
  url: string;
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
  throw new Error(`timed out waiting for ${label}`);
}

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));
  await mkdir(options.out, { recursive: true });
  const scratch = `/tmp/opencode/shot-${options.prefix}`;
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });

  const url = `${options.url.replace(/\/$/, "")}/?shot=1`;
  const s = options.session;

  // One page, reused for every view: the scene builds once.
  await ab(["open", url, "--session", s]);
  // Device scale 1 keeps the screenshot at the CSS size, which the references match.
  await ab(["set", "viewport", String(options.width), String(options.height), "1", "--session", s]);
  await waitFor("window.__ready === true", s, "the first frame");

  const written: string[] = [];
  let stats: Record<string, unknown> | null = null;

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
}

await main();
