# Contour smoothing plan

Status: planned. This document describes the staircase defect, the target pipeline, and the
documentation track that goes with it. No step is done.

| Step | State | Commit |
| :--- | :--- | :--- |
| 0 Baseline | planned | |
| 1 Subpixel edge | planned | |
| 2 Float opening | planned | |
| 3 Resampling | planned | |
| 4 Poly and bezier | planned | |
| 5 Viewer | planned | |
| 6 Documentation | planned | |

## 1. Purpose

The contour that `trace_hull.py` emits is a staircase. It is drawn over the reference picture, so
the defect is easy to see and easy to mistake for a modelling error. The cause is not the image. It
is the sampling.

This plan fixes the sampling at its source, gives the contour two emit modes, and adds the
documentation that makes the whole Three.js workflow readable without opening the scripts.

## 2. Current state, measured

### 2.1 The format

`scenes/<subject>/body-hull.js` holds one entry per orthogonal view:

```js
export const CONTOURS = {
  left: {
    kx: 0.0028236, ky: 0.0026515,   // metres per pixel, in the plate's frame
    size_px: [1251, 532],
    used: true,                      // false: a witness view, not read by the hull
    points: [u0, v0, u1, v1, ...],   // metres, flat, four decimals
  },
};
```

The array is a closed ring. One pass writes the top edge from left to right, then the bottom edge
back. The viewer turns the ring into a `LineLoop`, or into `LineSegments` when the view is a
witness.

Point counts today: `left` 2494, `right` 2442, `front` 1970, `back` 1396, `bottom` 1018,
`top` 736.

### 2.2 The source resolution

The tracer reads the cropped PNG. It does not read the canvas, and it does not read the source
image.

| View | Source image | Cropped file | Resampling |
| :--- | ---: | ---: | :--- |
| `left` | 1376 x 768 | 1251 x 532 | none. The crop is a sub-rectangle. |
| `front` | 2048 x 1152 | 988 x 885 | none. |
| `top` | 1376 x 768 | 372 x 708 | none. |

The pixel pitch of the contour is therefore the pitch of the generated image: 2.8236 mm across and
2.6515 mm down, on `left`. The display scale does not enter the trace.

### 2.3 The three causes of the staircase

1. **One integer sample per column.** `plate_contour` reads `view.cols`, which holds
   `np.flatnonzero` results. These are integers. A column reports one row for its top and one row
   for its bottom, so every step is one pixel high and one pixel wide. Every corner is a right
   angle. That is the staircase.
2. **A binary threshold.** The test is `min(RGB) < 246`. The true edge falls between two pixels,
   and the threshold snaps it to a pixel boundary.
3. **Two independent polylines.** The top edge and the bottom edge are separate passes, so each
   step adds an explicit vertical segment. Two segments meet at each step.

### 2.4 What the image supports

The generated image is not a hard mask. A vertical cut through the roof shows a transition over
about four pixels:

```text
coverage   0.01  0.02  0.05  0.16  0.47  0.60  0.62  0.64  0.63 ...
```

A 50 percent crossing between two samples gives a subpixel position. The position error falls from
plus or minus 0.5 pixel to about plus or minus 0.1 pixel, which is plus or minus 0.3 mm on `left`.
The material for a smooth contour is already in the file.

### 2.5 The defect is in the source, not only on screen

The hull reads the same integer intervals. A smooth outline drawn over a stepped mesh would show a
clean curve and a stepped volume at the same time. That is the worst case for judgment, because
the eye cannot tell which one is wrong.

The float fix must therefore happen in the intervals, before both consumers read them.

The two staircases are separate: the contour steps by one pixel, about 2.8 mm, and the mesh steps
by `--step`, which is 20 mm today. The float fix removes the first. `--step` controls the second.

## 3. Target design

### 3.1 One source of truth

```text
image
  -> subpixel edges        float lo[] and hi[] per pixel column, and per pixel row
  -> float opening         the same 150 mm window, now on floats
  -> two consumers
       contour: resample at --pitch, then emit poly or bezier
       hull:    read the same arrays at its own --step grid
```

Today the pipeline starts at "integer intervals". It must start one step earlier.

### 3.2 Subpixel edge

For each pixel column, walk the coverage profile from the outside inward and find the first
crossing of 0.5. Interpolate linearly between the two samples that straddle it.

```python
def crossing(profile, start, step):
    """The subpixel index where the profile crosses 0.5, walking from `start` in direction `step`."""
```

Rules:

- A pixel counts as covered when `min(RGB) < 250`, which is a wider band than today. The 0.5
  crossing does the discrimination, not the threshold.
- The two samples that straddle 0.5 must bracket it. If they do not, the column is ambiguous and
  returns `NaN`, as an absent column does today.
- The result is in pixels, as a float. The conversion to metres stays in one place, `View.to_model`.

### 3.3 Float opening

`erode`, `dilate` and `open_intervals` already work on float arrays. They only receive integers
today. The change is in the caller, not in the morphology.

One ordering rule becomes load-bearing. A NaN sample must not erase its neighbours, and the code
already skips NaN in both directions. This stays.

### 3.4 Resampling

The contour must not depend on the image resolution. It samples the opened intervals at a pitch the
caller chooses, in millimetres:

```bash
--pitch 2      # default. 2 mm is under one pixel on every current view.
```

A pitch under the pixel size is honest only because the edge is subpixel. A pitch under 1 mm adds
points without adding information, and the document must say so.

### 3.5 Two emit modes

| Mode | Output | When |
| :--- | :--- | :--- |
| `poly` | straight segments, one per resampled point | default. It is the trace, with no interpretation. |
| `bezier` | cubic segments fitted to the resampled points | reading, judging, and a clean outline to look at |

The bezier fit is greedy and guarded by a maximum deviation:

1. Start at a resampled point with the tangent of the next segment.
2. Grow the span one point at a time, and refit the cubic control points by least squares.
3. Stop when the maximum distance from any point of the span to the curve exceeds `--tolerance`.
4. Emit the cubic for the span before the failure, then restart at its last point.

```bash
--tolerance 0.25    # mm. About a tenth of a pixel. The deviation is measured, then reported.
```

The tracer prints the measured maximum deviation. A fit that meets the tolerance is a fact, not a
claim.

## 4. Contracts

### 4.1 `CONTOURS` version 2

The flat `points` array is replaced by a path. A path is one closed subpath, and it holds segments
in the shape that `THREE.Path` accepts.

```js
left: {
  kx, ky, size_px, used,
  mode: "bezier",                  // "poly" or "bezier"
  pitch_mm: 2,
  tolerance_mm: 0.25,
  deviation_mm: 0.18,              // measured, not requested
  points: 74,                      // how many points the fit consumed
  path: {
    start: [u, v],
    segments: [
      ["L", u, v],
      ["C", c1u, c1v, c2u, c2v, u, v],
    ],
  },
}
```

A poly contour is the same structure with `"L"` segments only. One reader serves both modes.

### 4.2 Command line

| Flag | Default | Meaning |
| :--- | ---: | :--- |
| `--pitch` | 2 | millimetres between contour samples |
| `--mode` | `poly` | `poly` or `bezier` |
| `--tolerance` | 0.25 | millimetres. Maximum deviation of the bezier fit |
| `--step` | 20 | millimetres between hull sections. Unchanged |

### 4.3 Viewer

`viewer/calque.js` builds the outline from `path`:

- `poly`: `THREE.Path` with `lineTo`, then `getPoints`.
- `bezier`: the same `Path` with `bezierCurveTo`, then `getPoints` at a fixed division.

The witness dash cutter stays. It reads the flattened positions, so it serves both modes.

The HUD gains a third state on the contour button? No. One switch, and the mode comes from the
file. A mode selector in the page is a later convenience, and it belongs to the viewer's own list
of open points.

## 5. Documentation track

The request is explicit. The code must stop being the only record of the process. Two files carry
the record, and each step of this plan updates them in the same commit.

### 5.1 `README.md`: the workflow chapter

Replace the current "Modelling a scene in the browser" section with a chapter that a new reader can
follow without opening a script.

| Section | Content |
| :--- | :--- |
| The pipeline at a glance | The four stages, from a draft to a `.glb`, and which tool does each |
| Stage 0, draft | The inputs, the command, the artifact, the human decision |
| Stage 1, blueprint | The six views, the crops, the scales, `dimensions.json`, gate G1 |
| Stage 2, volume | The contour, the hull, the sections, gate G2 |
| Stage 3, accessories | The five-step loop per part, gate G3 |
| The viewer | The page, `?scene=`, the API, the three layers, the capture |
| Tool inventory | One row per script: what it reads, what it writes, its command |
| Artifact map | Which file is written by which tool, and who owns it |
| Failure modes | One row per fault that already happened, its cause, and the rule |

