# T0006 — `check.ts` reports its progress, and its orientation guard stops crawling

- **Track**: Three.js viewer (tools and gates)
- **Wave**: 1 (independent)
- **Depends on**: nothing
- **Blocks**: nothing
- **References**:
  - `workflows/threejs/tools/check.ts` — the gate: `run()`, `roofMassSide()`, `main()`
  - `workflows/threejs/tools/shot.ts` — the capture, one named browser session per run
  - `workflows/threejs/tools/silhouette.ts` — the overlay
  - `workflows/threejs/tools/ctl.ts`, `workflows/threejs/tools/check_zoom.ts` — the session pattern
  - `workflows/threejs/AGENTS.md` — "Every capture pass uses one browser session and closes it"
  - `workflows/threejs/README.md` — the tool table
  - NumPy `maximum.accumulate`, the run-propagation primitive the fix is built on:
    <https://numpy.org/doc/stable/reference/generated/numpy.ufunc.accumulate.html>

## Context & Goal

`bun run check` looks like it hangs. It does not hang: it is silent for **1 minute 54 seconds**. The
art director ran it, saw no output, and could not tell a slow gate from a wedged one.

Measured on this machine, on 2026-11-09, against `r5-tl-1972`, on an idle machine:

| Step | Cost | Output while it runs |
| :--- | :--- | :--- |
| `roofMassSide`, one 1376 × 768 reference | **17.6 s** | none |
| `roofMassSide`, one 1400 × 1000 render | **21.7 s** | none |
| `roofMassSide`, the four images `check.ts` actually reads | **≈ 79 s** | none |
| the whole `bun run check` | **1 min 54 s** | none until the final report |

The orientation guard is **70 % of the run**.

Three independent causes:

1. **`roofMassSide` is O((w + h) · N).** The flood fill grows one pixel per iteration: `2143`
   iterations on a 1376 × 768 image and `2399` on a 1400 × 1000 one — exactly `w + h - 1`, the
   Manhattan diameter, both times. Each iteration is a full dilation over a megapixel. The loop
   cannot stop earlier, because the background surrounds the subject and the last pixel reached is
   the far corner.
2. **`run()` swallows the child's output.** `shot.ts` already prints one `render <path> …` line per
   view, and `silhouette.ts` prints its own progress. `run()` captures both pipes and discards them
   unless the child fails, so the only progress the chain produces never reaches the terminal.
3. **`main()` prints nothing between its five steps.** Even with the children silenced, `check.ts`
   could have said which step it entered.

A fourth defect was found while diagnosing: an interrupted run **leaks its browser session**.
`agent-browser session list` showed `scene-r5-L3` (left by an interrupted `check.ts`) and `zoomprobe`
(left by `check_zoom.ts`) still alive, each with its own Chrome process tree, one of them with a GPU
process at **776 % CPU**. Neither was wedged — both answered `eval` — but neither was closed, and
`agent-browser` calls have no timeout, so a wedged browser would block forever rather than fail. The
spinning process also **distorted every measurement taken before it was closed**: the same guard
image timed at 42.7 s under that load and 17.6 s without it. A leaked session does not only waste a
browser; it makes the gate look two and a half times slower than it is.

A fifth defect, found in the same read: **the exit code ignores the tolerance.** The header of
`check.ts` promises "Exit code 1 when the model is outside the tolerance, so a loop can gate on it",
and `main()` ends with `if (problems.length > 0) process.exit(1)` — where `problems` holds only the
orientation findings. The run of 2026-11-09 prints `status NEEDS WORK` (worst delta −85 mm against a
tolerance of 40 mm) and **exits 0**. A gate whose failure does not reach the exit code cannot gate
anything, and the document above it says the opposite.

**Done means**: `bun run check` prints a timestamped line as it enters each step and streams its
children's own output; the orientation guard costs a few seconds instead of 79, and returns **the
same answer for every image**; no run, successful or interrupted, leaves a browser session behind;
and the exit code says what the report says.

