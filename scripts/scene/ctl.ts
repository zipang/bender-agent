// Drive the live scene page from the shell.
//
// `shot.ts` presses the shutter on the named views. This script does everything else: it moves the
// camera to any angle, switches the projection, shows the wireframe, isolates one node, changes the
// background, and reports what the frame costs. A modelling pass asks those questions constantly
// ("from here, does the nose still read?"), and editing `scene.js` to answer them is not a loop.
//
// Usage, from the repository root (the dev server must run):
//
//   bun run scripts/scene/ctl.ts open
//   bun run scripts/scene/ctl.ts view front-3q
//   bun run scripts/scene/ctl.ts camera --azimuth 35 --elevation 18 --distance 9
//   bun run scripts/scene/ctl.ts ortho --on --height 4.4
//   bun run scripts/scene/ctl.ts wireframe --on
//   bun run scripts/scene/ctl.ts isolate Wheel_FL
//   bun run scripts/scene/ctl.ts isolate --all
//   bun run scripts/scene/ctl.ts nodes
//   bun run scripts/scene/ctl.ts shot /tmp/opencode/front-3q.webp
//   bun run scripts/scene/ctl.ts reset
//
// Every command prints the camera state and the frame statistics, so one call tells you where the
// page stands.

import { resolve } from "node:path";

type Options = { url: string; session: string; argv: string[] };

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  // Only the two global options are stripped. Everything else reaches the command, because
  // `--azimuth` belongs to `camera` and must not be eaten by the outer parser.
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--url" || argv[i] === "--session") {
      i += 1;
      continue;
    }
    rest.push(argv[i]);
  }
  return {
    url: value("url") ?? "http://127.0.0.1:5180/",
    session: value("session") ?? "scene-ctl",
    argv: rest,
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
    throw new Error(
      `agent-browser ${args[0]} failed (${code}): ${(stderr || stdout).trim().slice(0, 300)}`,
    );
  }
  return stdout;
}

async function evaluate(script: string, session: string): Promise<unknown> {
  const text = (await ab(["eval", script, "--session", session])).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function waitForReady(session: string, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if ((await evaluate("window.__ready === true", session)) === true) return;
    await Bun.sleep(150);
  }
  throw new Error("timed out waiting for the first frame");
}

function flag(argv: string[], name: string): boolean | null {
  if (argv.includes(`--${name}`)) return true;
  if (argv.includes(`--no-${name}`)) return false;
  return null;
}

function option(argv: string[], name: string): string | null {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? null) : null;
}

function numberOption(argv: string[], name: string): number | null {
  const raw = option(argv, name);
  if (raw === null) return null;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`--${name} expects a number, got "${raw}"`);
  return value;
}

