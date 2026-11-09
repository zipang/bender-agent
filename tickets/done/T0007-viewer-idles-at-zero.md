# T0007 — The viewer idles at zero: draw on demand, not every frame

- **Track**: Three.js viewer (rendering loop)
- **Wave**: 1 (independent)
- **Owner**: coding sub-agent, supervised by the CTO
- **Started**: 2026-11-09
- **Depends on**: T0003 — it rewrote the same loop and owns `camera.js`
- **Blocks**: nothing
- **References**:
  - `workflows/threejs/viewer/stage.js` — `renderer.setAnimationLoop` at the "loop" section, and
    `nextFrame()`
  - `workflows/threejs/viewer/main.js` — the mutators that change what is on screen
  - `workflows/threejs/viewer/camera.js` — the two `OrbitControls` instances and `activeControls`
  - `workflows/threejs/tools/shot.ts` — the capture that must keep producing the same files
  - `workflows/threejs/AGENTS.md` — "Scene rules", "Evidence rules"
  - three.js `WebGLRenderer.setAnimationLoop`:
    <https://raw.githubusercontent.com/mrdoob/three.js/r187/docs/pages/WebGLRenderer.html.md>
  - three.js `OrbitControls`, the `change` event:
    <https://raw.githubusercontent.com/mrdoob/three.js/r187/docs/pages/OrbitControls.html.md>

## Context & Goal

The page renders **every frame, unconditionally**:

```js
renderer.setAnimationLoop(() => {
  rig.activeControls.update();
  renderer.render(scene, rig.activeCamera);   // no condition
  frames += 1;
  ...
});
```

A headless browser has no vsync, so `requestAnimationFrame` runs as fast as it can, and every turn
rasterises 51 300 triangles through software WebGL (`--use-angle=swiftshader-webgl`). Measured on
this machine on 2026-11-09, with the page open at `?scene=r5-tl-1972` and **nobody driving it**:

```text
chrome tree total CPU: 852%
chrome tree total CPU: 882%
chrome tree total CPU: 906%
```

That is **nine cores of sixteen, for doing nothing**, and it does not stop.

Three consequences, all observed:

- **The machine stops answering.** Every headless run pegs the box for its whole duration.
- **A browser session that outlives its run is a permanent 9-core fire.** One leaked session was
  found still burning `1063 %` in a single `gpu-process` four minutes after its `check_zoom.ts` was
  interrupted. It is not ten sessions that the art director saw; it is one Chrome tree of thirteen
  processes, all of them fed by this loop.
- **Every measurement taken under a leak is wrong.** The same guard image timed at 42.7 s under a
  leaked session and 17.6 s without it.

**Done means**: with the page open and untouched, the renderer draws **nothing**. No rendered frame,
no animation-loop tick, and the browser tree costs a fraction of one core. Any action that changes
the picture draws again — a camera move, a wheel, a pan, a layer toggle, a view change, a knot edit, a
resize — and the page goes back to sleep as soon as the motion stops, including after an inertia
tail. **The pixels are identical for the same state.**

## Scope Boundary

May be created or modified:

- `workflows/threejs/viewer/stage.js` — the loop, the frame counters, `nextFrame()`
- `workflows/threejs/viewer/main.js` — the mutators that must ask for a frame
- `workflows/threejs/viewer/camera.js` — only if the rig must expose the active instance's `change`
- `workflows/threejs/tools/check_idle.ts` (new) — the headless gate
- `workflows/threejs/README.md` — the viewer section
- `workflows/threejs/AGENTS.md` — "Scene rules"
- `tickets/README.md` — the board

Do **not** touch:

- **What is drawn.** No camera, no material, no layer, no HUD, no scene change. This ticket changes
  *when* the renderer is called, never *what* it draws.
- `workflows/threejs/viewer/knots.js`, `volume.js`, `path.js`, `plate.js`, `calque.js`, `picker.js`,
  `measure.js`, `views.json`, `index.html`.
