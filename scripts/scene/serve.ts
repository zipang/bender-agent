// A minimal dev server for a Three.js scene directory.
//
// Why not a bundler. The scene is four static files plus an import map. Serving them directly
// means the browser loads exactly the source that is on disk, stack traces point at real line
// numbers, and a change costs one reload. Bun serves the files; a filesystem watch pushes the
// reload. That is the entire build step.
//
// Usage, from the repository root:
//
//   bun run scripts/scene/serve.ts --scene scenes/r5-tl-1972 --port 5180
//
// Routes:
//   /                        redirect to the shared viewer, on the scene given by --scene
//   /viewer/                 the shared viewer page, driven by ?scene=
//   /vendor/three/build/*    node_modules/three/build/*
//   /vendor/three/addons/*   node_modules/three/examples/jsm/*   (import map target)
//   /__reload                server-sent events, one message per file change
//   /measure/                the point picker, for measuring reference images
//   /api/*                   the scene API: scene document, assets, model, measurements
//   /viewer/*                shared viewer assets, including views.json
//   /repo/*                  any file under the repository root (reference images)
//   /*                       any file under the scene directory

import { watch, type FSWatcher } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { handleApi } from "./api";

type Options = { scene: string; port: number; root: string };

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const root = resolve(import.meta.dir, "../..");
  const scene = value("scene");
  if (!scene) throw new Error("--scene <directory> is required");
  const port = Number(value("port") ?? 5180);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("--port must be an integer between 1 and 65535");
  }
  return { scene: resolve(root, scene), port, root };
}

const MIME_FALLBACK = "application/octet-stream";

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
}

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
  watch(join(options.root, "viewer"), { recursive: true }, (_event, filename) =>
    reload(filename ? `viewer/${filename}` : null));

  // The third directory is the subject of the scene that is open. The server learns it from the
  // API, because the scene is chosen by the browser in the URL and the server never parses that.
  // Without this watch, editing cropped/left.png or dimensions.json leaves a stale page, which is
  // the one case where a reload is genuinely required.
  let subjectWatcher: FSWatcher | null = null;
  let subjectDir: string | null = null;
  function watchSubject(absolute: string): void {
    if (absolute === subjectDir) return;
    subjectWatcher?.close();
    subjectDir = absolute;
    try {
      subjectWatcher = watch(absolute, { recursive: true }, (_event, filename) =>
        reload(filename ? `subject/${filename}` : null));
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
        // One page serves every scene. The redirect keeps `?shot=1` and `?view=...` that a capture
        // appends to `/`, so ctl.ts and shot.ts still open the root URL and get the right scene.
        const target = new URLSearchParams(url.searchParams);
        target.set("scene", relative(options.root, options.scene));
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
        path = join(options.root, "viewer", rest === "" ? "index.html" : rest);
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
