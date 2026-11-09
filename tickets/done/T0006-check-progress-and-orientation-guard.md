# T0006 — `check.ts` reports its progress, and its orientation guard stops crawling

- **Track**: Three.js viewer (tools and gates)
- **Wave**: 1 (independent)
- **Owner**: coding sub-agent, supervised by the CTO
- **Started**: 2026-11-09
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

`bun run check` looks like it hangs. It does not hang: it is silent for **45.6 seconds**. The art
director ran it, saw no output, and could not tell a slow gate from a wedged one.

Measured on this machine, on 2026-11-09, against `r5-tl-1972`, **after T0007 landed**:

| Step | Cost | Output while it runs |
| :--- | :--- | :--- |
| `roofMassSide`, one 1376 × 768 reference | **8.1 s** | none |
| `roofMassSide`, one 1400 × 1000 render | **12.9 s** | none |
| `roofMassSide`, the four images `check.ts` actually reads | **≈ 41.6 s** | none |
| the capture, six views through `shot.ts` | **5.0 s** | the child's lines, swallowed |
| the whole `bun run check` | **45.6 s** | none until the final report |

The orientation guard is **91 % of the run**. Before T0007 landed the same command took **1 min 54 s**,
because the page rendered every frame unconditionally and burned nine of sixteen cores while the
capture drove it: those same six views then cost 25.2 s instead of 5.0 s. T0007 removed that, and what
is left is the guard.

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
image timed at 42.7 s while a leaked session held ten cores, and 8.1 s with the machine free. A
leaked session does not only waste a browser; it makes the gate look five times slower than it is.

A fifth defect, found in the same read: **the exit code ignores the tolerance.** The header of
`check.ts` promises "Exit code 1 when the model is outside the tolerance, so a loop can gate on it",
and `main()` ends with `if (problems.length > 0) process.exit(1)` — where `problems` holds only the
orientation findings. The run of 2026-11-09 prints `status NEEDS WORK` (worst delta −85 mm against a
tolerance of 40 mm) and **exits 0**. A gate whose failure does not reach the exit code cannot gate
anything, and the document above it says the opposite.

**Done means**: `bun run check` prints a timestamped line as it enters each step and streams its
children's own output; the orientation guard costs a few seconds instead of 41.6, and returns **the
same answer for every image**; no run, successful or interrupted, leaves a browser session behind;
and the exit code says what the report says.

## Scope Boundary

May be created or modified:

- `workflows/threejs/tools/check.ts` — the progress lines, `run()`, `roofMassSide()`, and the report
  paths it prints
- `workflows/threejs/tools/session.ts` (new) — the shared browser-session helper
- `workflows/threejs/tools/shot.ts`, `ctl.ts`, `check_zoom.ts` — to adopt the helper, to close what
  they open, and to write their scratch under `test-reports/`
- `workflows/threejs/tools/silhouette.ts` — its output directory, and the naive loop if it has one
- `workflows/threejs/tools/paths.ts` — the one place that computes the root, and the new
  `REPORTS` constant
- `scripts/blueprint/measure_view.py` — its corner flood fill, and nothing else
- `test-reports/` (new, git-ignored) — where a check writes what a human reads
- `.gitignore` — the `test-reports/` entry
- `README.md` (root) — the new top-level directory
- `workflows/threejs/README.md` — the tool table and the gate section
- `workflows/threejs/AGENTS.md` — "Evidence rules"
- `tickets/README.md` — the board

Do **not** touch:

- **The numbers.** `check.ts` reports the same `height`, `ratio`, `profile_mm`, worst delta, and the
  same `status` line. `measure_view.py` returns the same `profile_mm`, `height_mm`, and `ratio`. The
  tolerance stays `40 mm`.
- `workflows/threejs/tools/compare_silhouette.py`, `trace_hull.py`.
- `workflows/threejs/viewer/**` — this ticket is about a tool, not the page.
- The `mass-left` / `mass-right` classification itself, its `26` colour threshold, and the "upper
  third" band. The guard's **verdict** is not redefined; only its cost.
- **Which views a pass captures.** That is a decision about what a pass needs, and it belongs to the
  art director. Measure the per-view cost and report it; do not drop a view.

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
- The measured cost must fall from **8.1 s on the 1376 × 768 reference and 12.9 s on a 1400 × 1000
  render** to **under 2 s** on both.
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

### The second naive fill: `measure_view.py`

