// The knot selection editor, checked on the live page.
//
// T0004 makes a region of the outline an object: `Shift` + left drag draws a selection rectangle,
// a drag that starts on a selected knot moves the whole selection, `Delete` removes it, and no
// click inserts or removes a knot any more. This is the TDD test of that ticket.
//
// The check drives the page through `__ctl` and synthesises the pointer and keyboard events the
// gestures need, because the `Shift` and `Ctrl` flags are what the editor, the picker and
// `OrbitControls` read. Chrome throws a `NotFoundError` when `setPointerCapture` is called with the
// id of a pointer that does not exist; the shim below makes that call a no-op, so `OrbitControls`
// still registers its move and up listeners and a synthetic drag still moves the camera.
//
// It takes its browser session from `session.ts`: one owner, closed in a `finally` and on `SIGINT`,
// named after its pid, with a timeout on every `agent-browser` call. It writes nothing.
//
// Usage, from the repository root (the dev server must run on http://127.0.0.1:5180):
//
//   bun run workflows/threejs/tools/check_knot_selection.ts

import { Session, evaluate as evaluateIn } from "./session";

const SCENE = "r5-tl-1972";
const VIEWER_URL = `http://127.0.0.1:5180/?scene=${SCENE}`;
const VIEWPORT = { width: 1400, height: 1000 };

const session = new Session("knot-selection-check");
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

// ------------------------------------------------------------------ synthetic input

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
    if (proto.__knotShim) return true;
    proto.__knotShim = true;
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

/** A real `keydown`/`keyup` on `window`, or on the `#knot-tol` field so its target is an input. */
async function key(type: string, name: string, target: "window" | "input" = "window"): Promise<void> {
  await evaluate(`(() => {
    const target = ${target === "input" ? 'document.getElementById("knot-tol")' : "window"};
    const event = new KeyboardEvent(${JSON.stringify(type)}, {
      key: ${JSON.stringify(name)}, bubbles: true, cancelable: true,
    });
    target.dispatchEvent(event);
    return true;
  })()`);
}

// ------------------------------------------------------------------ page reads

async function knotSelection(): Promise<any> {
  try {
    return await evaluate("window.__ctl.knotSelection()");
  } catch {
    return null;
  }
}

async function positions(): Promise<number[][]> {
  return ((await evaluate("window.__ctl.knots()")) as any).positions as number[][];
}

async function selectRect(rect: [number, number, number, number]): Promise<any> {
  return evaluate(
    `window.__ctl.knotSelectRect(${rect[0]},${rect[1]},${rect[2]},${rect[3]})`,
  );
}

async function clearSelection(): Promise<any> {
  return evaluate("window.__ctl.knotClearSelection()");
}

async function deleteSelection(): Promise<any> {
  return evaluate("window.__ctl.knotDeleteSelection()");
}

async function dragSelection(du: number, dv: number): Promise<any> {
  return evaluate(`window.__ctl.knotDragSelection(${du},${dv})`);
}

async function knotScreen(index: number): Promise<{ x: number; y: number } | null> {
  return evaluate(`window.__ctl.knotScreen(${index})`) as Promise<{ x: number; y: number } | null>;
}

async function cursor(): Promise<string> {
  return evaluate("getComputedStyle(document.querySelector('canvas')).cursor") as Promise<string>;
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

async function view(name: string): Promise<void> {
  await evaluate(`window.__ctl.view(${JSON.stringify(name)}).then(() => true)`);
}

async function knotEdit(on: boolean): Promise<void> {
  await evaluate(`window.__ctl.knotEdit(${on})`);
  await evaluate("window.__ctl.wait().then(() => true)");
}

// ------------------------------------------------------------------ assertions

function ok(step: string, description: string, condition: boolean, detail?: unknown): void {
  if (!condition) throw new CheckFailure(step, description, detail);
  console.log(`  ok  ${step}  ${description}`);
}

function same(a: number[], b: number[], epsilon = 1e-4): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= epsilon);
}

