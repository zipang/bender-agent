---
name: vcad - Parametric CAD and Loon
description: Create, inspect, and export parametric CAD models (BRep and CSG) with the vcad MCP tools. Use for mechanical parts, precise geometry, assemblies, robots, and GLB or STL export.
---

# vcad — Parametric CAD for AI Agents

This skill explains how to use the **vcad** MCP server (`@vcad/mcp`). The server runs a BRep kernel
in Rust and WASM. It builds exact models and exports them to `.glb` (for Blender and Three.js) or
`.stl`.

**Read this skill as a contract, not as a wish.** It records what the installed server actually
does, verified by calling it. The published documentation is not a usable source: whatever a page
says, the behaviour below is what happens.

## The only two references

| Source | What it gives |
| :--- | :--- |
| `reference/server-instructions-<version>.md` | The type catalog, the material keys, and the transform semantics, as emitted by the kernel registry at boot |
| `reference/tools-<version>.md` | The 186 tool names with their required arguments |

Both are captured from the running server, and both carry the server version in their file name.
They are the API. Nothing else is.

To refresh them after a server upgrade, send `initialize` and `tools/list` over stdio and copy
`result.instructions` and `result.tools[].inputSchema`. Write the new `<version>` pair and delete
the old one, so exactly one version stays in the skill.

Do not consult the project documentation site: it serves a build several minor versions behind,
and three of its statements are false on the installed server (see the divergences below).
Do not consult `loonlang.com`: it documents an unrelated functional language, not this vocabulary.

## Status of this build

| Fact | Value |
| :--- | :--- |
| Server version | `0.11.0-main.138+2df8f6d` |
| Tools exposed | 186 |
| Authoring tool that works | `create` |
| `create_cad_document` | **absent from the server** |
| `create_cad_loon` | present, but answers `Loon evaluation not supported by this engine build` |
| `export_step` | absent; `export_cad` writes `.stl` and `.glb` only |

The build is a development snapshot. Treat it as an evaluation target: capable, but uneven.

## Core workflow

1. **Open a session.** `open_document` returns a `document_id`. Every later call takes it.
2. **Author one node at a time.** `create` with `type` and `params`. Always pass `name`.
3. **Measure per part.** `describe_scene` returns the bbox of every part in one call.
4. **Look.** `render_view` returns an isometric PNG.
5. **Ship.** `export_cad` with a **relative** filename.
6. **Verify.** `bunx @gltf-transform/cli inspect <file>.glb`, then check the triangle count.

## Tool argument contract

A wrong field name is rejected, and the error carries `accepted_arguments`. Read that list; do not
retry with another guess.

| Tool | Arguments |
| :--- | :--- |
| `open_document` | none required. Returns `document_id` |
| `create` | `document_id`, `type`, `params`, `name`, `parent_part_id` |
| `update` | `document_id`, `node_id`, `params` |
| `delete` | `document_id`, `part_id` |
| `set_material` | `document_id`, `part_id`, `material` |
| `read` | `document_id`, `part_id` (optional). Lists parts, or dumps one feature tree |
| `describe_scene` | `document_id`, `part_ids`, `limit` |
| `inspect_part` | `document_id`, `part_id` |
| `inspect_cad` | `document_id` |
| `render_view` | `document_id`, `azimuth`, `elevation`, `view`, `width_px`, `style` |
| `export_cad` | `document_id` or `ir`, plus `filename` |
| `export_step` | **does not exist on this build** |
| `create_cad_loon` | `source`, `document_id`, `use_loons`, `loons`, `base_dir`, `modules`, `format` |

`create` is the workhorse. `params` follows the type catalog in
`reference/server-instructions-*.md`, for example `cube: {size:{x,y,z}}`,
`cylinder: {radius,height}`, `translate: {child, offset}`, `rotate: {child, angles}`.

## Field-tested behaviour — read before you trust the instructions

These eight points were measured on the installed build. Several contradict the server's own
`instructions` text. When they disagree, the behaviour wins.