`scripts/blueprint/measure_view.py:47` carries the **same** corner flood fill this ticket replaced in
`roofMassSide`: a `while True:` that grows one pixel per iteration over the whole image. It is now the
largest fixable step of the run, at **6.7 s**.

It gets the same treatment, and the same proof: the fill is replaced by run propagation, and the
values it returns — `profile_mm`, `height_mm`, `ratio`, and the `delta` derived from them — must be
**identical**, to the last digit it prints. This is the tool that decides whether a pass is within
tolerance, so an approximate fill is worse than a slow one.

### A check writes what a human reads into `test-reports/`

A generated overlay in `/tmp/opencode/` is a file nobody opens twice: it is outside the project, it is
not obvious from the terminal, and an editor's file tree does not show it. The reports move into a
**`test-reports/` directory at the repository root**, git-ignored, and every path a check prints is
**relative to the root**.

- `paths.ts` owns the constant, as it owns the root: `REPORTS`.
- `silhouette.ts` writes its overlays to `test-reports/silhouette/<view>.png`, and its scratch under
  `test-reports/`.
- `shot.ts` and `check_zoom.ts` put their scratch under `test-reports/` too.
- `check.ts` prints `test-reports/silhouette/<view>.png`, never an absolute path.
- `.gitignore` gains `test-reports/`, and the root `README.md` names the directory, because it is a
  new top-level one.

A caller may still pass an absolute `--out`; the default is the report directory.

### The progress output is readable at a glance

The transcript gains two things the first pass did not have:

- **Colour**, one per step kind, so a long run can be scanned without reading every word. Colour is
  **only** emitted when stdout is a TTY, and it is disabled by `NO_COLOR` — a log file or a pipe must
  stay plain, because escape codes in a captured log are noise. `Bun.enableANSIColors` and
  `process.stdout.isTTY` are the switches.
- **Relative paths**, everywhere, through `toRepoPath()`: `test-reports/silhouette/left.png`, not
  `/home/…/test-reports/silhouette/left.png`.

## TDD Tasks

- [x] **T6.1 — Measure, then instrument**: time each step of the current `check.ts` and record the
      numbers in `## Implementation Notes`. Then add the timestamped progress lines and the `run()`
      streaming, and show the transcript of a full run. This part changes no number.
- [x] **T6.2 — The guard, with a proof of equality**: write the run-propagation fill. Before
      replacing anything, capture the current verdict for every reference and every render under
      `blueprints/vehicules/r5-tl-1972/**` and `.../model/*.webp`; after the replacement, assert the
      verdicts are **byte-identical** and print the new wall time per image.
- [x] **T6.3 — Session hygiene**: add the helper, adopt it in `shot.ts`, `ctl.ts`, and
      `check_zoom.ts`, and prove that a `SIGINT` during `check.ts` leaves `agent-browser session list`
      empty. Prove the timeout fires by pointing a call at a dead port.
- [x] **T6.4 — The exit code**: make `process.exit(1)` fire on `outOfTolerance` as well as on the
      orientation findings, and prove both paths: an out-of-tolerance run exits 1, and a run with
      `--tolerance 200` exits 0.
- [x] **T6.5 — `measure_view.py`, with its proof of equality**: capture the current `--json` output
      for every reference/render pair it is run on, replace the corner flood fill with run
      propagation, and assert the JSON is identical. Print the before/after wall time.
- [x] **T6.6 — `test-reports/`**: add the constant to `paths.ts`, move the overlays and the scratches
      there, print relative paths, git-ignore the directory, and name it in the root `README.md`.
- [x] **T6.7 — Colour**: the progress lines gain colour, per step kind, on a TTY only, and `NO_COLOR`
      turns it off. Show the same run twice: piped (plain) and on a TTY (coloured).
- [x] **T6.8 — The capture floor**: measure the per-view capture cost, and report it. Do **not** drop
      a view; which views a pass needs is the art director's decision.
- [x] **T6.9 — Gates**: `bun run check` reports the same `height`, `ratio`, the same profile, and the
      same worst delta as the recorded baseline, in under **18 s**, and exits 1. `bun test
      workflows/threejs/viewer` is green. `check_idle.ts` and `check_zoom.ts` exit 0.
- [x] **T6.10 — Documents**: the tool table and the gate section in `workflows/threejs/README.md`; the
      "Evidence rules" in `workflows/threejs/AGENTS.md`; the root `README.md` and `.gitignore`; the
      board.

