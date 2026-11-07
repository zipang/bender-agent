// Export one vcad session: a `.glb` model, plus one rendered picture per named view.
//
// Why this script exists. The MCP host turns a `render_view` image into an attachment and
// strips the base64 payload from the tool result it returns to an agent. The agent sees the
// picture but cannot write it, and a blueprint pipeline must keep the render next to the model
// so the art director can judge it. The bytes are still in the raw JSON-RPC reply, in
// `content[].data`, so this script speaks JSON-RPC to the server over stdio and keeps them.
//
// The vcad server is durable: it stores sessions on disk, so a `document_id` minted by another
// process is still readable here.
//
// Usage, from the repository root:
//
//   bun run scripts/vcad-render/export.ts \
//     --document doc_4_1brZqzecRqL8VIur \
//     --out blueprints/vehicules/r5-tl-1972/model/r5-L1-v2 \
//     --views iso,front,left,back,right,top
//
// It writes `<out>.glb` and one `<out>-<view>.webp` per view.

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SERVER = process.env.VCAD_MCP_COMMAND ?? "bunx";
const SERVER_ARGS = process.env.VCAD_MCP_ARGS ? process.env.VCAD_MCP_ARGS.split(" ") : ["@vcad/mcp"];

// A named view maps to an orthographic orbit. Azimuth is degrees counter-clockwise from +X in
// the XY plane, elevation is degrees above that plane, and the kernel is Z-up. With +Y as the
// front direction, the front view looks from +Y, so its azimuth is 90.
//
// The three-quarter views are the ones a modeler actually judges: they carry the front, one
// flank, and the roof in a single frame, so a wrong mass reads immediately.
// The view table is shared: `threejs/viewer/views.json` holds the name, the order and the angles, and it
// records them in BOTH frames. The viewer is +Y up with +Z forward; this kernel is +Z up with +Y
// forward, and the two are 90 degrees apart -- which is why `left` is 0 in the page and 180 here.
// Keeping the kernel angles in the same file means a rename cannot leave one tool behind.
// The table belongs to the Three.js workflow, because the page and its capture tools read it. A
// vcad export runs against the same named views, so it reads the same file: one table, two readers.
const VIEW_TABLE = await Bun.file(
  resolve(import.meta.dir, "../threejs/viewer/views.json"),
).json();
const VIEWS: Record<string, { azimuth?: number; elevation?: number }> = Object.fromEntries(
  Object.entries(VIEW_TABLE.views as Record<string, { kernel?: { azimuth: number; elevation: number } }>)
    .filter(([, view]) => view.kernel)
    .map(([name, view]) => [name, view.kernel!]),
);

// The default set: every required elevation, plus every optional perspective view. The optional
// perspective views are the inspection angles, and they are what replaces a single `iso`: a pair of
// three-quarter views shows more of a vehicle than one 22-degree orbit does. Derived from the
// table, so a new inspection angle is one edit and no tool names a view.
const DEFAULT_VIEWS: string[] = Object.entries(
  VIEW_TABLE.views as Record<string, { kernel?: unknown; required?: boolean; perspective?: boolean }>,
)
  .filter(([, view]) => view.kernel && (view.required || view.perspective))
  .map(([name]) => name);

type Options = {
  document: string;
  out: string;
  views: string[];
  width: number;
  glb: boolean;
  quality: number;
};

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const document = value("document");
  const out = value("out");
  if (!document) throw new Error("--document <document_id> is required");
  if (!out) throw new Error("--out <path without extension> is required");

  const views = (value("views") ?? DEFAULT_VIEWS.join(","))
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const unknown = views.filter((view) => !(view in VIEWS));
  if (unknown.length > 0) {
    throw new Error(`Unknown view: ${unknown.join(", ")}. Valid views: ${Object.keys(VIEWS).join(", ")}`);
  }

  const width = Number(value("width") ?? 1100);
  if (!Number.isInteger(width) || width < 64 || width > 2048) {
    throw new Error("--width must be an integer between 64 and 2048");
  }

  return {
    document,
    out: resolve(out),
    views,
    width,
    glb: !argv.includes("--no-glb"),
    quality: Number(value("quality") ?? 90),
  };
}

