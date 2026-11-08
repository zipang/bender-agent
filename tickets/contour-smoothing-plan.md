# Contour smoothing plan

Status: planned. No step is done.

| Step | State | Commit |
| :--- | :--- | :--- |
| 0 Baseline | planned | |
| 1 Subpixel edge | planned | |
| 2 Float opening | planned | |
| 3 Path | planned | |
| 4 Contact sheet | planned | |
| 5 Hull from the path | planned | |
| 6 Viewer | planned | |
| 7 Documentation | planned. The reorg landed, so this step adds rows to an existing chapter | |

## 1. Purpose

The body surface carries a staircase along a diagonal line. The line is where two extruded
silhouettes meet. It is a real feature of the shape, and it must stay. What must go is the way the
surface draws it: as a run of steps instead of a straight line.

`tickets/escaliers.png` shows the defect on a shaded render, circled at the meeting line of the roof
profile and the side profile.

This plan therefore does two things in one movement:

1. It turns the traced contour into one simplified path per view, with fewer points, either smooth
   (bezier) or angular (straight lines), at a resolution the caller chooses.
2. It makes that path the **only** source of the volume, so the hull samples the path instead of
   re-sampling the photograph on a fixed 20 mm lattice.

The second point is what makes the first one pay. Today the two are siblings. A simplified contour
over a 20 mm hull would show a clean line and a stepped surface at the same time, which is the
worst case for judgment, because the eye cannot tell which one is wrong.

## 2. Current state, measured

### 2.1 The format

`workflows/threejs/scenes/<subject>/body-hull.js` holds one entry per orthogonal view:

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

The tracer reads `cropped/<view>.png`. It does not read the canvas, and it does not read the
reference directly.

That file is a **cut, not a resample**. `crop_reference.py` calls `Image.crop` and saves, so the
cropped array is identical to the same rectangle of the locked reference. Measured on `left`: 768 x
1376 source, 532 x 1251 crop, and the two arrays are equal at the pixel.

| View | Locked reference | Cropped file | Resampling |
| :--- | ---: | ---: | :--- |
| `left` | 1376 x 768 | 1251 x 532 | none. The crop is a sub-rectangle. |
| `front` | 2048 x 1152 | 988 x 885 | none. |
| `top` | 1376 x 768 | 372 x 708 | none. |

The pixel pitch of the contour is therefore the pitch of the locked reference: 2.8236 mm across and
2.6515 mm down, on `left`.

The rule follows from that. **The trace reads the reference at its native resolution.** The crop
never resamples, and no image is upscaled to reach the trace. An upscale would repeat the
interpolation that `crossing()` already does, at a larger file size and with no new information.

Resolution is decided upstream, when the art director locks `reference.<ext>` for a view. The trace
inherits that choice, and cannot improve it.

`dimensions.json` records `image_px` for the cropped file, and the scale it holds is millimetres per
pixel **of that file**. A reference with a different native size gives a different crop and a
different scale. It is a re-measurement with `view_scale.py`, never a multiplication of the old
value. The locked references do not change in this plan, so the step 0 baseline stays valid.

What resolution buys has a limit, and it is measured. The coverage of a `left` column crosses from
0.10 to 0.60 over 4 pixels, which is 11.5 mm. The softness is the rounded, lit shoulder of the
generated render, not the sampling grid. A subpixel crossing locates that ramp to about 0.3 mm, and
a finer grid samples the same ramp better. It does not make the ramp narrower.

### 2.3 What the staircase is

The hull is built on a fixed lattice. `--step 20` is documented in the tracer as the **column and
station pitch**, and the measurement confirms it:

| Quantity | Measured |
| :--- | --- |
| Stations along the length | 177, for 3521 mm. Pitch 20.1 mm |
| Columns across the width | 76, for 1505 mm. Pitch 20.1 mm |
| Vertices outside that lattice | none |
| Triangles | 51,300 |
| Pixel pitch on `left` | 2.82 mm across, 2.65 mm down |

The surface height is `min(face_hi(x), side_hi(z))`. The two silhouettes cross along a diagonal
crease. At a mid station, 42 of 75 columns carry a distinct pair of heights, so the roof is not
flat. The roof is cut by that crease.

A 20 mm lattice that crosses a diagonal crease cannot follow it. The surface alternates between the
two constraints from one lattice cell to the next, and each switch draws as a step. The tread is
20.1 mm. The riser is the height difference between the two silhouettes at that point.

A second staircase has the same origin. The plan outline is the run of lattice columns, so the
shoulder edge is quantized to 20.1 mm. The flank ribbon then notches at every station.

**The crease is not the defect.** The defect is that a diagonal is drawn as a staircase. A
simplified path restores the straight line, and keeps the crease.