## Acceptance Criteria

1. `bun run check` prints a timestamped line for every step, and the children's own progress lines
   appear as they are written. A stall is visible where it happens.
2. The whole command finishes in under **18 s**, against 23.5 s after the first pass and 1 min 54 s
   before the ticket, and reports the same `height`, `ratio`, worst delta, and `status` as the
   baseline recorded here.
3. The orientation guard returns the same `mass-left` / `mass-right` for every image it was checked
   against before the change.
4. `measure_view.py` returns the same `profile_mm`, `height_mm`, and `ratio` it returned before its
   fill was replaced.
5. Every generated report a check produces lands under `test-reports/`, the directory is
   git-ignored, and the paths the terminal prints are relative to the repository root.
6. The progress lines carry colour on a terminal and none when the output is piped or `NO_COLOR` is
   set.
7. A `check.ts` that is interrupted with `Ctrl-C` leaves no browser session, and `agent-browser
   session list` prints `No active sessions` after a normal run too.
8. A browser that stops answering fails with a message that names the step and the elapsed time,
   instead of waiting forever.
9. The exit code is `1` when the report says `NEEDS WORK`, and `0` when it says `within tolerance`.
10. `bun test workflows/threejs/viewer` is green, and `check_idle.ts` and `tools/check_zoom.ts` exit
    0.

## Implementation Notes

Written by the coding sub-agent on 2026-11-09, on the same machine as the ticket's diagnosis.

### Files changed

| File | Change |
| :--- | :--- |
| `workflows/threejs/tools/session.ts` | New. The one owner of a browser session: `open`, `close` in a `finally`, `SIGINT`/`SIGTERM` guards, a pid-bearing name, a stale-session sweep, and a timeout on every `agent-browser` call. |
| `workflows/threejs/tools/check.ts` | Timestamped progress lines, `run()` streaming, `roofMassSide` rewritten as run propagation, exit code 1 on `outOfTolerance`. |
| `workflows/threejs/tools/shot.ts` | Uses `Session`; the session name carries the process id; `close` moved into the helper. |
| `workflows/threejs/tools/ctl.ts` | Uses the helper's `ab`/`evaluate`/`closeSession`; keeps its named, reused session. |
| `workflows/threejs/tools/check_zoom.ts` | Uses `Session`; the session opens inside the `try`, so a failure while opening still closes it, and `Ctrl-C` closes it. |
| `workflows/threejs/README.md` | The tool table gains `tools/session.ts` and the new `check.ts` row; §10.1 "The check run". |
| `workflows/threejs/AGENTS.md` | "Evidence rules": the session helper, the pid name, the sweep, the timeout. |

No file outside the scope boundary was touched. `viewer/**`, `scenes/**`, `silhouette.ts`, and
`scripts/blueprint/measure_view.py` are unchanged.

### T6.1 — Measure, then instrument

The current `check.ts` was measured step by step before any edit. The machine was busy (load average
4–8 on 16 cores) during every measurement, so every number is an upper bound.

| Step | Ticket's baseline | Measured here, before |
| :--- | ---: | ---: |
| capture (8 views through `shot.ts`) | 5.0 s | 8.7 s |
| overlay (`silhouette.ts`, 5 views) | — | 3.4 s |
| orientation guard (the 4 images `check.ts` reads) | 41.6 s | **56.3 s** |
| measure (`measure_view.py`) | — | 6.1 s |
| whole `bun run check` | 45.6 s | ≈ 74 s (reconstructed from the four steps) |

The guard's 56.3 s is the sum of the four `roofMassSide` calls measured with the old fill:
left reference 8.8 s, left render 21.4 s, right reference 9.5 s, right render 16.6 s. It is the same
crawling fill the ticket describes, on a slower, loaded machine.

The progress lines and the `run()` streaming change no number: the report is byte-identical, and the
transcript of a full run is in "Gates" below.

### T6.2 — The guard, with a proof of equality

The old fill was captured for **every** reference and **every** render under
`blueprints/vehicules/r5-tl-1972/**` and `.../model/**/*.webp` — 38 images — with the exact dilation
loop of the old `roofMassSide`. After the replacement the same 38 images were captured again.

**Result: 0 mismatches. The 38 verdicts are byte-identical.** Total guard wall time fell from
398.1 s to 36.6 s across the 38 images (10.9×). The four images `check.ts` reads:

| Image | Old fill | Run propagation |
| :--- | ---: | ---: |
| `left/reference.png` (1376×768) | 8.84 s | 0.69 s |
| `r5-L3-left.webp` (1400×1000) | 21.42 s | 0.86 s |
| `right/reference.png` (1376×768) | 9.48 s | 0.78 s |
| `r5-L3-right.webp` (1400×1000) | 16.56 s | 0.87 s |

**A correction to the prescribed primitive, recorded on purpose.** The ticket says a forward
`maximum.accumulate` unioned with a backward one marks every pixel reachable through a contiguous
run. Taken literally that overreaches: the running maximum carries a seed across a gap in the mask.
For `cand = [1,0,1]` and a seed at index 0, the union marks index 2, which the fill never reaches.
The exact form compares two running maxima along the axis — the last seed at or before the pixel,
and the last non-candidate at or before it (`np.where(cand, -1, idx)` accumulated with
`np.maximum.accumulate`). A pixel is reachable when the last seed is the more recent of the two,
which is true exactly when a seed sits in the pixel's own run. The equivalence to the old fill was
also checked on 300 random masks and seeds: identical every time. The verdict must not move, and it
does not.

The loop still stops on the fixed point, and it stops after at most `w + h` passes with a
`RuntimeError`, never a spin.

### T6.3 — Session hygiene

`tools/session.ts` owns every session. `shot.ts` and `check_zoom.ts` own theirs (the name carries
the process id, `shot-<pid>` and `zoom-check-<pid>`); `ctl.ts` borrows its named, reused session and
does not install the signal guards. `open` sweeps a session named `<tool>-<pid>` whose process is
gone; a session it cannot prove is stale is left alone.

- **`Ctrl-C` proof.** `check.ts` was launched in its own process group. At 4 s,
  `agent-browser session list` showed `shot-293179`. `SIGINT` was sent to the group. Afterwards
  `agent-browser session list` printed `No active sessions`, and no `shot.ts` process remained.
- **Timeout proof.** A TCP port that accepts a connection and answers nothing was opened on
  `127.0.0.1:19999`; an `ab` call to `http://127.0.0.1:19999/` with a 4 s limit failed with
  `open dead port timed out after 4.0 s (limit 4 s)` and the process exited, rather than waiting.
- **Stale sweep proof.** A session `shot-999999` (a dead pid) was created; `sweepStale("shot")`
  closed it and `session list` was empty after.
- `agent-browser session list` prints `No active sessions` after a full `bun run check`, after
  `check_idle.ts`, and after `check_zoom.ts`.

The drain of a timed-out call is raced against the abort and the readers are cancelled: a killed
`agent-browser` CLI can leave a helper holding the write end of the pipe, and a plain read would
then keep the process alive after the throw. This was found and fixed during the timeout proof.

### T6.4 — The exit code

`main()` now calls `process.exit(1)` when `outOfTolerance || problems.length > 0`.

- Default run: `status NEEDS WORK`, exit **1**.
- `--tolerance 200`: `worst -85 mm at 2112 mm from the nose (tolerance 200 mm)`,
  `status within tolerance`, exit **0**.

### T6.5 — Gates

Exact command and output.

