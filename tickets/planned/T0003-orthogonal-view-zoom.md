# T0003 — Zoom on the orthogonal views

- **Track**: Three.js viewer (camera and interaction)
- **Wave**: 1 (independent)
- **Depends on**: T0002 (the knot editor defines what the zoom must serve)
- **Blocks**: the knot-editor usability ticket, which is not created yet
- **References**:
  - `workflows/threejs/viewer/camera.js` — the rig: two cameras, one state
  - `workflows/threejs/viewer/measure.js` — `mmPerScreenPx()`
  - `workflows/threejs/AGENTS.md` — "Camera rules", "Knot rules"
  - `workflows/threejs/README.md` §7 — the viewer
  - `tickets/done/T0002-contour-smoothing.md` §6.8 — the knot editor, and why it is hard to use
  - three.js `OrthographicCamera`, `.zoom` and `.updateProjectionMatrix()`:
    <https://threejs.org/docs/#api/en/cameras/OrthographicCamera>
  - three.js `OrbitControls`, `.enableRotate` and `.enablePan`:
    <https://threejs.org/docs/#examples/en/controls/OrbitControls>

## Context & Goal

The knot editor works. The art director can reduce, add, remove, and move the points of a contour,
and the volume rebuilds from them. It is hard to use, and one reason is mechanical: an orthogonal
view has no zoom. The subject fills the frame at one fixed scale, a handle is nine screen pixels, and
the outline of a wing mirror is smaller than the cursor. The only way to see a detail is to resize
the browser window.

The perspective views already zoom: `OrbitControls` dollies the perspective camera on the wheel. The
orthogonal views do not, because the rig disables `OrbitControls` on them.

**Done means**: on any flat view (`left`, `right`, `front`, `back`, `top`, `bottom`), the mouse wheel
moves the view between **100 % and 400 %**, the wheel zooms on the point under the cursor, a drag
moves the view, and the reference plate, the contour line, the knot handles, and the picker stay
together at every zoom. A named view and a capture are still exactly the frame of today.

## Scope Boundary

May be created or modified:

- `workflows/threejs/viewer/camera.js`
- `workflows/threejs/viewer/measure.js`
- `workflows/threejs/viewer/picker.js`
- `workflows/threejs/viewer/stage.js`
- `workflows/threejs/viewer/main.js`
- `workflows/threejs/viewer/index.html`
- `workflows/threejs/tools/ctl.ts`
- `workflows/threejs/tools/shot.ts`
- `workflows/threejs/tools/check_zoom.ts` (new)
- `workflows/threejs/README.md`
- `workflows/threejs/AGENTS.md`
- `tickets/README.md`

Do **not** touch:

- `workflows/threejs/scenes/**` — no scene, no model, no contour changes.
- `workflows/threejs/viewer/views.json` — the view table is not a zoom setting.
- `workflows/threejs/tools/trace_hull.py`, `compare_silhouette.py` — the comparison already derives
  its scale from the subject box, and a capture is always at 100 %.
- `workflows/threejs/tools/check.ts` and its thresholds.
- The perspective camera behavior. Its zoom stays `OrbitControls`.
- `blueprints/**`.
- The knot editing gestures. This ticket changes the scale they work at, not what they do.

## Contract

### One state, one zoom

`state.zoom` is a **factor**, `1` to `4`, default `1`. It is the only source of zoom in the page.

`state.orthoHeight` keeps its current meaning: the height of the **100 %** frame, in metres. It is
the denormalized anchor that makes "100 %" reproducible.

```text
visibleHeight  = state.orthoHeight / state.zoom          (metres, at 100 % times 1/zoom)
mmPerScreenPx  = visibleHeight * 1000 / window.innerHeight
```

`frameOrtho()` sets the frustum planes from `state.orthoHeight` **without dividing them**, writes
`ortho.zoom = state.zoom`, and then calls `ortho.updateProjectionMatrix()`.

Documented surface this relies on (three.js r187, `docs/pages/OrthographicCamera.html.md`):

| Member | Documented meaning |
| :--- | :--- |
| `.zoom : number` | "The zoom factor of the camera." Default `1`. |
| `.updateProjectionMatrix()` | "Updates the camera's projection matrix. Must be called after any change of camera properties." |
| `new OrthographicCamera(left, right, top, bottom, near, far)` | The six frustum planes, as today. |

