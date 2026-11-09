// The invocation of a measurement point, checked on the live page.
//
// A measurement point is invoked by `Ctrl` + left click, and it lands on the **release**, not the
// press. A drag records nothing, and a plain left click records nothing. This is the TDD test of
// ticket T0005. T0003 gave the left button to the camera -- a left drag pans -- so a record on the
// press drops a point on every pan. The chord and the release are the fix.
//
// The check synthesises `PointerEvent`s, as T0004's check does, because the `Ctrl` and `Shift`
// flags are what the library and the picker read. Chrome throws a `NotFoundError` when
// `setPointerCapture` is called with the id of a pointer that does not exist; the shim below makes
// that call a no-op, so `OrbitControls` still registers its move and up listeners and a synthetic
// drag still moves the camera.
//
// It takes its browser session from `session.ts`: one owner, closed in a `finally` and on `SIGINT`,
// named after its pid, with a timeout on every `agent-browser` call. It writes nothing.
//
// Usage, from the repository root (the dev server must run on http://127.0.0.1:5180):
//
//   bun run workflows/threejs/tools/check_measure.ts

import { Session, evaluate as evaluateIn } from "./session";

const SCENE = "r5-tl-1972";
const VIEWER_URL = `http://127.0.0.1:5180/?scene=${SCENE}`;
const VIEWPORT = { width: 1400, height: 1000 };

const session = new Session("measure-check");
const SESSION = session.name;

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

// ------------------------------------------------------------------ synthetic pointer

type Chord = { ctrlKey?: boolean; shiftKey?: boolean };

/**
 * Make `setPointerCapture` a no-op for a pointer id that has no active pointer.
 *
 * A synthetic `PointerEvent` has an id Chrome does not know, so `setPointerCapture` throws
 * `NotFoundError`. `OrbitControls` calls it at the top of its `pointerdown` handler and registers
 * its move and up listeners right after, so the throw would leave a synthetic drag dead. The shim
 * swallows only that error and rethrows everything else.
 */
async function installCaptureShim(): Promise<void> {
  await evaluate(`(() => {
    const proto = Element.prototype;
    if (proto.__measureShim) return true;
    proto.__measureShim = true;
    const set = proto.setPointerCapture;
    const release = proto.releasePointerCapture;
    proto.setPointerCapture = function (id) {
      try { set.call(this, id); }
      catch (error) { if (!error || error.name !== "NotFoundError") throw error; }
    };
    proto.releasePointerCapture = function (id) {
      try { release.call(this, id); }
      catch (error) { if (!error || error.name !== "NotFoundError") throw error; }
    };
    return true;
  })()`);
}

async function dispatch(
  type: string,
  options: { x: number; y: number; button: number; buttons: number } & Chord,
): Promise<void> {
  const { x, y, button, buttons, ctrlKey = false, shiftKey = false } = options;
  await evaluate(`(() => {
    const canvas = document.querySelector("canvas");
    const event = new PointerEvent(${JSON.stringify(type)}, {
      pointerId: 1, pointerType: "mouse", isPrimary: true,
      clientX: ${x}, clientY: ${y}, button: ${button}, buttons: ${buttons},
      ctrlKey: ${ctrlKey}, shiftKey: ${shiftKey}, bubbles: true, cancelable: true,
    });
    canvas.dispatchEvent(event);
    return true;
  })()`);
}

async function click(point: { x: number; y: number }, chord: Chord = {}): Promise<void> {
  await dispatch("pointerdown", { ...point, ...chord, button: 0, buttons: 1 });
  await dispatch("pointerup", { ...point, ...chord, button: 0, buttons: 0 });
}

async function drag(
  from: { x: number; y: number },
  to: { x: number; y: number },
  chord: Chord = {},
  steps = 6,
): Promise<void> {
  await dispatch("pointerdown", { ...from, ...chord, button: 0, buttons: 1 });
  for (let i = 1; i <= steps; i += 1) {
    await dispatch("pointermove", {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
      ...chord,
      button: -1,
      buttons: 1,
    });
  }
  await dispatch("pointerup", { ...to, ...chord, button: 0, buttons: 0 });
}

// ------------------------------------------------------------------ page reads