- `workflows/threejs/scenes/**`, `blueprints/**`.
- `workflows/threejs/tools/check.ts`, `check_zoom.ts`, `shot.ts`, `silhouette.ts`, and every gate
  threshold. They are the witnesses, not the patient.
- The `SHARED` control table and the `mouseButtons` mapping that T0003 fixed.

## Contract

### The loop draws only when there is a reason

`renderer.setAnimationLoop(tick)` is the only clock the page has, and it stays the only one. `tick`
renders when, and only when, a reason exists:

```text
reason  =  dirty  ||  waiters.length > 0
```

- **`dirty`** is set by every call that changes what is on screen: `nextFrame()`, `resize`,
  `setRoot`, the layer toggles, `applyEdit`, `rebuildVolume`, `setView` / `placeCamera`,
  `calque.set`, and the `ctl` surface that reaches `stage` (`wireframe`, `isolate`, `exposure`,
  `shadows`, `background`, `grid`, `ground`).
- **`dirty` is also set by the documented `change` event of the active `OrbitControls`.** That event
  fires when a gesture moves the camera, and it fires again on every frame while `enableDamping`
  decays the inertia. So an inertia tail keeps the loop awake by itself, and the loop falls asleep
  on its own when the camera stops. This is the whole reason the loop cannot simply be stopped at
  the end of a gesture.
- When the active instance changes — the flat/perspective swap in `applyCamera()` — the `change`
  listener moves to the new one, and the old one stops driving frames.

### Idle means stopped, not skipped

An early `return` from `tick` would stop the drawing but leave `requestAnimationFrame` spinning. The
loop must **stop**: `renderer.setAnimationLoop(null)` when there is no reason, and re-arm from
whatever set `dirty`. The check proves the difference with the tick counter below, and the art
director proves it with `ps`.

### Two counters, so the check can see the difference

`stage` exposes both, and `__ctl.frames()` returns them:

```js
__ctl.frames()  // -> { rendered, ticks }
```

- `rendered` counts calls to `renderer.render`. It replaces today's internal `frames` counter and
  keeps its role for `onSecondFrame`.
- `ticks` counts invocations of the animation-loop callback.

The check reads both. `rendered` frozen alone would pass with a spinning loop; `ticks` frozen too is
the proof that the loop stopped.

### `nextFrame()` keeps its meaning

`nextFrame()` still resolves **after a frame that includes the requested change has been drawn**. It
sets `dirty` and re-arms the loop before it registers its waiter, so a caller that arrives while the
page is asleep still gets a frame. Every headless check in the repository depends on this, and so
does `shot.ts`: it calls `__setView(...)` and then screenshots.

`onSecondFrame` keeps its current meaning: the first frame after start-up.

### The gate

`tools/check_idle.ts` opens `?scene=r5-tl-1972`, waits for ready, and asserts:

1. **It sleeps.** Read `__ctl.frames()`; wait 1200 ms; read it again. Both `rendered` and `ticks`
   are **equal** — the page drew nothing and the loop did not fire.
2. **A view change wakes it.** `__ctl.view("left")` advances both counters, and both freeze again
   within 1200 ms.
3. **A pan wakes it, and its inertia tail keeps it awake.** `__ctl.pan(40, 0)` advances the counters
   over several frames — not one — and they freeze within 2000 ms, which is the damping tail
   finishing.
4. **A layer toggle wakes it.** `__ctl.layers({ volume: false })` advances both, then freezes.
5. **`nextFrame()` still works from asleep.** With the counters frozen, `__ctl.wait()` resolves, and
   `rendered` advanced by at least one.
6. **The images are the same.** Capture the six flat views with `shot.ts` before and after the change
   and compare the WebP files **byte for byte**. If the encoder turns out not to be bit-reproducible,
   compare the silhouette masks instead and require an IoU of exactly `1.000` on every view; report
   which of the two proofs was used and why.
7. **The machine is free.** The check records, in `## Implementation Notes`, the peak CPU of the
   Chrome tree while the page sits idle — measured with `ps` over ten seconds — and it must be under
   **2 % of one core**, against roughly nine cores before.