The built-in `zoom` is used rather than a divided frustum because it is the documented field for
exactly this, and because it keeps `left`, `right`, `top`, and `bottom` equal to the 100 % frame at
every zoom. One writer, one field: `frameOrtho()`.

`OrbitControls` stays **disabled** on the flat views (`controls.enabled = false`), as today. It would
bring orbit with it, and an elevation seen twenty degrees off its axis is a picture of a car that is
not there. Zoom and pan are written here, in the rig, so that `matchingView()` — which masks a plate
by **axis**, not by zoom — cannot be invalidated by a zoom.

### Rig API

```js
zoomPercent()                    // integer, 100..400
setZoom(percent, anchor)         // anchor: {x, y} in NDC, or null. Returns zoomPercent()
panBy(dxPx, dyPx)                // screen pixels. Moves the target in the view plane
resetFraming()                   // zoom = 1, target = frame.target, then frameOrtho()
```

`setZoom` clamps the **float** percent to `[100, 400]` before it divides by 100, so a wheel that
overshoots lands exactly on the limit and a zoom back to the limit does not jitter. It rounds only
for display.

**Cursor-anchored zoom.** With `anchor = {x, y}` in NDC and `ratio = newZoom / oldZoom`, the target
moves so that the world point under the cursor does not move on screen. With `B = viewBasis(views, …)`
of the current view:

```text
halfHeight = visibleHeight / 2
halfWidth  = halfHeight * aspect
target    += B.right * (anchor.x * halfWidth)  * (1 - 1/ratio)
           + B.up    * (anchor.y * halfHeight) * (1 - 1/ratio)
```

The point is anchored in the plane through the target. For an orthographic camera this is exact at
any depth, because an orthographic projection does not depend on the distance along the view
direction.

**Pan.** `panBy(dxPx, dyPx)` moves the target by the drag, at the current scale:

```text
scale   = mmPerScreenPx() / 1000                    (metres per screen pixel)
target -= B.right * (dxPx * scale)
target += B.up    * (dyPx * scale)                  (screen y is down, world up is up)
```

A pan and a zoom are **not** a manual orbit. Neither calls `onManual`, and neither changes
`currentView`: the page still shows `left`. Only a drag of the perspective controls makes a view
`custom`.

**A named view is the canonical frame.** `placeCamera(name)` calls `resetFraming()` before it applies
the preset, and `reset()` does the same. So `view(left)` always means 100 %, centred on
`frame.target`, whatever the pointer did before. This is what keeps a capture reproducible and
`bun run check` comparable.

### Input

`camera.js` registers one wheel listener on `element`, with `{ passive: false }`:

```text
if (state.perspective) return                   // the perspective views keep OrbitControls
event.preventDefault()
deltaPx = event.deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? window.innerHeight : 1)
percent = state.zoom * 100 * Math.pow(1.1, -deltaPx / 100)
setZoom(percent, anchorFrom(event, element))
```

One wheel notch (`|deltaY| = 100`) is a factor `1.1`, so the gesture is exponential and feels the
same at 100 % and at 400 %. A continuous trackpad scroll produces continuous zoom.

Pan takes the **middle button** always, and the **left button** when the knot editor is not active.
`state.panWithLeft` carries that: `main.js` sets it to `!editor.active` on every edit-mode change. The
left drag of the knot editor is never stolen, and a middle drag always works, editing or not.

### Display

`#hud` gains one row, after `size`:

```html
<dt>zoom</dt><dd id="hud-zoom">—</dd>
```

`stage.updateHud(name)` writes `zoomPercent() + " %"` when the active camera is the orthographic one,
and `—` on a perspective view. The wheel and the pan call `stage.updateHud(currentView)` after the
change, so the number is live.

### Script and command surface

```js
__ctl.zoom()          // { percent, applied, mmPerPx, visibleHeight }
__ctl.zoom(200)       // set, clamped; applied: false on a perspective view
__ctl.pan(12, -8)     // screen pixels; returns { target: [x, y, z], percent }
__ctl.state()         // gains zoomPercent
```