## Scope Boundary

May be created or modified:

- `workflows/threejs/tools/check.ts` — the progress lines, `run()`, and `roofMassSide()`
- `workflows/threejs/tools/session.ts` (new) — the shared browser-session helper, if the sweep needs
  one place
- `workflows/threejs/tools/shot.ts`, `ctl.ts`, `check_zoom.ts` — to adopt the helper, and to close
  what they open
- `workflows/threejs/README.md` — the tool table and the gate section
- `workflows/threejs/AGENTS.md` — "Evidence rules"
- `tickets/README.md` — the board

Do **not** touch:

- **The numbers.** `check.ts` reports the same `height`, `ratio`, `profile_mm`, worst delta, and the
  same `status` line as before this ticket. The tolerance stays `40 mm`.
- `workflows/threejs/tools/silhouette.ts` and `scripts/blueprint/measure_view.py` — their output is
  read, not changed.
- `workflows/threejs/tools/compare_silhouette.py`, `trace_hull.py`, `scripts/blueprint/**`.
- `workflows/threejs/viewer/**` — this ticket is about a tool, not the page.
- The `mass-left` / `mass-right` classification itself, its `26` colour threshold, and the "upper
  third" band. The guard's **verdict** is not redefined; only its cost.

## Contract

### Progress, with a clock

`check.ts` prints one line as it enters each step, prefixed with the elapsed seconds since the start
of the run, and it flushes:

```text
[  0.0s] scene     r5-tl-1972
[  0.1s] capture   6 view(s): left,right,front,back,top,front-3q,rear-3q
[  3.4s] capture   done in 3.3 s
[  3.4s] overlay   5 view(s)
[  5.1s] overlay   done in 1.7 s
[  5.1s] orient    left reference
[  6.0s] orient    left render
[  6.9s] orient    right reference
[  7.8s] orient    right render
[  7.8s] measure   left
[  8.4s] measure   done in 0.6 s
```

A step that is skipped prints the reason (`--no-shot`, no reference, no scene), so the reader can
tell a skip from a stall.

### `run()` streams, and it can time out

```js
async function run(cmd: string[], label: string, options: { capture?: boolean, timeoutMs?: number } = {})
```

- `capture: false` (**the default**) inherits the child's `stdout` and `stderr`, so `shot.ts`'s
  `render …` lines and `silhouette.ts`'s progress reach the terminal as they are written.
- `capture: true` keeps today's behaviour and returns the child's `stdout`. The `measure` step is the
  only caller that needs it, because its `stdout` is JSON.
- `timeoutMs` defaults to **180 000**. On expiry the child is killed and the error names the label
  and the elapsed time: `capture timed out after 180 s`. This is what turns a wedged browser from a
  silent forever-wait into a loud failure. `Bun.spawn` accepts an `AbortSignal`; `AbortSignal.timeout()`
  is the documented way to build one.

### `roofMassSide` stops crawling

The flood fill is replaced by **run propagation**, which reaches the same fixed point in a handful of
passes instead of one pass per pixel of distance. In one pass along an axis, every pixel reachable
from a seeded pixel through a contiguous run in that row (or column) is marked: a forward
`np.maximum.accumulate` unioned with a backward one. Alternating a horizontal pass with a vertical
pass, each masked by `cand`, converges to the same 4-connected component the dilation loop reaches.

- The output is **identical**: the same `mass-left` / `mass-right` for every reference and every
  existing render. The `26` threshold, the seed list, the "upper third" band, and the bounding box
  are untouched.
- The measured cost must fall from 42.7 s to **under 2 s** on the 1376 × 768 reference.
- No new dependency. `scipy` is **not** installed on this machine (`ModuleNotFoundError`); the fix
  uses `numpy` and `PIL`, which are present (`numpy 2.5.4`, `pillow 13.0.0`).
- The loop must still stop on the fixed point, and it must stop if it has not converged after a
  bounded number of passes — say `w + h` — rather than spin. Hitting the bound is an error, not a
  silent result.