async function points(): Promise<any[]> {
  return ((await evaluate("window.__ctl.measurePoints()")) as any).points;
}

async function state(): Promise<any> {
  return evaluate("window.__ctl.state()");
}

async function controls(): Promise<any> {
  return evaluate("window.__ctl.controls()");
}

async function target(): Promise<number[]> {
  return (await state()).target as number[];
}

async function orbitAzimuth(): Promise<number> {
  return (await controls()).orbit.azimuth as number;
}

async function clearPoints(): Promise<void> {
  await evaluate("window.__ctl.measure({ clear: true }).then(() => true)");
}

async function setTool(on: boolean): Promise<void> {
  await evaluate(`window.__ctl.measure(${on ? "{ on: true }" : "{ off: true }"}).then(() => true)`);
}

async function view(name: string): Promise<void> {
  await evaluate(`window.__ctl.view(${JSON.stringify(name)}).then(() => true)`);
}

// ------------------------------------------------------------------ assertions

function ok(step: string, description: string, condition: boolean, detail?: unknown): void {
  if (!condition) throw new CheckFailure(step, description, detail);
  console.log(`  ok  ${step}  ${description}`);
}

function same(a: number[], b: number[], epsilon = 1e-4): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) <= epsilon);
}

/** Wait until the camera target holds still: the pan's damping tail keeps it moving for a while. */
async function settle(timeoutMs = 4000): Promise<void> {
  await evaluate("window.__ctl.wait().then(() => true)");
  let previous = await target();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Bun.sleep(120);
    const now = await target();
    if (Math.max(...now.map((v, i) => Math.abs(v - previous[i]))) < 1e-7) return;
    previous = now;
  }
}

/** Wait until the orbit angle holds still: the rotate's damping tail keeps it moving for a while. */
async function settleRotate(timeoutMs = 4000): Promise<void> {
  await evaluate("window.__ctl.wait().then(() => true)");
  let previous = await orbitAzimuth();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Bun.sleep(120);
    const now = await orbitAzimuth();
    if (Math.abs(now - previous) < 1e-7) return;
    previous = now;
  }
}

/** The pixel position of a normalised device coordinate, from the canvas's own rectangle. */
let rect: [number, number, number, number] = [0, 0, VIEWPORT.width, VIEWPORT.height];

function pixel(nx: number, ny: number): { x: number; y: number } {
  const [left, top, width, height] = rect;
  return { x: left + ((nx + 1) / 2) * width, y: top + ((1 - ny) / 2) * height };
}

/**
 * Find a normalised device coordinate that lands on `source`, by probing candidates through
 * `measurePick`. Every probe records a point, so the list is cleared after each one.
 */
async function findNdc(source: string): Promise<[number, number]> {
  const candidates: Array<[number, number]> = [
    [0, 0], [-0.4, -0.2], [0.3, 0.1], [-0.2, 0.3], [0.2, -0.3], [-0.5, 0], [0.5, 0], [0, 0.3],
  ];
  for (const [nx, ny] of candidates) {
    const entry = await evaluate(`window.__ctl.measurePick(${nx}, ${ny}, ${JSON.stringify(source)})`);
    await clearPoints();
    if (entry) return [nx, ny];
  }
  throw new Error(`no point on the ${source} found among the probe candidates`);
}

// ------------------------------------------------------------------ run

