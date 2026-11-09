# T0003 — Zoom on the orthogonal views

- **Track**: Three.js viewer (camera and interaction)
- **Wave**: 1 (independent)
- **Depends on**: T0002 (the knot editor defines what the zoom must serve)
- **Blocks**: the knot-editor usability ticket, which is not created yet
- **References**:
  - `workflows/threejs/viewer/camera.js` — the rig: two cameras, one `OrbitControls`, one state
  - `workflows/threejs/viewer/measure.js` — `mmPerScreenPx()`
  - `workflows/threejs/AGENTS.md` — "Camera rules", "Knot rules"
  - `workflows/threejs/README.md` §7 — the viewer
  - `tickets/done/T0002-contour-smoothing.md` §6.8 — the knot editor, and why it is hard to use
  - three.js `OrthographicCamera`, `.zoom` and `.updateProjectionMatrix()`:
    <https://threejs.org/docs/#api/en/cameras/OrthographicCamera>
    (source of record: <https://raw.githubusercontent.com/mrdoob/three.js/r187/docs/pages/OrthographicCamera.html.md>)
  - three.js `OrbitControls`, `.zoomToCursor`, `.minZoom`, `.maxZoom`, `.mouseButtons`, `.pan()`,
    `.dollyIn()`, `.dollyOut()`:
    <https://threejs.org/docs/#examples/en/controls/OrbitControls>
    (source of record: <https://raw.githubusercontent.com/mrdoob/three.js/r187/docs/pages/OrbitControls.html.md>)
  - three.js `Controls`, `.enabled`:
    <https://raw.githubusercontent.com/mrdoob/three.js/r187/docs/pages/Controls.html.md>

## Context & Goal

The knot editor works. The art director can reduce, add, remove, and move the points of a contour,
and the volume rebuilds from them. It is hard to use, and one reason is mechanical: an orthogonal
view has no zoom. The subject fills the frame at one fixed scale, a handle is nine screen pixels, and
the outline of a wing mirror is smaller than the cursor. The only way to see a detail is to resize
the browser window.

The perspective views already zoom and pan, through `OrbitControls`. The orthogonal views do not,
because the rig disables the one `OrbitControls` instance on them (`camera.js`:
`controls.enabled = Boolean(state.perspective)`).

**Done means**: on any flat view (`left`, `right`, `front`, `back`, `top`, `bottom`), the mouse wheel
moves the view between **100 % and 400 %**, the wheel zooms on the point under the cursor, a drag
moves the view, and the reference plate, the contour line, the knot handles, and the picker stay
together at every zoom. **The gesture is the one the free views already have**: same wheel, same
ratio per notch, same inertia, same drag-to-move. A named view and a capture are still exactly the
frame of today.

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
- `blueprints/**`.
- The knot editing gestures. This ticket changes the scale they work at, not what they do.
- **The perspective camera configuration**: `minDistance`, `maxDistance`, `maxPolarAngle`,
  `dampingFactor`, `mouseButtons.LEFT` stay as they are. A ticket about the flat views does not get
  to change how the free views feel.

## Contract

### Rule one: no second zoom

The wheel zoom, the ratio per notch, the cursor anchoring, the clamp at both ends, and the drag to
move are **`OrbitControls`' own**, on a second instance bound to the orthographic camera. They are
not re-implemented, not even partially: no `wheel` listener in the rig, no clamp arithmetic, no
cursor-anchoring formula, no pan vector math.

This is the correction of a first draft that hand-wrote all of it. The two implementations would have
drifted, and the art director would have had two zoom feels for one page.

### Two instances, one configuration

`OrbitControls` takes the camera in its constructor, and the docs name no supported way to re-target
it (`new OrbitControls(object, domElement)`). So the rig holds **two** instances on the same canvas:

| Instance | Camera | Used when |
| :--- | :--- | :--- |
| `orbit` (exists) | perspective | `state.perspective === true` |
| `flat` (new) | orthographic | `state.perspective === false` |

`enabled` is the documented switch — "Whether the controls responds to user input or not." Exactly
one instance is enabled at a time; `applyCamera()` does the swap.

Shared settings, written on both, so parity is stated rather than inherited by chance:

```js
for (const c of [orbit, flat]) {
  c.enableDamping = true;
  c.dampingFactor = 0.08;   // the value the perspective view already uses
  c.zoomSpeed = 1;          // default; written so the two cannot diverge silently
}
```

`orbit` keeps its current limits: `minDistance = 3`, `maxDistance = 24`, `maxPolarAngle = π/2`.

`flat` is configured like this, every field from the documented surface:

| Setting | Value | Why |
| :--- | :--- | :--- |
| `enableRotate` | `false` | "Enable or disable horizontal and vertical rotation of the camera." An elevation seen twenty degrees off its axis is a picture of a car that is not there. |
| `enablePan` | `true` (default) | The drag that moves the view. |
| `enableZoom` | `true` (default) | "Enable or disable zooming (dollying) of the camera." |
| `zoomToCursor` | `true` | "allows to zoom to the cursor's position." Default `false`; the art director asked for the point under the cursor. |
| `minZoom` | `1` | "How far you can zoom in (orthographic camera only)." This is the 100 % floor. |
| `maxZoom` | `4` | "How far you can zoom out (orthographic camera only)." This is the 400 % ceiling. |
| `screenSpacePanning` | `true` (default) | The drag moves the view in the screen plane. |
| `mouseButtons.MIDDLE` | `THREE.MOUSE.PAN` | A middle drag always moves the view, editing or not. |
| `mouseButtons.RIGHT` | `THREE.MOUSE.PAN` (default) | Unchanged. |
| `mouseButtons.LEFT` | `THREE.MOUSE.PAN` when the knot editor is off, `THREE.MOUSE.ROTATE` when it is on | With `enableRotate = false`, `ROTATE` is inert, so the editor owns the left drag and the camera does not move under it. `ROTATE` is the documented mapping; no undocumented `null` action is used. |

### `state.zoom` is a mirror, not a second source

`OrthographicCamera.zoom` — "The zoom factor of the camera", default `1` — is the value
`OrbitControls` writes, and it is the only stored zoom. `state.zoom` mirrors it, updated from the
`change` event, so the rest of the page (HUD, `__ctl`, the picker) reads one number:

```js
flat.addEventListener("change", () => {
  state.zoom = ortho.zoom;
  state.target.copy(flat.target);   // a pan moves the target, and `state` must see it
});
```

`state.orthoHeight` keeps its current meaning: the height of the **100 %** frame, in metres.

```text
visibleHeight = state.orthoHeight / state.zoom
mmPerScreenPx = visibleHeight * 1000 / window.innerHeight
```

`frameOrtho()` keeps building the frustum from `state.orthoHeight` **without dividing it**, and no
longer touches `zoom`: the zoom is OrbitControls' field from now on.

`OrthographicCamera.updateProjectionMatrix()` — "Updates the camera's projection matrix. Must be
called after any change of camera properties" — is called by whoever writes `zoom` outside a
`change` event, that is `setZoom()` and `resetFraming()`.

### Rig API

```js
zoomPercent()                    // integer, 100..400
setZoom(percent)                 // clamped float, then updateProjectionMatrix() + flat.update()
panBy(dxPx, dyPx)                // flat.pan(dx, dy) + flat.update(); pixels, as documented
resetFraming()                   // ortho.zoom = 1, height = frame.orthoHeight, target = frame.target
activeControls                   // getter: the instance that is currently enabled
```

`setZoom` divides by 100 **after** clamping the float to `[1, 4]` through
`flat.minZoom`/`flat.maxZoom`, so a programmatic call cannot leave the documented range. Cursor
anchoring is not part of `setZoom`: it belongs to the wheel, and `zoomToCursor` provides it.

`OrbitControls.pan(deltaX, deltaY)` — "Programmatically pan the camera", pixels — is the only pan
implementation. `panBy` is a rename with the sign convention of a drag already handled by the
library.

**A named view is the canonical frame.** `placeCamera(name)` calls `resetFraming()` before it
applies the preset, and `reset()` does the same. So `view(left)` always means 100 %, centred on
`frame.target`, whatever the pointer did before. This is what keeps a capture reproducible and
`bun run check` comparable. `resetFraming()` restores `orthoHeight` from the frame as well, so a
`camera --ortho-height` experiment cannot survive a named view.

**A pan and a zoom are not a manual orbit.** Neither writes `currentView`, because the view name is
only invalidated by the perspective instance (`onManual` stays wired to `orbit` alone). A plate is
masked by **axis** (`matchingView()`), and a zoom changes no axis.

### Input ownership

Nothing new is registered on the canvas. The two `OrbitControls` do the wheel and the drag; the
editor's `pointerdown` handler (`main.js`) and the picker's stay as they are. `main.js` sets
`rig.flat.mouseButtons.LEFT` on every `setEditMode()` call:

```text
editor off  ->  LEFT: PAN      (a left drag moves the view)
editor on   ->  LEFT: ROTATE   (inert, because enableRotate is false; the knot drag is untouched)
```

The frame loop must update the **active** controls, both being damped (`stage.js` today updates only
the perspective one):

```js
rig.activeControls.update();
```

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
__ctl.pan(12, -8)     // pixels; returns { target: [x, y, z], percent }
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
      2. `zoom(200)`: `mmPerPx` is exactly half to 1e-9, `percent` is 200. `zoom(400)`: a quarter.
      3. `zoom(500)` stays 400. `zoom(50)` stays 100.
      4. **Cursor anchoring, through the real wheel**: with the plate on `left`, `knotProbe(nx, ny)`
         returns a view coordinate; one wheel event at that NDC, then the probe at the same NDC,
         returns the same coordinate within 0.5 mm, while a probe at `(-0.5, -0.5)` has moved.
      5. **Parity with the free views**: one wheel event of `deltaY = -100` on `left` and one on
         `front-3q` change the apparent size **in the same direction** and by the **same ratio ±2 %**
         (measured on `left` through `mmPerPx`, on `front-3q` through the screen size of a known
         world distance).
      6. A zoom leaves `state().view` equal to `left`; a pan leaves it `left` too.
      7. `view("top")` then `view("left")` after a pan and a zoom: `percent` is 100 and the target is
         `frame.target` again.
      8. On `front-3q`: `zoom(200)` returns `applied: false` and the percent stays 100.
      9. The `#hud-zoom` text is `110 %` after one wheel notch on a flat view and `—` on a
         perspective view.
      10. With `knotEdit(true)`, a synthesized left drag on the canvas moves no camera (`state` un-
          changed) and still reaches `knotProbe`; with `knotEdit(false)`, the same drag pans.
      11. `zoom(400)`, then `__stats()` reports `zoom: 1` after a capture prepared by `shot`.
- [ ] **T3.2 — The instrument, failing**: `tools/ctl.ts zoom` and `__ctl.zoom` / `__ctl.pan` exist
      and report. Until T3.3 they return the 100 % value on a flat view and the check fails on
      assertion 2.
- [ ] **T3.3 — Implementation**: the `flat` instance with the configuration table above, the
      `change` mirror, `zoomPercent`, `setZoom`, `panBy`, `resetFraming`, `activeControls`, the
      `placeCamera` reset, the frame-loop update, `visibleHeight` and `mmPerScreenPx` with `zoom`,
      the HUD row, `__ctl`, `ctl.ts zoom`, and the 100 % capture rule in `ctl.ts shot` and `shot.ts`.
- [ ] **T3.4 — Gates**: `bun run tools/check_zoom.ts` exits 0; `bun run check` produces the same IoU
      and the same worst deviation as before the ticket; a rendered trio at 100 %, 200 %, and 400 %
      on `left` shows the plate, the contour, and the handles at the same place.
- [ ] **T3.5 — Escalation record**: if assertion 5 shows that `OrbitControls` turns the orthographic
      wheel in the wrong direction, or at a different ratio that no documented knob corrects, the
      implementation **stops** and reports the measurement to the CTO. It does not answer with a
      second wheel handler.

## Acceptance Criteria

1. On each of `left`, `right`, `front`, `back`, `top`, `bottom`, the wheel moves the view from 100 %
   to 400 % and back, and stops exactly at both ends.
2. The wheel on a flat view feels like the wheel on a free view: same direction, same ratio per
   notch, same inertia. It is the same library doing it.
3. At 200 %, one screen pixel covers half the millimetres it covers at 100 %; at 400 %, a quarter.
   The HUD shows the percentage, and the picker panel shows the matching millimetres per pixel.
4. The detail under the cursor stays under the cursor while the wheel turns.
5. A middle drag moves the view; a left drag panning is disabled while the knot editor is active, and
   the knot gestures keep working unchanged.
6. The plate, the contour line, and the knot handles keep their alignment at every zoom, and the
   ten-screen-pixel grab threshold follows the zoom, so a handle stays as easy to grab at 400 % as at
   100 %.
7. `view(name)` and a capture are always 100 % and centred. A capture taken after a hand zoom is
   identical to the capture taken before it, and its sidecar says `zoom: 1`.
8. `bun run check` reports the same numbers as before the ticket.

## Implementation Notes

**Review correction, 2026-11-09.** The first draft hand-wrote the wheel listener, the `[100, 400]`
clamp, the cursor-anchoring formula, and the pan vector. That was a second zoom implementation
beside the one the free views already use, and it could not guarantee the parity the art director
asked for. The contract now delegates the whole gesture to a second `OrbitControls` bound to the
orthographic camera, and keeps only three rig-level functions: `setZoom`, `panBy`, `resetFraming`.
`state.zoom` became a mirror of `OrthographicCamera.zoom` instead of a competing source.
