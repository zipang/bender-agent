# The Blender workflow: agent rules

Rules for an agent that drives Blender through `mcp-for-blender`. The project does not use Blender
for its assets today, so these rules apply to a side task: a material study, a rig, a cleanup, or a
form that Three.js cannot build from numbers.

## Before you change a scene

1. Call `get_addon_status`. It returns the Blender version, the add-on version, and the libraries.
2. Call `get_scene_info`. Learn the object names, the transforms, and the materials that are there.
   Never guess a name.
3. Read [`README.md`](./README.md) and check that Blender is the right tool for this task.

## Rules

- **Work in short steps.** Build the blockout, call `look` in `angles` mode, then add detail. One
  400-line script cannot be reviewed and cannot be undone.
- **Prefer the data API.** Use `bpy.data.meshes`, `bpy.data.objects`, `bmesh`, and
  `obj.modifiers.new(...)`. Reserve `bpy.ops.*` for the calls that have no data equivalent: they
  depend on the window, the context, and the edit mode.
- **Look up a shader node by type, never by name.** Node names are localized.

  ```python
  bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
  ```

- **Read an enum before you set it.** Read the valid identifiers from `bl_rna`, and assign inside
  `try` / `except TypeError`, whose message lists the valid values.
- **Use only `Principled BSDF`.** The glTF exporter maps it to `MeshStandardMaterial`, which is what
  Three.js expects. Any other node graph exports as something nobody asked for.
- **Call `look` after each geometry change.** Check the front, the side, and a three-quarter view.
  A wireframe pass shows the topology that a shaded render hides.

## The asset contract

- Units are metres, and the model root sits on the ground at the world origin.
- Apply every transform before the export. Scale stays `1, 1, 1` and the rest rotation `0, 0, 0`.
- Name every animatable node with a stable name: `Head`, `Torso_Door`, `Wheel_FL`.
- Put each pivot on its axis of rotation, not on the object centre.
- Export glTF 2.0 with `export_yup=True`, so the file is Y up for Three.js.
- Keep the `.blend` file, or the `bpy` script that builds it, next to the export. A scene that exists
  only inside Blender cannot be reviewed or rebuilt.

## A note on `generate_3d`

`generate_3d` produces one object from a text prompt or an image, in a minute or two, and it may
cost the user a credit. Ask before you call it. It is never a scene: not a ground plane, not a set
of parts to assemble.
