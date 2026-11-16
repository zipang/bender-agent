# Demos

Unmeasured scene candidates that the art director kept on purpose. A demo is **evidence**, not an
asset: it has no gate, no measurement, and no place in `blueprints/`. It is a marker of one step.

| File                        | Workflow      | One line                                           |
| :-------------------------- | :------------ | :------------------------------------------------- |
| `voxel-christmas-tree.html` | Qwen 3D Coder | A Christmas tree in its pot, built only from cubes |

## Open one

The page imports Three.js from cdnjs, so it needs a network connection. Serve the folder rather than
opening the file directly, because the browser blocks an ES module over `file://`:

```bash
bunx serve demos
# then http://localhost:3000/voxel-christmas-tree.html
```

## `voxel-christmas-tree.html`

The first successful run of the Qwen 3D Coder workflow, kept as the marker of ticket `T0011`.

| Fact       | Value                                                                              |
| :--------- | :--------------------------------------------------------------------------------- |
| Model      | `qwen3.5-4b-3d-coder`, Q4_K_M, served by an OpenAI-compatible endpoint on loopback |
| Request    | one streamed `POST /v1/chat/completions`, thinking disabled                        |
| Prompt     | the three blocks below, built by `tools/lib/prompt.ts`                             |
| Reference  | none. This subject has no blueprint image, so no image part was sent               |
| Output     | 11 611 bytes, 451 lines                                                            |
| Wall clock | 125.3 s, cold load included                                                        |
| Tokens     | 3 898 generated, 32.0 tok/s                                                        |
| Geometry   | one `BoxGeometry`, reused; no sphere, cylinder, cone, addon, or imported model     |

The prompt, in the words that were sent:

```text
Subject: a Christmas tree standing in its pot
Style: voxel art: every visible form is made of cubes (THREE.BoxGeometry) aligned to one grid,
flat colors, no spheres, no cylinders, no cones, no imported model, no texture
Create one self-contained HTML file with Three.js from cdnjs that shows a voxel-art Christmas tree
standing in its pot: a short brown trunk, stacked green cube layers that taper to a point, a red cube
pot on the ground, a few yellow and white cubes as ornaments. Use only cubes, keep one orbit
controller implemented by hand, and light the scene with one ambient and one directional light.
```

A demo is never edited. A new run adds a new file.
