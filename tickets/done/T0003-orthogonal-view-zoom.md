# T0003 — Zoom on the orthogonal views

- **Track**: Three.js viewer (camera and interaction)
- **Wave**: 1 (independent)
- **Owner**: coding sub-agent, supervised by the CTO
- **Started**: 2026-11-09
- **Depends on**: T0002 (the knot editor defines what the zoom must serve)
- **Blocks**: T0005 — the measurement pick chord and release; T0004 — knot editing by marquee selection
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
    `.dollyIn()`, `.dollyOut()`, `.getAzimuthalAngle()`:
    <https://threejs.org/docs/#examples/en/controls/OrbitControls>
    (source of record: <https://raw.githubusercontent.com/mrdoob/three.js/r187/docs/pages/OrbitControls.html.md>)
  - three.js `Controls`, `.enabled`:
    <https://raw.githubusercontent.com/mrdoob/three.js/r187/docs/pages/Controls.html.md>
  - three.js `OrbitControls` source, pinned to r187, `onMouseDown`: the swap between the `ROTATE` and
    `PAN` actions when `ctrlKey`, `metaKey`, or `shiftKey` is held. **This swap is in the source and
    not in the documentation.** It is the one non-documented behavior this ticket depends on, it is
    written into the contract with its exact shape, and assertion 8 of the check fails loudly if a
    version bump changes it.
    <https://raw.githubusercontent.com/mrdoob/three.js/r187/examples/jsm/controls/OrbitControls.js>

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
same `zoomSpeed`, same `mouseButtons` (`LEFT` pan, `MIDDLE` dolly, `RIGHT` unbound), same inertia,
same zoom-to-cursor. A named view and a capture are still exactly the frame of today.

A left drag moves the view on **both** families. On a free view that costs the one-hand orbit, which
moves to `Shift` + left drag; on a flat view it costs nothing, because a flat view never orbited. The
art director asked for this: the left button pans everywhere, and the right button stays free for a
context menu.

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
  `dampingFactor` stay as they are. A ticket about the flat views does not get to change how far the
  free views dolly, or how far they tilt.
- **The measurement tool's recording moment.** `picker.js` is in scope for one reason only: it must
  pass the zoom to `mmPerScreenPx()`. Its `pointerdown` handler stays as it is. That handler records
  a point on **press**, which a left-drag pan makes wrong — every pan would drop a point — and the
  correction is **T0005**, a separate ticket that starts after this one.

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
  // A left drag moves the view on BOTH families. The middle keeps its default, the dolly. The right
  // button is bound to no action: it is kept for the context menu the art director reserves, and
  // `null` matches no case in `OrbitControls`' own `switch`, so a right drag is inert.
  mouseButtons: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null },
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

1. **The mouse combination is identical on both families.** `LEFT` = pan, `MIDDLE` = dolly, `RIGHT`
   unbound. The wheel and the middle drag are untouched. A pan is the **left** drag on a flat view
   and on a free view; the right button is deliberately free, so a right drag does nothing and the
   browser's context menu is left for a later feature to draw.
2. **`Shift` + left drag rotates a free view, and is inert on a flat one.** `OrbitControls` swaps the
   `ROTATE` and `PAN` actions when `ctrlKey`, `metaKey`, or `shiftKey` is held: `case MOUSE.PAN:`
   runs the **rotate** branch under a modifier, and returns early when `enableRotate === false`. So
   `LEFT: PAN` + `enableRotate: true` gives a free view a `Shift`-held orbit, and `LEFT: PAN` +
   `enableRotate: false` leaves a flat view with no camera rotation at all — which is exactly the
   room T0004 needs for the marquee. `enableRotate` stays the **single** documented difference
   between the two instances, and this ticket reaches it through one swap that the documentation
   does not describe.
3. **The left button is shared on a flat view, and the rule is a hit region, not a mode.** A left
   press inside a knot's grab threshold belongs to the editor; everywhere else it pans. T0004 owns
   that precedence. There is no `state.panWithLeft`, and `setEditMode()` never touches
   `mouseButtons`: the camera's gesture is the same at every moment, and the editor borrows the
   button only where the camera cannot want it.
4. **`zoomToCursor` is turned on for both.** The free views currently zoom toward the frame centre.
   They now zoom toward the cursor too. This is the one intended change to the free views, and it is
   the price of "the same gesture"; the ticket names it so the art director can veto it in review.
