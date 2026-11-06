---
name: volume-modelling
description: Model a 3D asset in three gated stages from a locked multi-view blueprint. Use when building any solid subject — vehicle, character, creature, product, machine — and the reference views already exist. Establishes the real dimensions and the per-view pixel scale first, builds the bare body as an axis-aligned section mesh second, then adds each accessory separately and places it on the body third. Each stage must pass its gate before the next one starts.
---

# Volume Modelling

This skill is the method. It builds one solid subject from a set of locked orthographic views.

It is not a modelling library and it does not name a tool. It names the **order of work**, the
**artifact** that carries each stage, and the **gate** that must pass before the next stage starts.

Read the whole skill before the first pass. A stage that starts on a wrong premise costs the
whole pass, and the gate cannot see a mistake that was already accepted.

## Scope

| In scope | Out of scope |
| :--- | :--- |
| One solid subject with a locked blueprint | Scene assembly, lighting, animation |
| The outer shape: volume, silhouette, and surface parts | Texturing from photographs, retopology for games |
| Dimensions in millimetres, traced from the views | Anything the reference does not show |

The precondition is a blueprint: a set of views whose scale is not yet known but whose shape is
accepted by the art director. If the views do not exist, stop. Use `blueprint-preparation` first.

### Which views are required

Not every locked view carries the same authority. Decide this before stage 1, and write it down.

| View | Default | Why |
| :--- | :--- | :--- |
| left, right, front, back | **required** | they carry the silhouette that the deliverable is judged on |
| top | **required** when the width or the depth varies along the length | it is the only source of the plan profile |
| bottom | **optional, best effort** | the subject usually stands on it, so it is not seen; and an image model has almost no underside in its training data, so it invents one |

An optional view does not enter a gate, and it does not cost a pass. Model the region it shows as
best effort, and state that the result is a hypothesis. Model it properly only when the art
director asks for it by name, or when the deliverable exposes the underside.

The rule for a view that is optional in principle: **it informs, it does not decide**. Where it
agrees with a required view, it is useful. Where it disagrees, the required view wins, and the
disagreement is reported rather than resolved by averaging.

## The five rules

1. **One stage at a time.** A stage is finished when its gate passes. Never start the next stage
   on a gate that failed, and never soften a gate to make it pass.
2. **The body comes before the accessories.** The body is the volume that holds everything else.
   An accessory placed on a wrong body is thrown away with the body.
3. **Every number comes from a measurement.** A value that came from an estimate is written with
   the word `estimate`, and the gate treats it as unproven.
4. **One correction per pass.** Change one thing, measure, and report the delta that the change
   closed. Two changes in one pass hide which one worked.
5. **A render is the evidence.** A stage that produced no picture has not been reported. The art
   director judges the picture; you report the numbers that aim at it.

---

## Stage 1 — Real dimensions and per-view scale

A view is a picture, and a picture has no size. A **generated** view is worse: it was drawn from a
description of the subject, so it carries its own scale and its own proportions. Two views of the
same subject are rarely the same drawing at two sizes.

That is the fact this stage exists for. Assume nothing is at scale. Measure every view.

### 1.1 Declare the real dimensions

The subject has three overall dimensions: `length`, `width`, and `height`. They are **inputs**,
never results.

| Subject | Source of the dimensions |
| :--- | :--- |
| A real machine, vehicle, or product | the manufacturer's figures |
| A human, an animal | a measured individual, or a stated average |
| A fictional or stylized subject | the art director's decision, written down |

Never derive an overall dimension from the views that the model will be checked against. That makes
the check circular: any error is normalized away and every gate passes. Write the source of each
value, and treat `estimate` as unproven.

### 1.2 Two scales per view, not one

Each view spans two of the three dimensions, and each axis of the image carries one of them:

| View | Horizontal | Vertical |
| :--- | :--- | :--- |
| left, right | length | height |
| front, back | width | height |
| top, bottom | width | length |

So a view gives **two** scales:

```
kx = real_horizontal_mm / silhouette_px_horizontal
ky = real_vertical_mm   / silhouette_px_vertical
```

