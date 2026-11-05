# Progressive Volume Modeling

**A rigorous method for faithful 3D reconstruction, from a bounding envelope to a finished asset.**

Status: method report. It surveys the existing skills and defines one procedure for this
repository. It is not a skill yet.

Date: 2026-11-04. Scope: hard-surface parts, vehicles, robots, and organic heads.

---

## 1. The problem

A reference image shows a shape. The shape is the projection of a volume that you cannot see.
You must rebuild the volume from a small number of views. Each view gives a silhouette and some
internal lines. The rest is inference.

The sculptor in front of the marble does not carve the nose first. The sculptor removes the
material that is certainly outside the form. Then the sculptor checks the block from several
sides. Then the sculptor removes more material. The form appears because each pass removes a
bounded amount of uncertainty, and because each pass is checked before the next one starts.

The digital method is the same. Call it **progressive volume modeling**.

1. Bind the unknown volume inside a coarse envelope.
2. Cut the envelope until every silhouette matches the reference.
3. Add resolution only where the current resolution hides an error.
4. Freeze the topology when the form is correct.
5. Add surface detail last.

The central rule is simple. **Never add detail on a wrong mass.** A wrong mass survives every
later stage. Detail on a wrong mass makes the error more expensive to find and to remove.

---

## 2. What already exists

Two sources matter. The local skills in this repository give the execution tools. The public
skill catalog gives the craft rules and the quality gates.

### 2.1 Local skills

| Skill | Role for this method | What it already enforces |
| :--- | :--- | :--- |
| `vcad` | Parametric envelope, exact booleans, mechanical masses | Z-up, exact geometry, `inspect_cad` after each change, positive volume, plausible triangle count |
| `blender-mcp` | Polygon blockout, modifiers, sculpt, materials, review | `get_scene_info` first, short steps, `look` after each geometry change, several angles |
| `threejs-web` | Export, pivots, budget, compression | Node names, pivot on the joint, applied transforms, triangle budget, `gltf-transform inspect` |

The local skills define the tool loop well. They do not define a fidelity ladder. They say "build
the blockout, then add details". They do not say when a stage is correct, or how much resolution
the next stage needs.

### 2.2 Public skills, by usefulness for this method

Install counts are from the skills.sh catalog on 2026-11-04. Counts change. Use them as a signal
of maturity, not as a proof of quality.

| Skill | Installs | What it gives | Limit for us |
| :--- | ---: | :--- | :--- |
| `scenario-labs/skills@scenario-blender-sculpting` | 715 | The strongest stage model. Voxel ladder, stated planes, form metrics, one weakest link per pass, long-lens review | Blender 5.2, Scenario MCP, headless helpers |
| `scenario-labs/skills@scenario-blender-retopology` | 651 | Loop budgets, pole rules, cage fit, game and film topology, measured results | Assumes a dense sculpt as input |
| `scenario-labs/skills@scenario-blender-hard-surface` | 632 | Modifier order, cutter hygiene, two-bevel method, shading audits, game reduction | Blender-centric, no envelope stage |
| `scenario-labs/skills@scenario-blender-blockout` | 337 | Fidelity levels (rough, shaped, detailed), metric scale, audits before review | Built for previs clips, not product fidelity |
| `scenario-labs/skills@scenario-blender-expert` | 1.1K | Execution channel, review loop, API notes | Infrastructure, not modeling method |
| `roble3/cc-blender-skill@blender-modeling` | 2.8K | Practical `bpy` recipes, modifier order, boolean and seam pitfalls | A recipe library, not a convergence method |
| `omer-metin/skills-for-antigravity@3d-modeling` | 1.2K | Production topology knowledge, three-phase sculpt pipeline, LOD rules | Prose knowledge, no executable gates |
| `w1ne/kernelcad-skills@blockout-model` | low | Parametric envelope, reference overlay, four canonical views, zero interference | Niche CLI, flat-product focus |
| `w1ne/kernelcad-skills@image-replicator` | low | Render, score, diagnose, one change per pass, anti-gaming policy | Pixel scores need care |
| `arjun988/blender-skills@retopology` | 403 | Retopology checklist | Narrow, small install base |
| `freshtechbro/claudedesignskills@blender-web-pipeline` | 3.7K | Blender to web handoff | Export only |

