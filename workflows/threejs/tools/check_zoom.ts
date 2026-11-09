// The zoom and pan of the orthogonal views, checked on the live page.
//
// This repository has no unit-test runner for the page, so the failing test is a deterministic
// browser check: it opens the viewer, drives it through `__ctl` and through real input events, and
// exits non-zero on the first failed assertion. It is the TDD test of ticket T0003.
//
// Why the input goes through Chrome DevTools Protocol, not `agent-browser mouse`. The modifier
// assertion needs a `Shift`-held pointerdown, and the documented `OrbitControls` behaviour this
// ticket depends on (the ROTATE/PAN swap under a modifier) is read from `event.shiftKey`. The
// `agent-browser mouse` command sends no modifiers, so the check talks to the page target's CDP
// socket directly and passes `modifiers` on every mouse event. It is still the library's own
// listener that reacts: the check only synthesises the pointer, it never calls a zoom function of
// its own.
//
// Usage, from the repository root (the dev server must run on http://127.0.0.1:5180):
//
//   bun run workflows/threejs/tools/check_zoom.ts
//
// It closes its own browser session, including on failure.

import { join } from "node:path";
import { REPORTS, TOOLS } from "./paths";
import { Session, ab, evaluate as evaluateIn } from "./session";

const SCENE = "r5-tl-1972";
const VIEWER_URL = `http://127.0.0.1:5180/?scene=${SCENE}`;
const VIEWPORT = { width: 1400, height: 1000 };
const SHOT_PATH = `${REPORTS}/zoom-check.webp`;

// The session name carries the process id, so two checks cannot collide, and a leftover of an
// interrupted run is swept at open and closed on Ctrl-C.
const session = new Session("zoom-check");
const SESSION = session.name;

// The CDP modifier bit for Shift. The library reads `event.shiftKey`, and a mouse event carries
// that bit only when the dispatch includes it.
const SHIFT = 8;
const BUTTON_MASK: Record<string, number> = { left: 1, right: 2, middle: 4 };

class CheckFailure extends Error {
  constructor(step: string, message: string, detail: unknown) {
    super(
      `assertion ${step} failed: ${message}` +
        (detail === undefined ? "" : `\n  ${JSON.stringify(detail)}`),
    );
    this.name = "CheckFailure";
  }
}

// ------------------------------------------------------------------ agent-browser

async function evaluate(script: string): Promise<unknown> {
  return evaluateIn(script, SESSION);
}

async function waitForReady(tries = 60): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if ((await evaluate("window.__ready === true")) === true) return;
    await Bun.sleep(150);
  }
  const reason = await evaluate("window.__error ?? null").catch(() => null);
  throw new Error(
    "timed out waiting for the first frame" + (reason ? `\n  the page reports: ${reason}` : ""),
  );
}

// ------------------------------------------------------------------ CDP input

type Cdp = { send: (method: string, params: unknown) => Promise<unknown>; close: () => void };

async function connectCdp(): Promise<Cdp> {
  const raw = await ab(["get", "cdp-url", "--session", SESSION], "get cdp-url");
  const url = raw.split("\n").map((line) => line.trim()).find((line) => line.startsWith("ws://"));
  if (!url) throw new Error(`could not read the CDP socket url from: ${raw.trim().slice(0, 200)}`);
  const port = new URL(url).port;
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Array<{
    url: string;
    webSocketDebuggerUrl: string;
  }>;
  const page = targets.find((t) => String(t.url).includes("/viewer/"));
  if (!page) throw new Error("no viewer page target found for CDP input");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("could not open the CDP socket"));
  });
  let id = 0;
  const pending = new Map<number, (value: unknown) => void>();
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number };
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)!(message);
      pending.delete(message.id);
    }
  };
  return {
    send(method, params) {
      const mid = (id += 1);
      ws.send(JSON.stringify({ id: mid, method, params }));
      return new Promise((resolve) => pending.set(mid, resolve));
    },
    close: () => ws.close(),
  };
}

function mouse(cdp: Cdp, type: string, x: number, y: number, extra: Record<string, unknown>) {
  return cdp.send("Input.dispatchMouseEvent", { type, x, y, ...extra });
}