The hull lattice is 7 to 13 times coarser than the photograph. The pixel is the finest measurement
this project has, and it is the surface that needs the resolution, not the sampling.

### 2.4 What the image supports

The generated image is not a hard mask. A vertical cut through the roof shows a transition over
about four pixels:

```text
coverage   0.01  0.02  0.05  0.16  0.47  0.60  0.62  0.64  0.63 ...
```

A 50 percent crossing between two samples gives a subpixel position. The position error falls from
plus or minus 0.5 pixel to about plus or minus 0.1 pixel, which is plus or minus 0.3 mm on `left`.

The material for a diagonal is already in the file. It is the sampling that destroys it.

### 2.5 The contour does not feed the mesh

`model.js` builds the mesh from `SECTIONS`, and exports `CONTOURS` for the reference plate only.
The two arrays are written by the same tracer, and they are read by two consumers that never meet:

```text
photograph -> tracer -> SECTIONS  (20 mm lattice) -> mesh
photograph -> tracer -> CONTOURS  (1 point per pixel) -> viewer plate
```

A simplified contour would change the plate and leave the mesh exactly where it is. The two
consumers must become one chain.

## 3. Target design

### 3.1 One source of truth

```text
image
  -> subpixel edges        float lo[] and hi[] per pixel column, and per pixel row
  -> float opening         the same 150 mm window, now on floats
  -> closed outline        one ring per view
  -> simplified path       resampled, then fitted. poly or bezier. deviation measured
  -> two consumers
       viewer: draw the path, as it is
       hull:   sample the path at a chord tolerance, and build the same three-way intersection
```

The path is the artifact that both consumers read. Nothing downstream re-reads the photograph.

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

This step does not remove the staircase. It is what makes a diagonal a diagonal in the path, and it
is cheaper to do before the fit than after it.

### 3.3 Float opening

`erode`, `dilate` and `open_intervals` already work on float arrays. They only receive integers
today. The change is in the caller, not in the morphology.

One ordering rule becomes load-bearing. A NaN sample must not erase its neighbours, and the code
already skips NaN in both directions. This stays.

### 3.4 The path: resample, then fit

The contour must not depend on the image resolution, and it must not carry one point per pixel.

```bash
--pitch 2        # mm. The resampling interval. Under one pixel on every current view.
--mode poly      # poly or bezier
--tolerance 0.25 # mm. Maximum deviation of the fit
```

A pitch under the pixel size is honest only because the edge is subpixel. A pitch under 1 mm adds
points without adding information, and the document must say so. The pixel is a ceiling, not a
target.

| Mode | Output | When |
| :--- | :--- | :--- |
| `poly` | straight segments, one per resampled point | default. It is the trace, with no interpretation. |
| `bezier` | cubic segments fitted to the resampled points | reading, judging, and a clean outline to look at |

The bezier fit is greedy and guarded by a maximum deviation:

1. Start at a resampled point with the tangent of the next segment.
2. Grow the span one point at a time, and refit the cubic control points by least squares.
3. Stop when the maximum distance from any point of the span to the curve exceeds `--tolerance`.
4. Emit the cubic for the span before the failure, then restart at its last point.

The tracer prints the measured maximum deviation. A fit that meets the tolerance is a fact, not a
claim.

### 3.5 The hull reads the path

The hull keeps its construction. At a station, a section is still the three-way intersection of one
interval from each view. What changes is where the stations come from.

Today the stations are `linspace` at a fixed pitch, and the columns are `linspace` across the
width. Both are blind to the shape.

After this step, the stations and the columns are the **vertices of the sampled paths**, plus
whatever the chord tolerance adds:

- A straight run of the path becomes one long span. It was 20 mm steps, each with its own quad.
- A curved run keeps its vertices. The lattice is dense where the shape turns and sparse where it
  does not.
- A crease is crossed by one straight span instead of a run of steps, because the two silhouettes
  are now read at the same stations.

Two parameters, and only one of them decides:

| Flag | Default | Meaning |
| :--- | ---: | :--- |
| `--deviation` | 0.5 | mm. The chord tolerance. This decides where a span ends and a vertex is placed. |
| `--step` | 200 | mm. A hard cap on the span length. It keeps a flat panel from becoming one quad. |

The tracer prints the station count before and after. A run that keeps its count means the
tolerance is doing nothing, and the step has failed.

The crease itself is not smoothed away. It is a C0 line between two surfaces, and it stays. Only its
representation changes.

### 3.6 The parameters are chosen at the render, not from a number

A pitch of 2 mm and a tolerance of 0.25 mm are plausible, and plausibility is not a decision. No
one can judge them from a table. The defect is visible, so the choice is visible too.

The staircase is clearest on a three-quarter view, at the meeting line of the two profiles. It is
almost invisible on an orthogonal view. So a sheet of contour tiles alone cannot decide. Each cell
shows two pictures side by side:

```bash
--sheet left,front-3q --pitch 1,2,4 --tolerance 0.1,0.25,0.6
```

```text
                contour on the reference        shaded body, 3/4 view
  pitch 1  t 0.1   [tile]                          [tile]
  pitch 2  t 0.25  [tile]                          [tile]
  ...
```

The left picture is drawn at trace zoom over the reference image, with the deviation printed under
it. The right picture is a capture of the body at the same settings, from the view where the
meeting line shows.

The art director picks one cell. The choice is recorded in this plan, and the defaults become that
cell. No number is defended before it is seen.

The sheet is one PNG per row, produced by a script. It is not a test, and it does not pass or fail.
It is the evidence the choice rests on.

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

### 4.2 `SECTIONS` version 2

The record keeps its shape. It loses its regularity.

- `z` is no longer evenly spaced. It follows the path vertices and the tolerance.
- `columns` keeps `[index, x, lo, hi]`. The index stays, because two consecutive stations rarely
  share the same run of columns, and the mesh matches columns by index.
- `TRACE` gains `deviation_mm`, `max_step_mm`, and the station count before and after.

A reader that assumed an even pitch must say so, or stop assuming it. Nothing else in the mesh
builder changes.

### 4.3 Command line

| Flag | Default | Meaning |
| :--- | ---: | :--- |
| `--pitch` | 2 | millimetres between path samples |
| `--mode` | `poly` | `poly` or `bezier` |
| `--tolerance` | 0.25 | millimetres. Maximum deviation of the bezier fit |
| `--deviation` | 0.5 | millimetres. Chord tolerance of the hull lattice |
| `--step` | 200 | millimetres. Hard cap on the span length |

`--step` is a cap, not a pitch. An old command line that passes `--step 20` still runs, and it means
"no span longer than 20 mm".

### 4.4 Viewer

`viewer/calque.js` builds the outline from `path`:

- `poly`: `THREE.Path` with `lineTo`, then `getPoints`.
- `bezier`: the same `Path` with `bezierCurveTo`, then `getPoints` at a fixed division.

The witness dash cutter stays. It reads the flattened positions, so it serves both modes.

The mode comes from the file. A mode selector in the page is a later convenience, and it belongs to
the viewer's own list of open points.

## 5. Documentation track

The code must stop being the only record of the process. Two files carry the record, and each step
of this plan updates them in the same commit.

```text
workflows/threejs/README.md    the workflow in use: pipeline, tools, artifacts, gates
workflows/threejs/AGENTS.md    the rules for an agent that works in it
workflows/blender/README.md    the same, for Blender
workflows/blender/AGENTS.md
workflows/vcad/README.md       the same, for vcad. Archived: the project does not use it.
workflows/vcad/AGENTS.md
```

The root `README.md` is an index. It states the three workflows, which one this project uses, the
shared inputs under `blueprints/`, and the glossary.

### 5.1 `workflows/threejs/README.md`: the contour rows

`tickets/workflow-reorg-plan.md` landed first and wrote this chapter, with its tool inventory and
its artifact map. What is left for this step is the contour:

- the two new flags that decide the shape, and the one that caps it
- the two emit modes
- the measured deviation, and where it is printed
- the contact sheet, and what it is evidence for
- the row that says the hull now reads the path, and the row that says it used to read the
  photograph

Read the existing chapter, then add the rows. Do not rewrite it.

### 5.2 `workflows/threejs/AGENTS.md`: the rules

| Addition | Content |
| :--- | :--- |
| The contour rules | Subpixel, float opening, then a path. Never a binary threshold alone. |
| The single-source rule | The plate and the hull read the same path. A second sampling of the photograph is a defect. |
| The documentation duty | A change that adds a tool, a flag, a file, or a gate updates the workflow's `README.md` and `AGENTS.md` in the same commit |
| The glossary duty | A new project word gets an entry in `README.md`, alphabetically sorted |

### 5.3 The documentation duty

A step of this plan is not complete when the code passes its gate. It is complete when the two
documents describe the new behavior, and the commit carries both.

The rule exists because the cost is real. This session read the code three times to answer
questions the documents should have answered.

### 5.4 Where a sentence belongs

| Question | Document |
| :--- | :--- |
| Is this about the page, the API, the trace, or the capture? | `workflows/threejs/` |
| Is this about Blender, its add-on, or its materials? | `workflows/blender/` |
| Is this about vcad, BRep, or Loon? | `workflows/vcad/` |
| Is this about the six views, the crops, or the real dimensions? | the root `README.md`, because every workflow reads them |
| Is this a word with a special meaning here? | the glossary in the root `README.md` |

## 6. Migration plan

No step starts before the previous step passes its gate.

