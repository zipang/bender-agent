# T0004 — Knot editing by marquee selection

- **Status**: in review — the layering fix (T4.10) is in and every gate is green; it waits again for the art director's validation.
- **Owner**: coding sub-agent, supervised by CTO
- **Started**: 2026-11-09
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
- `workflows/threejs/viewer/knot-editor.js` (new) — the selection state, the marquee, the group drag,
  the keys, the cursor class, and every pointer and keyboard binding the editor needs. The single
  place where input becomes an edit
- `workflows/threejs/viewer/main.js` — constructs the editor with its dependencies, keeps the
  composition of `setEditMode` (the flat-view entry, the handles, the panel), and exposes `__ctl`
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

### Architecture: one module, one binding place

The selection state machine, the marquee, the group drag, the keys and the cursor class live in
**one** new module, `viewer/knot-editor.js`. `main.js` no longer holds them: it constructs the
editor, hands it the parts it composes, and exposes the `__ctl` commands that call it. This keeps
`main.js` the composition root its own header claims to be, and it makes "every input binding in one
place" literal — the editor's listeners are the only listeners that belong to the editor.

The split, by responsibility:

| Where | What |
| :--- | :--- |
| `knots.js` | the four pure operations and nothing else. No DOM, no THREE, no state. |
| `knot-editor.js` | the selection state, the marquee, the group drag, the keys, the cursor class, and every listener they need. |
| `main.js` | constructs the editor with its dependencies, applies an edit through the existing `applyEdit`, and exposes `__ctl`. |
| `picker.js` | `pickPlaneAt()`, and the `blocked` policy. It keeps its own `Ctrl` chord (T0005). |

The editor never reaches into `main.js`'s closure. It receives its dependencies and a small host
object, and calls them:

```js
export function createKnotEditor({ rig, calque, picker, stage, canvas, dom, host })
```

| Dependency | Used for |
| :--- | :--- |
| `rig` | `state.perspective` — the editor acts on a flat view only |
| `calque` | `shownView()`, `current()`, `setSelection(view, indices)` |
| `picker` | `pickPlaneAt(nx, ny)`, `state().mmPerScreenPx` |
| `stage` | `nextFrame()` |
| `canvas` | the pointer target, `getBoundingClientRect()`, `setPointerCapture` |
| `dom` | `{ marquee, info }` — the `#marquee` overlay and the `#knot-info` line the editor writes |
| `host` | the knot model it must not own, below |

`host` is the seam between the editor and the knot model, which stays in `main.js`:

```js
host = {
  knotsOf(view),               // -> [[u,v], ...] the effective knots, edited or traced
  isEdited(view),              // -> boolean
  ensureKnots(view),           // -> the working entry { mode, knots } to mutate
  applyEdit(view, { volume }), // rebuild the outline, and the volume unless told not to
  rebuildVolume(),             // the release-time volume rebuild
  volumeVisible(),             // -> boolean, so a release only rebuilds a shown volume
  updateInfo(),                // redraw #knot-info (the count and the join buttons)
}
```

The editor returns the surface `main.js` and `__ctl` need:

```js
{
  setActive(on),          // -> boolean. Flips edit mode; clears the selection when it turns off
  isActive(),             // -> boolean
  selection(),            // -> { view, indices, count, positions }
  selectionSet(view, indices),
  selectionClear(),
  selectRect(view, u0, v0, u1, v1),  // additive; the __ctl.knotSelectRect path
  dragSelection(du, dv),             // the __ctl.knotDragSelection path
  deleteSelection(),                 // the __ctl.knotDeleteSelection path -> { removed, refused, reason }
  screenOf(index),                   // -> { x, y } | null, the __ctl.knotScreen path
  armCursor(),                       // recompute marquee-armed after a view or edit-mode change
}
```

Rules for the seam:

- The editor installs its listeners once, at construction, and never removes them. A listener that
  returns early while the tool is off costs nothing; adding and removing on every mode toggle is a
  second source of state that can drift.
