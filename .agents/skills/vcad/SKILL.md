---
name: vcad - Parametric CAD and Loon
description: Create, inspect, and export parametric CAD models (BRep and CSG) with the vcad MCP tools. Use for mechanical parts, precise geometry, assemblies, robots, and GLB or STL export.
---

# vcad — Parametric CAD for AI Agents

This skill explains how to use the **vcad** MCP server (`@vcad/mcp`). The server runs a BRep kernel in Rust and WASM. It builds exact models and exports them to `.glb` (for Blender and Three.js) or `.stl`.

## Core workflow

1. **Open a document.** Call `open_document`, or let the first authoring call create one.
2. **Author the part.** Call `create_cad_loon` with the full model, or call `create` / `update` / `delete` for one node at a time.
3. **Look at the result.** Call `render_view` for an isometric PNG.
4. **Measure the result.** Call `inspect_cad` for the document, or `inspect_part` / `describe_scene` for each part.
5. **Ship the result.** Call `export_cad` for STL, GLB, or STEP, or call `open_in_browser` for a vcad.io link.

## Main tools

| Tool | Purpose |
| :--- | :--- |
| `create_cad_loon` | Build geometry with the compact **Loon** language. Use this for models with several booleans, fillets, or patterns. |
| `create_cad_document` | Build geometry from a JSON document. Use this for simple parts and assemblies. |
| `create` / `update` / `delete` | Change one node and keep the rest of the document. |
| `render_view` | Render an isometric PNG of the current model. |
| `inspect_cad` | Return the volume, the area, the bounding box, and the center of mass of the document. |
| `inspect_part` / `describe_scene` | Return the bounding box, size, center, and material of one part, or of all parts. |
| `measure` | Return the distance or the overlap between two parts. |
| `set_material` | Apply a material preset to a part. |
| `export_cad` | Export to `.stl`, `.glb`, or `.step`. |
| `open_in_browser` | Return a vcad.io deep link for the document. |

## Coordinate system and primitive origins

All dimensions are in the **design unit**. The default is millimeters. Use meters for
human-scale assets such as characters, vehicles, and levels. Read section 3.5 of
[`research/progressive-volume-modeling.md`](../../../research/progressive-volume-modeling.md) before the
first primitive. The axes are **+X right, +Y forward, +Z up**.

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

## JSON documents

Use `create_cad_document` for parts with positioned holes, extruded sketches, or assemblies.

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