// Every mutation ends with `stats`, so the caller always sees the frame it just asked for.
function mutate(call: string): string {
  return `window.__ctl.wait().then(() => ${call}).then(() => ({
    state: window.__ctl.state(),
    stats: window.__stats(),
  }))`;
}

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));
  const [command = "state", ...rest] = options.argv;
  const session = options.session;

  if (command === "open") {
    const url = `${options.url.replace(/\/$/, "")}/`;
    await ab(["open", url, "--session", session]);
    await waitForReady(session);
    console.log(`open  ${url}`);
    return;
  }

  if (command === "shot") {
    const target = rest[0];
    if (!target) throw new Error("shot needs a path, for example /tmp/opencode/side.webp");
    const path = resolve(target);
    const scratch = `${path}.png`;
    await ab(["screenshot", "canvas", scratch, "--session", session]);
    if (path.endsWith(".webp")) {
      const png = await Bun.file(scratch).bytes();
      await Bun.write(path, await new Bun.Image(png).webp({ quality: 94 }).bytes());
      await Bun.file(scratch).delete();
    }
    console.log(`shot  ${path}`);
    return;
  }

  let call: string | null = null;
  let report: string | null = null;

  switch (command) {
    case "view":
      call = `window.__ctl.view(${JSON.stringify(rest[0] ?? "front-3q")})`;
      break;
    case "views":
      report = "window.__ctl.views()";
      break;
    case "camera": {
      const args: string[] = [];
      for (const field of ["azimuth", "elevation", "distance", "fov", "orthoHeight"]) {
        const value = numberOption(rest, field);
        if (value !== null) args.push(`${field}: ${value}`);
      }
      const target = option(rest, "target");
      if (target) {
        const [x, y, z] = target.split(",").map(Number);
        args.push(`target: { x: ${x}, y: ${y}, z: ${z} }`);
      }
      const perspective = flag(rest, "perspective");
      if (perspective !== null) args.push(`perspective: ${perspective}`);
      if (rest.includes("--reset")) args.push("reset: true");
      call = `window.__ctl.camera({ ${args.join(", ")} })`;
      break;
    }
    case "ortho": {
      const enabled = flag(rest, "on") ?? true;
      const height = numberOption(rest, "height");
      call = `window.__ctl.ortho({ enabled: ${enabled}${height === null ? "" : `, height: ${height}`} })`;
      break;
    }
    case "wireframe": {
      const enabled = flag(rest, "on") ?? true;
      const name = option(rest, "name");
      call = `window.__ctl.wireframe({ enabled: ${enabled}${name ? `, name: ${JSON.stringify(name)}` : ""} })`;
      break;
    }
    case "isolate": {
      const name = rest.includes("--all") ? null : (rest[0] ?? null);
      call = `window.__ctl.isolate({ name: ${JSON.stringify(name)} })`;
      break;
    }
    case "visible": {
      const name = rest[0];
      if (!name) throw new Error("visible needs a node name");
      const enabled = flag(rest, "off") === true ? false : true;
      call = `window.__ctl.visible({ name: ${JSON.stringify(name)}, visible: ${enabled} })`;
      break;
    }
    case "background": {
      const colour = rest[0] ?? "transparent";
      call = `window.__ctl.background({ color: ${JSON.stringify(colour)} })`;
      break;
    }
    case "grid":
      call = `window.__ctl.grid({ enabled: ${flag(rest, "on") ?? true} })`;
      break;
    case "ground":
      call = `window.__ctl.ground({ enabled: ${flag(rest, "on") ?? true} })`;
      break;
    case "shadows":
      call = `window.__ctl.shadows({ enabled: ${flag(rest, "on") ?? true} })`;
      break;
    case "exposure": {
      const value = Number(rest[0]);
      if (Number.isNaN(value)) throw new Error("exposure needs a number");
      call = `window.__ctl.exposure({ value: ${value} })`;
      break;
    }
    case "nodes":
      report = "window.__ctl.nodes()";
      break;
    case "stats":
      report = "window.__stats()";
      break;
    case "state":
      report = "window.__ctl.state()";
      break;
    case "wait":
      call = "window.__ctl.wait()";
      break;
    case "reset":
      call = "window.__ctl.reset()";
      break;
    case "eval": {
      const script = rest.join(" ");
      if (!script) throw new Error("eval needs a JavaScript expression");
      report = script;
      break;
    }
    default:
      throw new Error(`unknown command "${command}"`);
  }

  if (report) {
    await waitForReady(session);
    const value = await evaluate(report, session);
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  await waitForReady(session);
  const value = (await evaluate(mutate(call ?? "window.__ctl.wait()"), session)) as {
    state?: Record<string, unknown>;
    stats?: Record<string, unknown>;
  };
  if (!value?.state) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  const s = value.state;
  const t = s.target as number[];
  console.log(
    `camera  azimuth ${s.azimuth}  elevation ${s.elevation}  distance ${s.distance}  ` +
      `${s.perspective ? "perspective" : `orthographic ${s.orthoHeight}`}  ` +
      `target ${t.map((v) => v.toFixed(2)).join(",")}`,
  );
  const stats = value.stats as Record<string, unknown>;
  const size = (stats.size as number[]).map((v) => v.toFixed(3)).join(" × ");
  console.log(
    `frame   ${String(stats.view)}  ${size} m  ${stats.triangles} tris  ` +
      `${stats.meshes} meshes  ${stats.calls} draws`,
  );
}

await main();