| # | Step | Content |
| :--- | :--- | :--- |
| 0 | Baseline | Record the six point counts, the station and column counts, the hull numbers, and the five IoU values in `baseline-contour.json`. |
| 1 | Subpixel edge | `crossing()` in `trace_hull.py`. `cols` and `rows` become floats. The hull and the contour read them. Gate: the hull size moves by under 2 mm on every axis. |
| 2 | Float opening | The morphology reads floats without a code change. Verify the 150 mm window still removes the mirrors and keeps the sill. Gate: the cut table is unchanged within 2 mm. |
| 3 | Path | `--pitch`, `--mode`, `--tolerance`, the greedy fit, and the measured deviation. `CONTOURS` moves to version 2. Gate: deviation at or under the tolerance on all six views, and `left` under 120 segments. |
| 4 | Contact sheet | `--sheet`, one PNG per row, with the contour and the shaded 3/4 view side by side. The art director chooses the cell. Gate: the chosen cell is recorded, and the defaults become that cell. |
| 5 | Hull from the path | The stations and columns come from the sampled path. `--deviation` decides, `--step` caps. Gate: the surface follows the path, the triangle count falls, and no silhouette moves by more than the IoU gate allows. |
| 6 | Viewer | `path` instead of `points`, both modes, the witness dash preserved. Gate: three layers superpose on `left`, `top`, and `back`, and a witness view draws dashed. |
| 7 | Documentation | Add the contour rows to `workflows/threejs/README.md`, the contour rules to `workflows/threejs/AGENTS.md`, the glossary entries to the root `README.md`, and this plan's progress table. Gate: a reader answers "which flag sets the pitch, and what proved its value" from the workflow document alone. |

### 6.1 Gates

| Gate | Check |
| :--- | :--- |
| Model identity | `size` and `target` within 2 mm of the baseline of step 0 |
| Silhouette | IoU on `left`, `front`, `back`, `top`, `bottom` within 0.005 of the step 0 values |
| Path | Deviation at or under the tolerance, on all six views, printed by the tool |
| Point count | `bezier` on `left` under 120 segments, from 2494 points today |
| No staircase | On a shaded three-quarter view, the meeting line of the two profiles is a straight run, with no tread of one lattice cell. This is read on the render, not on the contour |
| Lattice | The station count is below the baseline of 177, and the tool prints it |
| Triangle count | Below 50 percent of the 51,300 baseline. A count that does not fall means the tolerance is doing nothing, and the step has failed |
| Layers | The picture, the contour, and the model superpose on one plane, and each of the three switches alone |
| Documents | `workflows/threejs/README.md` names the command and the output of every script in the workflow |
| Parameter choice | The pitch and the tolerance come from a rendered contact sheet that shows the surface, and the chosen cell is written in this plan |

The IoU values of step 0 are: `left` 0.940, `front` 0.855, `back` 0.915, `top` 0.936, `bottom`
0.935. The hull is 3521 x 1505 x 1180 mm, with the sill at 215 mm.

The triangle gate is a designed target, chosen before the measurement. It is a test of the
implementation, not a promise about the shape.

## 7. Failure modes to keep

| Symptom | Cause | Rule |
| :--- | :--- | :--- |
| A clean outline over a stepped surface | the contour and the hull read the photograph apart | one path, two readers |
| A contour that follows the canvas | the trace ran on a screenshot | read the cropped PNG, never the page |
| A witness that disagrees everywhere | the witness used the raw mask | the witness gets the same mask and the same opening |
| A bezier that misses the trace | the fit was trusted, not measured | print the maximum deviation and gate on it |
| A staircase that comes back | the hull re-sampled the photograph | the hull reads the path, and the station count is printed |
| A plate that draws nothing | the plate sat under the ground disc | a plan view is placed by height, not by depth |
| A document that describes an older tool | the doc was written once | the same commit updates the documents |

## 8. Open points

- A mode selector in the page. It is a convenience, and the file already carries the mode.
- A per-view orthographic fit, so each reference fills the frame. It changes the images, and it
  needs its own before and after.
- A contour for the perspective views. Today they have no plate, so they have no contour.
- The resolutions of the locked references. Five of the six are 1376 x 768, and a 2048 x 1152
  candidate sits in the same folder for each. A larger reference gives a larger crop and a
  different measurement, so it changes the picture and not only the sampling. It needs its own pass,
  with its own baseline, before step 0 or after this ticket closes.
- The crease as a real edge loop. The hull could emit the meeting line as its own edge, so the two
  surfaces are separated by a hard edge rather than by a change of normal inside a quad. This is a
  shading and topology question, not a sampling one, and it needs its own measurement.
- The `top` calibration drift of 20.69 percent. It is the next measurement to settle, and it is
  independent of this plan.