### A session is closed, and a stale one is swept

- One helper owns every browser session: it opens it, closes it in a `finally`, and closes it again
  on `SIGINT` and `SIGTERM`. `shot.ts`, `ctl.ts`, and `check_zoom.ts` use it.
- The session name carries the process id, so two runs of the same tool cannot collide, and an
  interrupted run's leftover is identifiable.
- At start-up, the helper closes any session whose name matches its own tool's prefix and whose
  process is gone. It never closes a session it cannot prove is stale.
- Every `agent-browser` call gets a timeout. A wedged browser fails loudly.
- After a full `bun run check`, `agent-browser session list` prints **`No active sessions`**.

### The exit code says what the report says

`check.ts` exits `1` when the model is outside the tolerance, as its own header has always promised,
and `0` when it is inside. The orientation findings keep their `exit 1` and keep their `WARNING`
lines. Both reasons may apply at once.

**This changes today's behaviour, on purpose.** The run of 2026-11-09 reports `status NEEDS WORK` —
worst delta −85 mm against a tolerance of 40 mm — and exits `0`. After this ticket it exits `1`, and
any loop that gates on `bun run check` will start failing until the model is brought inside the
tolerance. That is the point of a gate, and the art director may veto this one task and keep the
other four.

The baseline this ticket records is therefore: **`status NEEDS WORK`, worst delta −85 mm at 2112 mm,
exit code 1.**

## TDD Tasks

- [ ] **T6.1 — Measure, then instrument**: time each step of the current `check.ts` and record the
      numbers in `## Implementation Notes`. Then add the timestamped progress lines and the `run()`
      streaming, and show the transcript of a full run. This part changes no number.
- [ ] **T6.2 — The guard, with a proof of equality**: write the run-propagation fill. Before
      replacing anything, capture the current verdict for every reference and every render under
      `blueprints/vehicules/r5-tl-1972/**` and `.../model/*.webp`; after the replacement, assert the
      verdicts are **byte-identical** and print the new wall time per image.
- [ ] **T6.3 — Session hygiene**: add the helper, adopt it in `shot.ts`, `ctl.ts`, and
      `check_zoom.ts`, and prove that a `SIGINT` during `check.ts` leaves `agent-browser session list`
      empty. Prove the timeout fires by pointing a call at a dead port.
- [ ] **T6.4 — The exit code**: make `process.exit(1)` fire on `outOfTolerance` as well as on the
      orientation findings, and prove both paths: an out-of-tolerance run exits 1, and a run with
      `--tolerance 200` exits 0.
- [ ] **T6.5 — Gates**: `bun run check` reports the same `height`, `ratio`, the same profile, and the
      same worst delta as the recorded baseline, in under **60 s**. `bun test
      workflows/threejs/viewer` is green. `bun run workflows/threejs/tools/check_zoom.ts` exits 0.
- [ ] **T6.6 — Documents**: the tool table and the gate section in `workflows/threejs/README.md`; the
      "Evidence rules" in `workflows/threejs/AGENTS.md` gain the session rule; the board.

## Acceptance Criteria

1. `bun run check` prints a timestamped line for every step, and the children's own progress lines
   appear as they are written. A stall is visible where it happens.
2. The whole command finishes in under 60 s, against 1 min 54 s before, and reports the same
   `height`, `ratio`, worst delta, and `status` as the baseline recorded in this ticket.
3. The orientation guard returns the same `mass-left` / `mass-right` for every image it was checked
   against before the change.
4. A `check.ts` that is interrupted with `Ctrl-C` leaves no browser session, and `agent-browser
   session list` prints `No active sessions` after a normal run too.
5. A browser that stops answering fails with a message that names the step and the elapsed time,
   instead of waiting forever.
6. The exit code is `1` when the report says `NEEDS WORK`, and `0` when it says `within tolerance`.
7. `bun test workflows/threejs/viewer` is green and `tools/check_zoom.ts` exits 0.
