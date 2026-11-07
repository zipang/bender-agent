# Viewer refactor plan

Status: in progress. This document describes the target architecture and the migration order.

| Step | State | Commit |
| :--- | :--- | :--- |
| 0 Baseline | done | `bf338a2` |
| 1 View table | done, all eight views byte-identical | `4e39375` |
| 2 API | done, five endpoints, guards tested | this commit |
| 3 Client | done, nine views byte-identical, failure path named | this commit |
| 4 Measure | done, panel reads the API scale, 13 unit tests | this commit |
| 5 Frame | done, six formulas, IoU within 0.001 | this commit |
| 6 Stage | done, `scenes/*/scene.js` deleted, nine views pixel-identical | this commit |
| 7 Tools | done, `--scene`, closed on failure | this commit |
| 8 to 9 | planned | |

## 1. Purpose

The Three.js viewer works. It controls the camera, shows the reference views as calques, measures
in model units, captures named views, and answers a silhouette comparison. The art director uses it
on the R5 TL 1972 asset.

The viewer is not reusable. Every framing constant, every view table, and every model import is
bound to one subject. This document plans a refactor into a common base that serves any blueprint.

Two decisions are already taken:

1. There is **one viewer page**, selected by `?scene=<directory>`. A scene is not a separate copy
   of the viewer.
2. There is **one view table**, `viewer/views.json`, read by the browser and by the offline Python
   tools.

A third decision follows from the first two:

3. The viewer loads **one resolved document** from a Bun API. It does not assemble file paths and it
   does not merge data sources itself.

## 2. Current state, measured

### 2.1 What the file does

`scenes/r5-tl-1972/scene.js` holds 997 lines in thirteen sections:

| Section | Lines | Subject knowledge |
| :--- | ---: | :--- |
| control surface (`__ctl`) | 692-998 | yes, everywhere |
| calque | 160-381 | two tables |
| measure (model units and panel) | 382-555 | one constant |
| camera and `VIEWS` | 41-159 | fixed framing |
| lights and ground | 556-600 | yes |
| HUD and view buttons | 608-647 | yes |
| loop and `__stats` | 648-691 | yes |
| renderer | 21-40 | no |
| **the model** | 601-607 | **the subject itself** |

The subject occupies 7 lines. It influences more than 60 percent of the file.

### 2.2 Where the subject leaks

| # | Coupling | Line | Effect on another blueprint |
| :--- | :--- | :--- | :--- |
| 1 | `import { buildBody, measure, target, deviation } from "./model.js"` | 15 | the module name and the function name are fixed |
| 2 | `car` as the model identifier | 17 places | the whole control surface talks to one name |
| 3 | `DISTANCE = 10.5` | 75 | 2.98 times the length of this car, as a constant |
| 4 | `target = (0, 0.7, 0)` | 84 | 0.7 is half of 1.4 m |
| 5 | `orthoHeight = 4.4` | 86 | fixed orthographic framing |
| 6 | `ctlReset` restores 0.7 and 4.4 | 730-733 | the same constants, duplicated |
| 7 | shadow box 4.5, ground radius 9, grid 12 | 564-599 | calibrated on one car |
| 8 | `SPANS`: `left` spans `length` and `height` | 243-249 | assumes the key names of a vehicle |
| 9 | `PLANE_AXES` | 400-404 | repeats the mapping of item 8 |
| 10 | `VIEWS` has no `bottom` | 64-73 | `shot.ts` declares `bottom` and fails |
| 11 | HUD size in metres, title in HTML | 624, `index.html` | a subject in millimetres reports wrong |
| 12 | `"the image itself is 2.8 on left"` | 514 | a constant where the plate already stores `kx_mm` |

### 2.3 The five view tables

The view list is copied five times:

| File | Entries | Extra data |
| :--- | ---: | :--- |
| `scenes/.../scene.js` | 8 | azimuth, elevation, perspective, up |
| `scripts/scene/shot.ts` | 8 | includes `bottom` |
| `scripts/scene/check.ts` | 7 | |
| `scripts/scene/compare_silhouette.py` | 5 | anchor semantics |
| `scripts/vcad-render/export.ts` | 7 | azimuth, elevation |