The check closes its own browser session on every exit path, including a failure and a `Ctrl-C`.

## TDD Tasks

- [x] **T7.1 — The gate, written first**: write `tools/check_idle.ts` against the contract. Run it
      against the current page and prove it fails on assertion 1 — the counters grow while nobody is
      touching the page. Record the idle CPU it measures, which is the number this ticket removes.
- [x] **T7.2 — The counters**: expose `rendered` and `ticks` through `stage` and `__ctl.frames()`
      without changing the loop yet. Assertion 1 must still fail, now showing that `ticks` grows.
- [x] **T7.3 — The loop**: the `dirty` flag, the `change` subscription that follows the active
      instance, the stop and re-arm, and `nextFrame()` re-arming from asleep. Run the check until it
      exits 0.
- [x] **T7.4 — Visual equivalence**: capture the six flat views before and after, and record the
      proof — byte hashes or per-view IoU. Any pixel difference is a failure, not a tolerance.
- [x] **T7.5 — Gates**: `bun test workflows/threejs/viewer` green; `tools/check_idle.ts` exits 0;
      `check_zoom.ts` exits 0 — it drives the page through `__ctl` and will catch a loop that stopped
      too eagerly; `bun run check` reports the same numbers as T0006's baseline.
- [x] **T7.6 — Documents**: the viewer section of `workflows/threejs/README.md` states the idle
      rule; `workflows/threejs/AGENTS.md` "Scene rules" gains it as a rule; the board.

## Acceptance Criteria

1. With the page open and untouched, `__ctl.frames()` reports the same `rendered` and the same
   `ticks` a second apart, and the Chrome tree costs under 2 % of one core.
2. A camera move, a wheel, a pan, a layer toggle, a view change, a knot edit, a window resize, and
   `__ctl.wait()` each make the page draw again.
3. An inertia tail keeps the page drawing until the camera stops, and then it sleeps.
4. The images are identical to the ones the same states produced before this ticket, proved by
   hashes or by an IoU of exactly 1.000.
5. `bun test` is green, `tools/check_idle.ts` exits 0, `tools/check_zoom.ts` exits 0, and
   `bun run check` reports the same numbers as before.
6. No browser session is left behind, on success or on failure.

## Implementation Notes

### Files changed

- `workflows/threejs/viewer/stage.js` — the loop. `rendered` (was `frames`) and `ticks` counters;
  `dirty`; `requestFrame()` (set `dirty`, arm the loop); `tick()` (stop, do not skip, via
  `renderer.setAnimationLoop(null)`); `nextFrame()` sets `dirty` and re-arms **before** it registers
  its waiter; `setRoot`, `resize` and the `ctl` surface ask for a frame; `bindRig(rig)` subscribes to
  the active controls' `change` event; `frames()` returns `{ rendered, ticks }`.
