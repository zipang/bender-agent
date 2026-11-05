# vcad MCP server instructions — generated reference

Captured from the running server (`initialize` result, `instructions` field) on 2026-11-05.
Server version: **0.11.0-main.138+2df8f6d**. This text is emitted by the kernel registry at boot.

Do not edit by hand. Regenerate with `scripts/blueprint-generate` doc capture, or by asking the
server for `initialize` and copying its `instructions` field.

---

vcad — parametric CAD with a real BRep kernel. Coordinate system: Z-up (X right, Y forward, Z up). Units: millimeters.

Workflow: `open_document` → author → see → measure → ship.
- Author whole parts with `create_cad_loon` (the full modeling vocabulary in one call); make surgical edits with `create`/`update`/`delete` (one node per call — mutation results report a compact `changed` diff of affected parts).
- See your work with `render_view` (isometric PNG); measure with `inspect_cad` (whole-document volume, area, bbox, center of mass), `inspect_part` / `describe_scene` (per-part bbox, size, center, material), and `measure` (min distance/overlap between two parts, or one part's bbox+volume+center of mass).
- Ship with `export_cad` (STL/GLB/STEP) or `open_in_browser` (vcad.io deep link).
- Fix in place: when geometry is wrong, prefer `update` on the offending node over deleting parts and starting over.
- Cut sheet parts you already modelled: `flat_pattern_from_solid` turns any constant-thickness solid — extruded sketch, boolean, imported STEP — into a fab-ready DXF plus a bend table, no sheet-metal re-authoring. Called without `part_id` it does the whole document and groups identical parts into one pattern × quantity; hand its `nest_input` to `sheet_metal_nest`, then `sheet_metal_cost`, for a quote. It fails closed: the emitted profile re-extruded by the detected thickness must reproduce the solid's volume.
- Deliver the project bill of materials with `bom_create` → `bom_export` (markdown/CSV/JSON with landed-cost totals): link quote_manufacturing quotes on manufactured lines, and source COTS hardware (bearings, shafts, standoffs, screws, ferrite magnets) with `search_mechanical_parts`. Check electronic lines against live LCSC/JLCPCB stock and price with `bom_check_stock` (or one part with `check_part_stock`). All BOM prices are estimates and flagged as such.


Sessions and server restarts: a `document_id` is a handle to server-side state, NOT storage. If ANY preview goes dark, a widget stops updating, or a call fails with an unknown `document_id`, check `server_info` FIRST — a low `uptime_s` or a changed `instance_id` means the SERVER RESTARTED and the feature is fine. That is the fastest way to tell a restart from a bug, and it should be the first check for any preview-shaped complaint. On a restart every live document_id dies at once, so previously-working widgets all go dark together — that is not a renderer bug. When `server_info` reports `durable:false`, sessions are in-memory only and cannot be recovered: keep the authoring source (your `create_cad_loon` call or record of edits) so a document can be rebuilt, and snapshot long-lived work with `checkpoint_document` / `save_document`. Every tool result also carries `_meta['io.vcad/build']` with `boot_token` + `instance_id`, so a changed value flags a restart without polling.

Physics/RL workflow: `create_robot_env` (or `batch_create_envs`) → `gym_reset` → `gym_step` → `gym_close`. Both env creators are session-first like everything else: pass the `document_id` of the open assembly — never re-send its IR. `create_robot_env` binds the env to that same session, so a `document_id` env and the document you keep editing can't drift apart; inline `document` IR stays available as the stateless fallback (it mints a NEW session, returned as `document_id`) and passing both is refused. `env_id` drives gym_step/gym_reset/gym_observe/gym_close; `document_id` is what the replay viewer, `get_preview_glb`, and the other session tools bind to. Observations come back both as bare positional arrays and keyed by id (`joints[i] = {id, position, velocity}`, `end_effectors[i] = {id, pose}`) — read the keyed views and no ordering has to be remembered.

PCB workflow: `create_schematic` (declare connectivity as data via `nets`) → `place_components` → `route_nets` / `add_coil` / `add_coil_array` → `run_drc` → `validate_for_fab` → `export_gerber`. All take the `document_id` from create_schematic and mutate that session — never re-send the document. `validate_for_fab` is the single 'is this board ready?' gate (DRC + renderability + Gerber serialization + blockers, all fail-closed); `export_gerber` enforces a clean DRC by default and blocks a dirty board. `board_from_solid` turns a solid part (e.g. an enclosure or stator disc in a CAD session) into an outline polygon for `place_components`. For motors, plan the winding first with `winding_layout` (slots + poles → per-coil phase/polarity/winding-factor, as data — it touches no board), then realize it with `add_coil_array`. `run_drc` returns a summary by default (counts by rule + net-pair, worst clearance, a capped sample); pass `detail:'full'` for every violation. Surgical copper edits: `get_copper` lists existing traces/vias/zones (filtered by layer/net/bbox/kind) with the same indices `delete_trace`/`delete_via`/`delete_zone` accept — discover, then delete, without exporting the document. Where two nets must touch on purpose (wye neutral, split ground, shunt tap), declare it with `add_net_tie` — prefer a region-scoped tie (position+radius) so DRC stays honest away from the junction; `delete_net_tie` takes it back.

## Available Materials

Use set_material(part_id, material) to color parts. Preset keys:
- **Metals**: aluminum, steel, brass, copper, titanium, chrome, gold, silver
- **Plastics**: abs-white, abs-black, abs-red, abs-blue, pla, petg, nylon, resin, acrylic, rubber
- **Organic**: oak, walnut, leather, cork, bamboo
- **Glass**: glass, glass-tinted
- **Composite**: carbon-fiber, fiberglass, kevlar
- **Other**: concrete, ceramic, foam

For the Sun, use gold. For Mars, copper. For Earth, glass-tinted. For gold/silver metallic parts use gold/silver. There's no pure "color" system — you pick the closest preset.

## Orientation Notes

- **Cylinder**: axis along Z. Height is along Z, circular face is in XY plane. Params are `radius` and `height`, not "size" — don't swap them (radius 330, height 30 is a flat disc; radius 30, height 330 is a long pole).
- **Wheels — STRONG PREFERENCE**: Do NOT make wheels by rotating a cylinder. Instead, use `extrude` with a circular sketch (two half-arcs) in the XZ plane (set `y_dir` to (0,0,1)) and direction along Y for thickness. Rotating a Z-axis cylinder to lie sideways is fragile because rotation composes with later translates in confusing ways; an extruded disc is already oriented correctly.
- **Box/Cube**: size.x is width, size.y is depth, size.z is height.
- The grid lies in the XY plane. Z is up. X is right, Y is forward.

## How translate/rotate/scale work (IMPORTANT)

When you call create with type translate/rotate/scale, it WRAPS the existing part in place. The returned id is the SAME as the input child id — it does NOT create a new part with a new id. So:
- create(type:translate, params:{child:abc, offset:...}) → part abc still exists, now translated. Use abc for follow-ups.
- The DAG node behind the part gets a new wrapping node, but you reference parts by their stable part id, not by node id.

**Rotations happen around the WORLD ORIGIN, not the part's own center.** This is the #1 cause of parts ending up in unexpected places. Rules:
- Create geometry at origin first, THEN rotate (orients it in place around origin), THEN translate (moves the oriented part to its final position). Always this order.
- If you translate first and then rotate, the rotate swings the translated part in a wide arc around the origin — almost never what you want.
- If a part ends up in the wrong place after wrapping, prefer `update` on the translate/rotate params over deleting and recreating. You can also add another translate on top to nudge it.

## Sketch rules — READ CAREFULLY

- Sketches MUST have at least 2 segments forming a closed loop.
- Each segment's end must EXACTLY match the next segment's start.
- The LAST segment's end must match the FIRST segment's start.
- **Arcs**: start, end, center and ccw. The radius = distance(start, center) must equal distance(end, center) — if they don't match, the arc is invalid. For a full circle use TWO half-arcs (e.g. start=(r,0), end=(-r,0), center=(0,0), ccw=false, then start=(-r,0), end=(r,0), center=(0,0), ccw=false).
- To cut a shape OUT of a part, create the shape as a separate extrude, then use difference(left: mainPartId, right: cutPartId).
- Don't use single arcs — they aren't closed profiles.

## Type Catalog

### cube (primitive)
Axis-aligned box with its corner at the origin, extending to `size` along the positive axes.
Use for rectangular/box shapes. Size is width(x), depth(y), height(z).
Parameters:
- size: object — Size along each axis.

### cylinder (primitive)
Cylinder along the Z axis, base on the XY plane at `z = 0`, extending to `z = height`.
Axis along Z. Use for round shapes, pins, holes.
Parameters:
- height: number — Height of the cylinder.
- radius: number — Radius of the cylinder.
- segments: integer — Number of circular segments (0 = auto).

### sphere (primitive)
Sphere centered at origin.
Parameters:
- radius: number — Radius of the sphere.
- segments: integer — Number of circular segments (0 = auto).

### cone (primitive)
Cone along the Z axis, base on the XY plane at `z = 0`, extending to `z = height`.
Parameters:
- height: number — Height of the cone.
- radius_bottom: number — Bottom radius.
- radius_top: number — Top radius (0 for a point).
- segments: integer — Number of circular segments (0 = auto).

### torus (primitive)
Torus centered at origin with axis along Z.
Axis along Z. Use for rings, donuts, O-rings, gaskets, fillets-as-primitives.
Parameters:
- major_radius: number — Major radius — distance from the central axis to the tube center.
- minor_radius: number — Minor radius — radius of the tube cross-section.
- segments: integer — Number of circular segments per ring (0 = auto).

### wedge (primitive)
Right-triangular-prism wedge with corner at origin.
Right-triangular-prism wedge. Corner at origin, legs along +X and +Z, extruded along +Y.
Parameters:
- size: object — Wedge size: leg along +X, extrusion length along +Y, leg along +Z.

### prism (primitive)
Regular n-gonal right prism centered on Z.
Regular n-gonal right prism on Z. Use for hex nuts (sides=6), triangular bars, etc.
Parameters:
- height: number — Extrusion height along +Z.
- radius: number — Polygon circumradius (distance from center to each vertex).
- sides: integer — Number of polygon sides (>= 3).

### union (boolean)
Boolean union of two geometries.
Parameters:
- left: string — Left operand.
- right: string — Right operand.

### difference (boolean)
Boolean difference (left minus right).
Parameters:
- left: string — Left operand (base).
- right: string — Right operand (subtracted).

### intersection (boolean)
Boolean intersection of two geometries.
Parameters:
- left: string — Left operand.
- right: string — Right operand.

### translate (transform)
Translation by an offset vector.
Parameters:
- child: string — Child node to translate.
- offset: object — Translation offset.

### rotate (transform)
Rotation by Euler angles in degrees (applied as X, then Y, then Z).
Parameters:
- angles: object — Rotation angles in degrees.
- child: string — Child node to rotate.

### scale (transform)
Non-uniform scale.
Parameters:
- child: string — Child node to scale.
- factor: object — Scale factors per axis.

### mirror (transform)
Reflection of the child across a plane.
Reflect across a plane. plane_origin is any point on the plane; plane_normal points outward.
Parameters:
- child: string — Child node to mirror.
- plane_normal: object — Normal vector of the mirror plane (need not be unit).
- plane_origin: object — A point on the mirror plane.

### sketch_2_d (sketch_op)
A 2D sketch profile on a plane.  The sketch defines a closed profile in a local 2D coordinate system. Use with [`CsgOp::Extrude`] or [`CsgOp::Revolve`] to create 3D geometry.
Defines a closed 2D profile. Segments are Line{start,end} or Arc{start,end,center,ccw}. Usually used inline with extrude/revolve — prefer creating extrude directly with inline sketch.
Parameters:
- holes: array — Optional interior hole loops. Each entry is a closed loop of segments in the same sketch coordinate system, lying strictly inside the outer profile and disjoint from the other holes. Extrude turns each loop into an interior wall directly — no boolean Difference pass. Loop winding may be CW or CCW.
- origin: object — Origin point of the sketch plane in 3D.
- segments: array — The segments forming the closed profile.
- x_dir: object — Unit vector along the local X axis.
- y_dir: object — Unit vector along the local Y axis.

### extrude (sketch_op)
Extrude a sketch profile along a direction vector.
PREFERRED for custom shapes. Pass sketch as inline object with origin, x_dir, y_dir, segments. Example: {sketch: {origin:{x:0,y:0,z:0}, x_dir:{x:1,y:0,z:0}, y_dir:{x:0,y:1,z:0}, segments:[{type:'Line',start:{x:0,y:0},end:{x:20,y:0}},{type:'Line',start:{x:20,y:0},end:{x:20,y:15}},{type:'Line',start:{x:20,y:15},end:{x:0,y:15}},{type:'Line',start:{x:0,y:15},end:{x:0,y:0}}]}, direction:{x:0,y:0,z:10}}
Parameters:
- direction: object — Extrusion direction and distance (length of vector = extrusion depth).
- scale_end: number — Optional scale factor at end of extrusion (1.0 = no taper).
- sketch: string — The sketch node to extrude.
- twist_angle: number — Optional twist angle in radians (rotation around extrusion axis).

### revolve (sketch_op)
Revolve a sketch profile around an axis.
Parameters:
- angle_deg: number — Revolution angle in degrees (360 for full revolution).
- axis_dir: object — Direction of the revolution axis.
- axis_origin: object — A point on the revolution axis.
- sketch: string — The sketch node to revolve.

### linear_pattern (pattern)
Linear pattern — repeat geometry along a direction.
Parameters:
- child: string — Child node to pattern.
- count: integer — Number of copies (including original).
- direction: object — Direction vector (will be normalized).
- spacing: number — Spacing between copies along direction.

### circular_pattern (pattern)
Circular pattern — repeat geometry around an axis.
Parameters:
- angle_deg: number — Total angle span in degrees.
- axis_dir: object — Direction of the rotation axis.
- axis_origin: object — A point on the rotation axis.
- child: string — Child node to pattern.
- count: integer — Number of copies (including original).

### sweep_rotate (pattern)
Swept volume — union of the child rotated about an axis over an angle range (inclusive). Evaluates as a mesh union of sampled copies; the result is triangle soup, meant as a clearance-cut tool.
Swept volume of the child rotated about an axis over [angle_lo_deg, angle_hi_deg]. Use as the TOOL of a difference to carve the path a neighbouring link swings through (knee fold, elbow, hip relief).
Parameters:
- angle_hi_deg: number — End angle in degrees.
- angle_lo_deg: number — Start angle in degrees.
- axis_dir: object — Direction of the rotation axis (right-hand rule).
- axis_origin: object — A point on the rotation axis.
- child: string — Child node to sweep.
- clearance: number — Outward dilation (mm) applied to the child before sweeping.
- step_deg: number — Sample step in degrees. Omitted = automatic (≤0.25 mm chord sag and ≤15 mm copy spacing at the furthest point).

### shell (modifier)
Shell — hollow out a solid by offsetting faces.
Hollow out a solid. Use parent_part_id. Great for enclosures, cups, containers.
Parameters:
- child: string — Child node to shell.
- thickness: number — Wall thickness (inward offset).

### fillet (modifier)
Fillet — round edges of a solid.
Apply after creating geometry. Use parent_part_id to target a part. Typical radius: 1-5mm for small features, 5-20mm for large.
Parameters:
- child: string — Child node to fillet.
- radius: number — Fillet radius.

### chamfer (modifier)
Chamfer — bevel edges of a solid.
Bevel edges. Apply after creating geometry. Use parent_part_id to target a part.
Parameters:
- child: string — Child node to chamfer.
- distance: number — Chamfer distance.

### edge_blend (modifier)
Edge blend — chamfer/fillet/variable blend on query-selected edges.  `edges` resolves against the child's topology at evaluation time, so selections survive upstream parameter changes. The profile is either constant or keyed along each edge: `shape` interpolates a flat chamfer (`0`) into a round fillet (`1`), and `size` is the tangent setback (chamfer leg = fillet radius). Edges sharing a vertex with an already-blended edge are skipped (miter corners are a planned follow-up).
Per-edge blend with a declarative selector: pick edges by query (Near a point / Direction / All plane-plane edges), then apply a Constant or Keyed profile. shape 0 = chamfer, 1 = fillet; size = chamfer leg / fillet radius in mm. Keyed profiles morph along the edge — e.g. chamfer lofting into a fillet.
Parameters:
- child: string — Child node to blend.
- edges: object — Which edges to blend.
- profile: object — Cross-section profile along each selected edge.

### text_2_d (sketch_op)
2D text that can be extruded into 3D geometry.  Creates sketch profiles from text glyphs, which can then be extruded and used in boolean operations for embossing/engraving.
Parameters:
- alignment: object — Text alignment.
- font: string — Font name (e.g., "sans-serif", "monospace", or custom registered font).
- height: number — Text height in mm.
- letter_spacing: number — Letter spacing multiplier (1.0 = normal).
- line_spacing: number — Line spacing multiplier for multi-line text (1.0 = normal).
- origin: object — Origin point of the text plane in 3D.
- text: string — The text string to render.
- x_dir: object — X direction of the text plane (text flows along this axis).
- y_dir: object — Y direction of the text plane (text height along this axis).

### sweep (sketch_op)
Sweep a profile along a path curve.
Sweep a 2D sketch profile along a 3D path. The `path` field is a tagged object — one of: `{type:'Line', start:{x,y,z}, end:{x,y,z}}` for a straight sweep, or `{type:'Helix', radius, pitch, height, turns}` for a coil/spring (radius = helix radius in mm, pitch = vertical rise per turn in mm, height = total Z height, turns = total turn count ≈ height/pitch). USE HELIX for springs, coils, screw threads, spiral ramps — do NOT try to approximate a helix with Line segments; a Line path only produces a straight sweep. Example spring: sketch a small circle profile, then sweep with path:{type:'Helix', radius:10, pitch:8, height:50, turns:6.25}.
Parameters:
- arc_segments: integer — Segments per arc in profile (default 8).
- orientation: number — Initial profile rotation around path tangent (radians, default 0).
- path: object — The path curve to sweep along.
- path_segments: integer — Segments along path (0 = auto).
- scale_end: number — Scale at end (default 1.0).
- scale_start: number — Scale at start (default 1.0).
- sketch: string — The sketch node to sweep.
- twist_angle: number — Total twist in radians (default 0).

### loft (sketch_op)
Loft between multiple profiles.
Parameters:
- closed: boolean — Connect last profile to first (creates tube).
- sketches: array — Array of Sketch2D node references (>= 2).