### 2.3 The gap

No single skill covers the full ladder with measurable gates. The pieces exist in separate
places:

- The **envelope discipline** and the reference overlay come from `blockout-model`.
- The **iteration engine** and the anti-gaming rules come from `image-replicator`.
- The **resolution ladder** and the form metrics come from `scenario-blender-sculpting`.
- The **topology freeze** and the loop budget come from `scenario-blender-retopology`.
- The **edge control** and the game reduction come from `scenario-blender-hard-surface`.
- The **export contract** comes from the local `threejs-web` skill.

This report joins them into one procedure.

---

## 3. The fidelity ladder

Define the **form error** `e` as the distance between the current surface and the target surface,
measured in the canonical views and, when available, in 3D.

A resolution step of size `r` cannot show an error smaller than `r`. It is wasted work to refine
below the current error. It is also wasted work to measure at a resolution below the error,
because the measurement hides it.

This gives one rule for every stage.

> **Refine only when `e < r`. Stop refining when `e` is below the delivery tolerance.**

The delivery tolerance is the smallest error that the final camera can show. For a web asset, it
is about one pixel of the hero view, or the texel density, whichever is larger.

### 3.1 The stages

| Stage | Name | Question answered | Typical representation |
| :--- | :--- | :--- | :--- |
| L0 | Envelope | Where is the volume, and how big is it? | One box per mass, or one convex hull |
| L1 | Masses | Which volumes compose the object? | Boxes, cylinders, rounded blocks |
| L2 | Silhouette | Does the outline match in every canonical view? | Moved corners and edges, few loop cuts |
| L3 | Primary forms | Do the big planes and transitions read? | Bevel, chamfer, subdivision 1, voxel H/40 |
| L4 | Secondary forms | Do the features and joints read? | Subdivision 3 to 4, creases, booleans, loops |
| L5 | Tertiary detail | Does the surface hold at the delivery scale? | Subdivision 5 to 7, displacement, micro-bevels |
| L6 | Topology freeze | Can the mesh deform, bake, and ship? | Quad cage, retopo, game reduction |
| L7 | Asset contract | Does it load and animate in Three.js? | Pivots, names, materials, GLB, compression |

Stages L0 to L2 are additive refinement of a coarse cage. Stages L3 to L5 are resolution
refinement. Stage L6 changes the topology without changing the form. Stage L7 changes nothing
visible.

### 3.2 Two invariants

**Invariant 1. Silhouette before interior.** A correct interior line on a wrong outline is lost
work. The outline is the only information that all views share.

**Invariant 2. Mass before plane, plane before line, line before texture.** If a plane cut does
not fix the look, the mass is wrong. If a line does not fix the look, the plane is wrong. This
diagnostic comes from the sculpting experts and it holds for hard surface too.

### 3.3 Tolerance schedule

These are proposed defaults. Calibrate them on the first asset and record the result.

| Stage | Tolerance on the largest dimension | Also expressed as |
| :--- | :--- | :--- |
| L0 Envelope | 10% | "reads as the right object category" |
| L1 Masses | 5% | part count and part position correct |
| L2 Silhouette | 2% | outline inside the reference line |
| L3 Primary | 1% | planes and transitions correct |
| L4 Secondary | 0.5% | features placed within one feature width |
| L5 Detail | 0.2% or one output pixel | detail visible at delivery framing |

Halve the tolerance at each stage. Stop when the tolerance is below the delivery tolerance.

### 3.4 Unit policy

A model has three units. Keep them separate.

