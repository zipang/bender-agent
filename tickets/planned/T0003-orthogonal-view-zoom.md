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
together at every zoom. **The gesture is the one the free views already have**: same wheel ratio,
same `zoomSpeed`, same `mouseButtons` (`LEFT` rotate, `MIDDLE` dolly, `RIGHT` pan), same inertia,
same zoom-to-cursor. A named view and a capture are still exactly the frame of today.

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

### Two instances, one camera each

`OrbitControls` takes the camera in its constructor, and the docs name no supported way to re-target
it (`new OrbitControls(object, domElement)`). So the rig holds **two** instances on the same canvas:

| Instance | Camera | Used when |
| :--- | :--- | :--- |
| `orbit` (exists) | perspective | `state.perspective === true` |
| `flat` (new) | orthographic | `state.perspective === false` |

`enabled` is the documented switch — "Whether the controls responds to user input or not." Exactly
one instance is enabled at a time; `applyCamera()` does the swap.

### One table, two instances

`OrbitControls` already exposes every knob that makes a zoom and a pan feel the way it feels. The two
instances are configured from **one frozen table**, written once and copied onto both, so parity is
enforced by construction and a later edit cannot reach one without the other:

```js
// Both instances receive every field. A pair the projection ignores is still written, because
// "identical" is a property of the table, not of what the projection happens to read.
const SHARED = {
  enableDamping: true,   dampingFactor: 0.08,   // the value the perspective view already uses
  enableZoom: true,      enablePan: true,
  zoomSpeed: 1,          panSpeed: 1,           rotateSpeed: 1,
  zoomToCursor: true,
  screenSpacePanning: true,
  minZoom: 1,            maxZoom: 4,            // orthographic only: the 100 % floor, the 400 % cap
  minDistance: 3,        maxDistance: 24,       // perspective only
  maxPolarAngle: Math.PI / 2,
  mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
};

function configure(controls) {
  for (const [key, value] of Object.entries(SHARED)) {
    // `mouseButtons` and `touches` are objects: each instance gets its own copy, so no later
    // mutation of one can reach the other.
    controls[key] = value && typeof value === "object" ? { ...value } : value;
  }
}
```

