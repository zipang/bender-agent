# T0009 — Measuring a distance: an anchor, a rubber band, and the length

- **Status**: **draft — the specification is settled (D1–D8), and it awaits the art director's
  validation before it leaves `planned/`.** Every question raised in the first draft is answered.
- **Track**: Three.js viewer (measurement)
- **Wave**: 2 (integration) — it changes `picker.js`, `main.js`, `measure.js`, `index.html` and
  `stage.js`, and it must land after the pointer handlers are settled.
- **Depends on**: T0005 — the chord and the release it lands on; T0004 — it takes the same
  `pointerdown` on the canvas, and the two must not fight over it.
- **Blocks**: `nothing`
- **References**:
  - `tickets/done/T0005-measurement-pick-invocation.md` — the chord this ticket builds on
  - `tickets/done/T0007-viewer-idles-at-zero.md` — the on-demand loop a live rubber band must arm
  - `workflows/threejs/viewer/picker.js` — the recording path, the panel, and `pickAt`
  - `workflows/threejs/viewer/measure.js` — `betweenPoints`, `readPoint`, `panelLines`
  - `workflows/threejs/viewer/stage.js` — `requestFrame` / `nextFrame`, the reason to draw
  - `workflows/threejs/AGENTS.md` — "Measurement rules"
  - MDN `Element.pointermove_event`:
    <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event>
  - Three.js `Line`, `BufferGeometry.setFromPoints`, and `PointsMaterial.sizeAttenuation`:
    <https://threejs.org/docs/#api/en/objects/Line>
    <https://threejs.org/docs/#api/en/core/BufferGeometry.setFromPoints>
    <https://threejs.org/docs/#api/en/materials/PointsMaterial.sizeAttenuation>

## Context & Goal

T0005 settled **how** a point is invoked: `Ctrl` + left click, on the release, under 3 px of movement.
It did not settle what the art director **sees**. Three gaps follow, and they are the reason this
ticket exists.

1. **The tool cannot be turned on from the page.** `measurement.active` is set only by
   `__ctl.measure({ on: true })` (`main.js:959`). There is no button and no key. `index.html` has
   `#layers`, `#views` and `#knots`, and no control for the measurement. A feature that only the
   console can reach does not exist for the art director.
2. **Nothing is drawn where the point lands.** `picker.js` creates one `<div id="measure-panel">` and
   nothing else. No marker, no line. A `Ctrl` + click changes text in a corner panel and the canvas
   looks untouched.
3. **The panel states the wrong gesture.** `measure.js:80` still prints `click to place a point,
   shift-click to pick the model` — the chord before T0005. T0005 excluded `measure.js` on the ground
   that it changes "how a point is invoked, not what is recorded"; the help line is the invocation,
   so it is a leftover of that ticket, not a scope violation.

**Done means**: the art director turns the measurement on from the page, places an anchor with
`Ctrl` + left click, **sees a line from that anchor to the cursor**, places a second point, and reads
the distance between the two points.

## The interaction, as asked

```text
tool on
  Ctrl + click            -> an anchor is placed. A marker appears on the plate.
                             A line runs from the anchor to the cursor and follows it.
  move the pointer        -> the line follows. The length is a live readout.
  Ctrl + click            -> the second point is placed. The line freezes.
                             The panel gives the distance between the two points.
```

The line is the **rubber band**: it is not a measurement until the second point exists. Before the
second point, it is an aiming aid.

## What already exists, and what must be built

| Piece | Today | This ticket |
| :--- | :--- | :--- |
| the chord | `Ctrl` + click on release, under 3 px (T0005) | unchanged |
| `pickAt(nx, ny, source)` | raycasts the plate or the model, returns a world point | reused, unchanged |
| `betweenPoints(from, to, axes)` | the per-axis delta and the length, in mm | reused, unchanged |
| `panelLines(panel)` | a pure formatter, no DOM, no THREE | gains the live length and the frozen result |
| the marker and the line | do not exist | a `Line` and a point marker, in the scene |
| the frame | drawn on demand; the loop sleeps when nothing is dirty (T0007) | **armed on every `pointermove` while anchored**, and asleep again when the pointer stops |
| the trigger | `__ctl.measure({ on: true })` only | a control on the page, and a key |

## The frame budget — this is the trap