| Space | What it is | Rule |
| :--- | :--- | :--- |
| Design unit | The unit of the numbers that you type | One unit for the whole document. Record it. |
| Kernel and mesh | The numeric space of vcad | No hidden conversion. See the measurement below. |
| Runtime unit | glTF and Three.js | One glTF unit is one meter. Always. |

vcad does not convert on export. Measured on 2026-11-04: a cube of 2 document units exports a
GLB position accessor with minimum 0 and maximum 2. The design unit becomes the glTF unit
directly.

Choose the design unit from the deliverable, not from the subject alone.

| Subject or deliverable | Design unit | Export scale to meters |
| :--- | :--- | :--- |
| Character, vehicle, robot, level | 1 unit = 1 m | 1.0 |
| Mechanical part, CNC, 3D print | 1 unit = 1 mm | 0.001 |
| Building or terrain | 1 unit = 1 m | 1.0 |

Two limits apply.

1. **Fabrication formats are in millimeters.** STEP and STL use millimeters by convention. Author
   in millimeters when you export STEP for a vendor. A meter document sends a part 1000 times too
   small.
2. **The mesher drops very small features.** On a 2-unit cube, a 0.001-unit fillet is meshed (108
   triangles). A 0.0002-unit fillet is not (12 triangles). Keep every feature at 5e-4 units or
   more. In meters this floor is 0.5 mm. This is correct for a game asset and wrong for a 0.2 mm
   render bevel.

vcad labels its results `volume_mm3` and `surface_area_mm2`. The labels are fixed names, not a
conversion. When the design unit is a meter, read the numbers as cubic meters and square meters.
For example, the 2-unit cube reports `volume_mm3: 8`. The value 8 is correct in document units.

Never mix units in one document. Write the unit in the Loon source as a comment. Write it in the
model README.

### 3.5 The unit defines the job

The design unit is not a formatting detail. It fixes six things:

1. the smallest feature that survives meshing,
2. the kernel tolerance floor,
3. the export scale to glTF,
4. the meaning of an STL or a STEP file,
5. the Blender scene settings and the STL export flag,
6. the detail budget. A 0.2 mm bevel is a feature in a millimeter document and a rounding error
   in a meter document.

Two profiles cover the work of this repository.

| Setting | Game asset profile | 3D print profile |
| :--- | :--- | :--- |
| Design unit in vcad | 1 unit = 1 m | 1 unit = 1 mm |
| Typical subject | character 1.7, car 4.2, robot 2.0 | bracket 40, enclosure 120, jig 300 |
| Smallest feature | 1 mm | 0.4 mm, one nozzle width |
| vcad export | GLB, scale 1.0 | STL or STEP, scale 1.0, the numbers are already mm |
| Blender units | Metric, scale 1.0, meters | Metric, scale 0.001, millimeters |
| Blender web export | GLB, scale 1.0 | Do not export this scene. Copy it to a meter scene first. |
| Runtime | Three.js, meters | Slicer, millimeters |
| Delivery tolerance | 0.5 mm | 0.05 mm |

Rules for the game asset profile:

1. Set the design unit to the meter in vcad and in Blender.
2. Export GLB at scale 1.0. Import GLB in Blender at scale 1.0.
3. Check the bounds after the export. The root must sit on Y = 0.
4. Keep the smallest modeled feature at 1 mm or more.

Rules for the 3D print profile:

1. Set the design unit to the millimeter in vcad. Export STL or STEP at scale 1.0.
2. Set the Blender scene to Metric, unit scale 0.001, length millimeters. One Blender unit now
   displays as one millimeter.
3. Enable **Scene Unit** in the STL export. Without it, the file is 1000 times too large.
4. Keep every wall at two nozzle widths or more. Use 0.8 mm for a 0.4 mm nozzle, and prefer
   1.2 mm.
5. Use 0.2 to 0.3 mm clearance for a sliding fit and 0.1 mm for a press fit. Calibrate on the
   printer.