Do not average them. The ratio is a measurement in itself:

```
anisotropy = ky / kx
```

### 1.3 Read the anisotropy, do not hide it

`anisotropy = 1.0` means the view is a uniformly scaled picture of the subject. Anything else means
the drawing was stretched, and the stretch is a **correction to apply**, not a defect to reject: a
per-axis scale restores a stretched circle to a circle.

| Drift from 1.0 | Verdict | What it means |
| :--- | :--- | :--- |
| up to 5% | `pass` | uniform enough; one scale is acceptable |
| 5% to 25% | `corrected` | stretched; **both scales are mandatory** |
| over 25% | `reject` | the drawing has lost the subject's shape; do not trace it |

A rejected view is not a small error. At that drift, a curve that must be circular is an ellipse,
and rescaling cannot recover the detail the generator destroyed. Regenerate it.

The test cannot see everything. A "plan" view drawn as a high three-quarter shows the roof and both
flanks at once, and it passes or fails the anisotropy test by accident. Look at the image, and check
that it shows the face it claims to.

### 1.4 The rule that follows, for every later stage

> **Convert every pixel measurement to a fraction of the spanning dimension, then multiply by the
> real dimension.**

```
mm = (px / silhouette_px_on_that_axis) * real_dimension_mm
```

Never `mm = px * k`, with a single `k`. That product is wrong by the anisotropy, everywhere in the
view, and no later gate can see it. This one rule is what makes a distorted view usable, and it is
the rule that a single-scale method breaks.

### 1.5 Crop each view to its subject, first

A generated view is a picture on a white field, and the subject floats somewhere inside it. Every
tool then has to find it again, and every one of those steps is a place to be wrong.

```bash
python3 scripts/scene/crop_reference.py --subject blueprints/<category>/<subject>
```

It writes `cropped/<view>.png`, where the subject touches the frame, plus `cropped/manifest.json`
with the box and the margin. The locked `reference.<ext>` is read only: the crop is derived and can
be rebuilt at any time.

Two things the crop does **not** do, and they matter:

- it does not change the scale;
- it does not fix the anisotropy.

Both are ratios of two spans, and cropping preserves both. An image that was 9 % short stays 9 %
short. What the crop buys is that the span becomes the image size, so no statistical reading of the
silhouette is needed at all.

That last point is not a convenience, it is a correction. Anchoring a span on a smoothed profile
hides a real extreme: a side view's roof crown is one point of the silhouette, so a smoothing window
wider than the crown shortens the car and turns a real stretch into a false pass. On one subject it
turned an 18.85 % drift into `pass` on the front view and cost two passes. Read the span from the
cropped box, and use `--span robust` only for a stated reason.

### 1.6 Write `dimensions.json`

One file per subject, next to `notes.md`. The script writes it; no hand-editing is needed.

```bash
python3 scripts/scene/view_scale.py \
  blueprints/<category>/<subject>/cropped/left.png \
  --view left --length 3.521 --width 1.525 --height 1.400 \
  --source "manufacturer: 3521 x 1525 x 1400 mm" \
  --write blueprints/<category>/<subject>/dimensions.json
```

The input is the **cropped** file from section 1.5. The real dimensions come from `real` in
`dimensions.json`, which is written once and never derived from a view.

Run it once per view, and add `--optional` for a view that must not gate the stage. It appends one
entry per view and recomputes the two document fields: `scales` and `g1`.

### 1.7 Measure on the image, not by eye

A scale is useless until a distance is read on it. Never estimate a distance from the picture: a
number that looks authoritative and is wrong survives every later stage, and it is the hardest kind
of error to find.

Two tools do the job, and they are the only ones allowed to produce a distance. A point may be placed
by the art director or by an agent, because the placement is visible and checkable; the number is
only used once the annotated copy has been looked at.

**`scripts/measure/index.html`** places the points. Start the dev server, then open:

```text
http://127.0.0.1:5180/measure/?subject=blueprints/<category>/<subject>&view=<view>
```