// This helper mirrors `indicesInRect` on purpose: the check only confirms the WIRING (a rectangle
// from `__ctl` selects the knots the same rule selects). The real oracle for the rectangle rule is
// the hardcoded unit tests in `viewer/knots.test.js`; this check must not be read as a second one.
function insideIndices(knots: number[][], rect: [number, number, number, number]): number[] {
  const [u0, v0, u1, v1] = rect;
  const uMin = Math.min(u0, u1);
  const uMax = Math.max(u0, u1);
  const vMin = Math.min(v0, v1);
  const vMax = Math.max(v0, v1);
  const out: number[] = [];
  knots.forEach((p, i) => {
    if (p[0] >= uMin && p[0] <= uMax && p[1] >= vMin && p[1] <= vMax) out.push(i);
  });
  return out;
}

/**
 * A rectangle that isolates one knot: its half-size is half the distance to the nearest other
 * knot, so no other point can fall inside it. The check builds a selection of exactly the knots it
 * names, whatever the contour's spacing.
 */
function isolateRect(knots: number[][], index: number): [number, number, number, number] {
  const p = knots[index];
  let nearest = Infinity;
  for (let j = 0; j < knots.length; j += 1) {
    if (j === index) continue;
    nearest = Math.min(nearest, Math.hypot(knots[j][0] - p[0], knots[j][1] - p[1]));
  }
  const half = Math.max(1e-4, (Number.isFinite(nearest) ? nearest : 1) * 0.49);
  return [p[0] - half, p[1] - half, p[0] + half, p[1] + half];
}

async function selectKnots(indices: number[]): Promise<any> {
  const knots = await positions();
  for (const index of indices) await selectRect(isolateRect(knots, index));
  return knotSelection();
}

function fullRect(knots: number[][]): [number, number, number, number] {
  const us = knots.map((p) => p[0]);
  const vs = knots.map((p) => p[1]);
  return [Math.min(...us) - 1, Math.min(...vs) - 1, Math.max(...us) + 1, Math.max(...vs) + 1];
}

/** The index of the knot farthest from `from`: a knot the caller did not select, so a press on it
 * is a press on an unselected knot. */
function farthestIndex(knots: number[][], from: number): number {
  let best = from;
  let distance = -1;
  knots.forEach((p, i) => {
    const d = Math.hypot(p[0] - knots[from][0], p[1] - knots[from][1]);
    if (d > distance) { distance = d; best = i; }
  });
  return best;
}

/**
 * Call `__ctl.knotSave()` with `window.fetch` stubbed, so the request body is captured and the real
 * `POST /api/contours` never reaches the server. `fetch` is restored whatever the call does.
 */
async function captureSavePayload(): Promise<any> {
  return evaluate(`(() => {
    const original = window.fetch;
    let captured = null;
    window.fetch = function (url, options) {
      captured = options && options.body ? JSON.parse(String(options.body)) : null;
      return Promise.resolve({ ok: true, json: async () => ({ written: false }) });
    };
    return window.__ctl.knotSave()
      .then(() => { window.fetch = original; return captured; })
      .catch((error) => { window.fetch = original; throw error; });
  })()`);
}

// ------------------------------------------------------------------ geometry helpers

let rect: [number, number, number, number] = [0, 0, VIEWPORT.width, VIEWPORT.height];

function pixel(nx: number, ny: number): { x: number; y: number } {
  const [left, top, width, height] = rect;
  return { x: left + ((nx + 1) / 2) * width, y: top + ((1 - ny) / 2) * height };
}

async function settle(timeoutMs = 4000): Promise<void> {
  await evaluate("window.__ctl.wait().then(() => true)");
  let previous = await target();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Bun.sleep(120);
    const now = await target();
    if (same(now, previous, 1e-7)) return;
    previous = now;
  }
}

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