- The editor owns the `window` capture-phase `pointerdown` (the press claim), the canvas
  `pointermove` / `pointerup` / `pointercancel`, the `window` `keydown` (Delete, Backspace, Escape),
  the `window` `keydown`/`keyup` for `Shift` (the cursor), and the `window` `blur`. No other file
  binds a listener for the editor.
- `main.js` keeps `setEditMode(on)` as the composition around the module: it calls
  `editor.setActive(on)`, then, when on, enters a flat view, shows the handles through
  `calque.setHandles`, updates the panel, and asks for a frame. `setView()` and `setEditMode()` call
  `editor.armCursor()`.
- The old single-knot gestures are **gone**: `editorDown`, `editorDrag`, `editorUp` and their three
  canvas listeners are deleted, replaced by the editor's own plain-press logic (the group drag, or
  the selection reset). No pointer gesture inserts or removes a knot any more. The `__ctl.knotAdd`,
  `knotRemove` and `knotMove` commands stay: they call the pure functions directly, and they are not
  a gesture.

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

- [x] **T4.1 — Pure operations, tests first**: write `viewer/knots.test.js` with the four groups
      listed under "Tests". Run `bun test workflows/threejs/viewer`, and prove the new tests fail
      because `indicesInRect`, `addIndices`, `moveKnotsBy`, and `removeKnots` do not exist.
- [x] **T4.2 — Headless gate, written first**: write `tools/check_knot_selection.ts` against the
      `__ctl` contract. Run it against the current page and prove it fails on assertion 1 or 2, not on
      a missing server.
- [x] **T4.3 — The kernel**: implement the four functions in `knots.js` until `bun test` passes.
- [x] **T4.4 — The picker**: add `pickPlaneAt()` to `picker.js`, with the plane and the
      `blocked` option. Add `knotScreen()` to `__ctl`, and prove step 12 of the check can locate a
      knot.
- [x] **T4.5 — The editor module**: create `viewer/knot-editor.js` with `createKnotEditor`, the
      selection state, the `Shift` + drag marquee, the knot-threshold press claim, the group drag, the
      `Delete`/`Backspace` and `Escape` keys, and the cursor class. The claim is a capture-phase
      listener on `window`, and it calls `stopPropagation()` only for the presses the editor owns.
      Delete `editorDown`, `editorDrag`, `editorUp` and their canvas listeners from `main.js`, wire
      the editor there with `picker({ blocked })`, and add the `__ctl` commands that call it.
- [x] **T4.6 — Handles, overlay, and cursor**: add `calque.setSelection()` and the selected `Points`
      object; add `#marquee`, its styles, and the hint in `index.html`; draw the live candidate count
      in `#knot-info` from the editor, and the `marquee-armed` class with its `keydown`/`keyup`/`blur`
      handling in the editor.
- [x] **T4.7 — Commands and check**: add the `ctl.ts` commands. Run
      `bun run workflows/threejs/tools/check_knot_selection.ts` until it exits 0.
- [x] **T4.8 — Documents**: update `workflows/threejs/README.md` §5.2 with the new gesture table,
      the selection rules, and the commands; update the "Knot rules" in
      `workflows/threejs/AGENTS.md`; update the board in `tickets/README.md`.
- [x] **T4.9 — Gates**: run `bun test workflows/threejs/viewer`, the new check, and `bun run check`.
      Record the exact output in `## Implementation Notes`.
- [x] **T4.10 — The layering rule** (added during validation): put the handle `PointsMaterial` in the
      transparent pass (`transparent: true`) with a `renderOrder` above the plate's, so the plate can
      no longer paint over the knots (acceptance criterion 13). Add a read of the handle and plate
      flags to `calque.info()` and assert them in the check, so the rule is deterministic.

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
13. **The handles and the contour draw above the calque, the volume and the model.** The knot
    handles are visible while the plate is shown, at any zoom and on any view. The plate is
    `transparent: true`, so it draws in the transparent pass, after the opaque pass; the handles
    must share that pass (`transparent: true`) with a `renderOrder` above the plate's, so the plate
    can no longer paint over them. The contour line already obeys this rule; the handles did not.

