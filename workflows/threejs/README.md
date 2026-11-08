# The Three.js workflow

The active workflow of this project. It builds a 3D asset from a locked multi-view blueprint, runs
it in a browser, and measures the render against the reference until the shape agrees. The
deliverable is a `model.js` that builds the asset with `three` alone, and a `.glb` exported from it.

Every rule below is measured. Where a rule exists because something went wrong, the failure is
written next to it.

## 1. The pipeline at a glance

```text
blueprints/drafts/<draft>/        subject/ and style/ images
  -> one reference image          an image model combines them            stage 0
  -> blueprints/<category>/<subject>/reference.<ext>
  -> six orthographic views       one image model call per view           stage 1
  -> dimensions.json              real dimensions and a scale per view    stage 1
  -> the body volume              three traced silhouettes, intersected    stage 2
  -> the accessories              one per pass, measured and placed       stage 3
  -> model.js and a .glb          one source, two consumers
```

The four stages live here. The first two are shared with every other workflow: `blueprints/` holds
the inputs, and `scripts/blueprint-generate/`, `scripts/blueprint/` and `scripts/measure/` hold the
tools that prepare them.

## 2. The layout of this folder

```text
workflows/threejs/
  README.md            this file
  AGENTS.md            the rules for an agent that works here
  viewer/              the shared page, its modules, views.json
  scenes/<subject>/    one directory per subject: scene.json, model.js, and what it imports
  tools/               the server, the API, the capture, the trace, the comparisons
```

A scene holds two files and no build step:

| File | Role |
| :--- | :--- |
| `scene.json` | `{ id, name, subject, model }`. `subject` is repository-relative, so the scene can move |
| `model.js` | The asset. Exports `build()` or `buildBody()`, plus `measure()`, `target()` and `deviation()` when it carries the gate numbers |

`model.js` imports `three` and nothing else: no DOM, no renderer, no network. The live scene and
the exported `.glb` are then built from the same source.

## 3. Stage 0: the reference image

Input: `blueprints/drafts/<draft>/subject/` and `style/`. One image model call combines them into a
single reference on a uniform white field. The art director chooses the candidate, and the choice is
a copied file named `reference.<ext>`.

Run the free check first. It sends no request and lists the gaps:

```bash
cd scripts/blueprint-generate
bun run blueprint-generate.ts --draft ../../blueprints/drafts/<draft> --ask
```

Then generate, and mention what the reference holds in panel order:

```bash
bun run blueprint-generate.ts --draft ../../blueprints/drafts/<draft> \
  --models <model-id> --variants 3 --style "<style>" --two-view
```

A generation appends the next free counter. A rejected candidate stays where it is: there is no
archive folder, because a file that was rejected is evidence about what the prompt produced.

## 4. Stage 1: the views and their scales

```bash
bun run blueprint-generate.ts --subject blueprints/<category>/<subject> \
  --models <model-id> --variants 3 --style "<style>" \
  --reference-views "<panel 1> | <panel 2>"
```

`--reference-views` names the viewpoints the reference image holds, in panel order. Without it the
prompt claims one viewpoint, and the model draws both panels side by side in every view.

Then crop and calibrate. Every view gets two scales, one per axis, because a generated view carries
its own proportions:

```bash
python3 scripts/blueprint/crop_reference.py --subject blueprints/vehicules/<subject>
python3 scripts/blueprint/view_scale.py blueprints/vehicules/<subject>/cropped/left.png \
  --view left --length 3.521 --width 1.525 --height 1.400 --source "manufacturer" \
  --write blueprints/vehicules/<subject>/dimensions.json
```

A view's verdict is `pass` under 5 percent drift, `corrected` between 5 and 25, and `reject` above
25. A rejected view is regenerated, never rescaled. A corrected view is used, and both of its scales
are mandatory.

Gate G1: every required view has two scales, no required view is `reject`, and one landmark shared
by two views agrees within 10 percent.

## 5. Stage 2: the body volume

The body is one closed volume built as the **intersection of three extruded silhouettes**: the side
elevation, the plan, and the front elevation. Each pixel column and row is a measurement, so no
section is guessed.

```bash
python3 workflows/threejs/tools/trace_hull.py --subject blueprints/vehicules/<subject> \
  --out workflows/threejs/scenes/<subject>/body-hull.js --step 20
```

It writes `body-hull.js`, which holds `SECTIONS`, `CONTOURS` for all six views, and the numbers the
gate reads. The mesh step is separate from the contour step: the hull steps by `--step` in
millimetres, and the contour steps by one pixel.