5. The two limits pairs are written on both instances even though each projection reads only one.
   `minZoom`/`maxZoom` are documented as "orthographic camera only", `minDistance`/`maxDistance` as
   "perspective camera only", so the ignored pair is inert, and the configuration stays one object.

The only field that differs between the two instances is `enableRotate`: `true` on `orbit` (that is
what a free view is for), `false` on `flat` ("Enable or disable horizontal and vertical rotation of
the camera"). An elevation seen twenty degrees off its axis is a picture of a car that is not there.
That one field carries two behaviors, and both are wanted: on `orbit` it turns `Shift` + left drag
into the orbit that the plain left drag gave up, and on `flat` it makes the same gesture a no-op, so
the knot editor owns it.

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

Nothing new is registered on the canvas for the camera, and nothing is toggled when the editor opens
or closes. The two `OrbitControls` own the wheel, the middle drag, and the left drag on both
families. The right button is bound to no action.

The left button is **shared** on a flat view, and the arbitration rule is a hit region rather than a
mode: a left press inside a knot's grab threshold belongs to the editor, and every other left press
pans. T0004 owns that precedence, and it must preempt from an **ancestor** in the capture phase:
`OrbitControls` registers its own `pointerdown` on the canvas first, and at the target a listener
runs in registration order, so a canvas-level `stopImmediatePropagation()` would arrive too late.

The measurement tool is the second claimant of the left button, and this ticket is what makes the two
collide: `picker.js` records a point on `pointerdown`, so a left-drag pan would drop a point on every
press. The correction is T0005, which starts after this ticket. T0004's `blocked` option and T0005's
change meet on the same handler, so T0004 starts after T0005 as well.

The frame loop must update the **active** controls, both being damped (`stage.js` today updates only
the perspective one):

```js
rig.activeControls.update();
```

### Cursor

A cursor says what a button will do before it is pressed. The page styles the canvas with two body
classes, so one rule per state and no inline style competes with another:

```css
canvas { cursor: default; }
body.pan-ready canvas { cursor: grab; }
body.pan-dragging canvas { cursor: grabbing; }
```

| State | Class | Cursor |
| :--- | :--- | :--- |
| A view at rest: a left drag pans | `pan-ready` | `grab` — the open hand |
| A left-drag pan in progress | `pan-dragging` | `grabbing` — the closed hand |

`canvas { cursor: default; }` is the floor, not a state. Every view of the page can be panned with a
left drag now, so `pan-ready` is the resting cursor on a free view as well as on a flat one. The
earlier draft of this ticket showed `default` on a free view, because a left drag did not pan there.
The art director can veto the hand in review; the alternative is a fourth class, for a view that pans
and a `Shift` orbit that does not.

`main.js` owns the classes: `setView()` and `ctlCamera()` call `syncCursor()` after the camera
changes, and `pan-dragging` is set from `main.js`'s own `pointerdown` on the canvas with
`button === 0` — which it receives only when the editor did not claim the press — then cleared on
`pointerup`, `pointercancel`, or `blur`. `syncCursor()` reads one state and writes the classes; it
never sets `canvas.style.cursor` directly, so a later feature can add a state without rewriting the
others.

T0004 adds the third class (`marquee-armed` → `crosshair`) and places its rule **between**
`body.pan-ready` and `body.pan-dragging`, so a `Shift` + left drag shows the sight rather than the
open hand, and a pan already in progress still shows the closed hand.

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

- [x] **T3.1 — The check, written first**: `tools/check_zoom.ts` opens `?scene=r5-tl-1972`, waits
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
         `maxDistance`, `maxPolarAngle`, and a deep-equal `touches`. `mouseButtons` is exactly
         `{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: null }` on both. `enableRotate` is the
         single documented difference: `true` on `orbit`, `false` on `flat`.
      6. **Parity of the wheel**: one wheel event of `deltaY = -100` on `left` and one on `front-3q`
         change the apparent size **in the same direction** and by the **same ratio ±2 %** (measured
         on `left` through `mmPerPx`, on `front-3q` through the screen size of a known world
         distance). A second event on each keeps the ratio.
      7. **Parity of the drags**: on `left`, a synthesized middle drag changes the percent and leaves
         the target alone; a synthesized **left** drag moves the target and leaves the percent alone,
         with `knotEdit` on **and** off, as long as the press does not land inside a knot's grab
         threshold; a synthesized right drag changes neither. The same three drags on `front-3q`
         behave the same way, and a `Shift` + left drag there changes `getAzimuthalAngle()`.
      8. **The modifier swap, asserted** — the one non-documented dependency of this ticket: on
         `front-3q`, `controls().orbit.enableRotate` is `true` and a `Shift` + left drag rotates (the
         camera position changes, `getAzimuthalAngle()` moves). On `left`, `enableRotate` is `false`
         and the same gesture leaves the camera position and the target untouched.
      9. A zoom leaves `state().view` equal to `left`; a left-drag pan leaves it `left` too.
      10. `view("top")` then `view("left")` after a pan and a zoom: `percent` is 100 and the target is
         `frame.target` again.
      11. On `front-3q`: `zoom(200)` returns `applied: false` and the percent stays 100.
      12. After one wheel notch on a flat view, `#hud-zoom` shows the reported percent and not `—`;
         on a perspective view it shows `—`. The value is read from `__ctl.zoom()`, not guessed: the
         ratio per notch belongs to the library.
      13. `zoom(400)`, then `__stats()` reports `zoom: 1` after a capture prepared by `shot`.
      14. The computed cursor on the canvas is `grab` on `left` at rest, `grabbing` while a left drag
          is in progress, and `grab` on `front-3q` too.
- [x] **T3.2 — The instrument, failing**: `tools/ctl.ts zoom` and `__ctl.zoom` / `__ctl.pan` exist
      and report. Until T3.3 they return the 100 % value on a flat view and the check fails on
      assertion 2.
- [x] **T3.3 — Implementation**: the `flat` instance and the single `SHARED` table applied to both,
      the `change` mirror, `zoomPercent`, `setZoom`, `panBy`, `resetFraming`, `activeControls`, the
      `placeCamera` reset, the frame-loop update, `visibleHeight` and `mmPerScreenPx` with `zoom`,
      the HUD row, the cursor classes and `syncCursor`, `__ctl.controls`, `ctl.ts zoom`, and the
      100 % capture rule in `ctl.ts shot` and `shot.ts`.
- [x] **T3.4 — Gates**: `bun run tools/check_zoom.ts` exits 0; `bun run check` produces the same IoU
      and the same worst deviation as before the ticket; a rendered trio at 100 %, 200 %, and 400 %
      on `left` shows the plate, the contour, and the handles at the same place.
- [x] **T3.5 — Escalation record**: if assertion 6 shows that `OrbitControls` turns the
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
   damping, `zoomToCursor`, and the same `mouseButtons` — `LEFT` pan, `MIDDLE` dolly, `RIGHT`
   unbound — on the free views and on the flat ones. `enableRotate` is the only difference, and it is
   the one that makes a flat view flat.
6. The left drag moves the view on both families, except within a knot's grab threshold on a flat
   view with the editor on, where it belongs to the editor; the middle drag zooms on both; a `Shift`
   + left drag rotates a free view and does nothing on a flat one; a right drag does nothing.
7. The plate, the contour line, and the knot handles keep their alignment at every zoom, and the
   ten-screen-pixel grab threshold follows the zoom, so a handle stays as easy to grab at 400 % as at
   100 %.
8. `view(name)` and a capture are always 100 % and centred. A capture taken after a hand zoom is
   identical to the capture taken before it, and its sidecar says `zoom: 1`.
9. The canvas cursor is an open hand on any view whose left drag pans, and it closes while a left-drag
   pan runs.
10. `bun run check` reports the same numbers as before the ticket.

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
`mouseButtons` map — with `enableRotate` as the single documented difference. One consequence is
accepted and written down: `zoomToCursor` now applies to the free views too. `__ctl.controls()`
exposes the table so the check compares the two instances field by field instead of trusting this
note.

**Correction 3, 2026-11-09 — the left button pans, the right button is free.** The art director
rejected the right-drag pan, because the right button is reserved for a context menu, and asked for
the pan on the **left** button, on the flat views and on the free views alike. The middle drag keeps
its dolly, so the Blender-style `Shift` + middle pan is dropped. The `SHARED` table therefore reads
`{ LEFT: PAN, MIDDLE: DOLLY, RIGHT: null }`.

Three things follow, and all three are in the contract above:

- The one-hand orbit of a free view moves to `Shift` + left drag. `OrbitControls` reaches that by
  itself, through the swap between `ROTATE` and `PAN` under a modifier. **That swap is in the
  library's source and not in its documentation**, so it is pinned to r187 and assertion 8 of the
  check fails if a version bump changes it. This is the only non-documented behavior the ticket
  depends on, and it is stated rather than assumed.
- The left button is now **shared** on a flat view, where it was exclusive before. The rule is a hit
  region, not a mode: a press inside a knot's grab threshold is the editor's. T0004 owns that
  precedence, and it must preempt from an ancestor in the capture phase, because `OrbitControls`
  registers its `pointerdown` on the canvas first.
- `picker.js` records a measurement point on `pointerdown`, so a left-drag pan would drop a point on
  every press. That is T0005, a separate ticket that starts after this one. T0004's `blocked` option
  lands on the same handler, so T0004 starts after T0005.

The resting cursor becomes the open hand on the free views as well, because a left drag pans there
now. The earlier draft showed `default` there. The art director can veto the hand in review.

### Implementation notes — 2026-11-09 (coding sub-agent)

**T3.1, the failing test.** `tools/check_zoom.ts` was written first, run against the unmodified page,
and failed for the right reason — the page loaded, the check reached assertion 1, and the instrument
was absent:

```text
CheckFailure: assertion 1 failed: __ctl.zoom() is available
  {"hasZoom":false}
```

**T3.2, the instrument.** `__ctl.zoom`, `__ctl.pan` and `ctl.ts zoom` were added, reporting the 100 %
frame on a flat view and ignoring the set. The check then failed on assertion 2, as required:

```text
CheckFailure: assertion 2 failed: zoom(200) reports 200
  {"applied":false,"mmPerPx":4.40125,"percent":100,"visibleHeight":4.40125}
```

**T3.3, the implementation.** Two `OrbitControls` instances, one `SHARED` table, `enableRotate` the
only difference, the `change` mirror, `zoomPercent`/`setZoom`/`panBy`/`resetFraming`/`activeControls`,
the frame-loop update, `zoom` in `measure.mmPerScreenPx`, the HUD row, the cursor classes, the `__ctl`
surface, and the 100 % capture rule in `ctl.ts shot` and `shot.ts`.

**Decisions and deviations from the contract, all deliberate:**

1. **Assertion 4 uses `(-0.4, -0.2)`, not `(-0.5, -0.5)`.** For `r5-tl-1972` at 100 % the `left` plate
   is 1.41 m tall, so the NDC `(-0.5, -0.5)` falls below it and `knotProbe` returns `null` — a null
   cannot "move". The check uses `(-0.4, -0.2)`, which is on the plate and away from the anchor. The
   intent of the assertion is unchanged: a point away from the cursor moves while the anchored point
   does not.
2. **`clearInertia()` — an internal helper, not a new rig API.** `OrbitControls` applies a pan with
   damping, so a leftover `_panOffset` keeps moving the target after the pointer is released. A named
   view placed during that decay did not land on `frame.target` (assertion 10 failed). `resetFraming`
   and `applyCamera` now drop the inertia first, by toggling the documented `enableDamping` field off
   for one `update()` (which applies the whole offset and zeroes it) and back on. No private field is
   touched, and no zoom or pan arithmetic is written.
3. **The inline cursor is removed once.** `OrbitControls` writes `cursor: auto` inline on its element
   at connect, and an inline style beats the stylesheet. `createCameraRig` calls
   `element.style.removeProperty("cursor")` once, so the `body.pan-ready` / `body.pan-dragging` rules
   are the only source, as the contract requires.
4. **`__ctl.controls()` carries four live readouts besides the configuration** — `azimuth`
   (`getAzimuthalAngle()`), `distance` (`getDistance()`), `camera` and `target`. Assertion 6 measures
   the free view's apparent size through `distance`, and assertion 8 reads `azimuth` and `camera`.
   These are read-only and documented methods, not new behaviour.
5. **Assertion 13 uses `ctl.ts shot`, not `shot.ts`.** `shot.ts` opens and closes its own session, so
   the check could not read `__stats()` after it. `ctl.ts shot` shares the check's session, and the
   assertion proves the 100 % rule on the same code path. `shot.ts` carries the same one-line call.
6. **The check drives input through CDP, not `agent-browser mouse`.** The modifier assertion needs a
   `Shift`-held pointerdown, and the documented `OrbitControls` behaviour reads `event.shiftKey`;
   `agent-browser mouse` sends no modifiers. The check opens the page target's CDP socket and passes
   `modifiers` on the mouse events. It only synthesises the pointer — the library's own listener
   reacts.
7. **The middle-drag assertion drags upward.** A downward middle drag dollies out, and the 100 % floor
   clamps it back, so the percent would not change. The gesture is otherwise unchanged.
8. **Assertion 7's grab-threshold qualifier is inert in this ticket.** The knot editor is unchanged,
   so a left drag pans in both editor states. The qualifier becomes live only after T0004, which owns
   the hit region.

**T3.5 — no escalation.** Assertion 6 shows the orthographic wheel turns in the same direction and at
the same ratio (0.95 per notch, both families) as the perspective wheel; no documented knob was
needed, no second wheel handler was written, and the flat instance has no `zoomSpeed` of its own.

**Gates, exact commands and output:**

```text
$ bun run workflows/threejs/tools/check_zoom.ts
  ... 71 ok lines ...
check_zoom  all assertions passed
EXIT=0

$ bun test workflows/threejs/viewer
 30 pass
 0 fail
 46 expect() calls
Ran 30 tests across 3 files. [15.00ms]
EXIT=0

$ bun run check
height    1490.4 mm reference   1404.5 mm render   -85.9 mm
ratio     0.4234 reference   0.3990 render
worst     -85 mm at 2112 mm from the nose (tolerance 40 mm)
status    NEEDS WORK
EXIT=0
```

`bun run check` was run twice: once with the viewer files stashed (`git stash push` on
`workflows/threejs/viewer/*` and the two tools), once with them restored. The two reports are
byte-identical apart from the command echo line, and the silhouette IoU computed from the
`silhouette-tmp` masks is identical in both:

```text
PRE  {'left': 0.9223, 'right': 0.8683, 'front': 0.9626, 'back': 0.9887, 'top': 0.9479}
POST {'left': 0.9223, 'right': 0.8683, 'front': 0.9626, 'back': 0.9887, 'top': 0.9479}
```

**T3.4 rendered trio.** `/tmp/opencode/zoom-100.png`, `zoom-200.png`, `zoom-400.png` on `left` with
the plate and the editor on. Description, not a verdict: at 100 % the orange contour and the yellow
knot handles sit on the plate outline, the HUD reads `100 %`; at 400 % the view is magnified on the
roof and shoulder, and the contour and handles still follow the same plate edge, the HUD reads
`400 %`. The final visual judgement is the art director's.

**Documents updated in the same change:** `workflows/threejs/README.md` (§7.2 "Zoom and pan on the
flat views", the tools table) and `workflows/threejs/AGENTS.md` (a "Camera rules" section).

## CTO audit, 2026-11-09

The independent peer review is **deferred by the art director's instruction** — reviews are batched at
the end of the T0003/T0004/T0005 series. What was checked here, by the CTO and not by the coder:

- **Scope.** `git status` shows only files inside the Scope Boundary. `.opencode/agents/*.md` carry a
  pre-existing edit that predates this work (one `model:` line removed per file), and nothing else is
  outside. No scene, no contour, no `views.json`, no `check.ts` threshold.
- **`bun test workflows/threejs/viewer`** → `30 pass`, `0 fail`, `46 expect()` calls.
- **`bun run workflows/threejs/tools/check_zoom.ts`** → exit 0, 71 assertions `ok`, including
  assertion 8, which pins the non-documented `Shift` + left swap to r187.
- **`bun run check`** → `1 min 54 s`, `height 1490.4 mm reference / 1404.5 mm render / -85.9 mm`,
  `worst -85 mm at 2112 mm`, `status NEEDS WORK`. These match the coder's recorded numbers exactly,
  and the PRE/POST IoU table above shows no regression.
- **Ticket bookkeeping.** Every T3.x box is checked and `## Implementation Notes` is present. The
  ticket stayed in `in_progress/`, as instructed.

Two defects found during this audit belong to other tickets and are recorded there: the gate's
silence and its crawling orientation guard, and the exit code that ignores the tolerance (**T0006**);
and the render loop that burns nine cores while idle (**T0007**, which starts from this ticket's
`stage.js`).