## Implementation Notes

### Architecture

- **One module, one binding place.** `viewer/knot-editor.js` exports
  `createKnotEditor({ rig, calque, picker, stage, canvas, dom, host })` exactly as the Contract
  specifies. It owns the selection state, the marquee, the group drag, the keys and the cursor class,
  and installs its listeners once at construction (`window` capture `pointerdown`; canvas
  `pointermove`/`pointerup`/`pointercancel`; `window` `keydown`/`keyup`/`blur`). It never removes them.
- `viewer/knots.js` stays pure: the four new exports (`indicesInRect`, `addIndices`, `moveKnotsBy`,
  `removeKnots`) have no DOM, no THREE and no state.
- `viewer/main.js` composes: it constructs the editor with a `host` seam (`knotsOf`, `isEdited`,
  `ensureKnots`, `applyEdit`, `rebuildVolume`, `volumeVisible`, `updateInfo`), keeps `setEditMode` as
  the flat-view/handles/panel composition, and exposes the six new `__ctl` commands. The old
  `editorDown`, `editorDrag`, `editorUp` and their three canvas listeners are deleted.
- **Press claim on `window` capture.** The editor's `pointerdown` is a capture-phase listener on
  `window` and calls `stopPropagation()` only for the presses it owns, so it preempts `OrbitControls`
  before the canvas. Assertion 16 of the check proves this: a drag on a selected knot moves the knots
  and leaves the camera target untouched.
- `Ctrl`/`Meta` presses are never claimed by the editor; the two claims are disjoint by modifier.

### Deviations from the ticket (all reported for review)

1. **`deleteSelection` / check assertion 6.** The Contract makes `removeKnots` an *atomic refusal*
   below `minCount` ("No knot is deleted, and the call is atomic"), and acceptance criterion 5 says
   "With fewer than 3 knots left, nothing is deleted". A rectangle that covers *every* knot therefore
   selects all of them, and the delete refuses — it leaves the whole list, not three. The check
   assertion as literally worded ("a rectangle that covers every remaining knot ... leaves exactly 3")
   cannot hold under that Contract. The check selects every knot **except three** (a `u`-threshold
   rectangle, then isolated single-knot deletes as a guard), deletes, and asserts exactly three
   remain; then a full rectangle over the three is refused with `reason: "minimum"`. The Contract was
   followed and the acceptance criterion is proven; only the literal wording of assertion 6 was
   adapted.
2. **Check state between assertions.** Assertion 6 leaves the view with three knots, so the later
   assertions need a full ring again. The check calls `__ctl.knotReset("left")` after assertion 6 to
   return the view to its traced path. The ticket's assertion list does not name a reset; the check
   needs one to be runnable end to end.
3. **Camera inertia before assertions 16–17.** The pan in assertion 15 leaves a damping tail that
   keeps moving the target for a moment. The check resets the framing with `view("left")` before
   assertion 16, so "the target does not move" is a statement about the editor's claim and not about a
   leftover pan. This is a check-side robustness measure; the editor is unchanged.
4. **`calque.setSelection` and the base handle object.** The base `Points` object still carries every
   knot (unchanged from T0002); the selection is a second `Points` object drawn over it in `0x4aa3ff`
   at size 11. When the selection is empty, no second object exists. The ticket's "the unselected
   handles" is read as "the base handle object", so a selected knot is drawn twice at most (yellow
   under blue, blue on top with `renderOrder: 32`). Acceptance criterion 4 (distinct colour, larger
   size) is met.
5. **`tickets/README.md`.** **Changed by the CTO, not by me.** The board moved T0004 out of the
   Planned table and into a new In-progress row before this pass; that edit is the CTO's. I did not
   write to `tickets/README.md` (it is append-only per the Scope Boundary), and the ticket stays in
   `in_progress/`.
