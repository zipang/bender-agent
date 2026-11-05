---
name: Blender MCP - Modeling and Scenes
description: Control Blender live with MCP (mcp-for-blender) and the bpy Python API. Use for polygon modeling, modifiers, PBR materials, HDRI lighting (Poly Haven), rigging, multi-angle visual review (look), and glTF/GLB export.
---

# Blender MCP — Live Blender Control

This skill explains how to control **Blender** with the `mcp-for-blender` server and the `bpy` Python API. Use it to model, texture, rig, and export 3D assets for the web.

## MCP tools

| Tool | Purpose |
| :--- | :--- |
| `get_scene_info` | Compact scene summary, one line per object: transform, materials, topology, hierarchy. Filter with `root` or `query`. Call it before you change an existing scene. |
| `execute_blender_code` | Run Python (`bpy`, `bmesh`, `mathutils`) in the active Blender instance. |
| `look` | Visual review. Capture the viewport, the camera, an auto-framed multi-view sheet (`angles`), or an animation strip (`frames`). Styles: `solid`, `material`, `rendered`, `wireframe`, `xray`. |
| `search_assets` / `import_asset` | Find and import HDRIs, PBR textures, and models from **Poly Haven** (CC0), **Poly Pizza**, or **Sketchfab**. |
| `generate_3d` | Generate and import one textured model with an AI provider (Tripo, Meshy, Hunyuan3D, Hyper3D Rodin). |
| `get_addon_status` | Return the Blender version, the add-on version, and the enabled libraries. |

## Workflow rules

1. **Look before you change.** Call `get_scene_info` first. Learn the object names, the dimensions, and the naming rules in use.
2. **Work in short steps.** Do not send one 400-line script. Build the blockout, call `look` in `angles` mode, then add details.
3. **Prefer the data API.** Use `bpy.data.meshes`, `bpy.data.objects`, `bmesh`, and `obj.modifiers.new(...)`. Avoid `bpy.ops.*` when a data API call exists. `bpy.ops` depends on the window and on the edit mode.
4. **Look up shader nodes by type, not by name.** Node names are localized.

```python
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
```

5. **Read enum values before you set them.** Read the valid identifiers from `bl_rna`. Assign the new value inside `try` / `except TypeError`, and read the error message for the valid engines.

## Axes and units

- Blender uses **1 unit = 1 meter** and **+Z up**. The front view looks along `+Y`, so the model front faces `-Y`.
- The glTF 2.0 exporter writes **+Y up** when `export_yup=True`. This is the default, and Three.js expects it.
- Keep the model root at the world origin, on the ground plane.

## Python patterns for web assets

### 1. Build a mesh with `bmesh`

```python
import bpy
import bmesh

mesh = bpy.data.meshes.new("Visor_Mesh")
obj = bpy.data.objects.new("Visor", mesh)
bpy.context.collection.objects.link(obj)

bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=0.25)
bm.to_mesh(mesh)
bm.free()

for poly in mesh.polygons:
    poly.use_smooth = True
```

### 2. Create a PBR material for glTF and Three.js

Use only the `Principled BSDF` node. The exporter maps it to `MeshStandardMaterial` or `MeshPhysicalMaterial`.

```python
import bpy

def create_pbr_material(name, base_color=(0.7, 0.75, 0.8, 1.0), metallic=0.9, roughness=0.25):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

shiny_metal = create_pbr_material("Shiny_Metal", (0.62, 0.67, 0.72, 1.0), metallic=0.92, roughness=0.18)
```

### 3. Import a vcad `.glb`

```python
import bpy

bpy.ops.import_scene.gltf(filepath="/path/to/part_vcad.glb")
```

vcad exports the document numbers without a scale change. If the vcad document uses millimeters,
scale the object by `0.001` after the import. If it uses meters, keep the scale at `1.0`.

For a 3D print scene, set Metric, unit scale `0.001`, length millimeters, and enable **Scene
Unit** in the STL export. The scene scale changes the display and the print tools. It does not
change the mesh data, and the glTF exporter ignores it.

### 4. Export a `.glb` for Three.js

```python
import bpy

bpy.ops.export_scene.gltf(
    filepath="/path/to/export.glb",
    export_format="GLB",
    use_selection=False,
    export_yup=True,
    export_apply=True,        # Apply the modifiers
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_animations=True,
)
```

### 5. Add a coplanar detail on a face (windows, grilles, lamps)

Do not type 3D coordinates by hand for a window, a grille, or a lamp that lies on an inclined face. Hand-typed coordinates drift off the plane and break the alignment with the body edges.

Instead, read the target face from the mesh, project its edges into the 2D basis of that face, offset each edge inward by a fixed margin, and intersect the offset lines. Every side of the new quad is then strictly parallel to the body edge that it follows, and every vertex lies in the plane.

When the detail must sit flush with the body (no `lift` offset), cut the same outline out of the shell with an `EXACT` boolean difference so that the two surfaces do not fight in the depth buffer. Ensure that adjacent openings keep a positive pillar width between them, or the boolean leaves zero-thickness non-manifold edges.

```python
from mathutils import Vector

def inset_quad_on_face(verts, margins):
    """Inset a planar quad by (top, bottom, left, right) margins in meters."""
    # verts: 4 Vector points of the face, ordered around the perimeter
    O = verts[0]
    ex = (verts[1] - verts[0]).normalized()
    n = (verts[1] - verts[0]).cross(verts[2] - verts[0]).normalized()
    ey = n.cross(ex)

    def to2(p):
        d = p - O
        return Vector((d.dot(ex), d.dot(ey)))

    def to3(q):
        return O + ex * q.x + ey * q.y

    pts2 = [to2(v) for v in verts]
    center = sum(pts2, Vector((0.0, 0.0))) / 4.0

    def offset_line(i, j, dist):
        p0, p1 = pts2[i], pts2[j]
        d = (p1 - p0).normalized()
        inward = Vector((-d.y, d.x))
        if inward.dot(center - p0) < 0:
            inward = -inward
        return (p0 + inward * dist, d)

    def intersect(l1, l2):
        (p1, d1), (p2, d2) = l1, l2
        den = d1.x * d2.y - d1.y * d2.x
        t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den
        return p1 + d1 * t

    m_top, m_right, m_bot, m_left = margins
    l_top = offset_line(0, 1, m_top)
    l_right = offset_line(1, 2, m_right)
    l_bot = offset_line(2, 3, m_bot)
    l_left = offset_line(3, 0, m_left)

    return [
        to3(intersect(l_top, l_left)),
        to3(intersect(l_top, l_right)),
        to3(intersect(l_bot, l_right)),
        to3(intersect(l_bot, l_left)),
    ]
```

## Bender case study

Build the robot in parts. Give each part a stable name for the Three.js animation.

- `Bender_Root`. Empty at `0, 0, 0`, on the ground.
  - `Torso`. Tapered metal cone. Add `Torso_Door` with the pivot on the side hinge.
  - `Head`. Cylinder plus a half sphere. Add the recessed black `Visor`, the `Eye_L` and `Eye_R` cylinders, the `Mouth_Grille`, and the `Antenna`.
  - `Arm_L`, `Arm_R`, `Leg_L`, `Leg_R`. Tubular segments with an armature, or rigid segments with a parent bone.
- Call `look` after each sub-assembly. Check the front view, the profile, and a three-quarter view.
- Check the proportions against the reference images before you add surface detail.
