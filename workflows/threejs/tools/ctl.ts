// Drive the live scene page from the shell.
//
// `shot.ts` presses the shutter on the named views. This script does everything else: it moves the
// camera to any angle, switches the projection, shows the wireframe, isolates one node, changes the
// background, and reports what the frame costs. A modelling pass asks those questions constantly
// ("from here, does the nose still read?"), and editing `scene.js` to answer them is not a loop.
//
// Usage, from the repository root (the dev server must run):
//
//   bun run workflows/threejs/tools/ctl.ts open
//   bun run workflows/threejs/tools/ctl.ts view rear-3q     (no name: the page default)
//   bun run workflows/threejs/tools/ctl.ts camera --azimuth 35 --elevation 18 --distance 9
//   bun run workflows/threejs/tools/ctl.ts ortho --on --height 4.4
//   bun run workflows/threejs/tools/ctl.ts zoom                    (report)
//   bun run workflows/threejs/tools/ctl.ts zoom --percent 250
//   bun run workflows/threejs/tools/ctl.ts zoom --reset
//   bun run workflows/threejs/tools/ctl.ts wireframe --on
//   bun run workflows/threejs/tools/ctl.ts isolate Wheel_FL
//   bun run workflows/threejs/tools/ctl.ts isolate --all
//   bun run workflows/threejs/tools/ctl.ts nodes
//   bun run workflows/threejs/tools/ctl.ts shot /tmp/opencode/three-quarter.webp --view rear-3q
//   bun run workflows/threejs/tools/ctl.ts reset
//
// Every command prints the camera state and the frame statistics, so one call tells you where the
// page stands.
//
// ONE browser, reused. Every command talks to the same session (`scene-ctl` by default), because
// each new session name starts a new headless Chrome that outlives the command. Passing a fresh
// `--session` per test is how fourteen browsers and 238 processes accumulated during one refactor.
// `ctl.ts close` ends the session; do it when the pass is over. Use `--session` only to run two
// passes side by side, and close both.

import { resolve } from "node:path";