A new view costs five edits. A disagreement fails late or never.

## 3. Target layout

```text
viewer/
  index.html          the only page
  main.js             reads ?scene=, loads the document, imports the model, mounts
  views.json          the only view table
  api.js              the client for /api/*, with named errors
  frame.js            framing, ground and shadow numbers from the real dimensions
  camera.js           camera rig, presets, calque mask by angle
  calque.js           reference plates
  measure.js          picking in model units, and the panel
  stage.js            renderer, lights, ground, HUD, loop, __ctl, __stats
  contract.js         the schema of the scene document and of the model module

scenes/<subject>/
  scene.json          the only file that describes the subject to the viewer
  model.js            the volume
  accessories.js      the work list of stage 3
```

`scenes/<subject>/index.html` and `scenes/<subject>/scene.js` are removed.

## 4. The scene API

### 4.1 Endpoints

| Endpoint | Method | Response |
| :--- | :--- | :--- |
| `/api/scene?scene=scenes/<dir>` | GET | the merged scene document, section 4.2 |
| `/api/asset?scene=<dir>&view=<name>` | GET | the cropped reference image, with the correct media type |
| `/api/model?scene=<dir>` | GET | the model module, as `text/javascript` |
| `/api/scenes` | GET | the list of directories under `scenes/` that hold a `scene.json` |
| `/api/measure` | POST | writes `measurements.json` into the subject folder |

The viewer uses no other data route. It never builds a path under `blueprints/`.

### 4.2 The merged scene document

```json
{
  "ok": true,
  "scene": { "id": "r5-tl-1972", "dir": "scenes/r5-tl-1972", "name": "R5 TL 1972" },
  "subject": { "dir": "blueprints/vehicules/r5-tl-1972", "category": "vehicules" },
  "unit": "m",
  "roles": { "x": "width", "y": "height", "z": "length" },
  "real": {
    "length": { "mm": 3521, "source": "manufacturer, Renault 5 (1972)" },
    "width": { "mm": 1525, "source": "manufacturer, Renault 5 (1972)" },
    "height": { "mm": 1400, "source": "manufacturer, Renault 5 (1972)" }
  },
  "views": {
    "left": {
      "azimuth": 0, "elevation": 0, "perspective": false, "up": [0, 1, 0],
      "axes": "zy", "plate": true, "required": true, "anchor": "edge-ground",
      "span": { "h": { "role": "length", "mm": 3521 }, "v": { "role": "height", "mm": 1400 } },
      "reference": {
        "url": "/api/asset?scene=scenes/r5-tl-1972&view=left",
        "size_px": [1251, 532], "subject_box": [2, 2, 1248, 529], "offset": [2, 2],
        "kx_mm": 2.8236, "ky_mm": 2.6515, "gate": "corrected"
      }
    }
  },
  "gates": { "scales": "pass", "g1": "pass" },
  "anchors": { "ground_clearance_mm": 265 },
  "problems": [],
  "warnings": []
}
```

Every length in the document is in **millimetres**. The viewer divides by 1000 when it builds
geometry. A single unit removes the `{ value, source }` unwrap that produced `NaN` twice.

### 4.3 Merge rules

The server reads four files and merges them in this order:

1. `viewer/views.json` gives the physical description: azimuth, elevation, perspective, `up`,
   `axes`, `plate`, `required`, `anchor`.
2. `scenes/<dir>/scene.json` gives the subject directory and the model module.
3. `blueprints/<subject>/dimensions.json` gives the real dimensions, the roles, the calibrated
   scales and the gate results.
4. `blueprints/<subject>/cropped/manifest.json` gives the pixel geometry of each crop.

The span of a view comes from its `axes` and the roles, not from a per-view table. For `axes: "zy"`,
the horizontal span is `real[roles.z]` and the vertical span is `real[roles.y]`.

The server recomputes `kx` and `ky` from `subject_box`, then compares them with
`dimensions.json.views[view].scale_mm_per_px`. A difference above 0.2 percent becomes a warning with
the view name and both values.

A required view with no crop is a **problem**. An optional view with no crop is a **warning**.
`ok` is false when `problems` is not empty, and the viewer shows the problems instead of a scene.

