# The vcad workflow: agent rules

Rules for an agent that works in `workflows/vcad/`. The project does not use vcad for its assets
today, so most calls here are about a part that must fit, or about a session someone left open.

## Before the first call

1. Run `opencode mcp list` and check that `vcad` reports `connected`.
2. Load the `vcad` skill. It holds the tool catalog and the Loon language.
3. Read [`README.md`](./README.md) to know whether vcad is the right tool at all. For a stylized
   asset judged by silhouette, it is not.

## Rules

- **Set the unit before the first primitive.** Millimetres for fabrication, metres for a game asset.
  The unit is a decision, not a default.
- **Create at the origin, then rotate, then translate.** A rotation wraps the part around the world
  origin, not around the part. Translate first and the rotation swings the part in a wide arc.
- **Name a dimension.** Every key length is a parameter. A magic number is a measurement that
  nobody can trace.
- **Call `inspect_cad` after each change.** Check the volume, the bounding box, and the triangle
  count before you export. A positive volume and a plausible count are the two cheap signs that the
  boolean did what you meant.
- **Never trust a part id that survived a server restart.** A `document_id` is a handle to server
  state, not storage. Run `server_info` when a call fails with an unknown id.
- **Keep the authoring source.** Save the `create_cad_loon` call or the edit record next to the
  export, so the document can be rebuilt.
- **Export through `tools/export.ts`, not through `render_view` alone.** `render_view` gives an
  attachment and not a file, and a stage without pictures cannot be judged.
- **Read the view table, never a copy of it.** The angles live in
  `workflows/threejs/viewer/views.json`, in both frames.

## When a vcad export joins a Three.js scene

- vcad is Z up; glTF and Three.js are Y up. Export with the Y-up option, or convert once and say so.
- Keep the scale at `1, 1, 1` and the rest rotation at `0, 0, 0`.
- Keep the root origin at the centre of the base, so the asset sits on `Y = 0`.
- Import the `.glb` into the scene as its own named node. Do not merge it into another mesh.