type Options = { url: string; session: string; scene: string | null; argv: string[] };

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  // Only the two global options are stripped. Everything else reaches the command, because
  // `--azimuth` belongs to `camera` and must not be eaten by the outer parser.
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--url" || argv[i] === "--session" || argv[i] === "--scene") {
      i += 1;
      continue;
    }
    rest.push(argv[i]);
  }
  return {
    url: value("url") ?? "http://127.0.0.1:5180/",
    session: value("session") ?? "scene-ctl",
    scene: value("scene"),
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
  // A page that refused its scene never becomes ready, and "timed out" alone sends the reader
  // looking at the clock. The viewer records its reason in `window.__error`; quote it, the way
  // `shot.ts` does. The tool a person runs must not be the one with the least useful message.
  const reason = await evaluate("window.__error ?? null", session).catch(() => null);
  throw new Error(
    "timed out waiting for the first frame" + (reason ? `\n  the page reports: ${reason}` : ""),
  );
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
    // --shot loads the capture page: white field, no ground, no grid, no HUD. A silhouette
    // comparison needs that, because a ground plane is a large light shape that reads as subject.
    // `?scene=` is how the shared viewer picks its scene. Without it the server falls back to its
    // own `--scene`, which is what a single-scene dev loop wants.
    const query = new URLSearchParams();
    if (rest.includes("--shot")) query.set("shot", "1");
    if (options.scene) query.set("scene", options.scene);
    // `--url` may already carry a query, and the caller's query is the point of passing it. Glue a
    // separator only when there is something to glue: appending `/` unconditionally turned
    // `?scene=x` into `?scene=x/`, and the scene name reached the server with a slash on it.
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const base = options.url.replace(/\/$/, "");
    const url = suffix ? `${base}${base.includes("?") ? "&" : "/?"}${suffix.slice(1)}` : base;
    await ab(["open", url, "--session", session]);
    await waitForReady(session);
    console.log(`open  ${url}  (session ${session})`);
    return;
  }

  if (command === "close") {
    // A session is a live browser, not a file. Nothing else will stop it for you.
    await ab(["close", "--session", session]);
    console.log(`close  session ${session}`);
    return;
  }

  if (command === "shot") {
    const target = rest[0];
    if (!target) throw new Error("shot needs a path, for example /tmp/opencode/side.webp");
    const path = resolve(target);
    const scratch = `${path}.png`;

    // The camera is re-applied, always. The page is live and a human may have orbited it, so the
    // shot does not inherit whatever the window happens to show: it states the view it wants, and
    // then verifies that the page really is on it. A capture that silently records someone else's
    // camera is worse than no capture, because the file looks like evidence.
    const wanted = option(rest, "view");
    if (wanted) {
      await waitForReady(session);
      const applied = (await evaluate(
        `window.__ctl.view(${JSON.stringify(wanted)}).then(() => window.__ctl.state())`,
        session,
      )) as Record<string, unknown> | null;
      const state = (await evaluate("window.__ctl.state()", session)) as Record<string, unknown>;
      if (state.view !== wanted) {
        throw new Error(
          `asked for view "${wanted}" but the page reports "${String(state.view)}"` +
            (applied ? "" : " (the apply call returned nothing)"),
        );
      }
    }
    // The calque is an aid for a human eye, not part of the render. A silhouette comparison must
    // never see it: the plate IS the reference, so a mask that includes it would compare the
    // reference to itself and report a perfect score for any model.
    if (!rest.includes("--plate")) {
      await evaluate("window.__ctl.calque({ off: true })", session);
    }

    // A capture is always at 100 %. A hand-set zoom could clip the subject, and a clipped subject
    // silently corrupts the scale `compare_silhouette.py` derives from its bounding box. The
    // sidecar records `zoom: 1`, which is the proof.
    await evaluate("window.__ctl.zoom(100)", session);

    await ab(["screenshot", "canvas", scratch, "--session", session]);
    // The sidecar is what makes the picture measurable. It records the camera that drew it, so a
    // silhouette tool can convert pixels to millimetres instead of guessing a scale.
    const stats = (await evaluate("window.__stats()", session)) as Record<string, unknown>;
    await Bun.write(`${path}.json`, JSON.stringify(stats, null, 2) + "\n");
    if (path.endsWith(".webp")) {
      const png = await Bun.file(scratch).bytes();
      await Bun.write(path, await new Bun.Image(png).webp({ quality: 94 }).bytes());
      await Bun.file(scratch).delete();
    }
    console.log(`shot  ${path}`);
    console.log(`side  ${path}.json`);
    return;
  }

  let call: string | null = null;
  let report: string | null = null;

  if (command === "measure") {
    await waitForReady(session);
    if (rest.includes("--off")) {
      await evaluate("window.__ctl.measure({ off: true }).then(() => true)", session);
      console.log("measure  off");
      return;
    }
    if (rest.includes("--clear")) {
      await evaluate("window.__ctl.measure({ clear: true }).then(() => true)", session);
      console.log("measure  cleared");
      return;
    }
    if (rest.includes("--on")) {
      await evaluate("window.__ctl.measure({ on: true }).then(() => true)", session);
      console.log("measure  on -- click the calque; shift-click picks the model");
      return;
    }
    // No flag: report. This is the command a tracing pass uses most, so it is the default.
    const points = await evaluate("window.__ctl.measurePoints()", session);
    console.log(JSON.stringify(points, null, 2));
    return;
  }

  if (command === "zoom") {
    await waitForReady(session);
    // No flag: report. `--percent N`: set, clamped by the page. `--reset`: back to 100 %.
    if (rest.includes("--reset")) {
      const value = await evaluate("window.__ctl.zoom(100)", session);
      console.log(JSON.stringify(value, null, 2));
      return;
    }
    const percent = numberOption(rest, "percent");
    const value = await evaluate(
      percent === null ? "window.__ctl.zoom()" : `window.__ctl.zoom(${percent})`,
      session,
    );
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (command === "pick") {
    // pick <nx> <ny> [--model] -- place a point at a normalised device coordinate.
    const [nx, ny] = [Number(rest[0]), Number(rest[1])];
    if (Number.isNaN(nx) || Number.isNaN(ny)) throw new Error("pick needs nx and ny in -1..1");
    const source = rest.includes("--model") ? "model" : "calque";
    await waitForReady(session);
    const record = await evaluate(
      `window.__ctl.measurePick(${nx}, ${ny}, ${JSON.stringify(source)})`,
      session,
    );
    console.log(JSON.stringify(record, null, 2));
    return;
  }

  if (command === "volume") {
    await waitForReady(session);
    const payload = JSON.stringify({ rebuild: !rest.includes("--no-rebuild"), show: !rest.includes("--off") });
    const info = await evaluate(`window.__ctl.volume(${payload})`, session);
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (command === "calque") {
    await waitForReady(session);
    if (rest.includes("--off")) {
      await evaluate("window.__ctl.calque({ off: true })", session);
      console.log("calque  hidden");
      return;
    }
    const args: string[] = [];
    const view = option(rest, "view");
    if (view) args.push(`view: ${JSON.stringify(view)}`);
    const opacity = numberOption(rest, "opacity");
    if (opacity !== null) args.push(`opacity: ${opacity}`);
    const depth = option(rest, "depth");
    if (depth) args.push(`depth: ${JSON.stringify(depth)}`);
    const mode = option(rest, "mode");
    await evaluate(`window.__ctl.calque({ ${args.join(", ")} }).then(() => true)`, session);
    if (mode) await evaluate(`window.__ctl.contourMode(${JSON.stringify(mode)})`, session);
    const info = await evaluate("window.__ctl.calqueInfo()", session);
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  switch (command) {
    case "view": {
      // No view name means the page's own default, which it derives from the view table. Naming a
      // view here would put one subject's vocabulary in a generic tool.
      const name = rest[0] ?? (await evaluate("window.__ctl.defaultView()", session));
      call = `window.__ctl.view(${JSON.stringify(name)})`;
      break;
    }
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
    // Four layers, each on or off by name. A layer that is not named keeps its state, so
    // `layers --model 0 --volume 1` is a complete instruction and not a reset.
    case "layers": {
      const args: string[] = [];
      for (const name of ["model", "volume", "contour", "calque"]) {
        // `--model 0` and `--no-model` are the same instruction. The second form exists because
        // every other command already uses it, and a flag that changes grammar command by command
        // is a trap for the next reader.
        const value = option(rest, name) !== null ? !["0", "false", "off"].includes(String(option(rest, name))) : flag(rest, name);
        if (value !== null) args.push(`${name}: ${value}`);
      }
      call = `window.__ctl.layers({ ${args.join(", ")} })`;
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
