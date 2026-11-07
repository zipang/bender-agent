# A Modelling Loop in Three.js

**A measured, repeatable way to build a 3D asset in the browser, with the reference as the
specification and the render as the evidence.**

Status: field notes. The **toolchain** it describes is current and is reused by the
`volume-modelling` skill: serve the source, capture, overlay, measure, and guard the orientation.
The **modelling strategy** it describes — one side profile extruded, then fitted against one view —
is superseded. Fitting one view proves nothing about the width, the plan, or the parts that are not
the body. Use the `volume-modelling` skill for the order of work, which proves the scale on every
view before the body is built, and builds the accessories one at a time after it.

Date: 2026-11-06. Scope: hard-surface assets modelled from a locked multi-view blueprint.
Paths are as they were on that date. The workflow now lives in `workflows/threejs/`, and
`workflows/threejs/README.md` holds the current layout.

---

## 1. Why this exists

The first attempt used a parametric CAD server with a BRep kernel. It produced geometry, but the
geometry was wrong in ways that were hard to see and hard to fix:

- Booleans produced near-coplanar faces, which render as moiré on the flank.
- `wedge` was listed in the type catalog and rejected by the engine.
- A stale part id silently duplicated geometry instead of failing.
- A second `translate` replaced the first instead of wrapping it.

None of these are fatal alone. Together they make each pass slower than the one before, because
the model accumulates damage that nobody can see until the render.

Three.js has the opposite profile. It has no CSG worth using, so it forces a modelling method
that suits a stylized asset: **extrude one profile, place primitives on it, and taper it.** And it
renders in a browser, which means the loop closes in under a second.

The lesson is not "CAD is bad". The lesson is that the tool must match the deliverable. A stylized
game figurine is a silhouette and a set of flat panels. A BRep kernel is built for tolerances and
machining. Modelling a figurine with machining tools spends the effort on the wrong risk.

## 2. The loop

```
           edit model.js
                |
                v
   bun run scripts/scene/check.ts        one command
                |
    +-----------+-----------+
    |           |           |
 capture     overlay     measure
  WebP      silhouette   millimetres
    |           |           |
    +-----------+-----------+
                v
        one table, one image
                |
                v
      decide the next correction
```

One command, one report, one image. The pass is judged on numbers and on a silhouette overlay, in
that order. The eye confirms; the measurement decides.

### 2.1 Serve the source, do not bundle it

`scripts/scene/serve.ts` serves the scene directory, the `three` package, and a
server-sent-events reload channel. There is no build step.

- The browser loads the source that is on disk, so a stack trace names a real line.
- A change costs one reload.
- The import map points `three` at `node_modules/three/build/three.module.js` and
  `three/addons/` at `node_modules/three/examples/jsm/`.

This matters because a bundler would put a transform between the edit and the picture, and the
transform is where a stale module hides.

### 2.2 The model is a module, not a scene

`scenes/<subject>/model.js` exports `build()` (or `buildBody()`) and `measure()`. It imports `three`
and nothing else. It touches no DOM, no renderer, no network.

A scene is that module plus a `scene.json` that names its subject. The viewer that draws it is
shared, at `viewer/`, and is chosen by `?scene=`. A subject owns no page. See
`research/viewer-refactor-plan.md` for the migration that split the two.

The consequence: the same file builds the live scene and the exported GLB. There is one source of
truth, and a change cannot apply to one and not the other.

### 2.3 The page exposes a script API

The scene sets `window.__ready`, `window.__setView(name)` and `window.__stats()`. Capture is then
a page operation, not a renderer operation:

1. open the page once,
2. call `__setView` for each view,
3. screenshot the canvas,
4. convert to WebP.

`__setView` resolves after a frame that includes the new camera, so the screenshot cannot race the
camera.

### 2.4 Orthographic views for flat references

A blueprint sheet is an orthographic elevation. A perspective camera can never line up with one,
no matter how far back it sits. So the scene carries two cameras and switches:

| View kind | Camera | Reason |
| :--- | :--- | :--- |
| `front`, `back`, `left`, `right`, `top` | `OrthographicCamera` | matches the reference projection |
| `front-3q`, `rear-3q`, `iso` | `PerspectiveCamera` | judges volume, which an elevation cannot |

Skipping this made every overlay look "almost right" on the roof and "wrong" on the wheels, for a
reason that had nothing to do with the model.

## 3. Measurement, not opinion

### 3.1 The silhouette overlay