T0007 made the loop stop when there is no reason to draw. A line that follows the cursor is a reason
to draw on **every** `pointermove`, and it is the first feature in this repository that needs a frame
from a pointer event. Two rules follow.

- `stage.requestFrame()` is exposed on the stage's returned object (it exists at `stage.js:137` and is
  currently private). `nextFrame()` is not the right call here: it registers a promise waiter per
  move, and the waiter machinery is for a caller that must see the frame, not for a stream of moves.
- The loop must **not** be armed by a `pointermove` that changes nothing: when the tool is off, or no
  anchor is placed, the handler returns without asking for a frame. `check_idle.ts` must still pass,
  and the idle cost must stay at zero.

## Scope Boundary

May be created or modified:

- `workflows/threejs/viewer/picker.js` — the anchor state, the marker, the rubber band, the pointer
  move, and the completion
- `workflows/threejs/viewer/measure.js` — the pure lines: the live length, the frozen result, and the
  corrected help text
- `workflows/threejs/viewer/main.js` — the trigger wiring and the cursor state
- `workflows/threejs/viewer/index.html` — the control, and the cursor class
- `workflows/threejs/viewer/stage.js` — expose `requestFrame`
- `workflows/threejs/tools/check_measure.ts` — the gate grows the new assertions
- `workflows/threejs/README.md`, `workflows/threejs/AGENTS.md`, `tickets/README.md`

Do **not** touch: `viewer/camera.js` (T0003 owns the gestures), `viewer/calque.js` (the plate and the
knot handles), the knot editor's own state (T0004), `tools/check.ts`, `scenes/**`, `blueprints/**`.

## Contract

### State

```js
// in the picker
measurement.anchor   // null | { source, view, world: [x,y,z], u, v, axes, read }
measurement.points   // the recorded points, as today
```

| State | Anchor | Cursor line | Panel |
| :--- | :--- | :--- | :--- |
| `idle` | none | none | the help line |
| `anchored` | one point | from the anchor to the cursor | the anchor, and the live length |
| `measured` | two points | frozen | the two points, the per-axis delta, the length |

A `Ctrl` + click in `measured` **clears the pair and places a new anchor** (D2): the transition is
`measured -> anchored`, never `measured -> measured + one more`. One measurement is on screen.

### The trigger (D3)

- A key `M` toggles the tool, and a button carries the pressed state. The button reads the state from
  one place, as `#layer-*` and `#knot-edit` do, and `aria-pressed` is the state, not a second copy of
  it.
- The key must not fire while a text field has the focus. `#knots` holds a number input, so the
  handler tests the focused element, not only the key code.
- On a free view the tool is inert (D1). The button is `disabled` with a `title` that says why, and
  `M` does nothing. The page states the truth before the click, rather than accepting a toggle that
  has no effect (D8).

### The rubber band

- The anchor is placed by the existing `Ctrl` + click path. The moving end is a `pickAt` at the
  cursor's NDC, with the **anchor's** `source`: a point on the plate measures against the plate.
- The moving end is `null` when the ray misses the plate. Then the line is hidden, and the live length
  reads `—`. It must not jump to the last valid position.
- The segment is one `THREE.Line` with two vertices, in world metres, updated in place. The marker is
  one small object at the anchor. Both are added to the scene once and only made visible or invisible,
  never rebuilt per move.
- The marker is a **fixed size on screen** (D7): it stays readable at 100 % and at 400 %. It is a
  screen landmark, not a dimension of the model. The threshold follows the same rule the knot handles
  use — a constant on screen, divided by the zoom.

### The end of a measurement (D5)

- `Escape` clears the measurement, in `anchored` and in `measured`.
- Switching the tool off clears the measurement. The panel returns to its help line.
- A view change clears the measurement (D6): a measurement on the plate of `left` describes nothing on
  `front`, and keeping it would ask the reader to guess what it refers to. The world anchor is dropped
  with it, so nothing survives to be misread.
- There is no `clear` button. `Escape`, the tool, and the view are the three gestures, and each one is
  already a thing the art director does.

### The readout (D4)

- The live length is the 3D distance between the anchor and the cursor, in mm, through the existing
  `betweenPoints`.
- The frozen result is the same, plus the per-axis delta, on the second point.
- The panel is redrawn through `panelLines`, which stays pure. No new HTML element, and no label that
  follows the cursor.

### What must not change