Click to place a point, drag nothing, name what it is, select two rows, and press *Measure the two
selected points*. The page reads the scale of that view from `dimensions.json`, converts the
distance **per axis** — `dx` with `kx`, `dy` with `ky` — and draws the result on the image. Arrow
keys nudge the selected point by 1 px, Shift by 10 px. *Save to the subject folder* writes
`measurements.json`.

**`scripts/measure/report.py`** does the arithmetic and the check:

```bash
python3 scripts/measure/report.py blueprints/<category>/<subject>
python3 scripts/measure/report.py blueprints/<category>/<subject> --annotate
python3 scripts/measure/report.py blueprints/<category>/<subject> --write
```

`--annotate` writes one PNG per view into `measured/`, so the placement can be checked without a
browser. `--write` records the landmark verdict in `dimensions.json`, which is what closes G1.

Give a measurement a **key** when the same physical dimension appears on several views: the tyre
diameter, the wheelbase, the belt line height. The report groups the keys, prints the spread, and
fails the landmark when the spread is over 10%. That grouping is condition 4 of G1.

### Gate G1 — every view has a scale, and the drift is declared

Pass only when all four conditions hold:

1. The three real dimensions are written, with a source, and none is `estimate`.
2. Every **required** view has both `kx` and `ky` in `dimensions.json`.
3. Every required view is `pass` or `corrected`. No required view is `reject`. An optional view is
   recorded for the record, and it does not block the gate.
4. One landmark visible on two views agrees within 10% after normalization. Good landmarks: the
   tyre diameter on the side and front views, the belt line height on the side and front views, the
   wheelbase on the side and plan views, the track width on the front and plan views.

Condition 4 is the one that proves the views describe the same object, and it is the only condition
that the anisotropy test cannot replace. `scripts/measure/report.py --write` runs it and records the
verdict; run it before you claim G1, and never accept a key whose spread is over 10%.

On failure, report the view, the drift, and the landmark that disagrees. Do not rescale a view to
make it agree, and do not change a real dimension to fit a view. One of them is wrong, and the art
director decides which.

**Report:** the dimensions table with sources, the per-view scale table with `kx`, `ky`, drift, and
verdict, and the landmark cross-check.

## Stage 2 — The body, and only the body

The body is the volume that holds the whole subject together. It is what remains when every
separate part is removed.

| Subject | The body is |
| :--- | :--- |
| Vehicle | the shell: bonnet, flanks, roof, tailgate, and the closed wheel arches |
| Character | the naked body volume: head, torso, limbs |
| Creature | the body between the head and the extremities |
| Product or machine | the main casing, the chassis, the housing |

Everything else is an accessory: glass, lamps, bumpers, grille, mirrors, trim, wheels, wheels
arches if they are separate parts, hair, clothes, tools, props.

**Do not model an accessory in this stage.** Not as a placeholder, not as a box, not as a
reference object. A placeholder is worse than an absence, because it is measured and it is kept.

### 2.1 Trace the three profiles

Trace each profile from its view, in millimetres, at stations along the view's long axis. Every
point comes from a fraction of the view, never from a pixel distance multiplied by one scale
(see 1.4). A profile that was traced with a global scale is a stretched body, and the gate will
report it as a shape error for the whole pass.

- **Side profile** (left or right view): `(z, y)` — the top edge and the bottom edge as functions
  of the length.
- **Plan profile** (top view): `(x, z)` — the left and right edges as functions of the length.
- **Cross profile** (front or back view): `(x, y)` — the width and the height of the section.

Use the required view that is best for the profile, and say which one. A profile traced from an
optional view is a hypothesis, and it is marked `estimate`. `left` and `right` should agree;
when they do not, the difference is either an asymmetry of the subject or a defect of the views.
Report it, and do not average two views without a decision.

### 2.2 Cross the profiles into sections

The body is the intersection of the extents that the three views agree on. At a station `z` along
the length:

1. The side profile gives `y_bottom(z)` and `y_top(z)`.
2. The plan profile gives `x_half(z)`.
3. The cross profile gives the section contour at that station.

Cross them to obtain a section contour: a closed polyline in the `(x, y)` plane at that `z`.