Stage 2 models the body only. No accessory, no placeholder, no reference box, and **no hole**:
wheel arches, window openings and lamp recesses belong to stage 3, when the part that fills them has
been measured. A hole changes the silhouette, and G2 measures the silhouette.

Gate G2: the body silhouette matches the reference in every locked view, within 100 mm or 3 percent
of the largest dimension, whichever is smaller.

## 6. Stage 3: the accessories

One accessory per pass, and the same five steps every time:

1. **Select** it on a view where it is fully visible, and write its record: size, the views it was
   measured on, and the landmark it is positioned against.
2. **Model it apart**, at the origin, in its own frame, as its own named group.
3. **Validate it alone**: bounding box within 3 percent, and an overlay of the part on its reference
   region, before it touches the body.
4. **Place it**: orient first, then translate.
5. **Register it** as its own node parented to the body root. Never merge it into the body mesh.

The work list is `scenes/<subject>/accessories.js`. The body is `model.js`.

Gate G3 passes per accessory: size recorded, own box within 3 percent, placed within 20 mm of the
landmark offset, no z-fighting, no gap over 5 mm, and the body unchanged since G2.

## 7. The viewer

One page serves every scene. It is chosen by `?scene=`, and `/` redirects to it with the scene the
server was started with. The page is the same for every subject, so a modelling pass never edits it
to look from another angle.

```bash
bun run serve                                   # http://127.0.0.1:5180
bun run workflows/threejs/tools/ctl.ts open --shot --scene <name>
bun run workflows/threejs/tools/ctl.ts shot /tmp/opencode/left.webp --view left
bun run workflows/threejs/tools/ctl.ts close
```

A scene is named by its directory name, and by nothing else: `?scene=r5-tl-1972`. A path is refused,
and the refusal names the form. One name appears in a URL, in a command line, in a capture log and in
`scene.json`, so one form is one thing to keep in step instead of three.

| Route | Serves |
| :--- | :--- |
| `/` | redirect to the viewer, on the scene of `--scene` |
| `/viewer/*` | the shared page and `views.json` |
| `/workflows/threejs/scenes/*.js` | a scene's modules, at their real path, so a relative import resolves. Every other file is refused |
| `/vendor/three/*` | the `three` package |
| `/api/*` | the scene document, the assets, the model, the scene list, a measurement write. Every endpoint takes `?scene=<name>` |
| `/repo/*` | read-only files under the repository root |
| `/measure/` | the point picker for stage 1 |

The client never assembles a path. One API document returns the subject, the dimensions, the crops
and the view table already merged and in millimetres, and each failure has a name.

The page carries three layers, each with its own switch: the model, the contour, and the calque.
A calque is the reference plate, sized in metres from `kx` and `ky`. A plan view is placed by
height, not by depth, because the ground disc hides a plate placed under it.

## 8. The tools

Every row states what the tool reads, what it writes, and how it is called.

| Tool | Reads | Writes | Command |
| :--- | :--- | :--- | :--- |
| `tools/serve.ts` | the scene folder, the viewer, `node_modules/three` | nothing | `bun run serve` |
| `tools/api.ts` | `scene.json`, `dimensions.json`, the crop manifest, the view table | nothing, except `POST /api/measure` | reached through `serve.ts` |
| `tools/ctl.ts` | the live page | a capture, and its `.json` sidecar | `ctl.ts <command>` |
| `tools/shot.ts` | the live page, the view table | `<out>/<prefix>-<view>.webp` | `shot.ts --out <dir> --prefix <p> --scene <name>` |
| `tools/check.ts` | the captures, the references | one report, and the overlays | `bun run check` |
| `tools/silhouette.ts` | a render, a reference | an overlay PNG: red reference only, blue model only, magenta both | `silhouette.ts --subject <s> --render <dir>` |
| `tools/compare_silhouette.py` | a render, its sidecar, a reference, `dimensions.json` | an overlay, and a station table in millimetres | `--subject <s> --view <v> --render <file>` |
| `tools/trace_hull.py` | the cropped views, `dimensions.json` | `body-hull.js`: sections, contours, gate numbers | `--subject <s> --out <file> --step 20` |
| `tools/paths.ts` | nothing | nothing. It holds the root, the viewer, the scenes and the tool folder | imported |
| `scripts/blueprint/crop_reference.py` | `reference.<ext>` | `cropped/<view>.png` and `cropped/manifest.json` | `--subject <s>` |
| `scripts/blueprint/view_scale.py` | a cropped view, the real dimensions | an entry in `dimensions.json` | `--view <v> --length .. --write` |
| `scripts/blueprint/measure_view.py` | a reference, a render | a landmark table in millimetres | `<reference> <render> --json` |
| `scripts/blueprint/read_reference.py` | a side-view reference | profile data, in millimetres from the nose | `<image> --length 3520` |
| `scripts/measure/index.html` | a reference image | picked points, through the API | open `/measure/?subject=..&view=..` |
| `scripts/measure/report.py` | the picked points | `measurements.json`, and an annotated copy | `<subject> --annotate --write` |
| `scripts/blueprint-generate/` | a draft, a subject, a model | candidate images, then `reference.<ext>` | see its own README |