### 1. A transform REPLACES the previous one, it does not wrap it

The server instructions say `translate` / `rotate` / `scale` "WRAPS the existing part in place".
They do not stack. Measured on a single cube:

| Call | Result |
| :--- | :--- |
| `translate(cube, +500 X)` | centre `x = 550` ✓ |
| then `translate(same part, +300 Y)` | centre `x = 50, y = 350` ✗ |

The first offset is gone. The feature tree holds one `Translate` node, which is rewritten.

**Consequence:** one part carries **one** offset. To move a part twice, compute the final offset
and send it once, or use `update` on the existing node. If you chain two `translate` calls, the
second silently teleports the part to its local origin plus the new offset.

### 2. Every primitive is auto-wrapped in Scale, Rotate, Translate

`read` on a fresh part shows four nodes: the primitive, then `Scale` (factor 1,1,1), then `Rotate`
(angles 0,0,0), then `Translate` (offset 0,0,0). That wrapper is what the transforms rewrite.

`update` takes the **`node_id`** of the wrapper (for example `"8"`), not the `part_id` (`"0:1"`).
And `params` accepts only the fields of that node's own operation: passing `child` is rejected with
`` `child` is not a parameter of this part ``.

### 3. `integrity` describes the whole document, not the new part

Every `create` returns an `integrity` block with `bounding_box`, `volume_mm3`, `watertight`,
`open_edges`. That bbox is the **document** envelope. Reading it as the new part's bbox hides
placement bugs. Use `describe_scene` for a per-part bbox.

### 4. `part_id` is `"<root>:<index>"`, and it is not predictable

The id is `0:0`, `0:1`, `0:2` … in creation order. It is **not** the node id, and it is not derived
from the name. Never write a literal `"1:0"` for the second part: read `create`'s `part_id` from its
return value, or call `read` to list the parts.

### 5. `export_cad` accepts only a relative filename

The server refuses an absolute path:

```
Invalid filename: absolute paths are not allowed — pass a filename relative to the server
working directory (set VCAD_MCP_EXPORT_DIR to choose the directory).
```

The file lands in the directory the MCP server was launched from, which is the repository root. Move
it into the model directory afterwards, and compare `bytes` with the written file to confirm.

### 6. `render_view` returns assets, not a path

The reply is `{assets, suggestedFinalMarkdown}`, not a filename. It renders one isometric picture;
use `azimuth` and `elevation` to pick the angle.

### 7. A boolean consumes its operands, and a modifier births a new part

`union`, `difference` and `intersection` do not amend a part: they **consume** both operands and
return a new part. After the call, the operand ids are gone from `read`. A modifier such as
`fillet`, `chamfer` or `shell` likewise returns a **new** part that contains the source tree plus
the modifier node, and the source id disappears.

Measured on two 10 mm cubes:

| Step | Parts after the call |
| :--- | :--- |
| create `A`, create `B` | `0:0`, `0:1` |
| `union(left: 0:0, right: 0:1)` | `0:2` only |

So an operation chain is a chain of fresh ids: build, name, read the new `part_id`, and use **that**
for the next step. Never reuse the id you passed in.

### 8. A stale `part_id` is not rejected — it silently rebuilds the geometry

Pass a consumed id to a modifier and vcad does not error. It resurrects the underlying node as a
**new part beside the current one**, so the scene ends up with a duplicate the model should not
have.

Measured: after the union above, `fillet(child: "0:0", radius: 1)` returned a fresh part `0:3` with
no warning, and the scene then held both `0:2` and `0:3`.

This is the most dangerous behaviour of this build: a wrong id costs no error, only a silently wrong
scene. Guard against it by reading the part list after every boolean or modifier, and by checking
`describe_scene` for a part count you did not expect.

## Coordinate system and primitive origins