Then hold the other two directions the same way. A station on the plan view gives the section
contour in `(y, z)` at a known `x`. A station on the front view gives the contour in `(x, z)` at a
known `y`.

Every section is a plane, and every plane is perpendicular to one of the three axes. So the model
is a mesh of lines parallel to the three axes, and the surface is the envelope that all sections
share. A point is inside the body only when all three profiles allow it there.

### 2.3 Build the sections

- Start coarse: 12 to 20 stations over the length, and 8 to 12 points per section contour.
- Place more stations where the silhouette bends: the nose, the base of the windscreen, the roof
  break, the tail, and each wheel arch.
- Keep the station positions identical between the views. The same `z` values everywhere, so a
  delta at one station can be compared across views.
- Loft between sections. Close the ends.

Write the station list once, as data, and let the three profiles index into it. Three separate
station lists are three profiles that never meet, which is the first-pass mistake.

### 2.4 Refine by measurement

Take a measurement at each station and in each view, compare it to the reference, and move the
section. Do this in this order:

1. overall bounding box on the three axes,
2. the wheel-centre positions and the ground clearance, if the subject has wheels,
3. the top edge and the bottom edge along the length,
4. the half-width along the length,
5. the section contour at the stations that still differ.

### 2.5 See the frame before you trust the numbers

A section table can be right while the volume is wrong, and the art director judges the volume. So
every pass ends with a look, never with numbers alone.

```bash
bun run scripts/scene/serve.ts --scene scenes/<subject> &     # the dev server
bun run scripts/scene/ctl.ts open                              # one page, reused
bun run scripts/scene/ctl.ts view left
bun run scripts/scene/ctl.ts camera --azimuth 35 --elevation 18 --distance 9
bun run scripts/scene/ctl.ts ortho --on --height 4.4           # flat view, orthographic
bun run scripts/scene/ctl.ts wireframe --on                    # topology, not shading
bun run scripts/scene/ctl.ts isolate Wheel_FL                  # one part, alone
bun run scripts/scene/ctl.ts nodes                             # every named node
bun run scripts/scene/ctl.ts shot /tmp/opencode/left.webp      # one frame
```

`ctl.ts` prints the camera state and the frame statistics after every command, so one call says
where the page stands. `shot.ts` still captures the named views in one pass; use it for the record,
and `ctl.ts camera` for the angle the argument is actually about.

A flat view is **always** orthographic. A perspective camera against an orthographic reference turns
a correct roof into a wrong one, and sends you fixing the model instead of the camera.

### 2.5 Trace on a calque, the way a Blender user does

The reference views are in the scene as planes: `scene.json` names the subject, and the calque loads
`cropped/<view>.png` with its two scales from `dimensions.json`.

```bash
bun run scripts/scene/serve.ts --scene scenes/<subject> &
bun run scripts/scene/ctl.ts open --shot
bun run scripts/scene/ctl.ts view left
bun run scripts/scene/ctl.ts calque --view left --depth front --opacity 0.55
bun run scripts/scene/ctl.ts calque --off
```

The plane is sized in **metres**: `kx` on one axis and `ky` on the other, because the generated view
is stretched. It is placed on the subject's box, not on the image centre. A single scale, or an
anchor on the image centre, puts every traced point off by a known but unmeasured amount, and the
error then looks like a modelling error.

Two depth modes, and they answer different questions:

| `--depth` | What you see | Use it to |
| :--- | :--- | :--- |
| `behind` | the model occludes the reference | find where the silhouette leaves the reference |
| `front` | the reference line lies over the model | catch a stray vertex before the silhouette hides it |

The plate is **masked to its own view**: it is an elevation, so from any other angle it is a picture
of a car that is not there. A perspective view gets nothing.

`ctl.ts shot` hides the calque unless you pass `--plate`. This is not a convenience. The plate *is*
the reference, so a silhouette comparison that included it would compare the reference to itself and
report a perfect score for any model, including an empty scene.

### 2.6 Compare silhouettes, not shading

A shaded render hides an error that a silhouette cannot, so G2 is judged on a binary mask.

