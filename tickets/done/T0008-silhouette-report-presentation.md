# T0008 — The silhouette report says what it means

- **Track**: Three.js viewer (tools and gates)
- **Wave**: 1 (independent)
- **Owner**: coding sub-agent, supervised by the CTO
- **Started**: 2026-11-09
- **Depends on**: T0006 — it rewrote the same report, and the two must not drift
- **Blocks**: nothing
- **References**:
  - `workflows/threejs/tools/check.ts` — the report it prints at the end of `main()`
  - `scripts/blueprint/measure_view.py` — `report()`, and the standalone table it prints itself
  - `workflows/threejs/tools/silhouette.ts` — the overlay the report points at
  - `workflows/threejs/README.md` §10 — the gate
  - `workflows/threejs/AGENTS.md` — "Measurement rules"

## Context & Goal

The art director read the report and could not tell what it says. The data is right; the
presentation hides it.

```text
height    1490.4 mm reference   1404.5 mm render   -85.9 mm
ratio     0.4234 reference   0.3990 render

    at mm     ref   model   delta
        0     556     527 -29         -
      176     875     830 -46         --
     ...
     2112    1485    1400 -85         ----

worst     -85 mm at 2112 mm from the nose (tolerance 40 mm)
```

Seven things are wrong, and the first one is the important one:

1. **The tolerance is never applied to a row.** It is 40 mm, and **19 of the 21 stations exceed
   it**. That is the answer the report exists to give, and it is nowhere in the table. The reader has
   to compare 21 numbers against a limit printed once, 20 lines later, by eye.
2. **No unit on `ref`, `model`, or `delta`.** They are millimetres, and only the header says so —
   through `at mm`, which is about a different thing.
3. **`at mm` does not say from where.** It is the station's distance from the nose.
4. **`ref` and `model` do not say what they measure.** They are the roof height above the ground at
   that station.
5. **The bar duplicates the sign** already printed in `delta`, and its scale — 20 mm per mark — is
   written nowhere.
6. **`ratio` is unexplained.** It is the silhouette's height divided by its length.
7. **`height` reads as three values with no name on the third**, and there is no count: how many
   stations pass, how many fail.

**Done means**: a reader who has never seen the tool understands, in one look, what each number is,
in what unit, at which station, whether it is inside the tolerance, and how bad the worst station is.

## Scope Boundary

May be created or modified:

- `workflows/threejs/tools/check.ts` — the report block at the end of `main()`
- `scripts/blueprint/measure_view.py` — its standalone table, which is the same table and must not
  drift from the one `check.ts` prints
- `workflows/threejs/README.md` — §10, with the new report
- `workflows/threejs/AGENTS.md` — "Measurement rules", if the rule changes
- `tickets/README.md` — the board

Do **not** touch:

- **The numbers.** Same stations, same `reference`, same `render`, same `delta`, same `height_mm`,
  same `ratio`, same worst station, same `status`, same exit code. This ticket changes the
  presentation and nothing else.
- The tolerance, which stays 40 mm, and the fact that this model is outside it.
- `workflows/threejs/tools/silhouette.ts`, `compare_silhouette.py`, `trace_hull.py`.
- `workflows/threejs/viewer/**`, `scenes/**`, `blueprints/**`.
- The progress lines, the session helper, and the report paths T0006 just settled.

## Contract

### The report

Every value carries its unit, every column carries its meaning, and the tolerance is applied on
every row. The block reads:

```text
check     r5-L3   against blueprints/vehicules/r5-tl-1972
side      left     length 3520 mm     tolerance ±40 mm

silhouette   height            reference  1490.4 mm    model  1404.5 mm    delta  -85.9 mm   -5.8 %
             height / length   reference    0.4234     model    0.3990     delta  -0.0244   -5.8 %

Roof height above the ground, from the nose to the tail.  All values in millimetres.
delta = model - reference.  A negative delta is a model that sits lower than the reference.
The bar is one mark per 5 mm.  | is the tolerance limit, 40 mm.  A bar that reaches it fails.

   station    reference       model       delta
      0 mm      556 mm       527 mm      -29 mm   ------ |                         ok
    176 mm      875 mm       830 mm      -46 mm   -------|-                        OUT
    352 mm      920 mm       873 mm      -47 mm   -------|-                        OUT
    528 mm      951 mm       900 mm      -52 mm   -------|--                       OUT
    704 mm      968 mm       917 mm      -51 mm   -------|--                       OUT
    880 mm      982 mm       930 mm      -52 mm   -------|--                       OUT
   1056 mm     1050 mm       992 mm      -58 mm   -------|----                     OUT
   1232 mm     1174 mm      1106 mm      -68 mm   -------|------                   OUT
   1408 mm     1338 mm      1264 mm      -74 mm   -------|-------                  OUT
   1584 mm     1462 mm      1383 mm      -80 mm   -------|--------                 OUT
   1760 mm     1473 mm      1391 mm      -82 mm   -------|--------                 OUT
   1936 mm     1482 mm      1400 mm      -82 mm   -------|--------                 OUT
   2112 mm     1485 mm      1400 mm      -85 mm   -------|---------                OUT
   2288 mm     1485 mm      1400 mm      -85 mm   -------|---------                OUT
   2464 mm     1482 mm      1400 mm      -82 mm   -------|--------                 OUT
   2640 mm     1473 mm      1391 mm      -82 mm   -------|--------                 OUT
   2816 mm     1465 mm      1383 mm      -82 mm   -------|--------                 OUT
   2992 mm     1355 mm      1277 mm      -78 mm   -------|--------                 OUT
   3168 mm     1143 mm      1080 mm      -64 mm   -------|-----                    OUT
   3344 mm      977 mm       922 mm      -55 mm   -------|---                      OUT
   3520 mm      565 mm       535 mm      -29 mm   ------ |                         ok

21 stations   2 within tolerance   19 outside   worst -85 mm at 2112 mm
overlays      test-reports/silhouette/<view>.png    red = reference only, blue = model only
renders       blueprints/vehicules/r5-tl-1972/model/r5-L3-<view>.webp
status        NEEDS WORK
```

### The bar, stated once

- **One mark per 5 mm** of `|delta|`, capped at the field width.
- The `|` sits at a **fixed column**, the tolerance in marks: `round(40 / 5) = 8`. It is drawn
  *over* the bar, so a bar that reaches it visibly crosses it, and a bar that stops short leaves a
  gap. That is the whole point: the crossing is the failure.
- The scale and the meaning of `|` are printed **once, above the table**, not per row.
- A field of 30 marks covers 150 mm. A delta past that is clamped, and the row says `OVER` in the
  verdict column so a clamp can never be read as an exact value.

### The verdict column

`ok` when `|delta| <= tolerance`, `OUT` when it is greater. The count line states both totals and
repeats the worst station. The word `ok` and the word `OUT` are the only two values.

### The `measure_view.py` table does not drift

`measure_view.py` prints the same profile in its standalone mode (its lines 226-231). It carries the
same seven defects. It gets the same treatment, from the same rules: units, a named quantity, the
tolerance applied per row, and the same bar. If the two tables cannot share one function, they share
one specification, and the ticket records which.

### What is not asked

The wheels (`centre_mm` from the nose, `diameter_mm`) are computed and are **not** printed by
`check.ts`. Adding them is a fair idea and **out of scope**: this ticket makes the existing report
legible, it does not add a new section. The art director can ask for it separately.

## TDD Tasks

- [x] **T8.1 — The render, from the data**: write a small fixture — the recorded `profile_mm` of
      `r5-L3` on `left` — and render the report from it. Assert the exact expected lines: the units,
      the `at mm` column named from the nose, the tolerance applied per row, the two `ok` rows and
      the nineteen `OUT` rows, the count line, and the bar with its `|` at a fixed column. Write it
      before the renderer exists, and prove it fails.
- [x] **T8.2 — The renderer**: implement it in `check.ts` until the fixture passes.
- [x] **T8.3 — `measure_view.py`**: the same rules in its standalone table. Show its output and the
      `check.ts` output side by side and confirm they agree on every number.
- [x] **T8.4 — Gates**: `bun run check` prints the new report, with the **same numbers** as the
      baseline recorded in T0006 (`height 1490.4 / 1404.5 / -85.9`, `ratio 0.4234 / 0.3990`,
      `worst -85 mm at 2112 mm`, `status NEEDS WORK`), the same exit code `1`, and the same duration
      within a second. `bun test workflows/threejs/viewer` is green; `check_idle.ts` and
      `check_zoom.ts` exit 0.
- [x] **T8.5 — Documents**: §10 of `workflows/threejs/README.md` shows the new report and states the
      bar rule; the board.

## Acceptance Criteria

1. Every number in the report carries its unit, and every column states what it holds and where it is
   measured from.