async function run(): Promise<void> {
  try {
    await session.open(VIEWER_URL);
    await session.ab(
      ["set", "viewport", String(VIEWPORT.width), String(VIEWPORT.height), "1", "--session", SESSION],
      "set viewport",
    );
    await waitForReady();
    await installCaptureShim();

    rect = (await evaluate(
      "(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()",
    )) as [number, number, number, number];

    const size = (await evaluate("[window.innerWidth, window.innerHeight]")) as number[];
    const center = { x: size[0] / 2, y: size[1] / 2 };

    await view("left");
    await evaluate("window.__ctl.calque({ view: 'left' }).then(() => true)");
    await settle();

    const plate = await findNdc("calque");
    const platePixel = pixel(plate[0], plate[1]);

    // --- 1. a plain left drag records no point, and it pans the camera instead.
    await setTool(true);
    await clearPoints();
    await view("left");
    await settle();
    const t0 = await target();
    const n0 = (await points()).length;
    await drag(center, { x: center.x + 40, y: center.y });
    await settle();
    const n1 = (await points()).length;
    ok("1", "a plain left drag records no point", n1 === n0, { before: n0, after: n1 });
    const t1 = await target();
    ok("1", "a plain left drag moves the camera target", !same(t0, t1, 1e-4), { t0, t1 });

    // --- 2. a plain left click records no point.
    await clearPoints();
    await click(center);
    ok("2", "a plain left click records no point", (await points()).length === 0);

    // --- 3. Ctrl + left click records exactly one point, at the place the click landed on.
    await clearPoints();
    await click(platePixel, { ctrlKey: true });
    const clicked = await points();
    ok("3", "Ctrl + left click records exactly one point", clicked.length === 1, { points: clicked });
    const probe = (await evaluate(
      `window.__ctl.measurePick(${plate[0]}, ${plate[1]}, "calque")`,
    )) as any;
    ok(
      "3",
      "the recorded u/v match the pick at the same NDC to 1e-4",
      clicked.length === 1 &&
        probe &&
        Math.abs(clicked[0].u - probe.u) <= 1e-4 &&
        Math.abs(clicked[0].v - probe.v) <= 1e-4,
      { recorded: clicked[0] && { u: clicked[0].u, v: clicked[0].v }, probe: probe && { u: probe.u, v: probe.v } },
    );
    ok("3", "the recorded point came from the plate", clicked.length === 1 && clicked[0].source === "calque", clicked[0]);

    // --- 4. a Ctrl + left drag records no point, and the camera target does not move.
    await clearPoints();
    await view("left");
    await settle();
    const t2 = await target();
    const n2 = (await points()).length;
    await drag(center, { x: center.x + 40, y: center.y }, { ctrlKey: true });
    await settle();
    ok("4", "a Ctrl + left drag records no point", (await points()).length === n2, { before: n2 });
    const t3 = await target();
    ok("4", "the claim keeps the camera target still", same(t2, t3, 1e-6), { t2, t3 });

    // --- 5. Ctrl + Shift + left click reads the model, not the plate.
    const model = await findNdc("model");
    await clearPoints();
    await click(pixel(model[0], model[1]), { ctrlKey: true, shiftKey: true });
    const modelPoints = await points();
    ok(
      "5",
      "Ctrl + Shift + left click records source model",
      modelPoints.length === 1 && modelPoints[0].source === "model",
      modelPoints,
    );

    // --- 6. a pointercancel between the press and the release records nothing.
    await clearPoints();
    await dispatch("pointerdown", { ...platePixel, ctrlKey: true, button: 0, buttons: 1 });
    await dispatch("pointercancel", { ...platePixel, ctrlKey: true, button: 0, buttons: 0 });
    await dispatch("pointerup", { ...platePixel, ctrlKey: true, button: 0, buttons: 0 });
    ok("6", "a pointercancel drops the pending point", (await points()).length === 0);

    // --- 7. the chord is claimed only while the tool is on.
    await setTool(false);
    await view("front-3q");
    await settleRotate();
    const az0 = await orbitAzimuth();
    await drag(center, { x: center.x + 60, y: center.y + 30 }, { ctrlKey: true });
    await settleRotate();
    const az1 = await orbitAzimuth();
    ok("7", "with the tool off, Ctrl + left drag rotates a free view", Math.abs(az1 - az0) > 1e-4, { az0, az1 });

    await setTool(true);
    await view("front-3q");
    await settleRotate();
    const az2 = await orbitAzimuth();
    await drag(center, { x: center.x + 60, y: center.y + 30 }, { ctrlKey: true });
    await settleRotate();
    const az3 = await orbitAzimuth();
    ok("7", "with the tool on, the same drag does not rotate", Math.abs(az3 - az2) <= 1e-6, { az2, az3 });

    console.log("\ncheck_measure  all assertions passed");
  } finally {
    await session.close();
  }
}

try {
  await run();
} catch (error) {
  console.error(`\ncheck_measure  FAILED\n${String((error as Error)?.stack ?? error)}`);
  await session.close();
  process.exit(1);
}