The kernel and the exporters work in **millimeters**. `inspect_cad` reports `volume_mm3`, and STL
and GLB carry no unit field, so a file exported from vcad is in mm by convention. Author
human-scale assets in mm as well (`3520` for a 3.52 m car body), and scale once at the Blender or
Three.js step. Do not author in meters and hope the exporter guesses.

The axes are **+X right, +Y forward, +Z up**.

| Primitive | Origin `(0, 0, 0)` | Extent |
| :--- | :--- | :--- |
| **Cube** | Lower corner | Extends to `(sx, sy, sz)` |
| **Cylinder** | Base centre | Height along `+Z` |
| **Sphere** | Centre | Radius in all directions |
| **Cone** | Base centre | Height along `+Z` |
| **Torus** | Centre | Axis along `+Z` |
| **Wedge** | Corner | Legs along `+X` and `+Z`, extruded along `+Y` |
| **Prism** | Centre on Z | Regular n-gon, height along `+Z` |

A cube's origin is a corner. To centre it on X and Y, offset by `(-sx/2, -sy/2, 0)` in the same
`translate` call, because a second one would replace it.

A cylinder's origin is its base centre. To lay it on the X axis as a wheel, rotate it `y: 90`, which
sweeps the centre from `(0,0,h/2)` to `(h/2,0,0)`. Account for that `h/2` shift in the single offset
you pass: it is the classic off-by-87.5-mm error.

## Feature nodes with `create`

```json
{ "document_id": "doc_...", "type": "cube", "name": "Body",
  "params": { "size": { "x": 1530, "y": 3520, "z": 1410 } } }
```

Node types come from the type catalog: `cube`, `cylinder`, `sphere`, `cone`, `torus`, `wedge`,
`prism`, `union`, `difference`, `intersection`, `translate`, `rotate`, `scale`, `mirror`,
`sketch_2_d`, `extrude`, `revolve`, `sweep`, `loft`, `linear_pattern`, `circular_pattern`,
`sweep_rotate`, `shell`, `fillet`, `chamfer`, `edge_blend`, `text_2_d`.

Booleans take `left` and `right` as child **part ids**, and they consume them. `fillet`, `chamfer`
and `shell` take a `child` and a size, and they return a new part. A modifier applies to a whole
part, not to a selection of edges; use `edge_blend` when the selection matters.

The rule that keeps this manageable:

```
create primitive  →  read part_id  →  create boolean/modifier  →  read NEW part_id  →  repeat
```

Name every node. The feature tree is the only record of the model, and a named tree is the only one
you can debug.

## The export rule — a model without a picture is not a deliverable

**Every modelling stage ends with one command, and that command writes the `.glb` *and* the
renders.** No stage is reported to the art director from numbers alone.

```bash
cd /path/to/repo
bun run scripts/vcad-render/export.ts \
  --document <document_id> \
  --out blueprints/<category>/<subject>/model/<asset>-L<n> \
  --views front-3q,rear-3q,front,left,back,right,top
```

It writes one model file and one WebP per named view:

```
blueprints/vehicules/r5-tl-1972/model/r5-L2-front-3q.webp
blueprints/vehicules/r5-tl-1972/model/r5-L2-rear-3q.webp
blueprints/vehicules/r5-tl-1972/model/r5-L2-front.webp
…
blueprints/vehicules/r5-tl-1972/model/r5-L2.glb
```

The name carries the ladder stage, so two passes never overwrite each other and the art director
can compare L1 and L2 side by side.

### Why a script and not the tool

`render_view` does return the picture, but the MCP host turns it into an attachment and **strips the
base64 payload** from the result the agent receives. The agent sees the image and cannot write it.
The bytes survive in the raw JSON-RPC reply, in `content[].data`, so the script speaks JSON-RPC to
the server over stdio and keeps them. It also converts to WebP, which keeps a render near 30 KB
instead of 150 KB.

The server is durable, so a `document_id` minted in one process is still readable by the script.

### The named views