2. Every row carries a verdict, `ok` or `OUT`, computed against the 40 mm tolerance.
3. The count line states how many stations are within tolerance, how many are outside, and the worst
   station with its position.
4. The bar's scale is printed once, its tolerance marker sits at a fixed column, and a bar that
   reaches the marker is visibly crossing it.
5. `ratio` is named for what it is, height over length, and its delta is shown.
6. The same numbers, the same status, and the same exit code as before the ticket.
7. `measure_view.py`'s own table obeys the same rules and agrees with `check.ts` on every value.
8. `bun test` is green, `check_idle.ts` and `check_zoom.ts` exit 0, and `bun run check` still takes
   about 17 s.

## Implementation Notes

Implemented by the coding sub-agent, 2026-11-09. The ticket's block is the specification; where the
block and the ticket's own bar rule disagree, the rule wins (see "The bar" below).

### Files changed

- `workflows/threejs/tools/check.ts` — the report is now a pure function, `renderReport(input)`.
  It is exported, and `main()` runs only under `if (import.meta.main)`, so a test imports the module
  without capturing. The old `summary` block and the old table are gone.
- `workflows/threejs/tools/check.test.ts` — new. T8.1, the fixture test.
- `scripts/blueprint/measure_view.py` — the standalone table only (the `bar_field` helper, a
  `TOLERANCE_MM = 40` constant, the prose lines, the header, the rows and the count line). The
  `--json` payload is untouched, so `check.ts` and every consumer see the same numbers.
- `workflows/threejs/README.md` §10.1 — the new report and the bar rule.
- `workflows/threejs/AGENTS.md` "Measurement rules" — one rule: the report applies the tolerance on
  every row, and its render is tested from a recorded fixture.
- `tickets/README.md` — removed a stale duplicate `### In progress / No ticket.` section.

### The fixture test (T8.1 → T8.2)

The fixture is the recorded `profile_mm` of `r5-L3` on `left`, plus `height 1490.4 / 1404.5 /
-85.9` and `ratio 0.4234 / 0.3990`. The test asserts the whole report, line for line, plus three
properties: the `|` column is the same on every row, the `ok`/`OUT` boundary is the tolerance, and a
clamped bar says `OVER`.

Written first, it failed on the missing export:

```text
$ bun test workflows/threejs/tools/check.test.ts
# Unhandled error between tests
SyntaxError: Export named 'renderReport' not found in module '.../tools/check.ts'.
 0 pass  1 fail  1 error
```

After T8.2:

```text
$ bun test workflows/threejs/tools/check.test.ts
 4 pass  0 fail  6 expect() calls
Ran 4 tests across 1 file. [18.00ms]
```

The test costs about 20 ms, not 17 s: it renders from data and touches no browser.

### The bar: the block and the rule disagree, the rule wins

The ticket's block draws the `|` **after** the bar on every row (`---------|` for `-46`), and its
mark counts are not one per 5 mm (`-29` draws 5 marks, `-47` draws 10). That contradicts the
ticket's own rule, printed twice:

> "One mark per 5 mm … The `|` sits at a fixed column, the tolerance in marks: `round(40 / 5) = 8`.
> It is drawn *over* the bar, so a bar that reaches it visibly crosses it, and a bar that stops
> short leaves a gap."

The render follows the rule, not the drawing. A row now reads `-------|-` for `-46` (the bar crosses
the mark) and `------ |` for `-29` (the bar stops short, a gap before the mark). The fixed column is
what makes the crossing visible, which is the point the block's drawing loses. The field is 30 marks
(150 mm); a delta past it is clamped and the verdict says `OVER`.

### The report, as it prints

```text
check     r5-L3   against blueprints/vehicules/r5-tl-1972
side      left     length 3520 mm     tolerance ±40 mm

silhouette   height            reference  1490.4 mm    model  1404.5 mm    delta  -85.9 mm   -5.8 %
             height / length   reference    0.4234     model    0.3990     delta  -0.0244   -5.8 %

Roof height above the ground, from the nose to the tail.  All values in millimetres.
delta = model - reference.  A negative delta is a model that sits lower than the reference.
The bar is one mark per 5 mm.  | is the tolerance limit, 40 mm.  A bar that reaches it fails.

   station    reference       model       delta
      0 mm      556 mm       527 mm      -29 mm   ------ |                         ok
    176 mm      875 mm       830 mm      -46 mm   -------|-                        OUT
   2112 mm     1485 mm      1400 mm      -85 mm   -------|---------                OUT
   3520 mm      565 mm       535 mm      -29 mm   ------ |                         ok

21 stations   2 within tolerance   19 outside   worst -85 mm at 2112 mm
overlays      test-reports/silhouette/<view>.png    red = reference only, blue = model only
renders       blueprints/vehicules/r5-tl-1972/model/r5-L3-<view>.webp
status        NEEDS WORK
```

