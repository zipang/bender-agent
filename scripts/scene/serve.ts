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
//   /                        index.html of the scene
//   /vendor/three/build/*    node_modules/three/build/*
//   /vendor/three/addons/*   node_modules/three/examples/jsm/*   (import map target)
//   /__reload                server-sent events, one message per file change
//   /*                       any file under the scene directory

import { watch } from "node:fs";
import { resolve, join, relative, sep } from "node:path";

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
  watch(options.scene, { recursive: true }, (_event, filename) => {
    if (!filename || filename.endsWith("~")) return;
    // One reload per burst: a save often emits several events.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => signalReload(String(filename)), 60);
  });

  const server = Bun.serve({
    port: options.port,
    development: true,
    idleTimeout: 0,
    async fetch(request) {
      const url = new URL(request.url);
      let path: string;

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

      if (url.pathname === "/") path = join(options.scene, "index.html");
      else if (url.pathname.startsWith("/vendor/three/build/")) {
        path = join(threeRoot, "build", url.pathname.slice("/vendor/three/build/".length));
      } else if (url.pathname.startsWith("/vendor/three/addons/")) {
        path = join(threeRoot, "examples/jsm", url.pathname.slice("/vendor/three/addons/".length));
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
