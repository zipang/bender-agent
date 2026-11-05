---
name: vcad - Parametric CAD and Loon
description: Create, inspect, and export parametric CAD models (BRep and CSG) with the vcad MCP tools. Use for mechanical parts, precise geometry, assemblies, robots, and GLB or STL export.
---

# vcad — Parametric CAD for AI Agents

This skill explains how to use the **vcad** MCP server (`@vcad/mcp`). The server runs a BRep kernel in Rust and WASM. It builds exact models and exports them to `.glb` (for Blender and Three.js) or `.stl`.

## Where the API reference lives

There is **no published documentation for the running build**. Read this before you trust a URL.

| Source | Version | Use |
| :--- | :--- | :--- |
| `reference/server-instructions-*.md` in this skill | the installed build | **authoritative**: type catalog, materials, transform semantics |
| `reference/tools-*.md` in this skill | the installed build | **authoritative**: 186 tool names, required arguments |
| The server at runtime | the installed build | ask `initialize` for `instructions`, `tools/list` for schemas |
| https://docs.vcad.io/reference/mcp | **v0.8.0** | stale by three minor versions. Use for concepts only |
| https://github.com/muni-works/vcad/blob/main/packages/mcp/README.md | `main` | closest public prose, still ahead of the site |

The repository has no tag above `v0.9.4`, no release above `v0.9.4`, and the changelog tool reports
"Current version: 0.10.0" while the server reports `0.11.0-main.<n>`. The build is a development
snapshot of `main`, so the site lags it and contradicts it.

Two contradictions to know about, both verified on the installed build:

- `create_cad_document` is **absent**. The v0.8.0 site calls it the primary tool. The tools index
  in this skill has no such entry.
- `create_cad_loon` **exists but cannot evaluate** here: it answers
  `Loon evaluation not supported by this engine build`. Author with `open_document` then `create`
  instead.

To refresh the reference after a server upgrade, capture it from the server itself: send
`initialize` and `tools/list` over stdio, and copy `result.instructions` and
`result.tools[].inputSchema`. Write the new `server-instructions-<version>.md` and
`tools-<version>.md`, and delete the old pair so only one version stays in the skill.

Two cautions that cost time if you skip them:

- **Loon is not VCode.** Loon is the S-expression source (`[cube 50 30 5]`). VCode is the
  line-based IR serialization (`C 50 30 5`). If you see single-letter opcodes, you read VCode.
- **`loonlang.com` is a different language.** It documents an unrelated functional language, not
  the vcad CAD vocabulary. The vcad vocabulary is the type catalog in the server instructions.

## Tool argument contract

These are the exact JSON arguments on the installed build. A different field name is rejected, and
vcad then lists `accepted_arguments`, so read that list rather than retrying with a guess.

| Tool | Arguments |
| :--- | :--- |
| `open_document` | none required. Returns `document_id` |
| `create` | `document_id`, `type`, `params`, `name` (recommended), `parent_part_id` |
| `create_cad_loon` | `source`, `document_id`, `use_loons`, `loons`, `base_dir`, `modules`, `format`. **Cannot evaluate on this build.** |
| `inspect_cad` | `document_id` |
| `export_cad` | `document_id` or `ir`, plus `filename` ending `.stl` or `.glb` |
| `render_view` | `document_id` |

`create` is the workhorse here: one call per feature node. `params` follows the Type Catalog in the
server instructions, for example `cube: {size:{x,y,z}}`, `cylinder: {radius,height}`,
`translate: {child, offset}`. Read that catalog before you invent a parameter.

`translate`, `rotate`, `scale` and `mirror` **wrap an existing part**: the returned `part_id` is the
same id you passed in `params.child`. Rotations act around the world origin, not the part center, so
create the geometry at the origin, rotate it, then translate it.

## Core workflow

1. **Open a session.** `open_document` returns a `document_id`. Every later call takes it.
2. **Author one node at a time.** `create` with `type` and `params`. Name each feature.
3. **Look at the result.** `render_view` for an isometric PNG.
4. **Measure.** `inspect_cad` for volume and bbox, or read the `integrity` block that every
   `create` call already returns: `bounding_box`, `volume_mm3`, `watertight`, `open_edges`.
5. **Ship.** `export_cad` with an absolute `filename`.

The `integrity` block makes the L0 and L1 gates cheap: a wrong transform shows up in `bounding_box`
on the same call that created the part, before any render.

## Main tools

| Tool | Purpose |
| :--- | :--- |
| `open_document` | Open a session. Returns the `document_id` every other call needs. |
| `create` | **The authoring tool on this build.** Add one feature node: primitive, boolean, transform, sketch, extrude, pattern, fillet. |
| `update` / `delete` | Patch one node's parameters, or remove a part. |
| `create_cad_loon` | Loon authoring. Present but **non-functional on this build**. |
| `render_view` | Render an isometric PNG of the current model. |
| `inspect_cad` | Return the volume, the area, the bounding box, and the center of mass of the document. |
| `inspect_part` / `describe_scene` | Return the bounding box, size, center, and material of one part, or of all parts. |
| `measure` | Return the distance or the overlap between two parts. |
| `set_material` | Apply a material preset to a part. |
| `export_cad` | Export to `.stl` or `.glb`. STEP goes through `export_step`, which this build does not carry. |
| `open_in_browser` | Return a vcad.io deep link for the document. |

## Coordinate system and primitive origins

The kernel and the exporters work in **millimeters**. `inspect_cad` reports `volume_mm3`, and STL
and GLB carry no unit field, so a file exported from vcad is in mm by convention. Author
human-scale assets in mm too (`3520` for a 3.52 m car body), and scale once at the Blender or
Three.js step. Do not author in meters and hope the exporter guesses.

