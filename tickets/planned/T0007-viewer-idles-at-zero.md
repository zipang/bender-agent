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

- [ ] **T7.1 — The gate, written first**: write `tools/check_idle.ts` against the contract. Run it
      against the current page and prove it fails on assertion 1 — the counters grow while nobody is
      touching the page. Record the idle CPU it measures, which is the number this ticket removes.
- [ ] **T7.2 — The counters**: expose `rendered` and `ticks` through `stage` and `__ctl.frames()`
      without changing the loop yet. Assertion 1 must still fail, now showing that `ticks` grows.
- [ ] **T7.3 — The loop**: the `dirty` flag, the `change` subscription that follows the active
      instance, the stop and re-arm, and `nextFrame()` re-arming from asleep. Run the check until it
      exits 0.
- [ ] **T7.4 — Visual equivalence**: capture the six flat views before and after, and record the
      proof — byte hashes or per-view IoU. Any pixel difference is a failure, not a tolerance.
- [ ] **T7.5 — Gates**: `bun test workflows/threejs/viewer` green; `tools/check_idle.ts` exits 0;
      `check_zoom.ts` exits 0 — it drives the page through `__ctl` and will catch a loop that stopped
      too eagerly; `bun run check` reports the same numbers as T0006's baseline.
- [ ] **T7.6 — Documents**: the viewer section of `workflows/threejs/README.md` states the idle
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