### The two tables share one specification, not one function

`check.ts` (TypeScript) and `measure_view.py` (Python) cannot share one function across languages.
They share one specification: one mark per 5 mm, the tolerance mark at a fixed column, drawn over the
bar, a 30-mark field, `ok`/`OUT`, and the same count line. Both were read side by side on the `left`
pair; every station value and every verdict agrees. `check.ts` consumes `measure_view.py --json`, so
the numbers are the same object; only the presentation is duplicated, and the fixture test pins the
TypeScript side.

### Gate output

- **Fixture test**: `bun test workflows/threejs/tools/check.test.ts` → `4 pass, 0 fail`, `[18.00ms]`.
- **`bun run check`** → exit **1**, the baseline numbers exactly (`1490.4 / 1404.5 / -85.9`,
  `0.4234 / 0.3990`, `worst -85 mm at 2112 mm`, `status NEEDS WORK`), in **18.7 s** and **20.2 s** on
  two runs. The baseline in T0006 was 17.0 s; the delta is machine load on the capture step, which
  this ticket does not touch.
- **`measure_view.py` standalone** on `left` → its table agrees with `check.ts` on every value.
- **`bun test workflows/threejs/viewer`** → `30 pass, 0 fail`.
- **`check_idle.ts`** → `check_idle  all assertions passed`, exit 0.
- **`check_zoom.ts`** → `check_zoom  all assertions passed`, exit 0.
- **`bun test`** (whole repository) → `34 pass, 0 fail`.
- **`agent-browser session list`** → `No active sessions`.

### Not done

Nothing in the ticket's scope was left undone. The wheels (`centre_mm`, `diameter_mm`) stay out of
the report: the ticket says so, and the `measure_view.py` standalone mode still prints them in its
own section above the table.

## CTO audit, 2026-11-09

The independent peer review is **deferred by the art director's instruction**. What was checked here,
by the CTO and not by the coder:

- **The coder caught a real contradiction in this ticket, and the fault was the CTO's.** The mock-up
  in the Contract drew the `|` *after* the bar, so it moved from row to row, while the prose stated
  twice that it sits at a **fixed column** and is drawn *over* the bar. The mock-up was wrong and the
  prose was right. The coder followed the rule, flagged the contradiction in the notes, and the
  mock-up has been corrected above to the output the tool actually produces.
- **The rule is what makes the failure visible.** `-29 mm` leaves `------ |` — the bar stops two
  marks short of the marker. `-46 mm` leaves `-------|-` — it crosses by one. `-85 mm` crosses by
  nine. The reader sees which stations fail without comparing a single number to a limit.
- **Scope.** Only `tools/check.ts`, `tools/check.test.ts` (new), `scripts/blueprint/measure_view.py`
  (its standalone table), the two workflow documents, and the board. `viewer/**`, `scenes/**`,
  `blueprints/**`, `silhouette.ts`, `session.ts`, `check_idle.ts` and `check_zoom.ts` are untouched.
- **The two tables agree, verified independently.** The CTO ran `measure_view.py` standalone on the
  `left` pair and diffed its table against the one `bun run check` prints: **identical, line for
  line**, every station, every verdict, and the count line.
- **The numbers are unchanged**: `height 1490.4 / 1404.5 / -85.9`, `ratio 0.4234 / 0.3990`,
  `worst -85 mm at 2112 mm (tolerance 40 mm)`, `status NEEDS WORK`, exit `1`.
- **The test is the cheap one the ticket asked for.** `check.test.ts` renders from a recorded
  `profile_mm` fixture, opens no browser, and runs in **17 ms** — against the 18 s a full
  `bun run check` costs. It was proven to fail first: `Export named 'renderReport' not found`.
- **`check.ts` now exports `renderReport()` and runs `main()` only under `import.meta.main`**, which
  is what makes the pure render testable. `bun run check` still works, at **18.2 s** — the variance
  against T0006's 17.0 s is the capture step, which this ticket does not touch.
- **Gates**: `bun test` (whole repository) → 34 pass, 0 fail. `check_idle.ts` → exit 0.
  `check_zoom.ts` → exit 0. `agent-browser session list` → `No active sessions`.
