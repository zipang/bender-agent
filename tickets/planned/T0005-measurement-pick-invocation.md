# T0005 — How a measurement point is invoked: Ctrl + left click, on release

- **Track**: Three.js viewer (measurement)
- **Wave**: 1 (independent)
- **Depends on**: T0003 — the left-drag pan is what makes the plain-left record wrong.
- **Blocks**: T0004 — it shares `picker.js`, and its `blocked` option lands on the handler this
  ticket rewrites.
- **References**:
  - `workflows/threejs/viewer/picker.js` — the recording handler
  - `workflows/threejs/viewer/measure.js` — `readPoint`, `panelLines`, and `mmPerScreenPx`
  - `tickets/planned/T0003-orthogonal-view-zoom.md` — the left-drag pan that creates the defect
  - `tickets/planned/T0004-knot-marquee-selection.md` — the `blocked` option added after this ticket
  - MDN `pointerdown`, `pointerup`, and `pointercancel`:
    <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event>
    <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerup_event>
    <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event>
  - MDN `MouseEvent.ctrlKey` and `MouseEvent.shiftKey`:
    <https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/ctrlKey>
    <https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/shiftKey>
  - MDN `EventTarget.addEventListener()` and `Event.stopPropagation()` — a capture-phase listener on
    an ancestor runs before a listener the target already holds:
    <https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener>
    <https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation>

## Context & Goal

T0003 gives the left button to the camera: a left drag pans, on the flat views and on the free views
alike. `picker.js` records a measurement point on a plain `pointerdown`. Two defects follow. With the
measurement tool on, **every pan drops a point**, and the panel fills with coordinates the art
director never asked for. And a plain left click is now ambiguous: it is the pan's resting gesture,
not a measurement.

**Done means**: a point is invoked by **`Ctrl` + left click**, and it lands on the **release**, not on
the press. A drag records nothing. A plain left click records nothing. The recorded coordinates are
the ones the click landed on.

## Scope Boundary

May be created or modified:

- `workflows/threejs/viewer/picker.js` — the chord, the recording moment, and the claim
- `workflows/threejs/tools/check_measure.ts` (new) — the headless gate
- `workflows/threejs/README.md` — the measurement section
- `tickets/README.md` — the board

Do **not** touch:

- `workflows/threejs/viewer/main.js` — `__ctl.measure`, `__ctl.measurePoints`, and
  `__ctl.measurePick` already expose everything the check needs. The `measure` toggle keeps its
  meaning: the chord invokes a pick, and the tool must still be on for one to be recorded.
- `workflows/threejs/viewer/camera.js` — T0003 owns the pan and the `mouseButtons` table.
- `workflows/threejs/viewer/measure.js`, and the readout, the panel, and the per-axis breakdown. This
  ticket changes **how** a point is invoked, not what is recorded.
- `workflows/threejs/tools/check.ts` and its thresholds.
- The knot editor. T0004 adds its `blocked` option to the same handler, after this ticket.

## Contract

### The chord

A measurement point is invoked by `Ctrl` + left click. `Shift` keeps its current meaning, the model
instead of the plate:

| Chord | `source` | Records |
| :--- | :--- | :--- |
| `Ctrl` + left click | `"calque"` | one point, on release, if the pointer moved under 3 px |
| `Ctrl` + `Shift` + left click | `"model"` | one point, on release, if the pointer moved under 3 px |
| `Ctrl` + left drag | — | nothing |
| plain left click or drag | — | nothing. The camera owns it |

`ctrlKey` only. `metaKey` is deliberately **not** accepted: on macOS a `Meta` click is the
secondary-click gesture, and the art director asked for `Ctrl`.

### The claim, and why it is on an ancestor

On a free view `Ctrl` + left is `OrbitControls`' own rotate — the modifier swap that T0003 pins to
r187. The measurement chord must therefore be taken **before** the canvas, exactly as T0004's marquee
is:

- `picker.js` registers its `pointerdown` on `window` with `{ capture: true }`.
- When `measurement.active` is true, the event is `button === 0`, and `event.ctrlKey` is true, the
  handler calls `event.preventDefault()` and `event.stopPropagation()`. The event never reaches the
  canvas, so `OrbitControls` never claims it, on either family.
- When the chord does not match, the handler returns without touching the event. The camera keeps the
  plain left press, and a free view keeps its documented `Ctrl` + left rotate while the tool is off.