| View | Azimuth | Elevation | Use |
| :--- | :--- | :--- | :--- |
| `front-3q` | 60 | 30 | **the judgement view**: front, one flank, and roof in one frame |
| `rear-3q` | 240 | 30 | the same from the other end |
| `front` | 90 | 0 | orthographic elevation |
| `back` | 270 | 0 | orthographic elevation |
| `left` | 180 | 0 | orthographic profile |
| `right` | 0 | 0 | orthographic profile |
| `top` | 0 | 89 | plan |
| `bottom` | 0 | −89 | underbody |
| `iso` | 40 | 22 | generic orbit |

`+Y` is the front direction, so the front camera sits at azimuth 90. The default view set is
`front-3q, rear-3q, front, left, back, right, top`.

### What to look at in the renders

The two three-quarter views carry the most information, and they expose the failures that numbers
hide: a slab-shaped greenhouse, a missing bonnet slope, wheels crossing the bodywork, a flat tail.
Report what you see as a description of the silhouette, never as a verdict.

## Rules that prevent broken geometry

- **One offset per part.** A second `translate` replaces the first. Compute it once.
- **Re-read `part_id` after every boolean or modifier.** Operand ids die on use, and a stale id
  silently duplicates geometry instead of failing.
- **Rotate before you place.** A rotation sweeps the part around the world origin, so a part that is
  already far away will swing. Build at the origin, rotate, then translate in the same call chain.
- **Boolean tools must overlap and overshoot.** A cutting solid exactly coplanar with a face gives
  an unreliable boolean; extend it by 1 or 2 mm on each side.
- **Check the per-part bbox.** `describe_scene` after every stage. A symmetric assembly must be
  symmetric on the bbox centres; an odd value is a placement bug, not a rendering quirk.
- **Watch the volume.** A boolean that removes nothing returns the original volume unchanged. A
  boolean that removes everything returns 0.

## Sessions

A `document_id` is a handle to server-side state, not storage.

- Call `server_info` when a call fails with an unknown `document_id`. A changed `instance_id` or a
  low `uptime_s` means the server restarted.
- On restart, every open document is lost. Keep the Loon source or a rebuild script next to the
  export.
- Call `checkpoint_document` or `save_document` for long sessions.

## Known limitations

- **`create_cad_loon` cannot evaluate on this build.** Author with `create`.
- **No `export_step`.** Only `.stl` and `.glb`.
- **No edge selection on `fillet`.** It applies to the whole part; `edge_blend` takes a query.
- **`create_cad_document` is absent**, so the JSON part document format has no entry point. Build
  with `create` instead.
- **No error on a stale id**, only a duplicated part. See divergence 8.
- **`add`-style transforms do not compose.** Every placement is an absolute offset from the part's
  own origin, never a delta on the previous one.

## Evaluation notes

Field data from the Renault 5 TL L1 pass (`blueprints/vehicules/r5-tl-1972/model/`):

| Observation | Value |
| :--- | :--- |
| Six named parts, one box, one greenhouse, four wheels | 536 triangles, `watertight: true` |
| File size | 48 KB GLB, six meshes, glTF 2.0, no extensions |
| Bounding box | exactly the real car, `−765..765 × −1760..1760 × 0..1410` mm |
| Cost of one full rebuild | about fifteen `create` calls, a few seconds |

What it is good at: constant-size primitives, exact absolute dimensions, cylindrical parts, a
scene split into named parts, and a small triangle budget that suits a game asset.

Where it costs time: every placement is a manual offset with no constraint and no assembly joint
in the simple path, and the two silent failures (transform replacement, stale id) turn a mistake
into a wrong model rather than an error. Budget for a measurement after every second call.

## Export for the web

1. `export_cad` with a relative `filename` such as `r5-L1.glb`.
2. Move the file into the model directory next to the reference images.
3. Verify with `bunx @gltf-transform/cli inspect <file>.glb`: glTF 2.0, `generator: vcad`, no
   extensions, one mesh per part, and a triangle count that matches `inspect_cad`.
4. Load the `threejs-web` skill before you ship the asset to a browser.