6. Use 2 mm as the minimum hole diameter. Small holes shrink.
7. Check the mesh before the export: watertight, positive volume, zero non-manifold edges, no
   zero-thickness wall.
8. Do not export GLB from the millimeter scene. The glTF exporter ignores the scene scale.

The unit is a job parameter, like the camera, the budget, and the pivot list. Write it in the
vision pack before the first primitive.

---

## 4. The procedure

Each step has an action, a gate, and a failure list. Do not start a step before the previous gate
passes.

### Step 0. Build the vision pack

Collect the inputs before any geometry.

1. Put every reference image in the model directory.
2. Name the canonical views: front, back, left, right, top, bottom, three-quarter.
3. Record the real size of the object, or the size ratio between two known features.
4. Record the camera: focal length, distance, and height. Use a long lens (85 to 95 mm
   equivalent) for form review. Use orthographic views for silhouette measurement.
5. Record the delivery: hero camera, screen size, triangle budget, texture budget.
6. Declare the job profile from section 3.5: design unit, target format, feature floor, tolerance
   floor, and export scale. Blender and vcad use Z-up. glTF uses Y-up.
7. List the animatable parts and put each pivot on its joint.

**Gate:** a written table with size, views, camera, budget, and part list.

**Failure mode:** you start to model from one image. The back and the depth become invention.

### Step 1. Bind the volume in a box

Create one box for the whole object. Use the bounding box of the reference in all three axes.

For vcad, use `[cube sx sy sz]` with parameters. For Blender, use a cube with dimensions in
meters. Do not add a bevel, a hole, or a material.

Check the envelope against every view:

- front width and height,
- side depth and height,
- top width and depth,
- center of mass height.

**Gate:** the box matches the extreme silhouette points in all canonical views. The volume is
positive. Scale is 1.

**Failure mode:** the depth comes from one guess. Measure the depth from a second view, or state
the assumption in the log.

### Step 2. Split the envelope into masses

Replace the single box with one box per named mass. Examples: `Body`, `Cabin`, `Wheel_FL`,
`Wheel_FR`, `Head`, `Torso`, `Door`.

Rules:

1. One primitive per mass. Do not model two masses in one box.
2. Put the primitive origin on the joint, not on the corner, when the part moves.
3. Overlap adjacent masses by 1 to 3% of the part size. At human scale this is 5 to 15 mm. A small
   overlap hides the seam and prevents a zero-thickness boolean.
4. Keep the mass count stable after this step. A new mass is a new hypothesis, not a detail.

**Gate:** every mass is present, named, and at the correct position. The interference report
shows only the intended overlaps. The part count matches the vision pack.

**Failure mode:** an early union. Do not union the masses yet. You lose the ability to move one
mass without a boolean rebuild.

### Step 3. Move the box edges to enclose the form

This is the core approximation step. A box has 8 corners and 6 faces. Each corner is a control
point that you can move along one axis at a time. Each move is an answer to a measured deviation.

Work per view, and per silhouette segment:

1. Overlay the reference on the render, at the correct scale and camera.
2. Measure the deviation `d` between the box outline and the reference outline, segment by
   segment.
3. Find the segment with the largest deviation.
4. Move the corner or edge that controls that segment, along one axis only.
5. Re-render the same view. Re-measure.
6. Repeat until `d` is below the L2 tolerance.

When one corner cannot follow the outline, the segment needs one more control point. Add one
loop cut, then move the new vertex. Do not add ten cuts. Add one cut where the error is largest.
This is adaptive refinement: **split the segment at its point of maximum deviation**.

The same idea applies in 3D:

- a silhouette break needs one loop cut on the box,
- a new plan view needs one cut on the top face,
- a rounded corner needs a chamfer, not a subdivision.

**Gate:** the front, side, and top outlines are inside the L2 tolerance. The wireframe shows only
the cuts that answer a measured deviation. No cut is present "for later".

**Failure mode:** uniform subdivision. A subdivision level doubles the resolution everywhere and
hides the fact that only one segment is wrong.