Every value above is on the documented surface: `enableDamping` and `dampingFactor` ("Set to `true`
to enable damping (inertia)"), `enableZoom` ("Enable or disable zooming (dollying) of the camera"),
`enablePan`, `zoomSpeed` ("Speed of zooming / dollying"), `panSpeed`, `rotateSpeed`,
`zoomToCursor` ("allows to zoom to the cursor's position"), `screenSpacePanning`,
`minZoom`/`maxZoom` ("How far you can zoom in / out (orthographic camera only)"),
`minDistance`/`maxDistance` ("How far you can dolly in / out (perspective camera only)"),
`maxPolarAngle`, `mouseButtons`.

**Consequences, stated rather than discovered later:**

1. **The mouse combination is identical on both families.** `LEFT` = rotate, `MIDDLE` = dolly,
   `RIGHT` = pan — the library defaults, written down. On a flat view `MIDDLE` therefore **zooms**,
   it does not pan: a pan is the **right** drag, exactly as on a free view. The middle-drag-pans
   proposal is dropped, because it was a second gesture for one page.
2. **`LEFT` is rotate on both.** On a flat view `enableRotate = false` makes it inert, which frees
   the left button for the knot editor **permanently** — no `state.panWithLeft`, no
   `mouseButtons.LEFT` toggling on `setEditMode()`. The editor cannot fight the camera for the left
   drag, at any moment.
3. **`zoomToCursor` is turned on for both.** The free views currently zoom toward the frame centre.
   They now zoom toward the cursor too. This is the one intended change to the free views, and it is
   the price of "the same gesture"; the ticket names it so the art director can veto it in review.
4. The two limits pairs are written on both instances even though each projection reads only one.
   `minZoom`/`maxZoom` are documented as "orthographic camera only", `minDistance`/`maxDistance` as
   "perspective camera only", so the ignored pair is inert, and the configuration stays one object.

The only field that differs between the two instances is `enableRotate`: `true` on `orbit` (that is
what a free view is for), `false` on `flat` ("Enable or disable horizontal and vertical rotation of
the camera"). An elevation seen twenty degrees off its axis is a picture of a car that is not there.

`__ctl.controls()` returns the compared table — the fields of both instances, side by side — so the
check proves the parity instead of trusting this paragraph.

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

Nothing new is registered on the canvas, and nothing is toggled when the editor opens or closes. The
two `OrbitControls` own the wheel, the middle drag, and the right drag on both families; the
editor's `pointerdown` handler (`main.js`) and the picker's stay as they are.

The left button needs no arbitration, because `LEFT` is `ROTATE` on both instances and rotation is
disabled on the flat one: a left drag never moves an orthographic camera, so it is the editor's, and
only the editor's. `setEditMode()` does not touch `mouseButtons`.

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
__ctl.controls()      // { orbit: {...}, flat: {...} }: the compared configuration, field by field
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
      5. **The two instances are configured alike**: `__ctl.controls()` returns, for `orbit` and
         `flat`, the same `zoomSpeed`, `panSpeed`, `rotateSpeed`, `dampingFactor`, `zoomToCursor`,
         `screenSpacePanning`, `enableZoom`, `enablePan`, `minZoom`, `maxZoom`, `minDistance`,
         `maxDistance`, `maxPolarAngle`, and a deep-equal `mouseButtons` / `touches`. `enableRotate`
         is the single documented difference: `true` on `orbit`, `false` on `flat`.
      6. **Parity of the wheel**: one wheel event of `deltaY = -100` on `left` and one on `front-3q`
         change the apparent size **in the same direction** and by the **same ratio ±2 %** (measured
         on `left` through `mmPerPx`, on `front-3q` through the screen size of a known world
         distance). A second event on each keeps the ratio.
      7. **Parity of the drags**: on `left`, a synthesized right drag moves the target and leaves the
         percent alone; a synthesized middle drag changes the percent and leaves the target alone;
         a synthesized left drag changes neither, with `knotEdit` on **and** off. The same three
         drags on `front-3q` move/zoom it the same way (the left one orbits, as it always did).
      8. A zoom leaves `state().view` equal to `left`; a pan leaves it `left` too.
      9. `view("top")` then `view("left")` after a pan and a zoom: `percent` is 100 and the target is
         `frame.target` again.
      10. On `front-3q`: `zoom(200)` returns `applied: false` and the percent stays 100.
      11. After one wheel notch on a flat view, `#hud-zoom` shows the reported percent and not `—`;
         on a perspective view it shows `—`. The value is read from `__ctl.zoom()`, not guessed: the
         ratio per notch belongs to the library.
      12. `zoom(400)`, then `__stats()` reports `zoom: 1` after a capture prepared by `shot`.
- [ ] **T3.2 — The instrument, failing**: `tools/ctl.ts zoom` and `__ctl.zoom` / `__ctl.pan` exist
      and report. Until T3.3 they return the 100 % value on a flat view and the check fails on
      assertion 2.
- [ ] **T3.3 — Implementation**: the `flat` instance and the single `SHARED` table applied to both,
      the `change` mirror, `zoomPercent`, `setZoom`, `panBy`, `resetFraming`, `activeControls`, the
      `placeCamera` reset, the frame-loop update, `visibleHeight` and `mmPerScreenPx` with `zoom`,
      the HUD row, `__ctl.controls`, `ctl.ts zoom`, and the 100 % capture rule in `ctl.ts shot` and
      `shot.ts`.
- [ ] **T3.4 — Gates**: `bun run tools/check_zoom.ts` exits 0; `bun run check` produces the same IoU
      and the same worst deviation as before the ticket; a rendered trio at 100 %, 200 %, and 400 %
      on `left` shows the plate, the contour, and the handles at the same place.
- [ ] **T3.5 — Escalation record**: if assertion 6 shows that `OrbitControls` turns the
      orthographic wheel in the wrong direction, or at a different ratio that no documented knob
      corrects, the implementation **stops** and reports the measurement to the CTO. It does not
      answer with a second wheel handler, and it does not fix the flat instance by giving it a
      `zoomSpeed` of its own: that would be the divergence this ticket exists to prevent.

## Acceptance Criteria

1. On each of `left`, `right`, `front`, `back`, `top`, `bottom`, the wheel moves the view from 100 %
   to 400 % and back, and stops exactly at both ends.
2. The wheel on a flat view feels like the wheel on a free view: same direction, same ratio per
   notch, same inertia. It is the same library doing it.
3. At 200 %, one screen pixel covers half the millimetres it covers at 100 %; at 400 %, a quarter.
   The HUD shows the percentage, and the picker panel shows the matching millimetres per pixel.
4. The detail under the cursor stays under the cursor while the wheel turns.
5. The two control instances are configured alike: same `zoomSpeed`, `panSpeed`, `rotateSpeed`,
   damping, `zoomToCursor`, and the same `mouseButtons` — `LEFT` rotate, `MIDDLE` dolly, `RIGHT`
   pan — on the free views and on the flat ones. `enableRotate` is the only difference, and it is the
   one that makes a flat view flat.
6. The right drag moves the view on both families; the middle drag zooms on both; the left drag never
   moves a flat camera, so the knot gestures keep working unchanged whether the editor is on or off.
7. The plate, the contour line, and the knot handles keep their alignment at every zoom, and the
   ten-screen-pixel grab threshold follows the zoom, so a handle stays as easy to grab at 400 % as at
   100 %.
8. `view(name)` and a capture are always 100 % and centred. A capture taken after a hand zoom is
   identical to the capture taken before it, and its sidecar says `zoom: 1`.
9. `bun run check` reports the same numbers as before the ticket.
## Implementation Notes

**Review correction 1, 2026-11-09 — no second zoom.** The first draft hand-wrote the wheel listener,
the `[100, 400]` clamp, the cursor-anchoring formula, and the pan vector. That was a second zoom
implementation beside the one the free views already use, and it could not guarantee the parity the
art director asked for. The contract now delegates the whole gesture to a second `OrbitControls`
bound to the orthographic camera, and keeps only three rig-level functions: `setZoom`, `panBy`,
`resetFraming`. `state.zoom` became a mirror of `OrthographicCamera.zoom` instead of a competing
source.

**Review correction 2, 2026-11-09 — the two instances must be configured alike.** Two instances
were not enough: the second draft gave the flat one `MIDDLE = PAN` and a `LEFT` that switched with
the knot editor, while the free views kept `MIDDLE = DOLLY` and `LEFT = ROTATE`. That is a different
gesture for the same page. The contract now applies **one frozen `SHARED` table** to both — same
`zoomSpeed`, `panSpeed`, `rotateSpeed`, damping, `zoomToCursor`, `screenSpacePanning`, and one
`mouseButtons` map (`LEFT` rotate, `MIDDLE` dolly, `RIGHT` pan) — with `enableRotate` as the single
documented difference. Two consequences are accepted and written down: the middle drag zooms on a
flat view instead of panning (a pan is the right drag, as on a free view), and `zoomToCursor` now
applies to the free views too. `__ctl.controls()` exposes the table so the check compares the two
instances field by field instead of trusting this note.