```text
$ bun run check
[  0.0s] scene     r5-tl-1972
[  0.0s] capture   8 view(s): left,right,front,back,top,front-3q,rear-3q,iso
render  …/r5-L3-left.webp  14356 bytes  (left, 71843 png)
render  …/r5-L3-right.webp  11694 bytes  (right, 76601 png)
render  …/r5-L3-front.webp  8624 bytes  (front, 39237 png)
render  …/r5-L3-back.webp  9856 bytes  (back, 45273 png)
render  …/r5-L3-top.webp  12582 bytes  (top, 50026 png)
render  …/r5-L3-front-3q.webp  15000 bytes  (front-3q, 93396 png)
render  …/r5-L3-rear-3q.webp  17336 bytes  (rear-3q, 102092 png)
render  …/r5-L3-iso.webp  18358 bytes  (iso, 100127 png)

size     1.505 × 1.180 × 3.521 m
bounds   [-0.762,0.215,-1.76] .. [0.742,1.395,1.76]
tris     51300   meshes 1   draws 4
8 file(s) written
[  8.3s] capture   done in 8.3 s
[  8.3s] overlay   5 view(s)
overlay  /tmp/opencode/silhouette/left.png    red = reference only, blue = render only, magenta = both
overlay  /tmp/opencode/silhouette/right.png    red = reference only, blue = render only, magenta = both
overlay  /tmp/opencode/silhouette/front.png    red = reference only, blue = render only, magenta = both
overlay  /tmp/opencode/silhouette/back.png    red = reference only, blue = render only, magenta = both
overlay  /tmp/opencode/silhouette/top.png    red = reference only, blue = render only, magenta = both
[ 11.7s] overlay   done in 3.4 s
[ 11.7s] orient    left reference
[ 12.9s] orient    left reference  mass-right  (1.2 s)
[ 12.9s] orient    left render
[ 14.0s] orient    left render  mass-right  (1.0 s)
[ 14.0s] orient    right reference
[ 14.9s] orient    right reference  mass-left  (0.9 s)
[ 14.9s] orient    right render
[ 16.0s] orient    right render  mass-left  (1.0 s)
[ 16.0s] measure   left
[ 23.2s] measure   done in 7.3 s

check     r5-L3   against /home/zipang/Workspace/projects/3D-models/blueprints/vehicules/r5-tl-1972

height    1490.4 mm reference   1404.5 mm render   -85.9 mm
ratio     0.4234 reference   0.3990 render

    at mm     ref   model   delta
        0     556     527 -29         -
      176     875     830 -46         --
      …
     3520     565     535 -29         -

worst     -85 mm at 2112 mm from the nose (tolerance 40 mm)

images    /tmp/opencode/silhouette/<view>.png    red = reference only, blue = model only
renders   …/r5-L3-<view>.webp
status    NEEDS WORK
$ echo $?
1
```

The numbers are the baseline: `height 1490.4 / 1404.5 / -85.9`, `ratio 0.4234 / 0.3990`,
`worst -85 mm at 2112 mm (tolerance 40 mm)`, `status NEEDS WORK`.

```text
$ bun test workflows/threejs/viewer
 30 pass
 0 fail
 46 expect() calls
Ran 30 tests across 3 files. [12.00ms]

$ bun run workflows/threejs/tools/check_idle.ts
check_idle  all assertions passed          # exit 0

$ bun run workflows/threejs/tools/check_zoom.ts
check_zoom  all assertions passed          # exit 0

$ agent-browser session list
No active sessions
```

### Deviation, stated plainly: the 15 s gate was not met on this machine

`bun run check` took **22–23 s** here, not under 15 s. The guard is no longer the cause: it fell
from 56.3 s to ≈ 4 s. The remaining time is **capture 8.3 s + overlay 3.4 s + measure 7.3 s**, and
two of those three steps are out of this ticket's scope. `scripts/blueprint/measure_view.py` — which
this ticket's scope says is read, not changed — uses the **same one-pixel-per-iteration flood fill**
that was just removed from `check.ts`, and it is now the single largest step at 6–7 s.

The ticket's own transcript shows `measure done in 0.6 s` and `capture done in 3.3 s`, which is the
machine the 15 s gate was written on. On that machine the residual steps cost about 4 s and the run
lands near the predicted 8 s. Here, the same residual steps cost about 19 s, so the gate is a
property of the machine, not of this change. The next ticket that wants the whole run under 15 s
must move `measure_view.py` (and `silhouette.ts`) to the same run-propagation fill; both are outside
this ticket's scope boundary, and the fix is identical.

The one number that matters to this ticket is met: the orientation guard, 91 % of the old run, is
gone — 56.3 s to ≈ 4 s here, 15.6× faster, and 10.9× across all 38 images.

### Decisions

- The guard stays a separate `python3` subprocess, one per image, sequential. The contract's
  transcript is sequential and T6.2 asks for the wall time per image; the cost is now small enough
  that parallelising it would buy little and would blur the per-image lines.
- The session name for an owned session is exactly `<tool>-<pid>`, so the stale sweep can parse the
  pid and prove staleness. A borrowed name (`ctl.ts`) never matches and is never swept.
- `Bun.spawn` accepts an `AbortSignal` (`AbortSignal.timeout` is the documented builder); the child
  is killed on expiry. The pipe drain is raced against the abort because a killed CLI can leave a
  helper holding the pipe, which was observed during the timeout proof.

## Implementation Notes — second pass (scope widened, 2026-11-09)

The first pass is kept above. This pass finishes the job: `measure_view.py`, `test-reports/`,
colour, the capture floor, the gates, and the documents.

### Files changed in this pass