### Step 4. Establish the primary forms

Now convert boxes into volumes with planes and transitions.

**Hard surface.** Add a design bevel on the silhouette edges. Use 8 to 12 segments and a weight
limit. Then add a micro bevel after each cut: 30 degrees, 3 segments for render, 1 to 2 for game.
Keep every wall, step, and groove wider than twice the micro bevel width. Otherwise the bevel
clamps and the edge highlight breaks.

**Organic.** Replace the boxes with blended masses. Use a voxel remesh at H/40 for a head, where
H is the head height. State the planes: cranium, jaw, cheekbone, brow. Blend the big masses at
0.08 to 0.15 H. Clip the planes at 0.02 to 0.03 H.

**Curved hard surface.** Build a quad cage and add support loops. Do not use weight creases on
primary edges. At equal quality, support loops cost about one tenth of the triangles of a
creased cage.

**Gate:** the silhouette still matches after the bevel or the blend. Large planes read under a
neutral matcap. Scale is 1 on every object with a bevel or a subdivision. Zero non-manifold edges.

**Failure mode:** you add a bevel before the outline is correct. The bevel hides the outline
error and costs a rebuild.

### Step 5. Add secondary forms

Double the resolution. For organic work, move from H/40 to H/65 through H/110. For hard surface,
add the cuts and the design details.

Place the features that carry the identity:

- eyes, mouth, ears, jaw corner,
- wheels, arches, lights, grille,
- panel gaps, vents, handles, hinges,
- joints and their loops.

Put three loops on every joint that bends. Put two loops on each eyelid crease. Keep the upper
and lower counts equal around the eye and the mouth.

**Gate:** every identity feature is present and placed. The part reads as the intended object at
thumbnail size. No more than about 100k faces before the shape review passes. Every cut is clean
in a close-up.

**Failure mode:** detail before proportion. A grille on a wrong body is not progress.

### Step 6. Add tertiary detail

Add only the detail that the delivery camera can show. Compute the pixel size of the detail
first. If one detail is smaller than one output pixel, cut it.

Examples: screws, panel screws, stitching, skin pores, brushed-metal streaks, tire tread.

**Gate:** the detail is visible at the hero framing and does not alias. Density matches the
surface area. No stretching at poles or at boolean corners.

**Failure mode:** detail added for the viewport. It costs triangles and shows nothing.

### Step 7. Freeze the topology

Stop changing the form. Copy the mesh. Build the deformation cage or the game mesh from the copy.

Rules for a deforming cage:

- 99% quads or more.
- No pole on a crease loop, a shell rim, or the face center line.
- Loops close on themselves around the eyes and the mouth.
- The subdivided cage, not the cage, matches the high-resolution surface.
- 3 loops per joint. 2 loops per eyelid crease.

Rules for a game mesh:

- The silhouette plus the animation loops.
- Triangles only where nothing bends.
- A low-poly surface slightly outside the high-poly surface.
- The triangle budget from the vision pack.

**Gate:** the subdivided surface error is 0.3% or less. The inside ratio is 40 to 60%. The cage
reads without subdivision. The triangle count is inside the budget.

**Failure mode:** you retopologize before the form is correct. Every later change breaks the
cage.

### Step 8. Apply the asset contract

1. Put the root origin at the center of the base.
2. Put each pivot on its joint.
3. Apply all transforms. Scale is 1, rotation is 0.
4. Name every node with a stable name.
5. Use Principled BSDF materials only.
6. Export with Y-up and the export scale from the vision pack.
7. Inspect the GLB. Check size, triangle count, draw calls, and animation clips.

**Gate:** the model loads in Three.js. Each animated part moves around the correct axis. The file
is inside the size budget.

---

## 5. The iteration engine

A stage is not a single action. It is a loop. The loop is the same at every stage.

### 5.1 Render

Render the same set of views at every pass:

1. front, orthographic,
2. side, orthographic,
3. top, orthographic,
4. three-quarter, long lens,
5. one close-up of the weakest area.