async function wheel(cdp: Cdp, x: number, y: number, deltaY: number, modifiers = 0): Promise<void> {
  await mouse(cdp, "mouseWheel", x, y, { deltaX: 0, deltaY, modifiers });
}

/** One button drag, as a real pointer path. Pixels, CSS space. */
async function drag(
  cdp: Cdp,
  button: "left" | "right" | "middle",
  from: { x: number; y: number },
  to: { x: number; y: number },
  modifiers = 0,
  steps = 6,
): Promise<void> {
  const mask = BUTTON_MASK[button];
  await mouse(cdp, "mouseMoved", from.x, from.y, { button: "none", buttons: 0, modifiers });
  await mouse(cdp, "mousePressed", from.x, from.y, {
    button, buttons: mask, clickCount: 1, modifiers,
  });
  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await mouse(cdp, "mouseMoved", x, y, { button, buttons: mask, modifiers });
  }
  await mouse(cdp, "mouseReleased", to.x, to.y, {
    button, buttons: 0, clickCount: 1, modifiers,
  });
}

// ------------------------------------------------------------------ assertions

function ok(step: string, description: string, condition: boolean, detail?: unknown): void {
  if (!condition) throw new CheckFailure(step, description, detail);
  console.log(`  ok  ${step}  ${description}`);
}

function close(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon;
}

async function view(name: string): Promise<void> {
  await evaluate(`window.__ctl.view(${JSON.stringify(name)}).then(() => true)`);
}

async function zoom(percent?: number): Promise<any> {
  const call = percent === undefined ? "window.__ctl.zoom()" : `window.__ctl.zoom(${percent})`;
  return evaluate(call);
}

async function state(): Promise<any> {
  return evaluate("window.__ctl.state()");
}

async function target(): Promise<number[]> {
  return (await state()).target as number[];
}

async function controls(): Promise<any> {
  return evaluate("window.__ctl.controls()");
}

async function cursor(): Promise<string> {
  return evaluate("getComputedStyle(document.querySelector('canvas')).cursor") as Promise<string>;
}

// Wait until the view is still. Both instances are damped, so a pan keeps moving the target for a
// while after the pointer is released: a check that read the target immediately would call the
// leftover motion of the PREVIOUS gesture a change of the current one.
async function settle(timeoutMs = 3000): Promise<void> {
  await evaluate("window.__ctl.wait().then(() => true)");
  let previous = (await state()).target as number[];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Bun.sleep(120);
    const now = (await state()).target as number[];
    const moved = Math.max(...now.map((v, i) => Math.abs(v - previous[i])));
    if (moved < 1e-7) return;
    previous = now;
  }
}

function sameTarget(a: number[], b: number[], epsilon = 1e-6): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) <= epsilon);
}