- `workflows/threejs/viewer/camera.js` — `onChange(listener)` subscribes to the **active** instance's
  `change` event; `rebindChange()` moves the listener across the flat/perspective swap in
  `applyCamera()`. This is the only change to the rig, and it exists because the loop must follow the
  active instance (the ticket's own "only if the rig must expose the active instance's change event").
- `workflows/threejs/viewer/main.js` — `stage.bindRig(rig)` after the rig is built; `__ctl.frames()`;
  the calque `onChange` and `rebuildVolume()` ask for a frame (a plate can arrive asynchronously, and
  a volume rebuild after a knot-drag release changes the picture).
- `workflows/threejs/tools/check_idle.ts` (new) — the gate.
- `workflows/threejs/README.md` §7.3, `workflows/threejs/AGENTS.md` "Scene rules" — the idle rule.

### Decisions

- **Clear `dirty` before the controls are updated, not after.** A gesture's inertia tail fires
  `change` *during* `update()`. Clearing `dirty` after the update ate that signal and stopped the
  loop one frame early (observed: a pan advanced exactly one tick). Clearing before it lets the
  in-frame `change` schedule the next frame, so the tail keeps the loop awake on its own.
- **`hasReason()` also includes `rendered < 2`.** `onSecondFrame` fires on the second render, so the
  loop must draw two frames at start-up before it may stop.
- **The calque `onChange` asks for a frame.** `calque.js` is out of scope; its `onChange` is a
  `main.js` callback, and the plate can be added to the scene after an awaited texture load. Without
  the request the plate could land undrawn.
- **The pan gesture drives the flat instance.** `__ctl.pan` uses `rig.panBy` -> `flat.pan`/`flat.update`,
  so it wakes the loop only on a flat view (where `flat` is the active instance). On a perspective
  view it moves the hidden orthographic camera, which is pre-existing behaviour and unchanged.

### Deviation from the contract

- Assertion 3 says the pan's inertia tail "freezes within 2000 ms". The tail is a fixed number of
  **frames** (three.js `enableDamping`, `dampingFactor 0.08`): about 34 ticks were measured, i.e.
  ~5.4 s at the software renderer's ~6 frames per second. The 2000 ms bound assumes ~60 fps. The
  check polls to freeze with a bound that reflects the machine (`TAIL_FREEZE_MS = 15000`); the rule it
  proves is unchanged — the tail keeps the loop awake over several frames, then the loop sleeps. The
  camera damping is **not** touched (Camera rules).

### Idle CPU, measured with `ps` over ten seconds (`/proc/<pid>/stat` jiffies, all agent-browser
chrome processes summed)

- **Before** (HEAD loop, unconditional): **1061.5 %** — 10.61 cores of 16.
- **After** (this ticket): **0.1 %** — 0.00 cores of 16. `__ctl.frames()` read `{rendered:2, ticks:2}`
  before and after the ten seconds.

### T7.1 — the gate fails first

`check_idle.ts` written before the loop changed. Against the current page it failed at the first
thing it read:

```text
check_idle  FAILED
Error: agent-browser eval failed (1): ✗ Evaluation error: TypeError: window.__ctl.frames is not a function
    at async frames (.../check_idle.ts:93:17)
    at async run (.../check_idle.ts:134:25)
EXIT=1
```

### T7.2 — the counters alone still fail on assertion 1

With `rendered`/`ticks` exposed but the loop unchanged:

```text
check_idle  FAILED
CheckFailure: assertion 1 failed: rendered is frozen while the page is untouched
  {"before":{"rendered":3,"ticks":3},"after":{"rendered":7,"ticks":7}}
EXIT=1
```

`ticks` grows with `rendered`: the loop is running, and nothing is touching the page.

### T7.4 — visual equivalence (byte-for-byte WebP)

Captured the six flat views (`left,right,front,back,top,bottom`) with `shot.ts`, before (HEAD files)
and after (this ticket), both at `?scene=r5-tl-1972`, 1400x1000, quality 92. The encoder is
bit-reproducible here, so the byte proof was used and the silhouette IoU was not needed. `cmp` and
`sha256sum` agree on all six:

```text
left    IDENTICAL  716be67a62929110070628385d56d9c083e4302710ead945567089c6e3d939b2
right   IDENTICAL  f15313a677ee4f2678b689483c5358629bc15e33634df5f16c246054040bdfbe
front   IDENTICAL  20e3875bb8484392f1780be010ed2cc330a27ee7f305a6c2b1b532471b4700be
back    IDENTICAL  b10b5cfe9e99abbf3ac76e8086c350f1babe5bcaf02466d4d5a030bc4e4fe6d1
top     IDENTICAL  9d57fea6961fa8263e666c1d4a3cdc14abb52e80cc0399266464e20536d2cd34
bottom  IDENTICAL  d7744cd54fb2c0301e22235bca482b7ea3353b3e7c2e64708640ff5c21930eb7
```

### Gates (exact commands and results)

`bun run workflows/threejs/tools/check_idle.ts` — exit 0:

```text
  ok  1  rendered is frozen while the page is untouched
  ok  1  ticks is frozen while the page is untouched
  ok  2  a view change advances rendered
  ok  2  a view change advances ticks
  ok  2  it freezes again after the view change
  ok  3  a pan advances the counters over several frames
  ok  3  the inertia tail finishes and it sleeps
  ok  4  a layer toggle advances rendered
  ok  4  a layer toggle advances ticks
  ok  4  it freezes again after the layer toggle
  ok  5  the page is asleep before wait()
  ok  5  wait() draws at least one frame from asleep

check_idle  all assertions passed
EXIT=0
```

`bun run workflows/threejs/tools/check_zoom.ts` — exit 0, `check_zoom  all assertions passed`.

`bun test workflows/threejs/viewer` — exit 0:

```text
30 pass
0 fail
46 expect() calls
Ran 30 tests across 3 files.
```

`bun run check` — exit 0, `status NEEDS WORK`, `worst -85 mm at 2112 mm from the nose (tolerance 40 mm)`
— the same numbers as the T0006 baseline.

### Housekeeping

No browser session is left behind: `agent-browser session list` reports `No active sessions` after
every run above, including the failed T7.1/T7.2 runs (the check closes its own session in a `finally`
and on `SIGINT`).

The board (`tickets/README.md`) needed no change: T0007 is already listed under "In progress", and a
ticket is not moved by the sub-agent.

## CTO audit, 2026-11-09

The independent peer review is **deferred by the art director's instruction** — reviews are batched at
the end of the series. What was checked here, by the CTO and not by the coder:

- **Scope.** Only `viewer/stage.js`, `viewer/camera.js`, `viewer/main.js`, `tools/check_idle.ts` (new),
  the two workflow documents, and the board. Nothing else.
- **The idle cost, measured independently** with the CTO's own `/proc/<pid>/stat` sampler, on the
  Chrome tree of a session opened by hand: **0,20 % of one core over a 10 s window**, against
  `852 %`, `882 %`, `906 %` before. `__ctl.frames()` read `{"rendered":2,"ticks":2}` before and after
  the window — frozen.
- **The loop.** `dirty` is cleared **before** `rig.activeControls.update()`, which is what keeps the
  damping tail alive: `update()` fires `change` during the decay, and clearing afterwards ate the
  signal and stopped one frame early. The subscription follows the active instance through
  `rebindChange()` on the flat/perspective swap, so only the current camera drives frames. The loop
  stops with `setAnimationLoop(null)` rather than returning early, which is the difference between
  `ticks` frozen and `ticks` growing.
- **The gate is not a rubber stamp.** `check_idle.ts` asserts both counters, the four wake-ups, and
  `nextFrame()` from asleep; it closes its session on success, on failure, and on `SIGINT`. It was
  proven to fail first: T7.1 and T7.2 both exit 1 on assertion 1.
- **Visual equivalence.** Six flat views, `sha256sum` identical byte for byte. The WebP encoder is
  bit-reproducible here, so the IoU fallback was not needed.
- **Gates.** `bun test workflows/threejs/viewer` → 30 pass, 0 fail. `check_idle.ts` → exit 0.
  `check_zoom.ts` → exit 0. `bun run check` → exit 0, `height -85.9 mm`, `worst -85 mm at 2112 mm`,
  `status NEEDS WORK` — identical to the T0003 baseline.
- **`bun run check` fell from 1 min 54 s to 45.6 s** with this ticket alone, because the capture no
  longer burns nine cores while it renders. T0006 still holds the other 79 s, in the orientation
  guard.
- **One documented deviation.** Assertion 3 of the contract asked for the inertia tail to freeze
  within 2000 ms. The tail is a fixed number of frames (~34 at `dampingFactor 0.08`), which is about
  5.4 s at the software renderer's ~6 fps; the 2000 ms assumed 60 fps. The check polls to freeze with
  a 15 s bound. The camera damping was not touched, and the rule the assertion proves is unchanged.