Use the same camera, the same framing, and the same lighting for every pass. A changed camera
hides a changed form.

For organic form, use a long lens (85 to 95 mm equivalent). A wide lens flatters the volume and
hides proportion errors. Use the orthographic views only for silhouette measurement.

### 5.2 Compare

Do three comparisons, in this order.

1. **Silhouette.** Black shape on white. Overlay the reference. Measure the deviation.
2. **Planes.** Neutral matcap, cavity off. Check the big planes and the transitions between them.
3. **Lines and detail.** Cavity on. Check the feature lines and the placement.

Do not start with the detail. Detail attracts the eye and hides the mass.

### 5.3 Diagnose

Name one weakest link. Use this table.

| Symptom | Wrong stage | Correct action |
| :--- | :--- | :--- |
| The object reads as the wrong category | L0 or L1 | Change the envelope or the mass split |
| The outline is wrong in one view | L2 | Move a control point or add one cut |
| The outline is right, the depth is wrong | L1 | Re-measure the depth from a second view |
| A transition is too soft or too sharp | L3 | Change the bevel, chamfer, or blend |
| A feature sits in the wrong place | L4 | Move the feature. Do not cut it deeper |
| A feature is too small to read | L4 or L5 | Enlarge it to one pixel or more |
| A plane cut does not change the look | L3 | The mass is wrong. Go back one stage |
| A line looks like a scratch | L5 | Change the stroke or the tool. Do not smooth |
| A shading smear on a flat face | L3 | The face is not planar. Flatten it |
| The cage looks right, the subdivision is lumpy | L7 | Adjust the cage fit, not the sculpt |

### 5.4 Change one thing

Make one change per pass. Then re-render the same views and re-measure.

If you change two things, you cannot attribute the result. If you change the camera, you cannot
compare the result.

### 5.5 Log

Keep a short log next to the model:

```text
pass | stage | change | metric before | metric after | verdict
-----+-------+--------+---------------+--------------+--------
  01 | L0    | box 1.8 x 4.2 x 1.4 m | width -12% | width -2% | pass
  02 | L2    | moved front-top corner | silhouette 0.71 | 0.79 | continue
```

The log is the memory of the method. It also makes the work reviewable by a human.

### 5.6 Stop rules

Stop a stage when all of these are true:

1. Every required gate passes.
2. No visible defect maps to an unapplied fix.
3. The render agrees with the numbers.

Stop the whole job when the iteration cap is reached. The default cap is 8 passes per stage. At
the cap, report the remaining gates. Do not reset the counter.

### 5.7 Anti-gaming rules

Metrics are selectors, not objectives. Follow these rules.

1. Check the identity features before the pixel score. A model can score well and lose its
   defining feature.
2. Prefer a 3D reference when one exists. Use a chamfer distance or a bounding-box overlap. This
   is a geometry oracle, not a picture comparison.
3. Never loosen a gate to make a pass succeed. Report the evidence instead.
4. Never iterate to climb one number while another feature regresses.
5. Read the render before you trust the score.

A previous run on a pair of glasses scored high on silhouette overlap. The model had no lens
openings. It was a slab. The pixel score was high and the object was wrong.

---

## 6. Metrics

Use a small set. Each metric answers one question. No metric replaces the render.

| Metric | Question | Stage | Typical gate |
| :--- | :--- | :--- | :--- |
| Bounding box | Is the volume at the right place and size? | L0 | inside 10% of reference |
| Silhouette deviation | Is the outline correct? | L1 to L3 | 2% of largest dimension |
| Silhouette IoU | Does the outline overlap? | L1 to L3 | 0.45 minimum, as a selector |
| SSIM | Is the internal structure similar? | L3 to L5 | 0.25 minimum, as a selector |
| Volume | Is the solid plausible? | L0 to L4 | positive, within 15% of the estimate |
| Center of mass | Is the mass distributed correctly? | L1 | within 5% of height |
| Non-manifold edges | Is the mesh closed? | L3 to L6 | 0 |
| Subdivision fit | Does the cage match the surface? | L7 | mean 0.3% or less |
| Stretch ratio | Is the surface distorted? | L4 to L6 | p95 over median below 2.5 |
| Triangle count | Is the asset inside budget? | L6 to L7 | from the vision pack |
| Texel density | Are the textures even? | L7 | one value per asset class |