```bash
bun run scripts/scene/ctl.ts open --shot --url http://127.0.0.1:5180
bun run scripts/scene/ctl.ts shot /tmp/opencode/left.webp --view left
python3 scripts/scene/compare_silhouette.py \
  --subject blueprints/<category>/<subject> --view left \
  --render /tmp/opencode/left.webp --out /tmp/opencode/cmp-left.png
```

`--shot` loads the capture page: white field, no ground, no grid, no HUD. Without it the ground
plane is a large light shape, and the mask reads it as subject.

`shot --view <name>` **re-applies the view** before it captures, and fails if the page does not
report that view afterwards. The page is live and a human may be orbiting it, so a capture must not
inherit whatever the window happens to show. A file that looks like evidence and is not is worse
than no file.

The overlay is grey where both agree, red where only the reference has the subject, blue where only
the model does. The scale is read in the tool, not by eye: the reference gets `kx` and `ky` from
`dimensions.json`, the model gets its metric size from the sidecar `shot` writes next to the image.

**Do not anchor a wheel-less body on the reference's tyre contact.** Stage 2 has no wheels, so its
lowest point is the sill, 265 mm up. The tool lifts the model by exactly that declared distance, so
both bottoms mean the underside of the body. The band below the sill is the wheel zone and is not
comparable at stage 2; a gate that counts it wrong is measuring a part that is not mounted yet.

### Gate G2 — the body is true

Pass only when all four conditions hold:

1. The silhouette of the body matches the reference in **every required view**, within
   **100 mm, or 3% of the largest dimension, whichever is smaller**.
2. The measured wheel centres, if any, are within **3%** of the length.
3. The body is one closed volume, with no accessory modelled on it and **no hole cut in it**.
   Wheel arches, window openings and lamp recesses are cut in stage 3, when the part that fills them
   has been measured. A hole changes the silhouette, and the gate measures the silhouette.
4. Each of the three bounding-box dimensions is within **3%** of `dimensions.json`.
5. Height is measured **from the ground**, Y = 0, not from the lowest vertex: a body without wheels
   has its lowest point at the sill, and a bounding box would report the body as 265 mm too short.

Say the numbers view by view. A gate that passes on the side view and is not measured on the plan
view has not passed; it is half-measured. If a view cannot be measured yet, write `not measured`
and treat the gate as failed.

**Report:** one overlay and one station table per view, the bounding box on three axes, the IoU of
each silhouette, and the worst station with its delta. A shaded render is not evidence: G2 is
measured on the binary mask from section 2.6.

---

## Stage 3 — Accessories, one at a time

An accessory is any part that the body does not include. Each one goes through the same five
steps, alone, in this order. Never model two accessories in one pass.

### 3.1 Select and create the record

Pick the accessory on a view where it is fully visible. Write its record before you model it:

```json
{
  "name": "windscreen_front",
  "view": "front",
  "landmarks": ["body top edge", "A-pillar on both sides", "bonnet break"],
  "size_mm": { "width": 1180, "height": 520, "thickness": 18 },
  "measured_from": ["front", "left"],
  "gate": "pending"
}
```

A part measured on one view has a 2D size. An accessory needs a third dimension, so measure it on
a second **required** view whenever that view exists. When it does not, or when the only second
view is optional, mark the third dimension `estimate`.

### 3.2 Model it apart

Model the accessory **at the origin**, in its own local frame, as its own named group. Do not
place it yet, and do not join it to the body.

- The part is a `Group` or a `Mesh` with a stable name: `Windscreen`, `Wheel_FL`, `Mirror_R`.
- The pivot is at the point that would move, if the part could move: hinge, hub, base.
- Scale is `1, 1, 1` and rest rotation is `0, 0, 0`.

### 3.3 Validate it alone

Before it touches the body, check the part against its own measurement:

1. The bounding box matches `size_mm` within **3%**.
2. The shape matches the reference region: capture the part alone and overlay it on the cropped
   reference region, the same way the body was checked.
3. The part is closed and its normals point outward.

A part that fails here cannot be fixed by placing it better.

