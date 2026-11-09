# T0005 — How a measurement point is invoked: Ctrl + left click, on release

- **Track**: Three.js viewer (measurement)
- **Wave**: 1 (independent)
- **Owner**: coding sub-agent, supervised by the CTO
- **Started**: 2026-11-09
- **Depends on**: T0003 — the left-drag pan is what makes the plain-left record wrong.
- **Blocks**: T0004 — it shares `picker.js`, and its `blocked` option lands on the handler this
  ticket rewrites.
- **References**:
  - `workflows/threejs/viewer/picker.js` — the recording handler
  - `workflows/threejs/viewer/measure.js` — `readPoint`, `panelLines`, and `mmPerScreenPx`
  - `tickets/done/T0003-orthogonal-view-zoom.md` — the left-drag pan that creates the defect
  - `tickets/planned/T0004-knot-marquee-selection.md` — the `blocked` option added after this ticket
  - `workflows/threejs/tools/session.ts` — the one owner of a browser session, added by T0006. A new
    check uses it; it opens and closes on every exit path, and every `agent-browser` call has a timeout
  - `workflows/threejs/tools/check_idle.ts` — the newest check, and the shape a check takes here
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

It takes its browser session from `session.ts`, as `check_idle.ts` and `check_zoom.ts` do: one owner,
closed in a `finally` and on `SIGINT`, named after its pid, and a timeout on every `agent-browser`
call. It writes nothing, so it has no report directory to use; if it ever does, the report goes to
`test-reports/`, which T0006 made git-ignored.

## TDD Tasks

- [x] **T5.1 — The gate, written first**: write `tools/check_measure.ts` against the contract above.
      Run it against the current page and prove it fails on assertion 1, not on a missing server: a
      pan records a point today, and the plain-left chord is accepted.
- [x] **T5.2 — Implementation**: replace the `pointerdown` record in `picker.js` with the `window`
      capture claim, the `pending` slot, the `pointerup` distance test, and the cancel paths.
- [x] **T5.3 — Gates**: `bun test` exits 0 with the 34 tests it has today; `tools/check_measure.ts`
      exits 0; `bun run check` prints the same `height`, `ratio`, `worst`, and `status` as the T0008
      baseline and exits `1` as it now does.
- [x] **T5.4 — Documents**: record the chord and the release rule in the measurement section of
      `workflows/threejs/README.md`, and add `check_measure.ts` to the tools table there — a new tool
      updates its workflow's documents in the same change; update the board in `tickets/README.md`.

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

## Implementation Notes

### Files changed

- `workflows/threejs/viewer/picker.js` — the `pointerdown` record is replaced. The chord is a
  capture-phase `pointerdown` on `window`; it stores a `pending` slot and records nothing. A
  `pointerup` on the canvas records one point when the movement is under `DRAG_PX = 3`, at the
  release position, with the source decided at the press. A `pointercancel` on the canvas, a
  `window` `blur`, and a non-chord `pointerdown` clear `pending` without recording. `pickAt`,
  `pick`, `record`, `between`, `lastBetween`, `render`, `on`, `off`, `clear` and `state` keep their
  signatures and their output.
- `workflows/threejs/tools/check_measure.ts` (new) — the headless gate. It opens `?scene=r5-tl-1972`
  on `left`, turns the tool on with `__ctl.measure({ on: true })`, and runs the seven assertion
  groups of the contract. It takes its session from `session.ts` (`measure-check-<pid>`), closes it
  in a `finally` and on `SIGINT`/`SIGTERM`, and writes nothing.
- `workflows/threejs/README.md` — a new `### 7.4 The measurement point` records the chord and the
  release rule; the tools table gains the `tools/check_measure.ts` row.

### Decisions

- **The check synthesises `PointerEvent`s**, as the contract asks, not CDP mouse events. A synthetic
  pointer has an id Chrome does not know, so `OrbitControls`' `setPointerCapture` throws
  `NotFoundError` at the top of its `pointerdown` handler, before it registers its move and up
  listeners, and a synthetic drag would then be dead. The check installs a shim that swallows only
  that error on `Element.prototype.setPointerCapture` and `releasePointerCapture`, and rethrows
  everything else.
- **The target probe matches the view family.** A flat pan is read through `__ctl.state().target`
  (the rig mirrors `flat.target`); a free rotate is read through `__ctl.controls().orbit.azimuth`.
  Both reads wait for the damping tail to hold still, as `check_zoom.ts` does.
- **The board needed no edit.** `tickets/README.md` already lists T0005 under In progress; that edit
  was made when the ticket started. The ticket is not moved to `review/` or `done/` here.

### T5.1 — the failing gate, before the fix

```
check_measure  FAILED
CheckFailure: assertion 1 failed: a plain left drag records no point
  {"before":0,"after":1}
    at ok (.../tools/check_measure.ts:169:29)
    at run (.../tools/check_measure.ts:263:5)
EXIT=1
```

The failure is assertion 1 and not a missing server: the page was up and the run reached the drag.