Read the numbers as diagnostics. A high SSIM on a wrong object is a false signal.

---

## 7. Tool mapping

### 7.1 vcad

Use vcad for the envelope, the masses, the mechanical booleans, and the exact parts.

- Set the design unit before the first primitive. Read section 3.4. Axes are Z-up.
- Every key dimension is a parameter. Do not use magic numbers.
- The cube origin is a corner. Translate by half the size to center it.
- Create at the origin, then rotate, then translate.
- Cut with a tool that is longer than the part by 2% of its smallest dimension.
- Call `inspect_cad` after each change. Check the volume, the box, and the triangle count. The
  numbers are in document units.
- Call `render_view` after each mass change.
- Export GLB with the export scale from the vision pack. Import in Blender with the inverse
  scale: 1.0 for a meter document, 0.001 for a millimeter document.
- For the 3D print profile, export STL or STEP at scale 1.0. The document numbers are already in
  millimeters.

vcad is exact. It is the best tool for the envelope and for parts that must fit. It is a poor
tool for organic blending.

### 7.2 Blender

Use Blender for the polygon blockout, the organic forms, the retopology, and the materials.

- Units are meters for game assets. Axes are Z-up. The front faces -Y.
- Build with `bmesh` and the data API. Avoid `bpy.ops` when a data call exists.
- Keep the modifier order: Mirror, Bevel, Subdivision. Bevel before subdivision.
- Apply the scale before a bevel.
- Call `look` in `angles`, `wireframe`, and `material` mode after each large change.
- Use a voxel remesh for organic masses. Use a quad cage for hard surface.
- Export with `export_yup=True` and `export_apply=True`.

For the 3D print profile, set the scene units to Metric, unit scale `0.001`, length
`MILLIMETERS`. The display then reads in millimeters. The mesh data does not change.

Measured in Blender 5.2.3:

| Check | Result |
| :--- | :--- |
| Cube of 1 Blender unit, mesh dimensions | 1.0, independent of the scene scale |
| glTF export bounds of that cube | -1 to 1, no unit conversion |
| glTF export operator unit properties | none |
| STL export with **Scene Unit** off | 1.0 per Blender unit |
| STL export with **Scene Unit** on, scale 0.001 | 0.001 per Blender unit |

So the scene scale is a display and tool setting. It is not a data conversion. For a web export,
use a meter scene. For an STL, enable **Scene Unit**. Check the exported bounds in both cases.

### 7.3 Three.js

Use Three.js for the final check.

- Y-up. The root sits on the ground at Y = 0.
- One material per mesh group. Join static meshes that share a material.
- Put each animated part in its own node.
- Load an environment map for metallic materials.
- Inspect the file with `bunx @gltf-transform/cli inspect`.

### 7.4 Hybrid handoff

1. Build the mechanical masses in vcad with the design unit from section 3.4.
2. Export GLB. The GLB keeps the document numbers.
3. Import in Blender with the inverse of the design unit: 1.0 for a meter document, 0.001 for a
   millimeter document.
4. Add organic parts, materials, and rigging in Blender.
5. Freeze the transforms.
6. Export one GLB for the web.

Keep the vcad Loon source next to the `.blend` file. A server restart loses the vcad session.

---

## 8. Short worked example

Object: a robot head, about 0.30 m high. Design unit: 1 unit = 1 m. Export scale: 1.0. Reference:
a front view and a side view.