### One press, one possible point

```js
const DRAG_PX = 3;   // the same threshold T0004 uses for a degenerate marquee rectangle
let pending = null;  // { pointerId, clientX, clientY, source } | null
```

- **`pointerdown`**, chord matched: store
  `pending = { pointerId, clientX, clientY, source: event.shiftKey ? "model" : "calque" }`. Record
  nothing. The source is decided at the **press**, so releasing `Shift` a moment early cannot change
  which surface the point lands on.
- **`pointerup`** on the canvas, with `pending !== null` and
  `event.pointerId === pending.pointerId`:
  - `hypot(event.clientX - pending.clientX, event.clientY - pending.clientY) < DRAG_PX` — record the
    point at the **release** position, through the existing `pickAt` / `record` path, with
    `pending.source`. Then clear `pending`.
  - Otherwise — record nothing, and clear `pending`.
- **`pointercancel`**, `window.blur`, and a `pointerdown` with a different button clear `pending`
  without recording.
- A `pointerup` with `pending === null` records nothing. This is what makes T0004's press claim safe:
  when the knot editor consumes a press with `stopPropagation()`, the picker never sees the press, so
  the release that follows cannot record a point.

The `pointerup` listener stays on `element` (the canvas), where the current handler is.
`OrbitControls` captures the pointer on the same element, so a `pointerup` reaches the canvas even
when the press was the camera's.

### What does not change

- `pickAt`, `pick`, `record`, `between`, `lastBetween`, `render`, `on`, `off`, `clear`, and `state`
  keep their signatures and their output.
- `mmPerScreenPx()` is read at the moment of the record, as it is today.
- The panel is redrawn on every record, as it is today.
- A `pointerdown` with the chord and `measurement.active` false falls through untouched.

### The gate

`tools/check_measure.ts` opens `?scene=r5-tl-1972` on `left`, turns the measurement tool on with
`__ctl.measure({ on: true })`, and asserts:

1. A plain left **drag** of 40 px records no point (`__ctl.measurePoints().points` unchanged), and it
   moves the camera target instead.
2. A plain left **click** records no point.
3. `Ctrl` + left **click** records exactly one point, and its `u`/`v` match `__ctl.measurePick()` at
   the same NDC to 1e-4.
4. `Ctrl` + left **drag** of 40 px records no point, and the camera target does not move — the claim
   took the press before the canvas saw it.
5. `Ctrl` + `Shift` + left click records `source: "model"`.
6. A `pointercancel` between the press and the release records nothing.
7. With the tool **off**, a `Ctrl` + left drag on `front-3q` rotates the camera
   (`getAzimuthalAngle()` moves). With the tool **on**, the same drag does not. The chord is claimed
   only while the tool is on.

The check synthesises `PointerEvent`s with the `ctrlKey` and `shiftKey` flags set, as T0004's check
does, and swallows the `NotFoundError` that `setPointerCapture` throws for a synthetic pointer.

## TDD Tasks

- [ ] **T5.1 — The gate, written first**: write `tools/check_measure.ts` against the contract above.
      Run it against the current page and prove it fails on assertion 1, not on a missing server: a
      pan records a point today, and the plain-left chord is accepted.
- [ ] **T5.2 — Implementation**: replace the `pointerdown` record in `picker.js` with the `window`
      capture claim, the `pending` slot, the `pointerup` distance test, and the cancel paths.
- [ ] **T5.3 — Gates**: `bun test workflows/threejs/viewer` exits 0; `tools/check_measure.ts` exits
      0; `bun run check` reports the same IoU and the same worst deviation as before the ticket.
- [ ] **T5.4 — Documents**: record the chord and the release rule in the measurement section of
      `workflows/threejs/README.md`; update the board in `tickets/README.md`.

## Acceptance Criteria

1. With the measurement tool on, `Ctrl` + left click adds exactly one point, at the place the click
   landed on, and `Ctrl` + `Shift` + left click reads the model instead of the plate.
2. A left-drag pan adds no point, with the tool on or off.
3. A plain left click adds no point.
4. A `Ctrl` + left movement under 3 px records a point; 3 px or more records none.
5. With the tool off, a free view keeps its `Ctrl` + left rotate. With the tool on, the measurement
   takes the chord.
6. `bun test` is green, `tools/check_measure.ts` exits 0, and `bun run check` reports the same
   numbers as before the ticket.