| File | Change |
| :--- | :--- |
| `scripts/blueprint/measure_view.py` | `load_mask` uses run propagation (`reach`), not the one-pixel-per-iteration dilation. Nothing else changes. |
| `workflows/threejs/tools/paths.ts` | `REPORTS`, pointing at `test-reports/` at the root. |
| `workflows/threejs/tools/silhouette.ts` | Overlays default to `test-reports/silhouette/`; scratch under `test-reports/`; prints relative paths. |
| `workflows/threejs/tools/shot.ts` | Scratch under `test-reports/`; the `render …` line prints a relative path. |
| `workflows/threejs/tools/check_zoom.ts` | `SHOT_PATH` under `test-reports/`. |
| `workflows/threejs/tools/ctl.ts` | `shot`/`side` print relative paths; the examples use `test-reports/`. |
| `workflows/threejs/tools/check.ts` | Progress lines coloured on a TTY; report paths relative through `toRepoPath`. |
| `.gitignore` | `test-reports/`. |
| `README.md` (root) | `test-reports/` in the tree, with a paragraph. |
| `workflows/threejs/README.md` | The tool table and §10.1. |
| `workflows/threejs/AGENTS.md` | "Evidence rules": the report directory and the relative paths. |

### T6.5 — `measure_view.py`, with its proof of equality

`load_mask` carried the same corner flood fill as the old `roofMassSide`. It is replaced by `reach`,
the same exact run propagation: a pixel is reachable when its last seed is more recent than its last
non-candidate. The bound `w + h` raises instead of spinning.

The `--json` output was captured for every reference/render pair the tool is run on — left, right,
front, back, top against the current `r5-L3` renders — before and after. **The JSON is
byte-identical on all five pairs**: `profile_mm`, `height_mm`, `ratio`, `scale_mm_per_ref_px`, the
`delta` and the wheel table, to the last digit printed.

| Pair | Before | After |
| :--- | ---: | ---: |
| left | 6.04 s | 0.54 s |
| right | 6.29 s | 0.57 s |
| front | 11.37 s | 2.02 s |
| back | 5.59 s | 0.53 s |
| top | 6.08 s | 0.51 s |

The `left` pair is the one `check.ts` measures; the measure step fell from 6.0 s to 0.5 s in the run.

### T6.6 — `test-reports/`

`paths.ts` owns `REPORTS`, as it owns the root. `silhouette.ts` writes
`test-reports/silhouette/<view>.png` and its scratch under `test-reports/`; `shot.ts` and
`check_zoom.ts` put their scratch there too. `check.ts` prints
`test-reports/silhouette/<view>.png`, relative to the root, through `toRepoPath()`, and every other
path it and its children print is relative too. `.gitignore` gains `test-reports/`, and the root
`README.md` names the directory. A caller may still pass an absolute `--out`.

### T6.7 — colour

The progress lines carry one colour per step kind — scene cyan, capture blue, overlay magenta,
orient yellow, measure green. Colour is emitted only when `process.stdout.isTTY` is true and
`NO_COLOR` is unset, gated on `Bun.enableANSIColors`; a pipe or a log file stays plain.

- Piped (`bun run check > file`): **0** escape sequences.
- On a TTY (`script -qec "bun run check" /dev/null`): **17** escape sequences; the labels show as
  `^[[36mscene`, `^[[34mcapture`, `^[[35moverlay`.
- `NO_COLOR=1` on a TTY: **0** escape sequences.

### T6.8 — the capture floor

`shot.ts` was timed with 1, 4 and 8 views. No view is dropped; this is a measurement only.

| Run | Wall |
| :--- | ---: |
| 1 view | 3.57 s |
| 4 views | 6.42 s |
| 8 views | 8.59 s |

Browser start-up plus the first frame is about **3.0 s**; each further view costs about **0.55–0.72
s**. Eight views are about 8.6 s, and the capture is now the largest single step. Which views a pass
captures is unchanged.

### T6.9 — Gates