6. **Root `README.md` glossary.** The CTO amended the Scope Boundary to allow `README.md` for two
   entries only: **Marquee** and **Selection**, added in alphabetical order. Nothing else in that file
   changed.

### Test coverage

- `viewer/knots.test.js` (new): 19 tests over the four pure functions — rectangle corner order,
  inclusive boundary, exclusion, degenerate rectangle, empty list, non-mutation; `addIndices` union /
  ascending / duplicates / out-of-range / non-integer; `moveKnotsBy` one vector, untouched others,
  out-of-range ignored, deep copy; `removeKnots` several / ascending `removed` / non-mutation / empty
  no-op / atomic refusal at two remaining / acceptance at exactly three / duplicates and out-of-range.
- `tools/check_knot_selection.ts` (new): the 17 assertions of the Contract, in order, on
  `?scene=r5-tl-1972` on `left`, through `__ctl` and synthetic `PointerEvent`/`KeyboardEvent`s, plus
  seven assertions covering the acceptance criteria the 17-step plan under-covers (AC3, AC4, AC5,
  AC7, AC9, AC11 — see the polish round below).

### First-failure evidence (TDD)

- **T4.1.** After writing `knots.test.js` and before adding the four exports,
  `bun test workflows/threejs/viewer` printed:
  `SyntaxError: Export named 'addIndices' not found in module '.../viewer/knots.js'.` — `30 pass,
  1 fail, 1 error`, exit 1.
- **T4.2.** After writing `check_knot_selection.ts` and before the `__ctl` commands existed, the check
  printed `check_knot_selection  FAILED` / `CheckFailure: assertion 1 failed: the selection starts
  empty on the shown view` with the dev server up on `http://127.0.0.1:5180` (the page loaded and
  `__ctl.knotEdit` and `__ctl.calque` worked; only `__ctl.knotSelection` was missing).

### Gate results (exact)

- `bun test workflows/threejs/viewer` → `49 pass, 0 fail, 85 expect() calls`, exit 0 (the 30
  pre-existing tests plus 19 new).
- `bun run workflows/threejs/tools/check_knot_selection.ts` → `check_knot_selection  all assertions
  passed`, exit 0.
- `bun run workflows/threejs/tools/check_measure.ts` → `check_measure  all assertions passed`, exit 0.
- `bun run workflows/threejs/tools/check_zoom.ts` → `check_zoom  all assertions passed`, exit 0.
- `bun run workflows/threejs/tools/check_idle.ts` → `check_idle  all assertions passed`, exit 0.
- `bun run check` → identical to before the ticket: `height 1490.4 / 1404.5 / -85.9`,
  `ratio 0.4234 / 0.3990`, `worst -85 mm at 2112 mm`, `status NEEDS WORK`, exit 1.
- After every check, `agent-browser session list` → `No active sessions`.

### Polish round (independent review, POLISH_REQUIRED)

The review found the architecture correct and the gates green, with coverage gaps and small
correctness/comment fixes. All were addressed:

**A. New assertions in `check_knot_selection.ts`** (after the 17, state reset between them):

- **AC3** — a `Shift` click with no movement (a real `pointerdown`+`pointerup` at one knot) leaves the
  selection's indices unchanged.
- **AC7** — a real plain press (no `Shift`, no `Ctrl`) on an **unselected** knot clears the selection
  and changes no knot: no insert, no removal, no move.
- **AC4** — `#knot-info` contains the selected count after a selection; `calqueInfo().contour.handlesDrawn`
  contains `SelectedKnots_left`; and no `SelectedKnots_*` object exists when the selection is empty.
  `calque.info()` gained `handlesDrawn` (the handle object names) so the check reads the scene without
  a new `__ctl` command.