- The chord, the 3 px rule, the release moment, and the `window` capture claim (T0005).
- `pickAt`, `pick`, `between`, `lastBetween`, `clear`, `on`, `off` and `state` keep their signatures.
- The idle cost stays at zero with the tool off, and with the tool on but no anchor placed.

## Decisions settled with the art director

- **D1 — The moving end lands on the plate, by raycast**, exactly as the first point does. The
  consequence is accepted: **the measurement lives on the flat views only.** A free view has no plate,
  so `pickAt` returns `null`, nothing is recorded, and nothing is drawn. The tool does not invent a
  plane to measure against, because a distance that depends on the camera angle is not a distance
  about the model.
- **D2 — A third `Ctrl` + click replaces the measurement.** One measurement is on screen at a time.
  The third click is a new anchor: the old pair is cleared, the new anchor is placed, and the rubber
  band re-arms. The screen never carries two measurements, so nothing has to distinguish them.
- **D3 — The tool is turned on by a key `M` and by a button.** The button carries the pressed state,
  like `#layer-*` and `#knot-edit`, so the page always says whether the measurement is on. The key is
  for the working gesture; the button is for the discoverability the tool has never had.
- **D4 — The length is read in the panel, bottom left.** One rendering path, always in the same place,
  and `panelLines` stays pure and headless-testable. A label beside the cursor is a second HTML path;
  it is not in this ticket.
- **D5 — `Escape` clears, and switching the tool off clears.** No `clear` button. The measurement never
  outlives the gesture that made it.
- **D6 — A view change clears the measurement.** It is anchored on one view's plate, so it is dropped
  with that view rather than carried, world-anchored, onto a view where it describes nothing.
- **D7 — The marker is a fixed size on screen.** It is a landmark, not a dimension of the model, and it
  stays readable at every zoom.
- **D8 — On a free view the tool refuses to turn on**: the button is `disabled`, and `M` is inert. The
  page says the tool is unavailable instead of accepting a toggle that would do nothing.

## Not in this ticket

- **Snapping.** A point does not snap to the plate's edges, to a knot, or to a grid. Stage 1 reads a
  photograph by eye; snapping is a different tool and a different ticket.
- **Several measurements at once.** D2 keeps one on screen.
- **A label beside the cursor.** D4 keeps the readout in the panel.
- **A measurement written to the scene.** Nothing is saved, and nothing reaches `contours.js` or the
  API.

## TDD Tasks

- [ ] **T9.1 — The pure lines first**: the live length and the frozen result in `measure.js`, with the
      unit tests `measure.test.js` already runs headless. Prove them failing first.
- [ ] **T9.2 — The gate first**: extend `tools/check_measure.ts` with the new assertions — the marker
      exists after the anchor, the line follows a synthetic `pointermove`, the line is frozen after the
      second point, the reported length matches `betweenPoints` on the two picked points, `Escape`
      clears, a third click replaces, and a view change clears. Prove the new assertions fail before
      the implementation.
- [ ] **T9.3 — Implementation**: the anchor state, the marker, the rubber band, the pointer move, the
      `requestFrame` exposure, the trigger, and the clearing paths.
- [ ] **T9.4 — Gates**: `bun test`; `tools/check_measure.ts`; `tools/check_idle.ts` (the loop must
      still idle at zero); `tools/check_zoom.ts`; `bun run check` unchanged.
- [ ] **T9.5 — Documents**: the measurement section of `workflows/threejs/README.md`, the rule in
      `AGENTS.md` if one changes, and the board.

## Acceptance Criteria

1. The measurement is turned on from the page, with no console call: `M`, and a button that carries
   the pressed state.
2. `Ctrl` + left click places an anchor, and a marker appears where it landed, at a fixed size on
   screen at 100 % and at 400 %.
3. A line runs from the anchor to the cursor and follows it, on every move, without leaving the
   previous position behind.
4. A second `Ctrl` + left click places the second point and prints the distance between the two
   points, in millimetres, with the per-axis delta.
5. A third `Ctrl` + left click clears the pair and places a new anchor. One measurement is on screen.
6. `Escape` clears, and switching the tool off clears.
7. A view change clears the measurement.
8. On a free view the button is `disabled`, `M` is inert, nothing is recorded, and nothing is drawn.
9. The panel states the `Ctrl` chord, not the pre-T0005 one.
10. With the tool off, and with the tool on but no anchor, the page idles at zero: `check_idle.ts`
    passes and `bun run check` is unchanged.
