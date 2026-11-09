# T0004 — Knot editing by marquee selection

- **Track**: Three.js viewer (contour knots and interaction)
- **Wave**: 1 (independent of the scene data, after the viewer's zoom work)
- **Depends on**: T0003 and T0005. T0003 owns the camera gestures: `LEFT` pans on both families,
  `MIDDLE` dollies, `RIGHT` is unbound, and `enableRotate` is `false` on the flat instance — which is
  what leaves `Shift` + left drag to the editor. T0005 moves the measurement point from the press to
  a release without movement. All three touch `picker.js`, and this ticket's `blocked` option lands on
  the handler T0005 leaves in place, so they run in order: T0003, then T0005, then this one.
- **Blocks**: nothing
- **References**:
  - `tickets/done/T0002-contour-smoothing.md` §6.8 — the knot editor as it exists today
  - `tickets/planned/T0003-orthogonal-view-zoom.md` — pointer precedence on a flat view
  - `workflows/threejs/viewer/knots.js` — the knot list and the edit operations
  - `workflows/threejs/viewer/main.js` §"knot editor" — the gesture state machine
  - `workflows/threejs/viewer/calque.js` — the knot handles and the plate
  - `workflows/threejs/viewer/picker.js` — the pick in the plate's own metres
  - `workflows/threejs/AGENTS.md` — "Knot rules", "Contour rules"
  - `workflows/threejs/README.md` §5.2 — the contour knots
  - three.js `Ray.intersectPlane(plane, target)`, which returns the intersection point or `null`:
    <https://threejs.org/docs/#api/en/math/Ray>
  - three.js `Plane.setFromNormalAndCoplanarPoint(normal, point)`:
    <https://threejs.org/docs/#api/en/math/Plane>
  - three.js `Object3D.worldToLocal(vector)`, `getWorldPosition()`, and `getWorldQuaternion()`:
    <https://threejs.org/docs/#api/en/core/Object3D>
  - three.js `Vector3.project(camera)`:
    <https://threejs.org/docs/#api/en/math/Vector3>
  - MDN `pointerdown`, `setPointerCapture`, and the `Shift` modifier:
    <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event>
  - MDN `EventTarget.addEventListener()` and `Event.stopPropagation()` — a capture-phase listener on
    an ancestor is the only way to run before a listener that the target already holds:
    <https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener>
    <https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation>
  - MDN `KeyboardEvent.key` values `Delete`, `Backspace`, and `Escape`:
    <https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values>

## Context & Goal

The knot editor can reduce a contour, and it can change a knot one at a time. A contour that carries
194 knots, or a reduce that keeps 34, cannot be reshaped one knot per gesture: the art director needs
to act on a region of the outline as one object.

**Done means**: in edit mode, `Shift` + left-drag draws a selection rectangle. Every knot of the
current view inside the rectangle joins the selection. A second rectangle adds to the selection. The
selected knots are drawn apart from the others. `Delete` removes them, unless fewer than three knots
would remain. A drag that starts on a selected knot moves the whole selection by one vector, and the
outline follows the pointer. While `Shift` is held, the cursor becomes a `+` sight. No click adds,
removes, or moves an unselected knot: selection is the only way into an edit.

The selection is **transient**. It is not written to `contours.js`, and it does not enter the saved
payload.

The editor does not own the left button. T0003 gives it to the camera: a left drag pans, on a flat
view as on a free one. The editor borrows the button in one place only — a press that lands inside a
knot's grab threshold — so the same button pans everywhere else and never needs a mode. A pan leaves
the selection alone.

## Scope Boundary

May be created or modified:

- `workflows/threejs/viewer/knots.js` — the pure selection, move, and delete operations
- `workflows/threejs/viewer/knots.test.js` (new) — the failing tests of those operations
- `workflows/threejs/viewer/main.js` — the selection state, the gestures, the keys, the marquee cursor
  class, and `__ctl`
- `workflows/threejs/viewer/calque.js` — the selected handles
- `workflows/threejs/viewer/picker.js` — an infinite-plane pick, and the measurement lockout while
  the editor is active. T0005 owns the recording moment; this ticket adds only the lockout, on
  whichever handler T0005 leaves in place.
- `workflows/threejs/viewer/index.html` — the marquee overlay, its styles, the cursor rule, and the
  edit-mode hint
- `workflows/threejs/tools/ctl.ts` — the selection commands
- `workflows/threejs/tools/check_knot_selection.ts` (new) — the headless gate
- `workflows/threejs/README.md` — §5.2, the editor gestures
- `workflows/threejs/AGENTS.md` — the "Knot rules"
- `tickets/README.md` — the board

Do **not** touch:

- `workflows/threejs/scenes/**` — the ticket changes the editor, not a contour, a model, or the
  volume. A saved `contours.js` written by the art director is not part of the diff.
- `workflows/threejs/viewer/camera.js` — T0003 owns the camera, the zoom, and the pan. This ticket
  only reads `rig.state.perspective` and `mmPerScreenPx()`.
- `workflows/threejs/viewer/volume.js`, `path.js`, `plate.js` — the selection is not a geometry
  change. The volume rebuilds through the existing `rebuildVolume()`.
- `workflows/threejs/tools/check.ts`, `trace_hull.py`, `compare_silhouette.py`, or any gate
  threshold.
- `blueprints/**`.
- The behavior of `reduce`, `reset`, `save`, and the join controls. `reduce` keeps its button
  semantics, and it is not redefined here.

## Contract

### The selection

One selection exists at a time, because one view is edited at a time.

```js
const selection = { view: null, indices: [] }; // ascending, unique, indices into knotsOf(view)
```

Invariants:

- `indices` are sorted ascending, contain no duplicate, and are all inside `[0, count)` for the
  current `knotsOf(selection.view)`.
- If `selection.view` is not the plate's view, `indices` is empty. The selection never crosses a
  view.
- The selection is cleared when: the plate view changes, edit mode turns off, `reduce` runs,
  `reset` runs, `Escape` is pressed with no marquee open, a plain left press lands on an unselected
  knot, or a delete commits. A pan does **not** clear it.
- The selection survives a join switch (`poly` to `bezier`), because a join does not move a list
  index.
- The selection is never saved. The `POST /api/contours` payload is unchanged.

### Selection geometry

`knots.js` gains these exports. All are pure: they return new arrays and never mutate an argument.

```js
/** Indices of the knots inside a rectangle, inclusive, in plate-local metres. */
export function indicesInRect(knots, rect) // rect = [u0, v0, u1, v1], in any corner order

/** The union of a selection and a set of indices: ascending, no duplicate, out of range dropped. */
export function addIndices(selection, indices, count)

/** A copy of the knot list with every selected knot moved by the same vector. */
export function moveKnotsBy(knots, indices, delta) // delta = [du, dv]

/** A copy of the knot list without every selected knot, or a refusal below `minCount`. */
export function removeKnots(knots, indices, minCount = 3)
```

`indicesInRect`:

- Normalizes the rectangle to `uMin <= uMax` and `vMin <= vMax`.
- A knot is inside when `uMin <= u <= uMax && vMin <= v <= vMax`. The boundary is inclusive.
- Returns `[]` for an empty knot list or a degenerate rectangle.
- The caller passes the two corners converted to the plate's own metres, so the test never depends
  on screen pixels or zoom.

`addIndices`:

- `count` is the current knot count. It ignores an index that is not an integer, is negative, or is
  `>= count`.
- Returns ascending order, so the check can compare arrays directly.

`moveKnotsBy`:

- Ignores an index outside the list.
- Applies the same `[du, dv]` to every selected knot. One vector for the group, never a per-knot
  offset.
- Returns a deep copy of every point.

`removeKnots`:

- Ignores an index outside the list and any duplicate.
- An empty set of removed indices is a no-op: `{ knots: copy, removed: [], refused: false }`.
- If `knots.length - removed.length < 3`, the whole operation is refused:
  `{ knots: copy, removed: [], refused: true, reason: "minimum" }`. No knot is deleted, and the
  call is atomic.
- Otherwise: `{ knots: copyWithout, removed: ascendingIndices, refused: false, reason: null }`.

### Pointer gestures

T0003 gives the left button to the camera on both families: a left drag pans, a middle drag dollies,
a `Shift` + left drag rotates a free view and is inert on a flat one. The editor borrows the left
button on a flat view, and only there, in two cases:

| Press | Owner | Action |
| :--- | :--- | :--- |
| `Ctrl` + left | the measurement tool (T0005) | one point, on release |
| `Shift` + left, no `Ctrl`, flat view, `editor.active` | the editor | the selection rectangle |
| left, no `Shift` and no `Ctrl`, inside a knot's grab threshold, flat view, `editor.active` | the editor | a group drag, or a selection reset |
| left, no `Shift` and no `Ctrl`, anywhere else | the camera | pan |
| middle, right | the camera | dolly, nothing |

The editor never claims a press that carries `Ctrl` or `Meta`: that chord belongs to the measurement
tool, which T0005 claims the same way, on `window` in the capture phase. The two claims are disjoint
by modifier, so the order in which the two listeners are registered never matters.

**The preemption is a capture-phase listener on an ancestor.** `OrbitControls` registers its own
`pointerdown` on the canvas when it is constructed, and at the target a listener runs in registration
order — the capture flag does not reorder listeners on the target itself. A canvas-level
`stopImmediatePropagation()` therefore arrives **after** `OrbitControls` has already claimed the
press. The editor listens on `window` with `{ capture: true }` and calls `stopPropagation()` for the
presses it owns, which stops the event before it reaches the canvas. The pointer capture is the
editor's own, and it is taken on the canvas.

All pointer coordinates enter as NDC, then land on the plate's **infinite plane** through a new
picker method:

```js
picker.pickPlaneAt(nx, ny)
// -> { view, uv: [u, v], world: [x, y, z] } | null
```

Implementation, with the documented three.js surface:

```js
raycaster.setFromCamera(new THREE.Vector2(nx, ny), rig.activeCamera);
const plate = calque.current();                     // the plate mesh of the shown view
const quaternion = new THREE.Quaternion();
plate.getWorldQuaternion(quaternion);
const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
  normal,
  plate.getWorldPosition(new THREE.Vector3()),
);
const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
if (!point) return null;
const local = plate.worldToLocal(point.clone());
return { view: plate.userData.view, uv: [local.x, local.y], world: point.toArray() };
```

The plane is needed because a marquee may start or end outside the finite plate rectangle, and
`intersectObject` returns no hit there. A selection rectangle is judged in the plate's own metres,
which are aligned with the flat view's screen axes, so the box is the same box the eye drew.

`picker` gains one option, `blocked: () => boolean`. While the knot editor is active, `blocked()`
returns true, and the picker ignores both the press and the release. T0005 has already moved the
record from the press to a release without movement, and to the `Ctrl` + left chord, so the guard is
one condition on the press handler.

The chords are already disjoint — `Ctrl` for a measurement, `Shift` and the knot threshold for the
editor — so `blocked` is a **policy, not a necessity**: one tool at a time on one view. It keeps the
art director from dropping measurement points on the plate while reshaping it, and it states the rule
in one place instead of relying on the claim's side effect.

**Start.** On `pointerdown` with `event.button === 0`, `editor.active`, a flat view, `event.shiftKey`,
and neither `event.ctrlKey` nor `event.metaKey`:

1. Call `picker.pickPlaneAt()`. On `null`, do nothing: the press is not claimed, and `OrbitControls`
   is inert under `Shift` on a flat view.
2. Record `marquee.view`, `marquee.origin = uv`, `marquee.startClient`, and
   `marquee.candidates = selection.indices`.
3. Show `#marquee` at the origin, with zero size.
4. `event.preventDefault()` and `event.stopPropagation()`, from the `window` capture listener, so
   neither `OrbitControls` nor the picker sees this press.
5. `canvas.setPointerCapture(event.pointerId)`, guarded by `try/catch`: a synthetic event in a check
   has no active pointer and the browser throws `NotFoundError`.

**Move.** While a marquee is open, update `#marquee` in **client pixels** (a screen-aligned box) and
compute the candidate set:

```text
rect       = box of marquee.origin and picker.pickPlaneAt(current).uv
candidates = addIndices(selection.indices, indicesInRect(knotsOf(view), rect), knotsOf(view).length)
```

Draw the candidate handles as selected, and write the live count in `#knot-info`. The selection is
not committed yet.

**Release.** On `pointerup`:

- If the rectangle's diagonal is under **3 screen pixels**, it is a `Shift` click: the selection does
  not change, and the marquee closes.
- Otherwise, commit `candidates` through `selectionSet(view, candidates)`.
- Hide `#marquee`, release the pointer capture when held, and rebuild nothing: a rectangle changes no
  knot, so no outline and no volume work is needed.

**Cancel.** `Escape`, a `pointercancel`, or leaving edit mode closes the marquee and restores the
selection it had at press.

**Plain press and group drag.** With `editor.active`, a flat view, `event.button === 0`, and no
`Shift`, no `Ctrl`, and no `Meta`, the editor claims the press **only when it lands on a knot**:

- Find the nearest knot to `picker.pickPlaneAt()` with the existing grab threshold,
  `threshold_m = 10 * picker.state().mmPerScreenPx / 1000`.
- **No knot within the threshold**: the editor does not claim the press. It does not
  `stopPropagation()`, it does not clear the selection, and it does not capture the pointer. The
  press reaches the canvas and `OrbitControls` **pans**. A pan therefore never costs the art director
  the selection.
- **A selected knot within the threshold**: claim the press, and start a group drag. Record the
  pointer's `uv`.
- **An unselected knot within the threshold**: claim the press, and clear the selection. Do **not**
  insert, remove, or move anything. This is the "selection only" rule: a click on a knot is a
  selection reset, not an add, and not a removal.

During a group drag, on each `pointermove`:

```text
delta = current.uv - last.uv
knots = moveKnotsBy(knots, selection.indices, delta)
last  = current.uv
applyEdit(view, { volume: false })     // the outline follows the pointer
```

On release, call `rebuildVolume()` when the volume layer is visible, exactly as the single-knot drag
does today. A drag that never moved is not a removal: no pointer gesture removes a knot any more.

**Selection rectangle overlay.** `index.html` gains:

```html
<div id="marquee" hidden></div>
```

with `position: fixed; pointer-events: none; z-index: 15; border: 1px dashed #22262b;
background: rgb(34 38 43 / 0.08);` and `body.shot #marquee { display: none !important; }`. The script
sets `left`, `top`, `width`, and `height` in client pixels and toggles `hidden`.

### Cursor

T0003 writes two body classes for the camera. This ticket adds the third, and the source order of
the rules settles the priority:

```css
canvas { cursor: default; }
body.pan-ready canvas { cursor: grab; }
body.marquee-armed canvas { cursor: crosshair; }
body.pan-dragging canvas { cursor: grabbing; }
```

| State | Class | Cursor |
| :--- | :--- | :--- |
| Edit mode on a flat view, `Shift` held, or a marquee drag in progress | `marquee-armed` | `crosshair` — the `+` sight |
| A left-drag pan in progress | `pan-dragging` | `grabbing` — the closed hand |
| A view at rest: a left drag pans | `pan-ready` | `grab` — the open hand |

`marquee-armed` is true when `editor.active && !rig.state.perspective && shiftDown`. `main.js` sets it
on the `keydown` and `keyup` of `Shift`, and it recomputes it in `setEditMode()` and `setView()`.
`window.blur` clears `shiftDown`, so a key released outside the page cannot leave the sight on. The
class is cleared on `pointercancel`. No handler writes `canvas.style.cursor` directly: the default
rule and the three classes are the whole cursor contract.

The `pan-dragging` rule comes last, so a pan already in progress keeps the closed hand even while
`Shift` is held. The `marquee-armed` rule comes after `pan-ready`, so the sight replaces the open
hand as soon as the art director arms the rectangle.

A free view shows the open hand too, because T0003 gives it a left-drag pan. The rule that shows
`default` there is gone: the page has no view whose left drag does nothing.

### Keyboard

One `keydown` listener on `window`, active only while `editor.active`:

| Key | Action |
| :--- | :--- |
| `Delete` or `Backspace` | delete the selected knots, through `removeKnots(knots, selection.indices)` |
| `Escape` | clear the selection, or cancel an open marquee |

Rules:

- Ignore the event when `event.metaKey || event.ctrlKey || event.altKey || event.repeat` is true.
- Ignore the event when its target matches `input, textarea, select, [contenteditable="true"]`. The
  `#knot-tol` field is an input, and typing there must not delete knots.
- `Delete` with an empty selection is a no-op.
- `Delete` that `removeKnots` refuses leaves the knot list unchanged, keeps the selection, and writes
  `cannot delete: at least 3 knots` in `#knot-info`. A successful delete clears the selection, calls
  `applyEdit(view)` so the outline and the volume rebuild, and writes the new count.
- `Backspace` is accepted because the key labeled "Suppr" on a Mac sends `Backspace`. The listener
  calls `preventDefault()` in both cases so the browser does not navigate back.

### Handles

`calque.js` renders the selected knots apart from the others:

- `calque.setSelection(view, indices)` stores the pair and calls `refreshHandles()`.
- The unselected handles keep `color: 0xffd24a, size: 9`, name `Knots_<view>`.
- The selected handles use `color: 0x4aa3ff, size: 11`, `sizeAttenuation: false`,
  `depthTest: false`, `depthWrite: false`, `renderOrder: 32`, name `SelectedKnots_<view>`.
- When the selection is empty, no selected object is added. Only one `Points` object per role, so a
  hundred selected knots stay two draw calls at most.
- Both objects are placed with the existing `placeContour(points, plate)`, so a selected handle
  cannot sit beside its line.
- `setHandles(false)` hides both. A rebuild after `applyEdit` keeps the current selection and redraws
  both objects.

### Display

`#knot-info` keeps its current shape and gains the selection when it is not empty:

```text
left: 194 (traced) · 12 selected
left: 34 · 12 selected
```

During a marquee drag it shows the candidate count, so the gesture is legible before release. After a
refused delete it shows `cannot delete: at least 3 knots`. The existing `(traced)` marker is kept.

The `#knots` panel gains a one-line hint before the controls:

```text
Shift+drag selects · drag a selected knot moves all · Delete removes
```

The old `title` on `#knot-edit` ("click the line to add, click a knot to remove, drag to move")
describes gestures that no longer exist. Replace it with the hint above.

### Script surface

`__ctl` gains six commands. They address knots by **plate-local metres**, so the check does not
depend on the camera, the zoom, or the window size.

```js
__ctl.knotSelection()
// -> { view: string|null, indices: number[], count: number, positions: [[u, v], ...] }

__ctl.knotSelectRect(u0, v0, u1, v1)
// additive. -> { view, added: number[], selection: number[], count: number }

__ctl.knotClearSelection()
// -> { view, count: 0 }

__ctl.knotDragSelection(du, dv)
// -> { view, moved: number, count: number }   // no pointer, no threshold, one vector

__ctl.knotDeleteSelection()
// -> { view, removed: number[], refused: boolean, reason: string|null, count: number }

__ctl.knotScreen(index)
// -> { x, y } | null   // CSS pixels inside the canvas, for the synthetic pointer gesture
```

They call the same functions as the pointer and the keyboard. They do not emulate a gesture.

`ctl.ts` gains the matching commands:

```bash
bun run workflows/threejs/tools/ctl.ts knots                     # counts, selection, positions
bun run workflows/threejs/tools/ctl.ts select --rect u0,v0,u1,v1
bun run workflows/threejs/tools/ctl.ts select --clear
bun run workflows/threejs/tools/ctl.ts drag --delta du,dv
bun run workflows/threejs/tools/ctl.ts delete-selection
```

### Tests

There is a unit-test runner: `bun test`. The pure functions are tested by `viewer/knots.test.js`,
and the wiring by a headless page check.

`knots.test.js` covers:

1. `indicesInRect`: corners in any order, boundary inclusive, exclusion outside, degenerate
   rectangle, empty list.
2. `addIndices`: union, ascending, duplicates, out-of-range indices.
3. `moveKnotsBy`: the same delta on every selected knot, unselected untouched, input not mutated, an
   out-of-range index ignored.
4. `removeKnots`: remove several, ascending `removed`, input not mutated, empty set is a no-op,
   refusal at 2 remaining, acceptance at exactly 3, atomic refusal.

`tools/check_knot_selection.ts` opens `?scene=r5-tl-1972` on `left`, turns edit mode on, and asserts
in this order:

1. `__ctl.knotSelection()` starts `{ view: "left", count: 0 }`.
2. A 30 mm rectangle around the first knot selects every knot whose position is inside it, and no
   other. The check computes the expected set from the positions it read.
3. A second disjoint rectangle **adds**; the union is ascending with no duplicate.
4. `knotDragSelection(0.01, 0.02)` moves those knots by exactly that vector; the unselected positions
   are unchanged.
5. `knotDeleteSelection()` removes exactly the selection and empties it; the count falls by the
   selected count.
6. A rectangle that covers every remaining knot, then `knotDeleteSelection()`, leaves exactly 3
   knots. A second full rectangle, then `knotDeleteSelection()`, returns `refused: true`,
   `reason: "minimum"`, and the count is still 3.
7. Select two knots again, then dispatch a real `Escape` `keydown` on `window`: the selection is
   empty.
8. Select two knots, then dispatch a real `Delete` `keydown` on `window`: the selection is deleted
   when edit mode is on. Select two knots, focus `#knot-tol`, dispatch `Delete`: nothing is deleted.
9. A view change clears the selection.
10. A join switch (`poly` then `bezier`) keeps the same selection and the same indices.
11. `reduce` clears the selection.
12. In edit mode, a `pointerdown` with `shiftKey` on the canvas followed by a `pointermove` and a
    `pointerup` selects at least one knot, and the `#marquee` element is hidden after release. The
    check derives the three client positions from `__ctl.knotScreen(index)`.
13. `__ctl.knotScreen(index)` is added for step 12: it projects a knot to CSS pixels through
    `Vector3.project(camera)`, and returns `{ x, y }` inside the canvas rectangle.
14. With edit mode on and `left` shown, dispatch a real `Shift` `keydown` on `window`: the computed
    cursor of the canvas is `crosshair`. Dispatch `Shift` `keyup`: the cursor is no longer
    `crosshair`, and it is `grab`, because a left drag pans the flat view.
15. **The pan keeps the camera and the selection.** In edit mode, with a selection, a synthesized
    left drag that starts **away from every knot** moves the camera target and leaves
    `knotSelection()` unchanged; `#marquee` stays hidden.
16. **The editor preempts the camera.** In edit mode, a synthesized left drag that starts **on a
    selected knot** moves those knots and leaves the camera target untouched. This is the assertion
    that fails if the preemption is wired on the canvas instead of on an ancestor in the capture
    phase: `OrbitControls` would pan, and the knots would not move.
17. **A `Shift` + left drag is the editor's on a flat view, and the camera's on a free view.** On
    `left`, the gesture opens the marquee and leaves the camera position untouched; on `front-3q`,
    with the editor off, the same gesture rotates the camera.

Steps 12, 15, 16, and 17 are the synthetic pointer gestures. They are guarded: a `NotFoundError` from
`setPointerCapture` is expected and swallowed.

### Gates

- `bun test workflows/threejs/viewer` exits 0, and the existing 30 tests still pass.
- `bun run workflows/threejs/tools/check_knot_selection.ts` exits 0 with the server on
  `http://127.0.0.1:5180`.
- `bun run check` reports the same IoU values and the same worst deviation as before the ticket. The
  ticket changes no scene file, so a moved number is a regression in the viewer, not in the model.
- A rendered trio on `left`, at 100 %, 200 %, and 400 % (after T0003), shows the selection rectangle
  aligned with the plate and the selected handles on their knots at every zoom.

## TDD Tasks

- [ ] **T4.1 — Pure operations, tests first**: write `viewer/knots.test.js` with the four groups
      listed under "Tests". Run `bun test workflows/threejs/viewer`, and prove the new tests fail
      because `indicesInRect`, `addIndices`, `moveKnotsBy`, and `removeKnots` do not exist.
- [ ] **T4.2 — Headless gate, written first**: write `tools/check_knot_selection.ts` against the
      `__ctl` contract. Run it against the current page and prove it fails on assertion 1 or 2, not on
      a missing server.
- [ ] **T4.3 — The kernel**: implement the four functions in `knots.js` until `bun test` passes.
- [ ] **T4.4 — The picker**: add `pickPlaneAt()` to `picker.js`, with the plane and the
      `blocked` option. Add `knotScreen()` to `__ctl`, and prove step 12 of the check can locate a
      knot.
- [ ] **T4.5 — Selection state and gestures**: implement `selection`, `selectionSet`,
      `selectionClear`, the `Shift` + drag marquee, the knot-threshold press claim, the group drag, the
      `Delete`/`Backspace` and `Escape` keys, and the `__ctl` commands in `main.js`. The claim is a
      capture-phase listener on `window`, and it calls `stopPropagation()` only for the presses the
      editor owns. Wire `picker({ blocked })`.
- [ ] **T4.6 — Handles, overlay, and cursor**: add `calque.setSelection()` and the selected `Points`
      object; add `#marquee`, its styles, the hint, the live count, and the `marquee-armed` cursor
      class with its `keydown`/`keyup`/`blur` handling.
- [ ] **T4.7 — Commands and check**: add the `ctl.ts` commands. Run
      `bun run workflows/threejs/tools/check_knot_selection.ts` until it exits 0.
- [ ] **T4.8 — Documents**: update `workflows/threejs/README.md` §5.2 with the new gesture table,
      the selection rules, and the commands; update the "Knot rules" in
      `workflows/threejs/AGENTS.md`; update the board in `tickets/README.md`.
- [ ] **T4.9 — Gates**: run `bun test workflows/threejs/viewer`, the new check, and `bun run check`.
      Record the exact output in `## Implementation Notes`.

## Acceptance Criteria

1. In edit mode on a flat view, `Shift` + left-drag draws a visible rectangle, and on release every
   knot inside the rectangle is selected. A knot exactly on an edge is selected.
2. A second `Shift` + drag **adds** to the selection. No knot is selected twice.
3. A `Shift` click with no movement changes nothing.
4. Selected knots draw with a distinct color and a larger size. The panel shows the selected count,
   and the count follows the rectangle before release.
5. `Delete` and `Backspace` remove exactly the selected knots, and the outline and the visible volume
   rebuild. With fewer than 3 knots left, nothing is deleted and the panel says
   `cannot delete: at least 3 knots`.
6. A drag that starts on a selected knot moves every selected knot by the same vector. The outline
   follows the pointer, and the volume rebuilds on release. Unselected knots do not move.
7. A drag that starts on an unselected knot moves nothing; the selection clears. A drag that starts
   away from every knot pans the camera and keeps the selection. No click adds or removes a knot.
8. `Escape` clears the selection, or cancels an open marquee without changing the selection it had
   at press. A view change, `reduce`, `reset`, and leaving edit mode clear the selection too. A join
   switch keeps it.
9. The left-drag pan and the middle-drag dolly keep working while editing, except inside a knot's
   grab threshold, and the measurement tool does not record a point from the `Shift` press that opens
   a marquee.
10. While `Shift` is held in edit mode on a flat view, the canvas cursor is a `+` sight. On release
    it is the open hand of the flat view, and a left-drag pan shows the closed hand even if `Shift`
    is held.
11. The selection is absent from the `POST /api/contours` payload, and `contours.js` is unchanged by
    this ticket.
12. `bun test` is green, `tools/check_knot_selection.ts` exits 0, and `bun run check` reports the same
    IoU and deviation values as before the ticket.