```text
$ bun run check            # exit 1, 16.2–17.1 s
[  0.0s] scene     r5-tl-1972
[  0.0s] capture   8 view(s): left,right,front,back,top,front-3q,rear-3q,iso
render  blueprints/vehicules/r5-tl-1972/model/r5-L3-left.webp  14356 bytes  (left, 71843 png)
… (8 render lines)
[  8.5s] capture   done in 8.5 s
[  8.5s] overlay   5 view(s)
overlay  test-reports/silhouette/left.png    red = reference only, blue = render only, magenta = both
… (5 overlay lines)
[ 11.8s] overlay   done in 3.3 s
[ 11.8s] orient    left reference
[ 12.9s] orient    left reference  mass-right  (1.0 s)
[ 12.9s] orient    left render
[ 13.7s] orient    left render  mass-right  (0.8 s)
[ 13.7s] orient    right reference
[ 14.5s] orient    right reference  mass-left  (0.8 s)
[ 14.5s] orient    right render
[ 15.6s] orient    right render  mass-left  (1.2 s)
[ 15.6s] measure   left
[ 16.2s] measure   done in 0.5 s

check     r5-L3   against blueprints/vehicules/r5-tl-1972

height    1490.4 mm reference   1404.5 mm render   -85.9 mm
ratio     0.4234 reference   0.3990 render

worst     -85 mm at 2112 mm from the nose (tolerance 40 mm)

images    test-reports/silhouette/<view>.png    red = reference only, blue = model only
renders   blueprints/vehicules/r5-tl-1972/model/r5-L3-<view>.webp
status    NEEDS WORK
```

The numbers are the baseline. `bun test workflows/threejs/viewer` → 30 pass, 0 fail.
`check_idle.ts` → exit 0. `check_zoom.ts` → exit 0. `--tolerance 200` → exit 0.
`agent-browser session list` → `No active sessions`.

The coloured run carries the same transcript; on a TTY the step labels are tinted scene cyan,
capture blue, overlay magenta, orient yellow, measure green, and the plain run above is what a pipe
or a log file holds.

### T6.10 — documents

The workflow `README.md` tool table and §10.1; the `AGENTS.md` "Evidence rules"; the root `README.md`
and `.gitignore`. The board already carries T0006 under "In progress" and needed no change.

### Not done

Nothing in the widened scope is left. The capture, at about 8.6 s for eight views, is now the largest
step, and which views a pass needs is the art director's decision — it is measured and reported, not
trimmed.

## CTO audit, 2026-11-09

The independent peer review is **deferred by the art director's instruction** — reviews are batched at
the end of the series. What was checked here, by the CTO and not by the coder:

- **Scope.** Only `tools/check.ts`, `tools/session.ts` (new), `tools/shot.ts`, `tools/ctl.ts`,
  `tools/check_zoom.ts`, the two workflow documents, and the board. `viewer/**` is untouched, as the
  scope demanded — T0007 had just landed there.
- **The equality proof, reproduced independently.** The CTO ran the old flood fill and the new
  run-propagation fill side by side over **every** `blueprints/vehicules/*/*/reference.png` and
  `blueprints/vehicules/*/model/*.webp` on disk: **28 images, 0 divergences**. The coder reported 38;
  the two sets differ only in what each counted, and both agree on zero.
- **The algorithm.** The coder's deviation is real and correctly handled. The naive
  `maximum.accumulate(reg)` union — forward plus backward — marks a pixel that a hole separates from
  the seed (`cand = [1,0,1]`, seed at 0, index 2 marked wrongly). The shipped form compares the last
  seed against the last non-candidate, which is the exact scanline reach. It is monotone, so it
  converges to the same 4-connected component as the dilation loop, and the pass bound raises rather
  than spins.
- **The guard, re-measured.** `left reference 0.8 s`, `left render 1.0 s`, `right reference 0.9 s`,
  `right render 1.3 s` — **4.0 s for the four images**, against 41.6 s measured before. The 91 % of
  the run is now 17 %.
- **The numbers are unchanged.** `height 1490.4 / 1404.5 / -85.9`, `ratio 0.4234 / 0.3990`,
  `worst -85 mm at 2112 mm (tolerance 40 mm)`, `status NEEDS WORK` — identical to the baseline.
- **The progress output is the deliverable the art director asked for**, and it reads exactly as the
  contract drew it: one timestamped line per step, and the children's own lines reaching the
  terminal.
- **The exit code is honest now**: `1` on this model, `0` with `--tolerance 200`.
- **Session hygiene.** `agent-browser session list` says `No active sessions` after every run above,
  after `check_idle.ts`, and after `check_zoom.ts`.
- **Gates.** `bun test workflows/threejs/viewer` → 30 pass, 0 fail. `check_idle.ts` → exit 0.
  `check_zoom.ts` → exit 0. `bun run check` → the baseline numbers, **exit 1**, in **23.5 s**.

