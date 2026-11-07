// A minimal dev server for a Three.js scene directory.
//
// Why not a bundler. The scene is four static files plus an import map. Serving them directly
// means the browser loads exactly the source that is on disk, stack traces point at real line
// numbers, and a change costs one reload. Bun serves the files; a filesystem watch pushes the
// reload. That is the entire build step.
//
// Usage, from the repository root:
//
//   bun run workflows/threejs/tools/serve.ts --scene r5-tl-1972 --port 5180
//
// `--scene` takes a scene directory name, or a path from the repository root. Both name the same
// folder: `r5-tl-1972` and `workflows/threejs/scenes/r5-tl-1972`.
//
// Routes:
//   /                        redirect to the shared viewer, on the scene given by --scene
//   /viewer/                 the shared viewer page, driven by ?scene=
//   /viewer/*                shared viewer assets, including views.json
//   /vendor/three/build/*    node_modules/three/build/*
//   /vendor/three/addons/*   node_modules/three/examples/jsm/*   (import map target)
//   /__reload                server-sent events, one message per file change
//   /measure/                the point picker, for measuring reference images
//   /api/*                   the scene API: scene document, assets, model, measurements
//   /repo/*                  any file under the repository root (reference images)
//   /workflows/threejs/scenes/*.js
//                            a scene's own modules, at their real path, so a relative import
//                            resolves. Only JavaScript is served there.
//   /*                       any file under the scene directory
//
// `/viewer/` is a public path, not a disk path. The page lives in `workflows/threejs/viewer/`, and
// the route keeps the short URL, because documents and captures name it. A scene module, by
// contrast, is served at its real path: the model URL is built from the scene id, and an alias
// there would make an import failure impossible to read.

import { watch, type FSWatcher } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { handleApi } from "./api";
import { ROOT, SCENES, VIEWER, toRepoPath, isInside } from "./paths";

type Options = { scene: string; port: number; root: string };

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const requested = value("scene");
  if (!requested) throw new Error("--scene <directory> is required");
  const port = Number(value("port") ?? 5180);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("--port must be an integer between 1 and 65535");
  }
  // The same three forms the API accepts, because the two must never disagree: a bare name, the
  // path this project publishes, and the legacy `scenes/<name>` that an old command line still has.
  const legacy = "scenes/";
  const scene = requested.startsWith(legacy)
    ? join(SCENES, requested.slice(legacy.length))
    : requested.includes("/")
      ? resolve(ROOT, requested)
      : join(SCENES, requested);
  if (!isInside(SCENES, scene)) {
    throw new Error(`--scene must name a directory under ${relative(ROOT, SCENES)}`);
  }
  return { scene, port, root: ROOT };
}