// A minimal JSON-RPC client over the server's stdio, enough for initialize and tools/call.
class VcadClient {
  private child: ReturnType<typeof spawn>;
  private buffer = "";
  private pending = new Map<number, (value: unknown) => void>();
  private nextId = 1;

  constructor(exportDir: string) {
    this.child = spawn(SERVER, SERVER_ARGS, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, VCAD_MCP_EXPORT_DIR: exportDir },
    });
    this.child.stdout?.on("data", (chunk: Buffer) => this.receive(chunk.toString()));
    this.child.stderr?.on("data", () => {});
  }

  private receive(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      let message: { id?: number; result?: unknown; error?: unknown };
      try {
        message = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (typeof message.id !== "number") continue;
      const resolvePending = this.pending.get(message.id);
      if (!resolvePending) continue;
      this.pending.delete(message.id);
      if (message.error) resolvePending({ __error: message.error });
      else resolvePending(message.result);
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolvePending) => {
      this.pending.set(id, resolvePending);
      this.child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  async initialize(): Promise<{ name: string; version: string }> {
    const result = (await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vcad-export", version: "1" },
    })) as { serverInfo?: { name: string; version: string } };
    this.child.stdin?.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );
    return result?.serverInfo ?? { name: "unknown", version: "unknown" };
  }

  async call(name: string, args: Record<string, unknown>): Promise<{
    content?: Array<{ type: string; data?: string; mimeType?: string; text?: string }>;
    structuredContent?: unknown;
    __error?: unknown;
  }> {
    return (await this.request("tools/call", { name, arguments: args })) as never;
  }

  close(): void {
    this.child.kill();
  }
}

// The first image block of a tool reply holds the render, as base64 PNG.
function imageBytes(content: Array<{ type: string; data?: string }> | undefined): Uint8Array | null {
  for (const block of content ?? []) {
    if (block.type === "image" && block.data) return Buffer.from(block.data, "base64");
  }
  return null;
}

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));
  const outDir = dirname(options.out);
  await mkdir(outDir, { recursive: true });

  const client = new VcadClient(outDir);
  const report: string[] = [];

  try {
    const server = await client.initialize();
    console.log(`server      ${server.name} ${server.version}`);
    console.log(`document    ${options.document}`);
    console.log(`output      ${options.out}`);
    console.log("");

    // 1. The model. export_cad refuses an absolute path, so the filename is a bare name and
    //    VCAD_MCP_EXPORT_DIR places it. The reported path confirms where it landed.
    if (options.glb) {
      const glbName = `${options.out.split("/").pop() ?? "model"}.glb`;
      const reply = await client.call("export_cad", {
        document_id: options.document,
        filename: glbName,
      });
      const structured = reply.structuredContent as
        | { path?: string; bytes?: number; format?: string; parts?: number }
        | undefined;
      if (reply.__error) throw new Error(`export_cad: ${JSON.stringify(reply.__error).slice(0, 200)}`);
      const written = structured?.path ?? `${outDir}/${glbName}`;
      const size = structured?.bytes ?? (await stat(written)).size;
      console.log(`glb         ${written}  ${size} bytes  ${structured?.parts ?? "?"} part(s)`);
      report.push(written);
    }

    // 2. One picture per view. The bytes are in content[0].data; the host strips them.
    for (const view of options.views) {
      const camera = VIEWS[view];
      const reply = await client.call("render_view", {
        document_id: options.document,
        width_px: options.width,
        ...camera,
      });
      if (reply.__error) throw new Error(`render_view ${view}: ${JSON.stringify(reply.__error).slice(0, 200)}`);
      const png = imageBytes(reply.content);
      if (!png) throw new Error(`render_view ${view} returned no image block`);

      // WebP keeps the file small next to the references, and the pipeline reads it back.
      const webp = await new Bun.Image(png).webp({ quality: options.quality }).bytes();
      const path = `${options.out}-${view}.webp`;
      await Bun.write(path, webp);
      console.log(`render      ${path}  ${webp.byteLength} bytes  from ${png.byteLength} png  (${view})`);
      report.push(path);
    }

    console.log("");
    console.log(`${report.length} file(s) written`);
  } finally {
    client.close();
  }
}

await main();