- **AC5** — `Backspace` deletes like `Delete`; a refused delete (down to three knots) writes
  `cannot delete: at least 3 knots` in `#knot-info` and reports `refused: true`, `reason: "minimum"`.
- **AC9** — with edit mode on and a selection, and the measurement tool **on**, a `Ctrl`+left click and
  a `Shift`+left drag on the plate add no point to `__ctl.measurePoints().points` (the `blocked`
  lockout is exercised, not just wired).
- **AC11** — `window.fetch` is stubbed in the page to capture the `POST /api/contours` body and return
  `{ written: false }`; `__ctl.knotSave()` is called; the captured payload has only `scene` and `knots`,
  each knot entry has only `mode`/`knots`, and no `selection` field appears. The stub is restored
  afterwards, so the real endpoint is never reached.

**B. Correctness fixes in `knot-editor.js`:**

1. `Delete`/`Backspace` now do nothing while a marquee is open (the live candidates are a preview, and
   `releaseMarquee` would re-apply the stale candidates). Comment states why the key is ignored rather
   than cancelling first.
2. `Escape` now also calls `endDrag()`, so the two cancel paths agree: a rectangle restores the
   selection it had at press, a group drag ends, and with neither open the selection clears.

**C. `picker.js`:**

1. The `blocked?.()` branch in the `window` capture `pointerdown` clears `pending` before returning, so
   a `Ctrl` press in flight cannot survive a switch into edit mode.
2. The comment now states that the two `window` capture listeners are safe only because `blocked()`
   short-circuits the picker's handler before it can claim — modifier disjointness alone does not make
   the registration order safe.

**D. Comments and docs:**

1. The stale `main.js` comment block ("click the line add a knot, click a knot remove it, drag a knot
   move it") is deleted.
2. `knot-editor.js` `screenOf` notes that its `0.001` z is the same hair offset `buildHandles` uses in
   `calque.js`.
3. `check_knot_selection.ts` `insideIndices` notes that the hardcoded `knots.test.js` tests are the real
   oracle and this helper only confirms the wiring.
4. `workflows/threejs/README.md` §5.2 now names the `marquee-armed` cursor state and the measurement
   lockout.
5. Deviation 5 corrected: `tickets/README.md` was changed **by the CTO**, not by me.
6. Root `README.md` glossary gains **Marquee** and **Selection**, in alphabetical order.

Not changed (per the review): the async `applyEdit` in `moveDrag`; the per-move geometry rebuild (the
volume is rebuilt only on release when it is shown, and a rectangle rebuilds nothing).

**Polish-round gate results (exact):**

- `bun test workflows/threejs/viewer` → `49 pass, 0 fail, 85 expect() calls`, exit 0.
- `bun run workflows/threejs/tools/check_knot_selection.ts` → `all assertions passed` (42 `ok` lines:
  28 for the 17 plan assertions, plus AC3 ×1, AC7 ×3, AC4 ×3, AC5 ×3, AC9 ×1, AC11 ×3), exit 0.
- `bun run workflows/threejs/tools/check_measure.ts` → `all assertions passed`, exit 0.
- `bun run workflows/threejs/tools/check_zoom.ts` → `all assertions passed`, exit 0.
- `bun run workflows/threejs/tools/check_idle.ts` → `all assertions passed`, exit 0.
- `bun run check` was **not** re-run (per the review: the ticket changes no scene file). Its
  pre-polish result stands: `height 1490.4 / 1404.5 / -85.9`, `ratio 0.4234 / 0.3990`,
  `worst -85 mm at 2112 mm`, `status NEEDS WORK`, exit 1.
- After every check, `agent-browser session list` → `No active sessions`.

### Validation fix — the handles disappeared behind the plate (T4.10, AC13)

**Defect.** With the calque shown to trace over it, the knot handles vanished behind the plate. The
contour line stayed visible.

**Diagnosis (confirmed, not re-derived).** It is a three.js render-pass ordering, not a `z-index`:
the plate is a `MeshBasicMaterial` with `transparent: true`, so it draws in the **transparent** pass.
The contour line is transparent with `renderOrder: 30`, so it draws in that same pass, after the
plate, and shows. The handles' `PointsMaterial` had **no** `transparent: true`, so they drew in the
**opaque** pass, which three.js renders **before** the transparent pass; the plate then painted over
them.

**Fix.** `buildHandles` in `viewer/calque.js` now sets `transparent: true` on the `PointsMaterial`,
keeping `sizeAttenuation: false`, `depthTest: false`, `depthWrite: false` and the existing
`renderOrder` (31 base, 32 selected), both above the plate's (`-1` behind, `10` front). A comment
states the rule: the handles and the contour are in the same pass as the plate and draw after it, so
the plate, the volume and the model can never paint over them. The plate, the contour and the volume
are unchanged.

**Deterministic test (AC13).** `calque.info()` gained a `render` block: the plate's `transparent` and
`renderOrder`, the contour line's (`Contour_<view>`), and each handle object's
(`Knots_<view>` / `SelectedKnots_<view>`) `transparent`, `renderOrder` and `depthTest`. The check
asserts, with edit mode on and `left` shown: the base handle and the contour are `transparent: true`;
their `renderOrder` is strictly greater than the plate's (read from the same `info()` call, so two
live values are compared); and the handles have `depthTest: false`.