const MIME_FALLBACK = "application/octet-stream";

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));
  const threeRoot = join(options.root, "node_modules/three");

  // Every connected page holds one stream. A file change ends them all; the browser reloads
  // and immediately opens a new one.
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();

  const signalReload = (file: string) => {
    const message = encoder.encode(`data: ${file}\n\n`);
    for (const controller of clients) {
      try {
        controller.enqueue(message);
      } catch {
        clients.delete(controller);
      }
    }
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const reload = (filename: string | null) => {
    if (!filename || filename.endsWith("~")) return;
    // One reload per burst: a save often emits several events.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => signalReload(filename), 60);
  };
  // The scene directory, and the shared viewer. A change to views.json must reload the page just
  // as a change to the model does, or the table is edited and the browser keeps the old one.
  watch(options.scene, { recursive: true }, (_event, filename) => reload(filename ? String(filename) : null));
  watch(VIEWER, { recursive: true }, (_event, filename) =>
    reload(filename ? `viewer/${filename}` : null));

  // The third directory is the subject of the scene that is open. The server learns it from the
  // API, because the scene is chosen by the browser in the URL and the server never parses that.
  // Without this watch, editing cropped/left.png or dimensions.json leaves a stale page, which is
  // the one case where a reload is genuinely required.
  //
  // `model/` is excluded. It holds the renders and the exports, which this pipeline WRITES while a
  // capture runs. Watching it meant that the first render of a pass reloaded the page underneath
  // the second one, and the capture failed with `window.__setView is not a function` -- a confusing
  // message for a rule that is one line. An output never reloads its own reader.
  const OUTPUT_DIRS = new Set(["model"]);
  let subjectWatcher: FSWatcher | null = null;
  let subjectDir: string | null = null;
  function watchSubject(absolute: string): void {
    if (absolute === subjectDir) return;
    subjectWatcher?.close();
    subjectDir = absolute;
    try {
      subjectWatcher = watch(absolute, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const top = String(filename).split(/[\\/]/)[0];
        if (OUTPUT_DIRS.has(top)) return;
        reload(`subject/${filename}`);
      });
    } catch {
      subjectWatcher = null; // the subject may be only partly promoted
    }
  }

  const server = Bun.serve({
    port: options.port,
    development: true,
    idleTimeout: 0,
    async fetch(request) {
      const url = new URL(request.url);
      let path: string;

      // The scene API answers first: it is the only supported way for the viewer to load data.
      // A null return means the request is not for /api/, and the static routes below take it.
      const api = await handleApi(request, { root: options.root, onSubject: watchSubject });
      if (api) return api;

      if (url.pathname === "/__reload") {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            clients.add(controller);
            controller.enqueue(encoder.encode(": connected\n\n"));
          },
          cancel(controller) {
            clients.delete(controller as never);
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        });
      }

      if (url.pathname === "/measure" || url.pathname === "/measure/") {
        path = join(options.root, "scripts/measure/index.html");
      } else if (url.pathname.startsWith("/measure/")) {
        path = join(options.root, "scripts/measure", url.pathname.slice("/measure/".length));
      } else if (url.pathname === "/") {
        // One page serves every scene. The redirect keeps `?shot=1`, `?view=...` and an explicit
        // `?scene=` that a caller passed, so ctl.ts and shot.ts open the root URL and get the scene
        // they named. Without a name, the server's own `--scene` is the default.
        //
        // `set` here would clobber a caller's choice, and a capture would silently record the
        // server's scene instead of the one it was told to record.
        const target = new URLSearchParams(url.searchParams);
        if (!target.has("scene")) target.set("scene", relative(options.root, options.scene));
        return new Response(null, {
          status: 302,
          headers: { location: `/viewer/?${target.toString()}` },
        });
      } else if (url.pathname.startsWith("/vendor/three/build/")) {
        path = join(threeRoot, "build", url.pathname.slice("/vendor/three/build/".length));
      } else if (url.pathname.startsWith("/vendor/three/addons/")) {
        path = join(threeRoot, "examples/jsm", url.pathname.slice("/vendor/three/addons/".length));
      } else if (url.pathname.startsWith("/viewer/")) {
        // The shared viewer assets. `views.json` and the page live here, and the page fetches them
        // by absolute path because the scene directory is not the root of the tree.
        const rest = url.pathname.slice("/viewer/".length);
        path = join(VIEWER, rest === "" ? "index.html" : rest);
      } else if (decodeURIComponent(url.pathname).startsWith(`/${toRepoPath(SCENES)}/`)) {
        // A scene's own modules, at their real path, so `import "./body-hull.js"` resolves. Only
        // JavaScript is served here: a scene directory also holds `baseline.json` and the traced
        // hull, and a route that hands out every file would serve a data file as a module.
        if (!url.pathname.endsWith(".js")) {
          return new Response("only .js modules are served from a scene directory", { status: 403 });
        }
        path = resolve(options.root, `.${decodeURIComponent(url.pathname)}`);
        if (!isInside(SCENES, path)) {
          return new Response("forbidden", { status: 403 });
        }
      } else if (url.pathname.startsWith("/repo/")) {
        path = join(options.root, decodeURIComponent(url.pathname.slice("/repo/".length)));
      } else {
        path = join(options.scene, url.pathname);
      }

      if (!isInside(options.root, path)) {
        return new Response("forbidden", { status: 403 });
      }

      const file = Bun.file(path);
      if (!(await file.exists())) {
        return new Response(`not found: ${url.pathname}`, { status: 404 });
      }

      const headers = new Headers();
      if (file.type) headers.set("content-type", file.type);
      else headers.set("content-type", MIME_FALLBACK);
      // The dev loop must never serve a stale module.
      headers.set("cache-control", "no-store");

      // The source maps that ship with three point at TypeScript sources, not built files.
      if (path.endsWith(".js")) headers.set("content-type", "text/javascript; charset=utf-8");
      return new Response(file, { headers });
    },
  });

  console.log(`scene   ${options.scene}`);
  console.log(`three   ${threeRoot}`);
  console.log(`url     http://127.0.0.1:${server.port}/`);
  console.log("watch   on, reload through /__reload");
}

await main();