/** A normalised device coordinate that is not within a knot's grab threshold. */
async function findFreeNdc(): Promise<[number, number]> {
  const candidates: Array<[number, number]> = [
    [0, 0], [0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4], [0.6, 0], [0, 0.5], [0.5, 0.2],
  ];
  for (const [nx, ny] of candidates) {
    const probe = await evaluate(`window.__ctl.knotProbe(${nx}, ${ny})`);
    if (probe && (probe as any).grab === false) return [nx, ny];
  }
  throw new Error("no point found away from every knot");
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
    await knotEdit(true);
    await settle();

    // --- 1. the selection starts empty, on the view being edited.
    const sel1 = await knotSelection();
    ok(
      "1",
      "the selection starts empty on the shown view",
      Boolean(sel1) && sel1.view === "left" && sel1.count === 0,
      sel1,
    );

    // --- 2. a 30 mm rectangle around the first knot selects exactly the knots inside it.
    const p0 = await positions();
    const rect2: [number, number, number, number] = [p0[0][0] - 0.015, p0[0][1] - 0.015, p0[0][0] + 0.015, p0[0][1] + 0.015];
    const expected2 = insideIndices(p0, rect2);
    const r2 = await selectRect(rect2);
    ok(
      "2",
      "a 30 mm rectangle selects every knot inside it, and no other",
      JSON.stringify(r2.selection) === JSON.stringify(expected2) && r2.count === expected2.length,
      { expected: expected2, got: r2.selection },
    );

    // --- 3. a second, disjoint rectangle adds to the selection.
    let far = 0;
    let farthest = -1;
    p0.forEach((p, i) => {
      const d = Math.hypot(p[0] - p0[0][0], p[1] - p0[0][1]);
      if (d > farthest) { farthest = d; far = i; }
    });
    const rect3: [number, number, number, number] = [p0[far][0] - 0.015, p0[far][1] - 0.015, p0[far][0] + 0.015, p0[far][1] + 0.015];
    const expected3 = insideIndices(p0, rect3);
    const union = [...new Set([...expected2, ...expected3])].sort((a, b) => a - b);
    const added3 = expected3.filter((i) => !expected2.includes(i));
    const r3 = await selectRect(rect3);
    ok(
      "3",
      "a second rectangle adds, ascending, with no duplicate",
      JSON.stringify(r3.selection) === JSON.stringify(union) &&
        JSON.stringify(r3.added) === JSON.stringify(added3),
      { expected: union, added: added3, got: r3.selection },
    );

    // --- 4. the group drag moves every selected knot by one vector, and no other.
    const before4 = await positions();
    const sel4 = await knotSelection();
    await dragSelection(0.01, 0.02);
    const after4 = await positions();
    const movedOk = sel4.indices.every(
      (i) => Math.abs(after4[i][0] - (before4[i][0] + 0.01)) <= 1e-4 && Math.abs(after4[i][1] - (before4[i][1] + 0.02)) <= 1e-4,
    );
    const stillOk = before4.every(
      (p, i) => sel4.indices.includes(i) || same(after4[i], p, 1e-6),
    );
    ok("4", "the selected knots move by exactly the vector", movedOk);
    ok("4", "the unselected knots do not move", stillOk);

    // --- 5. the delete removes exactly the selection and empties it.
    const sel5 = await knotSelection();
    const count5 = (await positions()).length;
    const del5 = await deleteSelection();
    const after5 = await positions();
    ok(
      "5",
      "the delete removes exactly the selection",
      JSON.stringify(del5.removed) === JSON.stringify(sel5.indices) && del5.refused === false,
      del5,
    );
    ok("5", "the selection is empty after the delete", (await knotSelection()).count === 0);
    ok(
      "5",
      "the count falls by the selected count",
      after5.length === count5 - del5.removed.length,
      { before: count5, after: after5.length, removed: del5.removed.length },
    );

    // --- 6. deleting down to three leaves three; a further full selection is refused.
    let remaining = await positions();
    const order = remaining.map((_, i) => i).sort((a, b) => remaining[a][0] - remaining[b][0]);
    const keep = new Set(order.slice(-3));
    const keepMinU = Math.min(...[...keep].map((i) => remaining[i][0]));
    const uMin = Math.min(...remaining.map((p) => p[0])) - 1;
    const vMin = Math.min(...remaining.map((p) => p[1])) - 1;
    const vMax = Math.max(...remaining.map((p) => p[1])) + 1;
    await selectRect([uMin, vMin, keepMinU - 1e-7, vMax]);
    await deleteSelection();
    remaining = await positions();
    while (remaining.length > 3) {
      await selectRect(isolateRect(remaining, 0));
      await deleteSelection();
      remaining = await positions();
    }
    ok("6", "deleting every knot but three leaves exactly three", remaining.length === 3, { count: remaining.length });
    await selectRect(fullRect(remaining));
    const del6 = await deleteSelection();
    ok(
      "6",
      "a full selection below the minimum is refused, and the count holds",
      del6.refused === true && del6.reason === "minimum" && (await positions()).length === 3,
      del6,
    );
    // The rest of the check needs a full contour again. `reset` drops the hand-set knots of the view
    // and returns to the traced path, so the later gestures run on the whole ring, not on three.
    await evaluate('window.__ctl.knotReset("left")');
    await settle();

    // --- 7. Escape clears the selection.
    await clearSelection();
    await selectKnots([0, 1]);
    const sel7 = await knotSelection();
    await key("keydown", "Escape");
    ok("7", "Escape clears the selection", sel7.count === 2 && (await knotSelection()).count === 0, sel7);

    // --- 8. Delete deletes in edit mode, and does nothing when the target is the tolerance field.
    await clearSelection();
    await selectKnots([0, 1]);
    const count8a = (await positions()).length;
    await key("keydown", "Delete");
    const after8 = await positions();
    ok(
      "8",
      "Delete removes the selected knots in edit mode",
      after8.length === count8a - 2 && (await knotSelection()).count === 0,
      { before: count8a, after: after8.length },
    );
    await selectKnots([0, 1]);
    const sel8b = await knotSelection();
    const count8b = (await positions()).length;
    await evaluate('document.getElementById("knot-tol").focus()');
    await key("keydown", "Delete", "input");
    ok(
      "8",
      "Delete on the tolerance field deletes nothing",
      (await positions()).length === count8b &&
        JSON.stringify((await knotSelection()).indices) === JSON.stringify(sel8b.indices),
      { sel: sel8b.indices },
    );
    await evaluate('document.getElementById("knot-tol").blur()');

    // --- 9. a view change clears the selection.
    await clearSelection();
    await selectKnots([0, 1]);
    await view("back");
    await settle();
    const sel9 = await knotSelection();
    ok("9", "a view change clears the selection", sel9.count === 0, sel9);
    await view("left");
    await settle();

    // --- 10. a join switch keeps the same selection and the same indices.
    await clearSelection();
    await selectKnots([0, 1]);
    const sel10 = await knotSelection();
    await evaluate('window.__ctl.contourMode("poly")');
    const polySel = await knotSelection();
    await evaluate('window.__ctl.contourMode("bezier")');
    const bezSel = await knotSelection();
    ok(
      "10",
      "a join switch keeps the same selection and indices",
      JSON.stringify(polySel.indices) === JSON.stringify(sel10.indices) &&
        JSON.stringify(bezSel.indices) === JSON.stringify(sel10.indices),
      { sel: sel10.indices, poly: polySel.indices, bezier: bezSel.indices },
    );

    // --- 11. reduce clears the selection.
    await clearSelection();
    await selectKnots([0, 1]);
    await evaluate('window.__ctl.knotReduce("left", 25)');
    ok("11", "reduce clears the selection", (await knotSelection()).count === 0);

    // --- 12. a Shift + left drag on the canvas opens the marquee and selects a knot.
    await clearSelection();
    const screen0 = await knotScreen(0);
    const screen1 = await knotScreen(1);
    await dispatch("pointerdown", { x: screen0!.x, y: screen0!.y, button: 0, buttons: 1, shiftKey: true });
    await dispatch("pointermove", { x: screen1!.x, y: screen1!.y, button: -1, buttons: 1, shiftKey: true });
    await dispatch("pointerup", { x: screen1!.x, y: screen1!.y, button: 0, buttons: 0, shiftKey: true });
    const sel12 = await knotSelection();
    ok("12", "the Shift drag selects at least one knot", sel12.count >= 1, sel12);
    ok(
      "12",
      "the marquee is hidden after the release",
      (await evaluate("document.getElementById('marquee').hidden")) === true,
    );

    // --- 13. knotScreen projects a knot to CSS pixels inside the canvas.
    const screen = await knotScreen(0);
    const inside =
      Boolean(screen) &&
      screen!.x >= rect[0] && screen!.x <= rect[0] + rect[2] &&
      screen!.y >= rect[1] && screen!.y <= rect[1] + rect[3];
    ok("13", "knotScreen projects a knot inside the canvas rectangle", inside, screen);

    // --- 14. Shift arms the crosshair; releasing it restores the open hand.
    await key("keydown", "Shift");
    const armed = await cursor();
    await key("keyup", "Shift");
    const released = await cursor();
    ok("14", "Shift on a flat view in edit mode arms the crosshair", armed === "crosshair", { cursor: armed });
    ok("14", "releasing Shift restores the open hand of the flat view", released === "grab", { cursor: released });

    // --- 15. a drag away from every knot pans the camera and keeps the selection.
    await clearSelection();
    const pos15 = await positions();
    let far15 = 0;
    let best15 = -1;
    pos15.forEach((p, i) => {
      const d = Math.hypot(p[0] - pos15[0][0], p[1] - pos15[0][1]);
      if (d > best15) { best15 = d; far15 = i; }
    });
    await selectKnots([0, far15]);
    const sel15 = await knotSelection();
    const t0 = await target();
    const free = await findFreeNdc();
    const from15 = pixel(free[0], free[1]);
    await drag(from15, { x: from15.x + 60, y: from15.y });
    await settle();
    const t1 = await target();
    ok("15", "a drag away from every knot pans the camera", !same(t0, t1, 1e-5), { t0, t1 });
    ok(
      "15",
      "the pan keeps the selection",
      JSON.stringify((await knotSelection()).indices) === JSON.stringify(sel15.indices),
      sel15.indices,
    );
    ok(
      "15",
      "the marquee stayed hidden",
      (await evaluate("document.getElementById('marquee').hidden")) === true,
    );

    // --- 16. the editor preempts the camera: a drag on a selected knot moves the knots.
    await view("left"); // reset the framing, so no pan inertia is left to confuse the target
    await settle();
    await clearSelection();
    await selectKnots([0]);
    const sel16 = await knotSelection();
    const before16 = await positions();
    const t2 = await target();
    const s16 = await knotScreen(sel16.indices[0]);
    await drag({ x: s16!.x, y: s16!.y }, { x: s16!.x + 50, y: s16!.y + 20 });
    await settle();
    const after16 = await positions();
    const moved16 = sel16.indices.some(
      (i) => Math.hypot(after16[i][0] - before16[i][0], after16[i][1] - before16[i][1]) > 1e-3,
    );
    ok("16", "a drag that starts on a selected knot moves it", moved16);
    const t3 = await target();
    ok("16", "the editor preempts the camera: the target does not move", same(t2, t3, 1e-6), { t2, t3 });

    // --- 17. Shift + left drag is the editor's on a flat view, and the camera's on a free one.
    await clearSelection();
    const t4 = await target();
    const free17 = await findFreeNdc();
    const from17 = pixel(free17[0], free17[1]);
    await drag(from17, { x: from17.x + 60, y: from17.y + 30 }, { shiftKey: true });
    await settle();
    ok("17", "on a flat view the Shift drag leaves the camera still", same(t4, await target(), 1e-6));

    await knotEdit(false);
    await view("front-3q");
    await settleRotate();
    const az0 = await orbitAzimuth();
    await drag(center, { x: center.x + 60, y: center.y + 30 }, { shiftKey: true });
    await settleRotate();
    const az1 = await orbitAzimuth();
    ok("17", "on a free view with the editor off the same drag rotates", Math.abs(az1 - az0) > 1e-4, { az0, az1 });

    // --- The acceptance criteria the 17-step plan under-covers.
    await knotEdit(false);
    await view("left");
    await knotEdit(true);
    await settle();

    // --- AC3. A Shift click with no movement changes nothing.
    await clearSelection();
    const posAC3 = await positions();
    await selectKnots([0, farthestIndex(posAC3, 0)]);
    const beforeAC3 = await knotSelection();
    const click3 = await knotScreen(beforeAC3.indices[0]);
    await dispatch("pointerdown", { x: click3!.x, y: click3!.y, button: 0, buttons: 1, shiftKey: true });
    await dispatch("pointerup", { x: click3!.x, y: click3!.y, button: 0, buttons: 0, shiftKey: true });
    const afterAC3 = await knotSelection();
    ok(
      "AC3",
      "a Shift click with no movement changes nothing",
      JSON.stringify(afterAC3.indices) === JSON.stringify(beforeAC3.indices),
      { before: beforeAC3.indices, after: afterAC3.indices },
    );

    // --- AC7. A plain press on an UNselected knot clears the selection and changes no knot.
    await clearSelection();
    const posAC7 = await positions();
    await selectKnots([0]);
    const other7 = farthestIndex(posAC7, 0);
    const beforeAC7 = await positions();
    const press7 = await knotScreen(other7);
    await dispatch("pointerdown", { x: press7!.x, y: press7!.y, button: 0, buttons: 1 });
    await dispatch("pointerup", { x: press7!.x, y: press7!.y, button: 0, buttons: 0 });
    const selAC7 = await knotSelection();
    const afterAC7 = await positions();
    ok("AC7", "a plain press on an unselected knot clears the selection", selAC7.count === 0, selAC7);
    ok(
      "AC7",
      "it inserts no knot and removes none",
      afterAC7.length === beforeAC7.length,
      { before: beforeAC7.length, after: afterAC7.length },
    );
    ok("AC7", "it moves no knot", beforeAC7.every((p, i) => same(afterAC7[i], p, 1e-9)));

    // --- AC4. The panel shows the selected count, and the selected handles are drawn.
    await clearSelection();
    await selectKnots([0, farthestIndex(await positions(), 0)]);
    const selAC4 = await knotSelection();
    const infoAC4 = (await evaluate('document.getElementById("knot-info").textContent')) as string;
    ok(
      "AC4",
      "the panel shows the selected count",
      infoAC4.includes(`${selAC4.count} selected`),
      { info: infoAC4, count: selAC4.count },
    );
    const drawnAC4 = ((await evaluate("window.__ctl.calqueInfo()")) as any).contour.handlesDrawn as string[];
    ok("AC4", "a SelectedKnots_<view> object is in the scene", drawnAC4.includes("SelectedKnots_left"), drawnAC4);
    await clearSelection();
    const drawnEmpty = ((await evaluate("window.__ctl.calqueInfo()")) as any).contour.handlesDrawn as string[];
    ok(
      "AC4",
      "no selected object exists when the selection is empty",
      !drawnEmpty.some((name) => name.startsWith("SelectedKnots_")),
      drawnEmpty,
    );

    // --- AC5. Backspace deletes like Delete; a refusal writes the minimum message.
    await clearSelection();
    await selectKnots([0, 1]);
    const countAC5 = (await positions()).length;
    await key("keydown", "Backspace");
    ok(
      "AC5",
      "Backspace removes the selected knots",
      (await positions()).length === countAC5 - 2 && (await knotSelection()).count === 0,
      { before: countAC5, after: (await positions()).length },
    );
    let remAC5 = await positions();
    while (remAC5.length > 3) {
      await selectRect(isolateRect(remAC5, 0));
      await deleteSelection();
      remAC5 = await positions();
    }
    await selectRect(fullRect(remAC5));
    await key("keydown", "Delete");
    const infoAC5 = (await evaluate('document.getElementById("knot-info").textContent')) as string;
    ok(
      "AC5",
      "a refused Delete writes the minimum message",
      infoAC5.includes("cannot delete: at least 3 knots"),
      { info: infoAC5 },
    );
    const refusedAC5 = await deleteSelection();
    ok(
      "AC5",
      "the refusal is reported and nothing is removed",
      refusedAC5.refused === true && refusedAC5.reason === "minimum" && (await positions()).length === 3,
      refusedAC5,
    );
    await evaluate('window.__ctl.knotReset("left")');
    await settle();

    // --- AC9. The measurement tool is locked out while the editor is active.
    await clearSelection();
    await selectKnots([0, farthestIndex(await positions(), 0)]);
    await evaluate("window.__ctl.measure({ on: true }).then(() => true)");
    const pointsBeforeAC9 = ((await evaluate("window.__ctl.measurePoints()")) as any).points.length;
    const freeAC9 = await findFreeNdc();
    const atAC9 = pixel(freeAC9[0], freeAC9[1]);
    await dispatch("pointerdown", { x: atAC9.x, y: atAC9.y, button: 0, buttons: 1, ctrlKey: true });
    await dispatch("pointerup", { x: atAC9.x, y: atAC9.y, button: 0, buttons: 0, ctrlKey: true });
    await drag(atAC9, { x: atAC9.x + 40, y: atAC9.y + 20 }, { shiftKey: true });
    const pointsAfterAC9 = ((await evaluate("window.__ctl.measurePoints()")) as any).points.length;
    ok(
      "AC9",
      "the measurement tool records no point while the editor is active",
      pointsAfterAC9 === pointsBeforeAC9,
      { before: pointsBeforeAC9, after: pointsAfterAC9 },
    );
    await evaluate("window.__ctl.measure({ off: true }).then(() => true)");

    // --- AC11. The selection is absent from the save payload, and no file is written.
    const payload = await captureSavePayload();
    ok(
      "AC11",
      "the save payload has only scene and knots",
      Object.keys(payload ?? {}).sort().join(",") === "knots,scene",
      payload && Object.keys(payload),
    );
    const fields = new Set<string>();
    for (const entry of Object.values(payload?.knots ?? {}) as any[]) {
      for (const field of Object.keys(entry)) fields.add(field);
    }
    ok(
      "AC11",
      "a knot entry has only mode and knots",
      [...fields].every((field) => field === "mode" || field === "knots"),
      [...fields],
    );
    ok("AC11", "no selection field appears in the payload", !JSON.stringify(payload).includes("selection"), payload);

    // --- AC13. The handles and the contour are in the same pass as the plate and draw after it.
    // A `PointsMaterial` without `transparent: true` draws in the OPAQUE pass, which three.js renders
    // before the transparent pass: the plate then paints over the handles. This asserts the mechanism
    // the eye sees, from two live values.
    await knotEdit(true);
    await view("left");
    await settle();
    const render = ((await evaluate("window.__ctl.calqueInfo()")) as any).render;
    const plateOrder = render.plate?.renderOrder;
    const baseHandle = render.handles?.["Knots_left"];
    const contourLine = render.contour;
    ok(
      "AC13",
      "the base handles and the contour are transparent, like the plate",
      baseHandle?.transparent === true && contourLine?.transparent === true,
      { handle: baseHandle, contour: contourLine, plate: render.plate },
    );
    ok(
      "AC13",
      "the handles and the contour draw after the plate",
      baseHandle?.renderOrder > plateOrder && contourLine?.renderOrder > plateOrder,
      { plateOrder, handle: baseHandle?.renderOrder, contour: contourLine?.renderOrder },
    );
    ok("AC13", "the handles ignore depth", baseHandle?.depthTest === false, { handle: baseHandle });

    console.log("\ncheck_knot_selection  all assertions passed");
  } finally {
    await session.close();
  }
}

try {
  await run();
} catch (error) {
  console.error(`\ncheck_knot_selection  FAILED\n${String((error as Error)?.stack ?? error)}`);
  await session.close();
  process.exit(1);
}