### 3.4 Place it on the body

Two operations, in this order, never reversed:

1. **Orient.** Rotate the part into the target frame, so the surface that must sit on the body
   faces the body facet.
2. **Translate.** Move it to the measured position, as an offset from a named landmark.

The order matters in every tool. In Three.js, `object.rotation` is local to the object, so a
rotation about its own frame is safe; a translate applied after a rotate is not affected by the
rotation. In a CAD kernel, a rotation often acts about the world origin, so the order reverses the
result. State the convention of the tool in the part file.

Apply this rule to both kinds of placement:

- **A part on a facet** — trim strip, mirror, plate, lamp lens — is a thin solid oriented to the
  facet normal and sunk by a fraction of its thickness, so the joint reads as a seam and not as a
  gap.
- **A part in a recess** — headlamp, grille, badge — is placed inside the body and its opening is
  a hole in the body surface. Model the hole with the body in stage 2, and the part in stage 3.

### 3.5 Register and freeze

Keep every accessory as a **separate named node**, parented to the body root. Never merge it into
the body mesh, and never rebuild the body to accommodate it. A separate node can be changed,
hidden, exported, or animated alone.

### Gate G3 — the accessory is accepted

Pass one accessory only when all five hold:

1. Its measured size is recorded, with the views it came from.
2. Its own bounding box matches the record within **3%**.
3. It is placed within **20 mm** of the measured landmark offset.
4. It shares no visible volume artifact with the body: no z-fighting, no gap wider than 5 mm, no
   face showing the background through it.
5. The body is unchanged since G2. If the body changed, G2 is reopened and re-measured.

**Report:** the part record, the part's own render, the placed render, and one line that says
where the seam sits.

The modelling is finished when every accessory in the list has passed G3.

---

## The asset contract

Write these down while the model is built, not after. They are the last gate, and they cannot be
retrofitted cheaply.

| Item | Rule |
| :--- | :--- |
| Unit | `1 unit = 1 m` for a game asset, `1 unit = 1 mm` for fabrication |
| Axis | +Y up, +Z forward, +X right. glTF and Three.js are +Y up; Blender and vcad are +Z up |
| Origin | centre of the base, so the subject stands on `Y = 0` |
| Pivots | on the axis of each part that can move |
| Names | stable, one node per part: `Body`, `Windscreen`, `Wheel_FL`, `Door_L` |
| Transforms | scale `1, 1, 1`, rest rotation `0, 0, 0`, applied |
| Materials | `Principled BSDF` only; it maps to `MeshStandardMaterial` on export |
| Budget | a triangle and draw-call ceiling, decided before the detail passes |

## What to report, at every gate

1. The gate and its verdict, in one line.
2. The numbers that decide it, in a table, view by view.
3. The renders: one per view, named `<asset>-S<stage>-<view>.webp`, so a new pass never overwrites
   the previous evidence.
4. The correction that the numbers call for, and nothing else.

Describe the renders in one line each, and say that the description is not a verdict. The art
director judges.

## Failure modes