### 4.4 Security

The `scene` parameter must resolve inside `scenes/`. The subject must resolve inside `blueprints/`.
Both use the existing `isInside` guard. A failing path returns 403, not 404, so the difference
between "outside the repository" and "missing" stays visible.

### 4.5 Reload

The server watches three directories:

- `viewer/`
- `scenes/`
- the subject folder of the last requested scene

The third entry is what makes a change to `cropped/left.png` or `dimensions.json` reload the page.
Today it does not.

## 5. Contracts

### 5.1 `scenes/<subject>/scene.json`

```json
{
  "subject": "blueprints/vehicules/r5-tl-1972",
  "model": "./model.js",
  "name": "R5 TL 1972"
}
```

The viewer derives the rest from the subject folder. `name` is optional and falls back to the
directory name.

### 5.2 The model module

```js
export function build() { /* returns the THREE root */ }   // required

export const meta = {                                      // optional
  real: { x: "width", y: "height", z: "length" },
  report: (root) => ({ target, deviation }),               // the gate numbers
};
```

The viewer computes the bounding box, the triangle count and the mesh count itself. `target` and
`deviation` are knowledge of the subject, so they stay in the model module. A scene backed by a
`.glb` returns a `build()` that loads the file, and touches nothing else.

### 5.3 `viewer/views.json`

```json
{
  "left":     { "azimuth": 0,   "elevation": 0,     "axes": "zy", "perspective": false, "plate": true,  "required": true,  "anchor": "edge-ground" },
  "right":    { "azimuth": 180, "elevation": 0,     "axes": "zy", "perspective": false, "plate": true,  "required": true,  "anchor": "edge-ground" },
  "front":    { "azimuth": 90,  "elevation": 0,     "axes": "xy", "perspective": false, "plate": true,  "required": true,  "anchor": "center-top" },
  "back":     { "azimuth": 270, "elevation": 0,     "axes": "xy", "perspective": false, "plate": true,  "required": true,  "anchor": "center-top" },
  "top":      { "azimuth": 90,  "elevation": 89.99, "axes": "xz", "perspective": false, "plate": true,  "required": true,  "anchor": "center", "up": [0, 0, -1] },
  "bottom":   { "azimuth": 270, "elevation": -89.99,"axes": "xz", "perspective": false, "plate": true,  "required": false, "anchor": "center" },
  "front-3q": { "azimuth": 60,  "elevation": 30,    "perspective": true },
  "rear-3q":  { "azimuth": 240, "elevation": 30,    "perspective": true },
  "iso":      { "azimuth": 40,  "elevation": 22,    "perspective": true }
}
```

`axes` replaces `SPANS` and `PLANE_AXES`. The anchor names lose the vocabulary of one subject:
`nose-ground` becomes `edge-ground`, and `center-roof` becomes `center-top`. The ground clearance
is a measurement of the subject, so it moves to `dimensions.json`.

### 5.4 `dimensions.json`

Two fields are added:

```json
{
  "axes": { "x": "width", "y": "height", "z": "length" },
  "anchors": { "ground_clearance_mm": 265 }
}
```

A character uses `{ "x": "width", "y": "height", "z": "depth" }`. Nothing else changes.

## 6. Framing derived from the real dimensions

Every framing constant is a fixed multiple of the largest real dimension. The five multiples
reproduce the current values on this subject:

| Constant | Rule | Current value | Rule value |
| :--- | :--- | ---: | ---: |
| camera target Y | `height / 2` | 0.70 m | 0.70 m |
| perspective distance | `2.982 x max(w, h, l)` | 10.50 m | 10.50 m |
| orthographic height | `1.250 x max(w, h, l)` | 4.40 m | 4.40 m |
| ground radius | `2.556 x max(w, h, l)` | 9.00 m | 9.00 m |
| grid size | `3.408 x max(w, h, l)` | 12.0 m | 12.0 m |
| shadow half-size | `1.278 x max(w, h, l)` | 4.50 m | 4.50 m |

The rule is verified when the refactor reproduces these six numbers. A different number means a
coefficient was invented, not measured.