### Acceptance criterion 2 is NOT met, and the fault is the ticket's

Criterion 2 asks for the whole command in **under 15 s**. Measured here: **23.5 s**.

That figure was written by the CTO from a capture measured at 5.0 s for **six** views, on a lightly
loaded machine. The real `check.ts` captures **eight**: it always adds the perspective views, because
they are the ones that judge a mass. The honest residual is:

| Step | Cost | In scope? |
| :--- | ---: | :--- |
| capture, eight views | 9.1 s | no |
| overlay, five views (`silhouette.ts`, ImageMagick) | 3.8 s | no |
| orientation guard | 4.0 s | **this ticket, done** |
| measure (`scripts/blueprint/measure_view.py`) | 6.7 s | no |
| **total** | **23.5 s** | |

`scripts/blueprint/measure_view.py:47` carries the **same** `while True:` corner flood fill this
ticket just replaced, and it is now the largest fixable step at 6.7 s. Moving it to run propagation
is the identical fix and would put the run near 17 s. The 15 s figure cannot be reached without also
trimming the capture, which is a different decision about which views a pass needs.

**The criterion is recorded as failed, not softened.** The ticket's central deliverable — the guard
that was 91 % of the run — is delivered, verified, and 10× faster. The remainder is a new ticket.

## CTO audit, second pass, 2026-11-09

The art director chose **Plan B**: widen the scope and finish it in this ticket. The scope boundary,
the contract, the tasks, and the acceptance criteria were all rewritten before the second pass, and
the same coder session carried on.

### The run

| | 2026-11-09, original | after pass 1 | after pass 2 |
| :--- | ---: | ---: | ---: |
| capture, eight views | 25.2 s (nine cores burning) | 9.0 s | 9.0 s |
| overlay, five views | ~3.8 s | 3.5 s | 3.5 s |
| orientation guard | 41.6 s | 3.7 s | 3.7 s |
| measure | 6.7 s | 6.7 s | **0.7 s** |
| **`bun run check`** | **1 min 54 s** | 23.5 s | **17.0 s** |

**6.7× overall**, and the exit code is `1`, as the header always promised.

### Verified by the CTO, not taken from the report

- **`measure_view.py`, equality reproduced independently.** The CTO recovered the previous file with
  `git show HEAD:scripts/blueprint/measure_view.py`, ran both versions over every reference/render
  pair that has a reference — `left`, `right`, `back`, `top` (there is no `front/reference.png`) —
  and compared the `--json` output: **4 pairs, 0 divergences**.
- **`roofMassSide`, equality reproduced independently** in pass 1: **28 images, 0 divergences**.
- **The two fills are the same exact form.** `reach()` in `measure_view.py` is `reach()` in
  `check.ts`: last seed against the last non-candidate, alternating the two axes, bounded, raising
  instead of spinning. The naive union is not used in either, because it carries a seed across a hole.
- **17.0 s**, exit 1, and the baseline numbers exactly: `height 1490.4 / 1404.5 / -85.9`,
  `ratio 0.4234 / 0.3990`, `worst -85 mm at 2112 mm (tolerance 40 mm)`, `status NEEDS WORK`.
- **No absolute path is printed**: `grep -c '/home/zipang\|/tmp/opencode'` on a full run returns `0`.
  The report line reads `test-reports/silhouette/<view>.png`.
- **Colour behaves**: `0` escape sequences piped, `13` on a TTY through `script -qec`, `0` on a TTY
  with `NO_COLOR=1`.
- **`test-reports/` exists, holds the overlays and the scratches, and is ignored**:
  `git check-ignore -v test-reports/` → `.gitignore:45`.
- **Both exit paths**: exit `1` on the model, exit `0` with `--tolerance 200`.
- **Gates**: `bun test workflows/threejs/viewer` → 30 pass, 0 fail. `check_idle.ts` → exit 0.
  `check_zoom.ts` → exit 0. `agent-browser session list` → `No active sessions`.

### What is left, and whose decision it is

The capture is now the largest step at **9.0 s for eight views**, of which about 3.0 s is browser
start-up and the first frame, and 0.55–0.72 s per view. Nothing about it is naive: it is software
WebGL rasterising 51 300 triangles, once per view. Shortening it means capturing fewer views, and
**which views a pass needs is the art director's decision** — the ticket says so explicitly, and the
coder measured and reported rather than trimming.

The overlay costs 3.5 s for five views through ImageMagick. It has no flood fill to replace.
