// Overlay the silhouette of a reference view and the silhouette of the matching render.
//
// Comparing two photographs of a car by eye is unreliable: the framing, the scale and the
// perspective all differ. So each image is reduced to its silhouette — the outline of the
// subject on the white field — and both are stretched into the same box. What remains is the
// shape alone. A red-only area exists in the reference, a blue-only area exists in the render,
// and the magenta area is where the two agree.
//
// Usage:
//
//   bun run workflows/threejs/tools/silhouette.ts \
//     --subject blueprints/vehicules/r5-tl-1972 \
//     --render blueprints/vehicules/r5-tl-1972/model \
//     --prefix r5-L3
//
// It writes /tmp/opencode/silhouette/<view>.png.

import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_VIEWS = ["front", "back", "left", "right"];

type Options = {
  subject: string;
  render: string;
  prefix: string;
  views: string[];
  width: number;
  height: number;
  out: string;
};

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const subject = value("subject");
  const prefix = value("prefix");
  if (!subject) throw new Error("--subject <subject directory> is required");
  if (!prefix) throw new Error("--prefix <render prefix> is required");
  return {
    subject: resolve(subject),
    render: resolve(value("render") ?? `${subject}/model`),
    prefix,
    views: (value("views") ?? DEFAULT_VIEWS.join(",")).split(",").map((v) => v.trim()).filter(Boolean),
    width: Number(value("width") ?? 900),
    height: Number(value("height") ?? 620),
    out: resolve(value("out") ?? "/tmp/opencode/silhouette"),
  };
}

async function magick(args: string[]): Promise<void> {
  const proc = Bun.spawn(["magick", ...args], { stdout: "pipe", stderr: "pipe" });
  const stderr = await new Response(proc.stderr).text();
  if ((await proc.exited) !== 0) throw new Error(`magick failed: ${stderr.trim().slice(0, 400)}`);
}

// White field to transparent, alpha to a grayscale mask, trim to the subject, then scale both
// images to the SAME WIDTH and drop them on a common canvas anchored at the bottom centre.
//
// Two choices matter here:
//
//   - Scale by width, never to the bounding box. Fitting each subject to its own box would
//     stretch a too-tall model back into shape and hide the very error being looked for.
//   - Anchor at the bottom centre. Both cars stand on the ground and are centred on their own
//     length, so the ground line and the mid-length plane coincide. Every remaining difference
//     is then a real difference in the model.
//
// The background is removed by a flood fill from a corner, not by a brightness test, because
// the car carries light grey trim that a threshold would eat.
async function mask(source: string, target: string, o: Options): Promise<void> {
  await magick([
    source,
    "-alpha", "on",
    "-fuzz", "14%",
    "-fill", "none",
    "-draw", "color 0,0 floodfill",
    "-draw", "color 1,0 floodfill",
    "-alpha", "extract",
    "-trim", "+repage",
    "-filter", "Lanczos",
    "-resize", `${o.width}x`,
    "-background", "black",
    "-gravity", "south",
    "-extent", `${o.width}x${o.height}`,
    "-threshold", "20%",
    target,
  ]);
}

async function findReference(subject: string, view: string): Promise<string | null> {
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    const path = `${subject}/${view}/reference.${ext}`;
    if (await Bun.file(path).exists()) return path;
  }
  return null;
}

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));
  await mkdir(options.out, { recursive: true });
  const scratch = "/tmp/opencode/silhouette-tmp";
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });

  for (const view of options.views) {
    const reference = await findReference(options.subject, view);
    const render = `${options.render}/${options.prefix}-${view}.webp`;
    if (!reference || !(await Bun.file(render).exists())) {
      console.log(`skip     ${view}`);
      continue;
    }

    const refMask = `${scratch}/${view}-ref-mask.png`;
    const rndMask = `${scratch}/${view}-rnd-mask.png`;
    await mask(reference, refMask, options);
    await mask(render, rndMask, options);

    // Reference in red, render in blue, screen blend: agreement turns magenta.
    // `+level-colors` maps the black-to-white mask onto black-to-colour, which is a tint;
    // `-colorize 100` would replace the mask with a flat rectangle.
    const refRed = `${scratch}/${view}-ref-red.png`;
    const rndBlue = `${scratch}/${view}-rnd-blue.png`;
    await magick([refMask, "+level-colors", "black,#e02424", refRed]);
    await magick([rndMask, "+level-colors", "black,#2050e0", rndBlue]);

    const out = `${options.out}/${view}.png`;
    await magick([refRed, rndBlue, "-compose", "screen", "-composite", out]);
    console.log(`overlay  ${out}    red = reference only, blue = render only, magenta = both`);
  }

  // A legend, once, so the colours are never guessed.
  const legend = `${options.out}/legend.png`;
  await magick([
    "-size", "900x620", "xc:white",
    "-gravity", "center",
    "-fill", "#e02424", "-pointsize", "26", "-annotate", "+0-40", "reference only",
    "-fill", "#2050e0", "-annotate", "+0+0", "render only",
    "-fill", "#a030a0", "-annotate", "+0+40", "both",
    legend,
  ]);
}

await main();