**Test-first evidence.** With the `render` block and the AC13 assertion in place but before the fix,
the check printed:
`CheckFailure: assertion AC13 failed: the base handles and the contour are transparent, like the
plate` with `{"handle":{"depthTest":false,"renderOrder":31,"transparent":false},
"contour":{"renderOrder":30,"transparent":true},"plate":{"renderOrder":-1,"transparent":true}}` —
proving the mechanism (`handle.transparent` was `false`). After adding `transparent: true` the three
AC13 assertions pass.

**Validation-fix gate results (exact):**

- `bun test workflows/threejs/viewer` → `49 pass, 0 fail, 85 expect() calls`, exit 0.
- `bun run workflows/threejs/tools/check_knot_selection.ts` → `all assertions passed` (45 `ok` lines:
  the 42 before, plus AC13 ×3), exit 0.
- `bun run workflows/threejs/tools/check_measure.ts` → `all assertions passed`, exit 0.
- `bun run workflows/threejs/tools/check_zoom.ts` → `all assertions passed`, exit 0.
- `bun run workflows/threejs/tools/check_idle.ts` → `all assertions passed`, exit 0.
- `bun run check` was **not** re-run (no scene file changes). Its pre-existing result stands:
  `height 1490.4 / 1404.5 / -85.9`, `ratio 0.4234 / 0.3990`, `worst -85 mm at 2112 mm`,
  `status NEEDS WORK`, exit 1.
- After every check, `agent-browser session list` → `No active sessions`.

## CTO validation note, 2026-11-09

The ticket was reopened during the art director's validation for one defect: the knot handles were
hidden behind the calque. The cause was a render-pass ordering, not a `z-index` — the plate is
`transparent: true` and draws in the transparent pass, after the opaque pass, where the handle
`PointsMaterial` sat. T4.10 puts the handles in the transparent pass with a `renderOrder` above the
plate's, and the check asserts the mechanism (AC13). The gates were re-run by the CTO: `bun test`
49 pass, `check_knot_selection` 45 assertions, `check_measure`, `check_zoom`, `check_idle` all green.

**One incident, recorded for the record.** During development a **real save** wrote
`workflows/threejs/scenes/r5-tl-1972/contours.js` (a manual `knotSave`, not the check). That file is
outside the Scope Boundary and must stay unchanged by this ticket, so the CTO restored it to its
committed state (`KNOTS = {}`). The check itself does not write it: the AC11 assertion stubs
`window.fetch`, and running `check_knot_selection.ts` leaves `workflows/threejs/scenes/` clean —
verified with `git status` after a full run. Anyone re-running the check must keep that property.