| Symptom | Cause | Rule |
| :--- | :--- | :--- |
| Every gate passes, the model looks wrong | the real dimension came from the same views | take the dimensions from outside the view set |
| Silhouette matches on one view, not on the others | one profile fitted, the others assumed | measure all views at the same stations |
| The scale differs between views | a view was generated with stretched proportions | cross-check each view against a dimension it does not span |
| A width-based view drifts by 5 to 12% | a protruding accessory — mirror, antenna, bumper corner — inflates the silhouette | measure the body only, or declare the accessory and subtract its span |
| A "plan" view drifts by 15% or more | the view is a high three-quarter, not an elevation: it shows the roof and the flanks at once | regenerate it, or drop it and say what the width is no longer measured by |
| The underside view shows parts the subject does not have | it is optional by nature, and often invented | best effort only; it does not enter a gate |
| Accessories cannot be placed | the body was modelled after them, or with them | stage 2 is the body only |
| A part sits at an angle on the body | orientation and translation applied in the wrong order | orient, then translate |
| The body changes every time a part is added | parts are merged into the body | one named node per part |
| A mirrored comparison passes | the two images show opposite flanks | check which side carries the roof mass in both |
| A correct roof measures wrong | perspective camera against an orthographic view | use the orthographic camera for flat views |
| A capture shows an angle nobody asked for | the page was live, and a hand had orbited it | `shot --view <name>` re-applies the view and verifies it |
| A stage-2 body looks 265 mm too short everywhere | the comparison anchored its sill on the reference's tyre contact | lift the model by the sill, and exclude the wheel band |
| The model appears smeared across the whole canvas | out-of-range samples clamped to the border instead of left empty | resample to empty, never to the edge |
| The calque loads and draws nothing | `real.height` is `{ value, source }`, and reading it as a number gives NaN | read `.value`, and check the plane's world box |
| The calque sits off by a few hundred pixels | the subject box is in the source image but the plane is built on the crop | use `offset`, which is the box inside the cropped file |
| The calque is missing after a restart of the dev server | the running server predates the `/repo/` route | restart it; a 404 on `/repo/` is the tell |
| A silhouette comparison scores a perfect match | the calque was in the capture | `shot` hides it; only `--plate` shows it |
| A distance is off by a few percent on a stretched view | the diagonal was scaled by one factor | convert per axis: `dx` with `kx`, `dy` with `ky` |
| A stretched view reports a small drift | the span was smoothed, and the smoothing ate the roof or the nose | read the span from the cropped box, not from a profile |
| The crop is expected to fix the proportions | cropping is a translation and a trim | it cannot: the anisotropy is a ratio, and it survives the crop |
| A landmark agrees because both views are wrong | the two measurements share the same mistake | check each against the annotated image, not only against each other |
| The material is white in the viewer | material set on the viewport field, not on the shader | set the base colour on the BSDF node |

## Files this skill reads and writes

| File | Role |
| :--- | :--- |
| `blueprints/<category>/<subject>/<view>/reference.<ext>` | the locked views, read only |
| `blueprints/<category>/<subject>/notes.md` | the camera note, the hidden parts, the subject notes |
| `blueprints/<category>/<subject>/dimensions.json` | **written by stage 1**, read by every later stage |
| `scenes/<subject>/model.js` | the asset: sections, body, accessories |
| `scenes/<subject>/scene.js` | the viewer: renderer, cameras, lights, script API |
| `scripts/scene/crop_reference.py` | **stage 1 tool**: crop each view to its subject, and write `cropped/manifest.json` |
| `blueprints/<category>/<subject>/cropped/` | the cropped views, and the derived manifest. Rebuildable at any time |
| `scripts/scene/view_scale.py` | **stage 1 tool**: the two scales of a view, its drift, its verdict |
| `scripts/scene/read_reference.py` | reads a silhouette into profile data |
| `scripts/scene/measure_view.py` | the same landmarks for both images, in millimetres |
| `scripts/scene/silhouette.ts` | the overlay: red is reference only, blue is model only |
| `scripts/scene/check.ts` | capture, overlay, measure, and the orientation guard |
| `scripts/scene/compare_silhouette.py` | **stage 2 tool**: binary silhouette overlay, IoU, per-station deltas in mm |
| `scenes/<subject>/scene.json` | the subject path, so the calque can find `dimensions.json` and the crops |
| `blueprints/<category>/<subject>/cropped/manifest.json` | each crop's box, offset, size, and the file it came from |
| `scripts/measure/index.html` | **stage 1 tool**: the point picker, served at `/measure/` |
| `scripts/measure/report.py` | **stage 1 tool**: points to millimetres, landmark spread, G1 verdict |
| `blueprints/<category>/<subject>/measurements.json` | **written by the picker**, read by the report |
| `blueprints/<category>/<subject>/measured/` | the annotated copies, one per view |
| `scripts/scene/ctl.ts` | **render control**: camera, projection, wireframe, isolate, nodes, shot |
| `scripts/scene/shot.ts` | captures every named view in one pass |
| `scripts/scene/serve.ts` | the dev server: scene, `/measure/`, `/repo/`, `/measure/save` |