async function run(): Promise<void> {
  let cdpForClose: Cdp | null = null;
  // The session opens inside the guard, so a failure while opening still closes it. The helper
  // installs the SIGINT and SIGTERM guards in its constructor.
  try {
    await session.open(VIEWER_URL);
    await session.ab(["set", "viewport", String(VIEWPORT.width), String(VIEWPORT.height), "1", "--session", SESSION], "set viewport");
    await waitForReady();

    const size = (await evaluate("[window.innerWidth, window.innerHeight]")) as number[];
    const center = { x: size[0] / 2, y: size[1] / 2 };
    const MOUSE = (await evaluate(
      "(async () => { const T = await import('/vendor/three/build/three.module.js'); " +
        "return { PAN: T.MOUSE.PAN, DOLLY: T.MOUSE.DOLLY, ROTATE: T.MOUSE.ROTATE }; })()",
    )) as { PAN: number; DOLLY: number; ROTATE: number };

    const frameTarget = (await evaluate("window.__stats()")).frame.target as number[];
    const cdp = await connectCdp();
    cdpForClose = cdp;
    // --- 1. the 100 % frame on a flat view, and its millimetres per pixel.
    await view("left");
    // The instrument itself is the first thing the check proves: a page without `__ctl.zoom` must
    // fail here, with a reason, and not with an uncaught page error.
    const hasZoom = await evaluate("typeof window.__ctl?.zoom === 'function'");
    ok("1", "__ctl.zoom() is available", hasZoom === true, { hasZoom });
    const z100 = await zoom();
    ok("1", "zoom() reports a percent", Boolean(z100) && typeof z100.percent === "number", z100);
    ok("1", "left rests at 100 %", z100.percent === 100, z100);
    const st = await state();
    const expectedMm = (st.orthoHeight * 1000) / size[1];
    ok(
      "1",
      "mmPerPx equals orthoHeight * 1000 / innerHeight",
      close(z100.mmPerPx, expectedMm, 1e-6),
      { got: z100.mmPerPx, expected: expectedMm },
    );

    // --- 2. the zoom factor scales the visible size.
    const z200 = await zoom(200);
    ok("2", "zoom(200) reports 200", z200.percent === 200, z200);
    ok(
      "2",
      "mmPerPx is exactly half at 200 %",
      close(z200.mmPerPx * 2, z100.mmPerPx, 1e-9),
      { at100: z100.mmPerPx, at200: z200.mmPerPx },
    );
    const z1000 = await zoom(1000);
    ok("2", "zoom(1000) reports 1000", z1000.percent === 1000, z1000);
    ok(
      "2",
      "mmPerPx is a tenth at 1000 %",
      close(z1000.mmPerPx * 10, z100.mmPerPx, 1e-9),
      { at100: z100.mmPerPx, at1000: z1000.mmPerPx },
    );

    // --- 3. the documented range is the floor and the cap.
    const z2000 = await zoom(2000);
    ok("3", "zoom(2000) stays 1000", z2000.percent === 1000, z2000);
    const z50 = await zoom(50);
    ok("3", "zoom(50) stays 100", z50.percent === 100, z50);

    // --- 4. the wheel anchors on the point under the cursor, through the real wheel.
    await view("left");
    await evaluate("window.__ctl.calque({ view: 'left' }).then(() => true)");
    await zoom(100);
    const nx = 0.25;
    const ny = 0.15;
    const px = ((nx + 1) / 2) * size[0];
    const py = ((1 - ny) / 2) * size[1];
    const before = (await evaluate(`window.__ctl.knotProbe(${nx}, ${ny})`)) as any;
    // A point on the plate, away from the anchor. The ticket names (-0.5, -0.5); for `r5-tl-1972`
    // that NDC falls below the plate (the plate is 1.41 m tall), so the check uses (-0.4, -0.2),
    // which is on the plate at 100 %. Recorded in the ticket's Implementation Notes.
    const farNdc = [-0.4, -0.2];
    const farBefore = (await evaluate(`window.__ctl.knotProbe(${farNdc[0]}, ${farNdc[1]})`)) as any;
    ok("4", "the plate is under the cursor before the wheel", Boolean(before?.uv), before);
    ok("4", "the plate is under the far probe before the wheel", Boolean(farBefore?.uv), farBefore);
    await wheel(cdp, px, py, -100);
    await settle();
    const after = (await evaluate(`window.__ctl.knotProbe(${nx}, ${ny})`)) as any;
    const farAfter = (await evaluate(`window.__ctl.knotProbe(${farNdc[0]}, ${farNdc[1]})`)) as any;
    ok("4", "the plate is still under the cursor after the wheel", Boolean(after?.uv), after);
    const drift = Math.hypot(after.uv[0] - before.uv[0], after.uv[1] - before.uv[1]);
    ok("4", "the anchored coordinate moves less than 0.5 mm", drift < 0.0005, { drift_mm: drift * 1000 });
    const farMoved = Math.hypot(farAfter.uv[0] - farBefore.uv[0], farAfter.uv[1] - farBefore.uv[1]);
    ok("4", "a point away from the cursor does move", farMoved > 0.001, { moved_mm: farMoved * 1000 });

    // --- 5. the two instances are configured alike, save `enableRotate`.
    const cfg = await controls();
    ok("5", "__ctl.controls() reports both instances", Boolean(cfg?.orbit && cfg?.flat), cfg);
    for (const field of [
      "enableDamping", "dampingFactor", "enableZoom", "enablePan", "zoomSpeed", "panSpeed",
      "rotateSpeed", "zoomToCursor", "screenSpacePanning", "minZoom", "maxZoom",
      "minDistance", "maxDistance", "maxPolarAngle",
    ]) {
      ok(
        "5",
        `orbit and flat share ${field}`,
        JSON.stringify(cfg.orbit[field]) === JSON.stringify(cfg.flat[field]),
        { orbit: cfg.orbit[field], flat: cfg.flat[field] },
      );
    }
    ok(
      "5",
      "touches is deep-equal",
      JSON.stringify(cfg.orbit.touches) === JSON.stringify(cfg.flat.touches),
      { orbit: cfg.orbit.touches, flat: cfg.flat.touches },
    );
    const wantedButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: null };
    for (const which of ["orbit", "flat"]) {
      ok(
        "5",
        `${which}.mouseButtons is LEFT pan, MIDDLE dolly, RIGHT null`,
        JSON.stringify(cfg[which].mouseButtons) === JSON.stringify(wantedButtons),
        cfg[which].mouseButtons,
      );
    }
    ok("5", "orbit.enableRotate is true", cfg.orbit.enableRotate === true, cfg.orbit.enableRotate);
    ok("5", "flat.enableRotate is false", cfg.flat.enableRotate === false, cfg.flat.enableRotate);

    // --- 6. the wheel is the same gesture on both families: same direction, same ratio.
    await view("left");
    await zoom(100);
    const leftMm0 = (await zoom()).mmPerPx as number;
    await wheel(cdp, center.x, center.y, -100);
    await settle();
    const leftMm1 = (await zoom()).mmPerPx as number;
    await wheel(cdp, center.x, center.y, -100);
    await settle();
    const leftMm2 = (await zoom()).mmPerPx as number;
    const ratioLeft = leftMm1 / leftMm0;
    const ratioLeft2 = leftMm2 / leftMm1;

    await view("front-3q");
    const orbitD0 = (await controls()).orbit.distance as number;
    await wheel(cdp, center.x, center.y, -100);
    await settle();
    const orbitD1 = (await controls()).orbit.distance as number;
    await wheel(cdp, center.x, center.y, -100);
    await settle();
    const orbitD2 = (await controls()).orbit.distance as number;
    const ratioOrbit = orbitD1 / orbitD0;
    const ratioOrbit2 = orbitD2 / orbitD1;

    ok("6", "the wheel zooms in on left (mmPerPx shrinks)", ratioLeft < 1, { ratioLeft });
    ok("6", "the wheel zooms in on front-3q (distance shrinks)", ratioOrbit < 1, { ratioOrbit });
    ok(
      "6",
      "the two ratios agree within 2 %",
      close(ratioLeft, ratioOrbit, 0.02),
      { ratioLeft, ratioOrbit },
    );
    ok("6", "a second notch keeps the left ratio", close(ratioLeft2, ratioLeft, 0.02), { ratioLeft2 });
    ok("6", "a second notch keeps the front-3q ratio", close(ratioOrbit2, ratioOrbit, 0.02), { ratioOrbit2 });

    // --- 7. the three drags, on left with the editor on and off, and on front-3q.
    for (const editOn of [false, true]) {
      await evaluate(`window.__ctl.knotEdit(${editOn})`);
      await view("left");
      await zoom(100);
      await settle();
      const t0 = await target();
      const p0 = (await zoom()).percent as number;
      // Upward: the middle drag dollies IN. Downward would zoom out, and the 100 % floor would
      // clamp it back, hiding the gesture.
      await drag(cdp, "middle", center, { x: center.x, y: center.y - 60 });
      await settle();
      const p1 = (await zoom()).percent as number;
      const t1 = await target();
      ok("7", `middle drag changes the percent (edit ${editOn})`, p1 !== p0, { p0, p1 });
      ok("7", `middle drag leaves the target (edit ${editOn})`, sameTarget(t0, t1, 1e-4), { t0, t1 });

      await view("left");
      await zoom(100);
      await settle();
      const p2 = (await zoom()).percent as number;
      const t2 = await target();
      await drag(cdp, "left", center, { x: center.x + 60, y: center.y + 40 });
      await settle();
      const p3 = (await zoom()).percent as number;
      const t3 = await target();
      ok("7", `left drag moves the target (edit ${editOn})`, !sameTarget(t2, t3, 1e-4), { t2, t3 });
      ok("7", `left drag leaves the percent (edit ${editOn})`, p3 === p2, { p2, p3 });

      await view("left");
      await zoom(100);
      await settle();
      const p4 = (await zoom()).percent as number;
      const t4 = await target();
      await drag(cdp, "right", center, { x: center.x + 60, y: center.y + 40 });
      await settle();
      const p5 = (await zoom()).percent as number;
      const t5 = await target();
      ok("7", `right drag changes neither (edit ${editOn})`, p5 === p4 && sameTarget(t4, t5, 1e-4), { p4, p5, t4, t5 });
    }
    await evaluate("window.__ctl.knotEdit(false)");

    // The same three drags on the free view: middle dollies, left pans, right is inert. The target
    // read here is the instance's own, because a perspective pan does not touch the rig's preset
    // target.
    await view("front-3q");
    await settle();
    const d0 = (await controls()).orbit.distance as number;
    const ft0 = (await controls()).orbit.target as number[];
    await drag(cdp, "middle", center, { x: center.x, y: center.y - 60 });
    await settle();
    const d1 = (await controls()).orbit.distance as number;
    const ft1 = (await controls()).orbit.target as number[];
    ok("7", "middle drag dollies on front-3q", !close(d0, d1, 1e-4), { d0, d1 });
    ok("7", "middle drag leaves the target on front-3q", sameTarget(ft0, ft1, 1e-4), { ft0, ft1 });

    await view("front-3q");
    await settle();
    const d2 = (await controls()).orbit.distance as number;
    const ft2 = (await controls()).orbit.target as number[];
    await drag(cdp, "left", center, { x: center.x + 60, y: center.y + 40 });
    await settle();
    const d3 = (await controls()).orbit.distance as number;
    const ft3 = (await controls()).orbit.target as number[];
    ok("7", "left drag pans on front-3q", !sameTarget(ft2, ft3, 1e-4), { ft2, ft3 });
    ok("7", "left drag leaves the distance on front-3q", close(d2, d3, 1e-4), { d2, d3 });

    await view("front-3q");
    await settle();
    const d4 = (await controls()).orbit.distance as number;
    const ft4 = (await controls()).orbit.target as number[];
    await drag(cdp, "right", center, { x: center.x + 60, y: center.y + 40 });
    await settle();
    const d5 = (await controls()).orbit.distance as number;
    const ft5 = (await controls()).orbit.target as number[];
    ok("7", "right drag changes neither on front-3q", close(d4, d5, 1e-4) && sameTarget(ft4, ft5, 1e-4), { d4, d5, ft4, ft5 });

    // --- 8. the modifier swap, the one non-documented dependency of this ticket.
    await view("front-3q");
    await settle();
    const orbitCfg = (await controls()).orbit;
    ok("8", "front-3q orbit has enableRotate true", orbitCfg.enableRotate === true, orbitCfg.enableRotate);
    const azBefore = orbitCfg.azimuth as number;
    const camBefore = orbitCfg.camera as number[];
    await drag(cdp, "left", center, { x: center.x + 80, y: center.y + 30 }, SHIFT);
    await settle();
    const orbitCfgAfter = (await controls()).orbit;
    ok("8", "Shift + left drag moves getAzimuthalAngle()", !close(orbitCfgAfter.azimuth, azBefore, 1e-4), { azBefore, azAfter: orbitCfgAfter.azimuth });
    ok("8", "Shift + left drag moves the camera position", !sameTarget(orbitCfgAfter.camera, camBefore, 1e-4), { camBefore, camAfter: orbitCfgAfter.camera });

    await view("left");
    await settle();
    const flatCfg = (await controls()).flat;
    ok("8", "left flat has enableRotate false", flatCfg.enableRotate === false, flatCfg.enableRotate);
    const fAz = flatCfg.azimuth as number;
    const fCam = flatCfg.camera as number[];
    const fTarget = await target();
    await drag(cdp, "left", center, { x: center.x + 80, y: center.y + 30 }, SHIFT);
    await settle();
    const flatAfter = (await controls()).flat;
    ok("8", "Shift + left drag is inert on a flat view", close(flatAfter.azimuth, fAz, 1e-4) && sameTarget(flatAfter.camera, fCam, 1e-4) && sameTarget(await target(), fTarget, 1e-4), { fAz, after: flatAfter.azimuth });

    // --- 9. a zoom and a pan do not invalidate the view name.
    await view("left");
    await zoom(100);
    await zoom(200);
    await evaluate("window.__ctl.pan(20, -10)");
    await settle();
    ok("9", "a zoom leaves the view name at left", (await state()).view === "left", (await state()).view);

    // --- 10. a named view restores 100 % and the frame target.
    await view("top");
    await view("left");
    await settle();
    const z10 = await zoom();
    const t10 = await target();
    ok("10", "view(left) after a pan and a zoom is 100 %", z10.percent === 100, z10);
    ok("10", "view(left) restores the frame target", sameTarget(t10, frameTarget, 1e-6), { t10, frameTarget });

    // --- 11. a perspective view reports `applied: false` and stays at 100 %.
    await view("front-3q");
    const z11 = await zoom(200);
    ok("11", "zoom(200) on front-3q returns applied false", z11.applied === false, z11);
    ok("11", "front-3q stays at 100 %", (await zoom()).percent === 100, await zoom());

    // --- 12. the HUD shows the reported percent on a flat view, and a dash elsewhere.
    await view("left");
    await zoom(100);
    await wheel(cdp, center.x, center.y, -100);
    await settle();
    const hudPercent = (await zoom()).percent as number;
    const hudText = await evaluate("document.getElementById('hud-zoom').textContent");
    ok("12", "the HUD shows the reported percent", hudText === `${hudPercent} %`, { hudText, hudPercent });
    await view("front-3q");
    await settle();
    const hudDash = await evaluate("document.getElementById('hud-zoom').textContent");
    ok("12", "the HUD shows a dash on a perspective view", hudDash === "—", { hudDash });

    // --- 13. a capture is always prepared at 100 %.
    await view("left");
    await zoom(1000);
    await runCommand(["bun", "run", join(TOOLS, "ctl.ts"), "shot", SHOT_PATH, "--session", SESSION]);
    const statsZoom = (await evaluate("window.__stats()")).zoom as number;
    ok("13", "a capture prepared by ctl.ts shot reports zoom 1", statsZoom === 1, { statsZoom });

    // --- 14. the cursor says what a left drag will do, on both families.
    await view("left");
    await settle();
    ok("14", "the cursor is grab on left at rest", (await cursor()) === "grab", await cursor());
    await mouse(cdp, "mouseMoved", center.x, center.y, { button: "none", buttons: 0, modifiers: 0 });
    await mouse(cdp, "mousePressed", center.x, center.y, { button: "left", buttons: 1, clickCount: 1, modifiers: 0 });
    await mouse(cdp, "mouseMoved", center.x + 30, center.y + 20, { button: "left", buttons: 1, modifiers: 0 });
    const draggingCursor = await cursor();
    await mouse(cdp, "mouseReleased", center.x + 30, center.y + 20, { button: "left", buttons: 0, clickCount: 1, modifiers: 0 });
    ok("14", "the cursor is grabbing during a left drag", draggingCursor === "grabbing", draggingCursor);
    await view("front-3q");
    await settle();
    ok("14", "the cursor is grab on front-3q too", (await cursor()) === "grab", await cursor());

    console.log("\ncheck_zoom  all assertions passed");
  } finally {
    cdpForClose?.close();
    await session.close();
  }
}

async function runCommand(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${cmd.join(" ")} failed (${code}): ${(stderr || stdout).trim().slice(0, 400)}`);
  }
}

await run();