The axes are **+X right, +Y forward, +Z up**. Read section 3.5 of
[`research/progressive-volume-modeling.md`](../../../research/progressive-volume-modeling.md) before the
first primitive.

| Primitive | Origin `(0, 0, 0)` | Extent | Loon syntax |
| :--- | :--- | :--- | :--- |
| **Cube** | Lower corner | Extends to `(sx, sy, sz)` | `[cube sx sy sz]` |
| **Cylinder** | Base center | Height along `+Z` | `[cylinder radius height]` |
| **Sphere** | Center | Radius in all directions | `[sphere radius]` |
| **Cone** | Base center | Height along `+Z` | `[cone r_bottom r_top height]` |
| **Torus** | Center | Axis along `+Z` | `[torus major_radius minor_radius]` |

`size.x` is the width, `size.y` is the depth, and `size.z` is the height.

The cube origin is a corner. To center a cube on the X and Y axes, translate it by `(-sx/2, -sy/2, 0)`.

## Loon in short

**Status on this build: reference only.** `create_cad_loon` answers
`Loon evaluation not supported by this engine build`. Read this section to understand the shapes
and the vocabulary, and author with `create` instead.

Loon uses square brackets: `[operator arg1 arg2 ...]`.

A transform or a modifier takes its **child as the last argument**. This order makes `pipe` possible.

```lisp
; Variables and root
[let name expression]
[root name "steel"]

; Sequential steps. Each step receives the previous result as the last argument.
[pipe
  [cube 50 50 30]
  [fillet 3]
  [shell 2]
  [translate -25 -25 0]]
[root _ "aluminum"]

; Booleans
[union a b]
[difference base tool]
[intersection a b]

; Transforms
[translate dx dy dz child]
[rotate rx ry rz child]      ; Euler angles in degrees
[scale sx sy sz child]
[mirror-x child]             ; Also mirror-y and mirror-z
[mirror-pattern-x child]     ; The child plus its X mirror
[quad-pattern child]         ; Mirror in X and Y

; Repetition and finishing
[circular-pattern ox oy oz dx dy dz count angle_deg child]
[linear-pattern dx dy dz count spacing child]
[fillet radius child]
[chamfer distance child]
[shell thickness child]
```

Materials: `aluminum`, `steel`, `brass`, `copper`, `chrome`, `abs-white`, `abs-black`, `rubber`, `glass`, `carbon-fiber`.

### Example: robot torso, head, and antenna

```lisp
; Tapered torso with a hollow body and a door cut
[let body [cone 40.0 48.0 110.0]]
[let hollowed [shell 4.0 body]]
[let door-cut [translate -25 -50 15 [cube 50 20 80]]]
[let torso [difference hollowed door-cut]]

; Neck ring, cylindrical head, and dome
[let neck [translate 0 0 110 [cylinder 28.0 6.0]]]
[let head-cyl [translate 0 0 116 [cylinder 25.0 45.0]]]
[let dome [translate 0 0 161 [sphere 25.0]]]
[let head [union [union neck head-cyl] dome]]

; Antenna
[let antenna-base [translate 0 0 185 [cone 6.0 2.0 5.0]]]
[let antenna-rod [translate 0 0 190 [cylinder 1.5 30.0]]]
[let antenna-tip [translate 0 0 220 [sphere 4.0]]]
[let antenna [union [union antenna-base antenna-rod] antenna-tip]]

[let robot [union [union torso head] antenna]]
[root robot "steel"]
```

## Feature nodes with `create`

`create` is the authoring entry point on this build. One call adds one node:

```json
{ "document_id": "doc_...", "type": "cube",
  "params": { "size": { "x": 1530, "y": 3520, "z": 1410 } }, "name": "Envelope" }
```

The node types and their `params` are the Type Catalog in this skill's
`reference/server-instructions-*.md`. Position formats for the operations that accept an `at`:

Position formats for `at`:
1. **Absolute (mm):** `{"x": 25, "y": 15, "z": 0}`
2. **Named:** `"center"`, `"top-center"`, `"bottom-center"`
3. **Percentage:** `{"x": "50%", "y": "25%"}`

```json
{
  "parts": [
    {
      "name": "Base",
      "primitive": { "type": "cylinder", "radius": 30, "height": 10 },
      "operations": [{ "type": "hole", "diameter": 8, "at": "center" }],
      "material": "aluminum"
    }
  ]
}
```

## Rules that prevent broken geometry

- **Rotation uses the world origin, not the part center.** Create the part at the origin, rotate it, then translate it. If you translate first and rotate later, the part swings around the origin.
- **Sketch profiles must close.** Each segment must start where the previous segment ends. The last segment must end at the start of the first segment.
- **Use two half-arcs for a full circle.** An arc needs `start`, `end`, `center`, and `ccw`. Both radii must be equal.
- **Do not make a wheel by rotating a cylinder.** Extrude a circular sketch in the XZ plane and extrude along Y. This method is stable.
- **Cut with a tool that is longer than the part.** Extend the cutting cylinder by 1 mm or 2 mm on each side. Coplanar faces cause unreliable booleans.
- **Check after each change.** Call `inspect_cad`. Confirm a positive volume, the expected bounding box, and a plausible triangle count.

## Sessions

A `document_id` is a handle to server-side state, not storage.

- Call `server_info` when a call fails with an unknown `document_id`. A high `instance_id` change or a low `uptime_s` means the server restarted.
- On restart, every open document is lost. Keep the Loon source of the model so that you can rebuild it.
- Call `checkpoint_document` or `save_document` for long sessions.

## Export for the web

1. Export with `export_cad` to a `.glb` file in the model directory.
2. Import the file in Blender for materials and rigging, or load it directly in Three.js.
3. Load the `threejs-web` skill before you ship the asset.