The last five rows prepare a reference, and every workflow needs them. They stay under `scripts/`,
not under this folder.

## 9. The artifacts

| Artifact | Written by | Owner |
| :--- | :--- | :--- |
| `blueprints/<cat>/<sub>/reference.<ext>` | the art director, by promotion | the art director |
| `blueprints/<cat>/<sub>/source.<ext>` | the cleaning pass, before it writes | nobody modifies it |
| `blueprints/<cat>/<sub>/<view>/reference.<ext>` | the art director, from the candidates | the art director |
| `blueprints/<cat>/<sub>/cropped/*` | `crop_reference.py` | derived, rebuilt at any time |
| `blueprints/<cat>/<sub>/dimensions.json` | `view_scale.py`, then read | committed: it records the decision |
| `blueprints/<cat>/<sub>/measurements.json` | `report.py`, or `POST /api/measure` | committed |
| `scenes/<sub>/body-hull.js` | `trace_hull.py` | generated, committed, never hand-edited |
| `scenes/<sub>/model.js` | a person or an agent | the authority for the shape |
| `scenes/<sub>/accessories.js` | a person or an agent | the stage-3 work list |
| `blueprints/<cat>/<sub>/model/*.webp` | `shot.ts` and `check.ts` | local, gitignored |
| `*.glb` | the export | local, gitignored |

## 10. Gates

| Gate | Check |
| :--- | :--- |
| G1, the scale | two scales per required view, no `reject`, and one shared landmark within 10 percent |
| G2, the body | the binary silhouette matches in every locked view, within 100 mm or 3 percent |
| G3, an accessory | its own box within 3 percent, placed within 20 mm, no z-fighting, no gap over 5 mm |
| Silhouette | IoU of the two binary masks, not a shaded render |
| Orientation | the two side images show the same flank before any number is trusted |
| Capture | the flat views use the orthographic camera |

A gate measured on one view is half-measured. Write `not measured` for the others and treat the gate
as failed.

## 11. Failure modes this workflow keeps

| Symptom | Cause | Rule |
| :--- | :--- | :--- |
| A mirrored silhouette reads as plausible | the two images show opposite flanks | check the nose side on both, in the picture |
| A correct roof measures wrong | a perspective camera against an orthographic reference | flat views use the orthographic camera |
| Every measurement is 0.3 percent short | the calque was calibrated on the cropped file, not the subject box | calibrate on the subject box |
| A plate draws nothing | the plate sat under the ground disc | a plan is placed by height |
| A contour is a staircase | one integer row per pixel column | the edge is subpixel, and the opening runs on floats |
| The surface is a staircase | the hull re-samples the photograph on a fixed lattice, so a diagonal crease is cut into steps | the hull reads the simplified path, and its pitch is a chord tolerance, not a constant |
| An accessory removal eats the shoulder | a taper is a long run of small moves | remove by geometric opening on the intervals, never by colour |
| A capture fails with an undefined global | the pass wrote a render into the watched subject | `model/` is not watched |
| A stage reports numbers and no picture | the stage was not finished | a stage ends with one WebP per named view |
| A scene module fails to import | an alias hid the real path | a module is served where it lives |

## 12. Where the documentation lives

| Question | Document |
| :--- | :--- |
| What does this workflow do, and with which tools? | this file |
| What are the rules for an agent that works here? | [`AGENTS.md`](./AGENTS.md) |
| How does the generator combine and extend images? | [`../../scripts/blueprint-generate/README.md`](../../scripts/blueprint-generate/README.md) |
| What is the folder contract under `blueprints/`? | [`../../blueprints/README.md`](../../blueprints/README.md) |
| What method does the fidelity ladder require? | [`../../research/progressive-volume-modeling.md`](../../research/progressive-volume-modeling.md) |
| Why this workflow replaced the CAD attempt? | [`../../research/threejs-modelling-loop.md`](../../research/threejs-modelling-loop.md) |
| What is still to do? | [`../../tickets/`](../../tickets/) |