`scripts/scene/silhouette.ts` reduces both images to a silhouette and blends them:

- **red**: present in the reference only,
- **blue**: present in the model only,
- **magenta**: both.

Two rules make the overlay honest:

- **Scale by width, never to the bounding box.** Fitting each subject to its own box would stretch
  a too-tall model back into shape and hide the error being looked for.
- **Anchor at the bottom centre.** Both subjects stand on the ground and are centred on their own
  length, so the ground line and the mid-length plane coincide. Every remaining difference is a
  real difference.

### 3.2 The number report

`scripts/scene/measure_view.py` prints the same landmarks for both images, in millimetres:

- overall height and its ratio to length,
- the wheel centres and tyre diameter,
- the height of the upper edge at 21 stations from the nose.

The output is a table with a delta column. A correction is then a number, not an adjective.

### 3.3 The orientation guard

A mirrored comparison is the most expensive mistake in this loop, because a mirrored silhouette of
a nearly correct model still looks plausible. It survived three passes here: the two reference
files carried swapped `left` and `right` labels.

The check compares the side that carries the roof mass in each image. On a hatchback the
greenhouse sits behind the middle, so that side is the tail side. If the two images disagree, the
report prints a warning and exits non-zero, before any measurement is trusted.

The probe is named after what it measures — `mass-left` / `mass-right` — and never after the nose.
Inferring "the nose is here" needs a handedness convention, and a convention that is off by one
turns a working check into a confident lie. This exact error happened during the work: the first
version of the guard reported a correct comparison with the wrong label.

## 4. Mistakes that cost time, and the rule that prevents each

| Symptom | Cause | Rule |
| :--- | :--- | :--- |
| Overlay all magenta or all blank | `-colorize 100` replaces the image | use `+level-colors black,#colour` to tint a mask |
| Background not removed | brightness threshold ate the grey trim | flood fill from the four corners, never a threshold |
| Roof "almost right", wheels "wrong" | perspective camera against orthographic reference | switch camera by view kind |
| Correct model, wrong verdict | normalization by bounding box | scale by width, anchor at the ground |
| Mirrored comparison | swapped view labels | measure the roof-mass side in both images |
| Nose on the wrong side of the frame | azimuth convention derived, not observed | check the nose side in the render once, in the image |
| Wheel arch shows through the body | open tunnel behind the tyre | a dark plate inboard of each wheel |
| Arch moiré | coincident faces | avoid CSG entirely; cut the arch as a hole in the profile |
| Body is a slab with a roof | constant-section extrusion | taper the vertices by height and by length |

## 5. The modelling vocabulary that actually works

Three.js has no usable CSG. That is a constraint, and it is a good one, because it maps to the
shape of the asset:

1. **One extruded side profile** for the body, with the wheel arches as holes in the profile.
   `THREE.Shape` plus `ExtrudeGeometry`. The shape carries the whole silhouette; the extrusion
   gives it width.
2. **Vertex tapering** on that extrusion for the tumblehome and the narrowing ends. This is the
   only thing that separates a car from a bar of soap.
3. **Primitives on top** for the glazing, the lamps, the bumpers, the trim.
4. **A group per movable part**, origin on the pivot. A wheel is a group at the hub, so a rotation
   is a `rotation.x` and nothing else.
5. **Measured profiles, written as data.** The profile point list is read from the reference by a
   script, and the comments give the measurement each point answers to.

## 6. Cost of one pass

| Step | Before | Now |
| :--- | :--- | :--- |
| Capture | 1 call | 1 call |
| Convert | 1 call | included |
| Overlay | 1 call | included |
| Measure | 1 call | included |
| Read the images | 2 calls | 2 calls, unchanged |
| Orientation check | none, assumed | automatic, fails loud |
| **Total** | **5 calls per pass, blind** | **3 calls per pass, guarded** |

The remaining two image reads are the ones worth keeping: the number report can say the silhouette
is 40 mm too tall, but only the picture says the roof is a slab.

## 7. What is still missing

- **Automatic convergence.** The loop still requires a human decision per pass. A fitter that moves
  a profile point to close its own delta would remove the slowest step, but it would also let the
  model optimise into nonsense at the corners, so it needs a per-point guard.
- **Width in the overlay.** The current overlay only checks a side elevation. The plan view is
  measured but not overlaid, so the taper is still judged by eye.
- **A shared profile library.** Every vehicle repeats "extrude a profile, cut two arches, taper the
  ends". That belongs in `scenes/lib/`, not in each subject.
