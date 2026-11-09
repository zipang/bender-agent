// The idle rule of the viewer, checked on the live page.
//
// The page draws on demand: `renderer.setAnimationLoop` runs only while a reason exists, and stops
// when none does. A headless browser has no vsync, so an unconditional loop rasterises the scene as
// fast as the software renderer allows -- nine cores of sixteen, for a still picture. This check is
// the TDD test of ticket T0007: it opens the viewer, waits for the first frame, and proves that the
// page sleeps, wakes on a real change, and sleeps again.
//
// It reads two counters through `__ctl.frames()`:
//
//   rendered  calls to `renderer.render`
//   ticks     invocations of the animation-loop callback
//
// `rendered` frozen alone would pass with a spinning loop; `ticks` frozen too is the proof that the
// loop stopped, not that its body returned early.
//
// Usage, from the repository root (the dev server must run on http://127.0.0.1:5180):
//
//   bun run workflows/threejs/tools/check_idle.ts
//
// It closes its own browser session on every exit path: success, failure, and Ctrl-C.

const SCENE = "r5-tl-1972";
const VIEWER_URL = `http://127.0.0.1:5180/?scene=${SCENE}`;
const SESSION = "idle-check";
const VIEWPORT = { width: 1400, height: 1000 };

// The idle window of the contract. Two reads a second apart must be equal.
const IDLE_MS = 1200;
// The pan's inertia tail is a fixed number of FRAMES (three.js damping), about fifty. At the
// software renderer's few frames per second that is several seconds of wall clock, where the
// contract's 2000 ms assumes 60 fps. The check polls to freeze with a bound that reflects the
// machine; the rule it proves -- the tail keeps the loop awake, then it sleeps -- is unchanged.
const TAIL_FREEZE_MS = 15000;

class CheckFailure extends Error {
  constructor(step: string, message: string, detail: unknown) {
    super(
      `assertion ${step} failed: ${message}` +
        (detail === undefined ? "" : `\n  ${JSON.stringify(detail)}`),
    );
    this.name = "CheckFailure";
  }
}

type Frames = { rendered: number; ticks: number };

// ------------------------------------------------------------------ agent-browser

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

async function evaluate(script: string): Promise<unknown> {
  const text = (await ab(["eval", script, "--session", SESSION])).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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

// ------------------------------------------------------------------ assertions

function ok(step: string, description: string, condition: boolean, detail?: unknown): void {
  if (!condition) throw new CheckFailure(step, description, detail);
  console.log(`  ok  ${step}  ${description}`);
}

async function frames(): Promise<Frames> {
  return (await evaluate("window.__ctl.frames()")) as Frames;
}

/** True when both counters are unchanged across a short window: the page is asleep. */
async function frozen(windowMs = 250): Promise<{ frozen: boolean; before: Frames; after: Frames }> {
  const before = await frames();
  await Bun.sleep(windowMs);
  const after = await frames();
  return { frozen: before.rendered === after.rendered && before.ticks === after.ticks, before, after };
}

/** Poll until both counters hold still, or the timeout passes. Returns the freeze and how long it took. */
async function waitFrozen(
  timeoutMs: number,
): Promise<{ frozen: boolean; ms: number; at: Frames }> {
  const start = Date.now();
  let last = await frames();
  while (Date.now() - start < timeoutMs) {
    await Bun.sleep(250);
    const now = await frames();
    if (now.rendered === last.rendered && now.ticks === last.ticks) {
      return { frozen: true, ms: Date.now() - start, at: now };
    }
    last = now;
  }
  return { frozen: false, ms: Date.now() - start, at: last };
}

// ------------------------------------------------------------------ run

let sessionOpen = false;

async function closeSession(): Promise<void> {
  if (!sessionOpen) return;
  sessionOpen = false;
  try {
    await ab(["close", "--session", SESSION]);
  } catch (error) {
    console.warn(`warning: could not close session ${SESSION}: ${String(error).slice(0, 160)}`);
  }
}

async function run(): Promise<void> {
  // The session closes on Ctrl-C too, not only on the normal paths. A leaked browser is nine cores.
  process.on("SIGINT", () => {
    void closeSession().finally(() => process.exit(130));
  });

  await ab(["open", VIEWER_URL, "--session", SESSION]);
  sessionOpen = true;
  await ab(["set", "viewport", String(VIEWPORT.width), String(VIEWPORT.height), "1", "--session", SESSION]);
  await waitForReady();

  // --- 1. it sleeps. Two reads a second apart are equal: nothing was drawn and the loop did not fire.
  const before1 = await frames();
  await Bun.sleep(IDLE_MS);
  const after1 = await frames();
  ok("1", "rendered is frozen while the page is untouched", after1.rendered === before1.rendered, {
    before: before1,
    after: after1,
  });
  ok("1", "ticks is frozen while the page is untouched", after1.ticks === before1.ticks, {
    before: before1,
    after: after1,
  });

  // --- 2. a view change wakes it, and it sleeps again.
  const before2 = await frames();
  await evaluate(`window.__ctl.view("left").then(() => true)`);
  const after2 = await frames();
  ok("2", "a view change advances rendered", after2.rendered > before2.rendered, {
    before: before2,
    after: after2,
  });
  ok("2", "a view change advances ticks", after2.ticks > before2.ticks, {
    before: before2,
    after: after2,
  });
  await Bun.sleep(IDLE_MS);
  const settled2 = await frozen();
  ok("2", "it freezes again after the view change", settled2.frozen, {
    before: settled2.before,
    after: settled2.after,
  });

  // --- 3. a pan wakes it, and the damping tail keeps it awake over several frames, then it sleeps.
  const before3 = await frames();
  await evaluate("window.__ctl.pan(40, 0)");
  await Bun.sleep(600);
  const mid3 = await frames();
  ok("3", "a pan advances the counters over several frames", mid3.ticks - before3.ticks >= 2, {
    before: before3,
    mid: mid3,
    ticks: mid3.ticks - before3.ticks,
  });
  const settled3 = await waitFrozen(TAIL_FREEZE_MS);
  ok("3", "the inertia tail finishes and it sleeps", settled3.frozen, settled3);

  // --- 4. a layer toggle wakes it, and it sleeps again.
  const before4 = await frames();
  await evaluate("window.__ctl.layers({ volume: false }).then(() => true)");
  const after4 = await frames();
  ok("4", "a layer toggle advances rendered", after4.rendered > before4.rendered, {
    before: before4,
    after: after4,
  });
  ok("4", "a layer toggle advances ticks", after4.ticks > before4.ticks, {
    before: before4,
    after: after4,
  });
  await Bun.sleep(IDLE_MS);
  const settled4 = await frozen();
  ok("4", "it freezes again after the layer toggle", settled4.frozen, {
    before: settled4.before,
    after: settled4.after,
  });

  // --- 5. nextFrame() still works from asleep: a caller that arrives while the page sleeps gets a
  // frame. The check proves the page is asleep first, then that `wait()` draws at least one frame.
  const asleep = await frozen();
  ok("5", "the page is asleep before wait()", asleep.frozen, { before: asleep.before, after: asleep.after });
  await evaluate("window.__ctl.wait().then(() => true)");
  const after5 = await frames();
  ok("5", "wait() draws at least one frame from asleep", after5.rendered - asleep.after.rendered >= 1, {
    before: asleep.after,
    after: after5,
  });

  console.log("\ncheck_idle  all assertions passed");
}

try {
  await run();
} catch (error) {
  console.error(`\ncheck_idle  FAILED\n${String((error as Error)?.stack ?? error)}`);
  await closeSession();
  process.exit(1);
}
await closeSession();