The tool inventory is the part that answers "what does this repository do" without a search. Each
row states the input, the output, and the command. It covers `scripts/scene/*.py`,
`scripts/scene/*.ts`, `scripts/measure/`, `scripts/blueprint-generate/`, and
`scripts/vcad-render/`.

### 5.2 `AGENTS.md`: the rules

`AGENTS.md` stays short. It holds the rules, not the tutorial.

| Addition | Content |
| :--- | :--- |
| The pass, in order | The commands of one modelling pass, in the order that works |
| The contour rules | Subpixel, float opening, then resample. Never a binary threshold alone |
| The documentation duty | A change that adds a tool, a flag, a file, or a gate updates `README.md` and `AGENTS.md` in the same commit |
| The glossary duty | A new project word gets an entry in `README.md`, alphabetically sorted |

### 5.3 The documentation duty

A step of this plan is not complete when the code passes its gate. It is complete when the two
documents describe the new behavior, and the commit carries both.

The rule exists because the cost is real. This session read the code three times to answer
questions the documents should have answered: the contour format, its source resolution, and why
the plan view's plate did not appear.

## 6. Migration plan

No step starts before the previous step passes its gate.

| # | Step | Content |
| :--- | :--- | :--- |
| 0 | Baseline | Record the six point counts, the hull numbers, and the five IoU values in `body-hull.js` and in a `baseline-contour.json`. |
| 1 | Subpixel edge | `crossing()` in `trace_hull.py`. `cols` and `rows` become floats. The hull and the contour read them. Gate: the hull size moves by under 2 mm on every axis. |
| 2 | Float opening | The morphology reads floats without a code change. Verify the 150 mm window still removes the mirrors and keeps the sill. Gate: the cut table is unchanged within 2 mm. |
| 3 | Resampling | `--pitch`, default 2 mm. `plate_contour` walks the opened intervals at that pitch. Gate: no repeated point, no segment over the pitch by more than 1 percent, and the contour stays inside the hull envelope. |
| 4 | Poly and bezier | The greedy fit, `--mode`, `--tolerance`, and the measured deviation. Gate: deviation at or under the tolerance on all six views, and `left` under 120 points. |
| 5 | Viewer | `path` instead of `points`, both modes, the witness dash preserved. Gate: three layers superpose on `left`, `top`, and `back`, and a witness view draws dashed. |
| 6 | Documentation | The workflow chapter in `README.md`, the rules in `AGENTS.md`, the glossary entries, and this plan's progress table. Gate: a reader answers "what writes `body-hull.js`" from `README.md` alone. |

### 6.1 Gates

| Gate | Check |
| :--- | :--- |
| Model identity | `size`, `triangles`, `target`, `deviation` within 2 mm and 1 percent of the baseline of step 0 |
| Silhouette | IoU on `left`, `front`, `back`, `top`, `bottom` within 0.005 of the step 0 values |
| Contour | Deviation at or under the tolerance, on all six views, printed by the tool |
| Point count | `bezier` on `left` under 120 points, from 2494 today |
| No staircase | At trace zoom, no right angle in the bezier outline, and no vertical segment between two adjacent samples |
| Layers | The picture, the contour, and the model superpose on one plane, and each of the three switches alone |
| Documents | `README.md` names the command and the output of every script in the pipeline |

The IoU values of step 0 are: `left` 0.940, `front` 0.855, `back` 0.915, `top` 0.936, `bottom`
0.935. The hull is 3521 x 1505 x 1180 mm, with the sill at 215 mm.

## 7. Failure modes to keep

| Symptom | Cause | Rule |
| :--- | :--- | :--- |
| A smooth outline over a stepped mesh | only the display was smoothed | fix the intervals, then both consumers inherit it |
| A contour that follows the canvas | the trace ran on a screenshot | read the cropped PNG, never the page |
| A witness that disagrees everywhere | the witness used the raw mask | the witness gets the same mask and the same opening |
| A bezier that misses the trace | the fit was trusted, not measured | print the maximum deviation and gate on it |
| A staircase that comes back on one view | that view had no subpixel edge | every view goes through `crossing()` |
| A plate that draws nothing | the plate sat under the ground disc | a plan view is placed by height, not by depth |
| A document that describes an older tool | the doc was written once | the same commit updates the documents |

## 8. Open points

- A mode selector in the page. It is a convenience, and the file already carries the mode.
- A per-view orthographic fit, so each reference fills the frame. It changes the images, and it
  needs its own before and after.
- A contour for the perspective views. Today they have no plate, so they have no contour.
- The `top` calibration drift of 20.69 percent. It is the next measurement to settle, and it is
  independent of this plan.