`__stats()` and the capture sidecar gain `zoom` (the factor). `orthoHeight` stays the 100 % frame
height, so a reader can compute the visible height at any zoom.

`ctl.ts` gains one command:

```bash
bun run workflows/threejs/tools/ctl.ts zoom                  # report
bun run workflows/threejs/tools/ctl.ts zoom --percent 250
bun run workflows/threejs/tools/ctl.ts zoom --reset
```

**A capture is always at 100 %.** `ctl.ts shot` and `shot.ts` call `window.__ctl.zoom(100)` before
the screenshot, after the optional `--view`. A capture that inherits a hand-set zoom could clip the
subject, and a clipped subject silently corrupts the scale that `compare_silhouette.py` derives from
its bounding box. The sidecar records `zoom: 1`, which is the proof.

## TDD Tasks

This repository has no unit-test runner. The failing test is a **deterministic page check**: a new,
headless tool that opens the page, asserts through `__ctl`, and exits non-zero on the first failure.
It runs before the feature exists and must fail for the right reason.

- [ ] **T3.1 — The check, written first**: `tools/check_zoom.ts` opens `?scene=r5-tl-1972`, waits
      for ready, and asserts:
      1. On `left`: `percent` is 100, and `mmPerPx` equals `orthoHeight * 1000 / innerHeight`.
      2. `zoom(200)`: `mmPerPx` is exactly half to 1e-9, `percent` is 200.
      3. `zoom(400)`: a quarter. `zoom(500)` stays 400. `zoom(50)` stays 100.
      4. Cursor anchoring: the plate point at NDC `(0.5, 0.5)` is the same before and after
         `zoom(250)` within 0.5 mm, and the point at `(-0.5, -0.5)` is not the same.
      5. `view("top")` then `view("left")` after a pan: `percent` is 100 and the target is
         `frame.target` again.
      6. A zoom leaves `state().view` equal to `left`.
      7. On `front-3q`: `zoom(200)` returns `applied: false` and the percent stays 100.
      8. From 100 % on `left`, one wheel event with `deltaY = -100` on the canvas raises the percent
         to 110 ± 1.
      9. The `#hud-zoom` text is `110 %` on a flat view and `—` on a perspective view.
      10. `zoom(400)`, then `__stats()` reports `zoom: 1` after a capture prepared by `shot`.
- [ ] **T3.2 — The instrument, failing**: `tools/ctl.ts zoom` and `__ctl.zoom` / `__ctl.pan` exist
      and report. Until T3.3 they return the 100 % value on a flat view and the check fails on
      assertion 2.
- [ ] **T3.3 — Implementation**: `state.zoom`, `frameOrtho()` writing `ortho.zoom`, `setZoom`,
      `panBy`, `resetFraming`, the wheel listener, the middle and left pan, `visibleHeight` and
      `mmPerScreenPx` with `zoom`, the HUD row, `__ctl`, `ctl.ts zoom`, and the 100 % capture rule in
      `ctl.ts shot` and `shot.ts`.
- [ ] **T3.4 — Gates**: `bun run tools/check_zoom.ts` exits 0; `bun run check` produces the same IoU
      and the same worst deviation as before the ticket; a rendered trio at 100 %, 200 %, and 400 %
      on `left` shows the plate, the contour, and the handles at the same place.

## Acceptance Criteria

1. On each of `left`, `right`, `front`, `back`, `top`, `bottom`, the wheel moves the view from 100 %
   to 400 % and back, and stops exactly at both ends.
2. At 200 %, one screen pixel covers half the millimetres it covers at 100 %; at 400 %, a quarter.
   The HUD shows the percentage, and the picker panel shows the matching millimetres per pixel.
3. The detail under the cursor stays under the cursor while the wheel turns.
4. A middle drag moves the view; a left drag panning is disabled while the knot editor is active, and
   the knot gestures keep working unchanged.
5. The plate, the contour line, and the knot handles keep their alignment at every zoom, and the
   ten-screen-pixel grab threshold follows the zoom, so a handle stays as easy to grab at 400 % as at
   100 %.
6. `view(name)` and a capture are always 100 % and centred. A capture taken after a hand zoom is
   identical to the capture taken before it, and its sidecar says `zoom: 1`.
7. `bun run check` reports the same numbers as before the ticket.