A per-view orthographic fit is a later improvement. This pass keeps one orthographic height, so the
framing comparison stays honest.

## 7. Migration plan

Each step ends with its gates, section 7.1. No step starts before the previous one passes.

| # | Step | Content |
| :--- | :--- | :--- |
| 0 | Baseline | **Done.** `scenes/r5-tl-1972/baseline.json`, eight views, silhouette IoU recorded. |
| 1 | View table | Create `viewer/views.json`. Point `scene.js`, `shot.ts`, `check.ts`, `compare_silhouette.py` and `export.ts` at it. |
| 2 | API | `serve.ts` serves `/api/scene`, `/api/asset`, `/api/model`, `/api/scenes`, `POST /api/measure`. The merge rules of section 4.3 apply. |
| 3 | Client | `viewer/api.js` loads the document and raises named errors. `calque.js` loses `calqueMeta`, `SPANS`, the scale check and the `kx` computation. |
| 4 | Measure | `viewer/measure.js`. The panel reads `kx_mm` from the plate instead of a constant. |
| 5 | Frame | `viewer/frame.js`. Six constants become six formulas, section 6. |
| 6 | Stage | **Done.** `viewer/camera.js`, `calque.js`, `picker.js`, `stage.js`, `contract.js`, `main.js`, `index.html`. `scene.js` and `scenes/*/index.html` are deleted. |
| 7 | Tools | `ctl.ts` gains `--scene` and builds `?scene=`. `shot.ts` and `check.ts` read `views.json`. `bottom` works. |
| 8 | Second subject | `scenes/blue-and-white-minivan-01/` with `scene.json` and `model.js` only. The page opens it with no edit outside its folder. |
| 9 | Documents | `AGENTS.md` scene rules, `volume-modelling` section 2.5, `README.md`. |

### 7.1 Gates

| Gate | Check |
| :--- | :--- |
| Model identity | `size`, `triangles`, `meshes`, `deviation`, `target` identical to the baseline, on all eight views |
| Camera identity | `azimuth`, `elevation`, `perspective`, `up` identical, per view |
| Silhouette | IoU on `left`, `front`, `back` within 0.005 of 0.674, 0.765, 0.770 |
| No duplication | `grep -rn "front-3q" scripts viewer scenes` returns only `viewer/views.json` |
| Second subject | The viewer opens the minivan with no change outside `scenes/blue-and-white-minivan-01/` |

The model numbers are exact. The framing numbers are allowed to change, because they become
derived. Section 6 states what they must equal.

## 8. What stays specific to the subject

- `model.js`: the volume, the numbers, `REAL`, the materials. A base that guesses a volume is a
  generator, not an instrument.
- `accessories.js`: the work list of stage 3.
- `scene.json`: the subject directory, the model module, the display name.
- The real dimensions and their source. They are an input, and the base reads them, never invents
  them.
- The ground clearance. It is a measurement, not a framing rule.
- The anchors of the gate. They describe this subject.

## 9. Failure modes to keep

These six faults already happened. The refactor must make each one impossible or visible.

| Symptom | Cause | Rule |
| :--- | :--- | :--- |
| Plate 404 | the client built a path with `../../` | the URL comes from the API |
| Plate loads and draws nothing | the cache entry was disposed | detach, never dispose a cache entry |
| Plane is `NaN` and undrawable | `real.height` is `{ value, source }` | the API sends millimetres as numbers |
| Plane is hundreds of pixels off | source box used for the crop | the API sends `subject_box` and `offset` only |
| Every measurement 0.3 percent short | scale built on the crop, margin included | the scale uses `subject_box`; the build fails without it |
| Plate disappears on zoom | the mask tested the view name | the mask tests the angle |
| Perfect silhouette score | the plate was in the capture | `shot` hides the plate unless `--plate` |
| Two tools disagree on a view | five tables | one `views.json`, and gate 4 |

## 10. Open points

- A per-view orthographic fit, so each reference fills the frame. It changes the images, so it needs
  its own before and after.
- `/api/model` for a `.glb`-backed scene. The endpoint already allows it.
- A scene picker in the page, driven by `/api/scenes`. It is a convenience, not a requirement.