| Pass | Stage | Action | Gate |
| :--- | :--- | :--- | :--- |
| 01 | L0 | One box, 0.24 x 0.22 x 0.30 m | Box matches both views within 10% |
| 02 | L1 | Split into `Cranium`, `Jaw`, `Neck` | Three masses, correct centers |
| 03 | L2 | Move the jaw corners down and forward | Side outline within 2% |
| 04 | L2 | Add one loop cut at the brow line | Front outline break matches |
| 05 | L3 | Bevel the shell edges, 3 mm (0.003 units), 3 segments | Edge highlight is continuous |
| 06 | L3 | Voxel remesh the jaw at H/40, blend 0.12 H | Jaw reads as a block, not a ball |
| 07 | L4 | Add eyes, mouth grille, antenna base | Features at the right height |
| 08 | L4 | Add the visor recess with a boolean | Cut is clean in close-up |
| 09 | L5 | Add panel lines and screws | Visible at 1080 px, no alias |
| 10 | L7 | Pivots, names, GLB, inspect | Loads in Three.js, inside budget |

The head passes about 10 gates. Each gate is a small decision. The form converges because each
decision is measured, not because the modeler worked longer.

---

## 9. What an agent can and cannot do

An agent is strong at these tasks:

- parametric envelopes and mass splits,
- repeated measurement and comparison,
- booleans, bevels, remesh ladders, and batch checks,
- topology audits and retopology starts,
- the iteration log and the gate report.

An agent is weak at these tasks:

- aesthetic judgment and appeal,
- pole routing on a face,
- expression and asymmetry,
- the choice of the one or two design exaggerations,
- the final call when a metric passes and the render looks wrong.

Plan a human review at L2, L4, and L6. At those points the cost of a wrong decision is high.

---

## 10. Adoption plan

1. Keep `vcad`, `blender-mcp`, and `threejs-web` as the execution layer.
2. Install the three Scenario reference skills for their gates and numbers:
   `bunx skills add scenario-labs/skills@scenario-blender-sculpting -y`,
   `bunx skills add scenario-labs/skills@scenario-blender-hard-surface -y`,
   `bunx skills add scenario-labs/skills@scenario-blender-retopology -y`.
3. Read them as reference. Do not depend on their Scenario MCP tools for local work.
4. Write a local `progressive-volume` skill with the ladder, the gates, and the log format.
5. Calibrate the tolerance schedule on one asset. Record the numbers in the model directory.
6. Add the calibrated table to the local skill.

The first asset should be small and measurable: a wheel, a head, or a vehicle body. Do not start
with a full car.

---

## 11. Summary

The method has four ideas.

1. **Bind the unknown volume in a box.** Measure the box in every view.
2. **Refine adaptively.** Add one control point where the error is largest. Never subdivide
   uniformly.
3. **Gate every stage.** A stage is correct when a number and a render agree.
4. **Freeze the topology last.** Change the form before the cage, and the cage before the
   materials.

The sculptor does not find the form by removing more marble. The sculptor finds it by checking
the block from every side, and by removing only the material that is certainly outside the form.

---

## 12. Sources

Local:

- `.agents/skills/vcad/SKILL.md`
- `.agents/skills/blender-mcp/SKILL.md`
- `.agents/skills/threejs-web/SKILL.md`

Public:

- <https://skills.sh/scenario-labs/skills/scenario-blender-sculpting>
- <https://skills.sh/scenario-labs/skills/scenario-blender-retopology>
- <https://skills.sh/scenario-labs/skills/scenario-blender-hard-surface>
- <https://skills.sh/scenario-labs/skills/scenario-blender-blockout>
- <https://skills.sh/roble3/cc-blender-skill/blender-modeling>
- <https://skills.sh/omer-metin/skills-for-antigravity/3d-modeling>
- <https://skills.sh/w1ne/kernelcad-skills/blockout-model>
- <https://skills.sh/w1ne/kernelcad-skills/image-replicator>
- <https://skills.sh/arjun988/blender-skills/retopology>