### T5.3 — the gates, after the fix

`bun run workflows/threejs/tools/check_measure.ts` — exit 0:

```
  ok  1  a plain left drag records no point
  ok  1  a plain left drag moves the camera target
  ok  2  a plain left click records no point
  ok  3  Ctrl + left click records exactly one point
  ok  3  the recorded u/v match the pick at the same NDC to 1e-4
  ok  3  the recorded point came from the plate
  ok  4  a Ctrl + left drag records no point
  ok  4  the claim keeps the camera target still
  ok  5  Ctrl + Shift + left click records source model
  ok  6  a pointercancel drops the pending point
  ok  7  with the tool off, Ctrl + left drag rotates a free view
  ok  7  with the tool on, the same drag does not rotate

check_measure  all assertions passed
```

`bun test` — exit 0: `34 pass  0 fail  52 expect() calls  Ran 34 tests across 4 files. [17.00ms]`.

`bun run check` — exit 1, and the same numbers as the T0008 baseline: `height` reference 1490.4 /
model 1404.5 (`delta -85.9 mm, -5.8 %`), `height / length` 0.4234 / 0.3990 (`delta -0.0244`),
`worst -85 mm at 2112 mm`, `status NEEDS WORK`.

`bun run workflows/threejs/tools/check_idle.ts` — exit 0, `check_idle  all assertions passed`.

`bun run workflows/threejs/tools/check_zoom.ts` — exit 0, `check_zoom  all assertions passed`.

### Session hygiene

Every browser session was closed. `agent-browser session list` reports `No active sessions`.

## CTO audit, 2026-11-09

The independent peer review is **deferred by the art director's instruction**. What was checked here,
by the CTO and not by the coder:

- **Scope.** Only `viewer/picker.js`, `tools/check_measure.ts` (new), `workflows/threejs/README.md`,
  and the board. `main.js`, `camera.js`, `measure.js`, `stage.js` and every other check are untouched.
  The knot editor is untouched, as the scope demanded — it is T0004.
- **The handler matches the contract line by line.** Read in the source: the `window` `pointerdown`
  with `{ capture: true }`; the chord test `measurement.active && button === 0 && ctrlKey`; the
  `preventDefault()` + `stopPropagation()` that keeps the press from reaching `OrbitControls`; the
  source decided at the **press** (`shiftKey ? "model" : "calque"`); the `pending` slot; the `pointerup`
  on the canvas with the `pointerId` match and the `< 3 px` test; the `pointercancel` and `window`
  `blur` paths. `metaKey` appears nowhere.
- **Every assertion the contract asks for exists.** The gate's twelve `ok` lines cover all seven
  numbered items: the plain drag records nothing *and* moves the camera, the plain click records
  nothing, the `Ctrl` click records one point whose `u`/`v` match `measurePick()` to 1e-4 and whose
  source is the plate, the `Ctrl` drag records nothing *and* leaves the target still, `Ctrl` + `Shift`
  reads the model, a `pointercancel` drops the point, and a free view keeps its rotate with the tool
  off and loses it with the tool on.
- **The failing-first proof is the right one**: `assertion 1 failed: a plain left drag records no
  point  {"before":0,"after":1}` — a pan was dropping a point, which is exactly the defect, and not a
  missing server.
- **Gates**: `bun test` → 34 pass, 0 fail. `check_measure.ts` → exit 0. `check_idle.ts` → exit 0.
  `check_zoom.ts` → exit 0. `bun run check` → exit 1, 17.5 s, `height 1490.4 / 1404.5`, `delta -85.9 mm`,
  `worst -85 mm at 2112 mm`, `status NEEDS WORK` — the T0008 baseline, unchanged.
- **`agent-browser session list`** → `No active sessions`. The new check takes its session from
  `session.ts`, as the ticket required.
- **One decision worth recording.** The gate synthesises `PointerEvent`s, and a synthetic pointer does
  not exist for Chrome: `OrbitControls`' `setPointerCapture` throws `NotFoundError` **before** it
  registers its listeners, which would kill a synthetic drag. The gate installs a shim that swallows
  only that error on `setPointerCapture` / `releasePointerCapture` and rethrows everything else. That
  is the right shape — a narrow, named exception rather than a broad `try`/`catch`.

**T0004 is unblocked.** Its two dependencies, T0003 and T0005, are both in `done/`, and the handler
its `blocked` option lands on is now the settled one.

## Acceptance, 2026-11-09

Accepted by the art director. The chord was exercised **by hand on the live page**, not only by the
headless gate: `__ctl.measure({ on: true })` from the console, then the five gestures of the table —
`Ctrl` + click records one point, a plain click and a plain drag record nothing, `Ctrl` + `Shift` reads
the model, and `Ctrl` + drag records nothing.

The art director also confirmed the limit this ticket does not fix, and which T0009 exists for: the
tool is reachable **only** from the console, so the gesture could be validated but the feature could
not be used. T0005 is accepted on its contract — the invocation — and the affordance is T0009.