# Demos

Unmeasured scene candidates that the art director kept on purpose. A demo is **evidence**, not an
asset: it has no gate, no measurement, and no place in `blueprints/`. It is a marker of one step.

| File                           | Workflow      | One line                                                            |
| :----------------------------- | :------------ | :------------------------------------------------------------------ |
| `voxel-christmas-tree.html`    | Qwen 3D Coder | A Christmas tree in its pot, built only from cubes. Renders nothing |
| `voxel-christmas-tree-02.html` | Qwen 3D Coder | The same tree, with our own prompt file                             |
| `modernist-office-chair.html`  | Qwen 3D Coder | A modernist chair in walnut, yellow leather, and steel              |

## Open one

The page imports Three.js from cdnjs, so it needs a network connection. Serve the folder rather than
opening the file directly, because the browser blocks an ES module over `file://`:

```bash
bunx serve demos
# then http://localhost:3000/voxel-christmas-tree.html
```

## `voxel-christmas-tree.html`

The first successful run of the Qwen 3D Coder workflow, kept as the marker of ticket `T0011`.

> **This file renders nothing.** Line 111 assigns `renderer = new THREE.WebGLRenderer({...})` with no
> `const`. A `<script type="module">` runs in strict mode, so the assignment throws
> `ReferenceError: renderer is not defined` and the script stops before the first frame. A browser
> capture of the page shows the HTML panel and no `<canvas>`. The file is kept unedited, because a
> demo is evidence: it records what the workflow produced, and what it produced did not run. Ticket
> `T0013` replaces the prompt that allowed this.

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

## The two 2026-11-17 runs

Both files come from a prompt file, with no blueprint and no reference image:

```bash
bun run workflows/qwen3d-coder/tools/scene-draft.ts \
  --prompt-file workflows/qwen3d-coder/prompts/subjects/voxel-christmas-tree.txt \
  --out blueprints/drafts/voxel-christmas-tree/generated
```

The system prompt is the model card's four lines, byte for byte. The user turn is the prompt file.

### `voxel-christmas-tree-02.html`

The prompt file asks for a pot 5 cubes wide, a trunk 1 cube wide, and seven tiers of 13, 11, 9, 7, 5,
3, and 1 cubes, with a last line: "No ground plane, no grid, no fog, no overlay, no camera animation.
Isolate the object."

| Fact       | Value                                                                                            |
| :--------- | :----------------------------------------------------------------------------------------------- |
| Output     | 10 966 bytes, 443 lines                                                                          |
| Wall clock | 114.8 s                                                                                          |
| Tokens     | 3 525 generated, 32.0 tok/s                                                                      |
| Geometry   | one `BoxGeometry`, reused. No ground plane, no grid, no fog                                      |
| Renders    | yes, one canvas. The camera sits too close: the pot fills the frame and the crown is out of view |

The frame is not the object. The model wrote a camera target at `y = 3.2` and a distance that frames
about ten units, while the tree is about twenty-four units tall. The HTML panel is still there,
although the prompt forbids an overlay.

### `modernist-office-chair.html`

The prompt file gives metres for every part: a seat 0.55 by 0.52 at 0.50 high, a back 0.54 wide and
0.62 high leaning 12 degrees, four steel legs, two armrests at 0.72.

| Fact       | Value                                                                        |
| :--------- | :--------------------------------------------------------------------------- |
| Output     | 10 793 bytes, 382 lines                                                      |
| Wall clock | 117.2 s                                                                      |
| Tokens     | 3 549 generated, 30.7 tok/s                                                  |
| Geometry   | 12 `BoxGeometry` and one `TubeGeometry`. No ground plane, no grid, no fog    |
| Renders    | no. The canvas exists at 1280 by 633, and the page shows only its background |

A captured frame is the page background and the HTML title, with no object. The module parses, and no
variable is undeclared, so the fault is inside the scene. This file is evidence, not a result: the
next pass changes one constraint, not the prompt.
