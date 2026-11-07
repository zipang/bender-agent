# AGENTS.md

Rules for agents that work in this repository.

## Purpose

This repository tests 3D asset workflows for web animation: **vcad** for parametric CAD and **Blender** for polygon modeling. The target runtime is **Three.js** with `.glb` files.

The pipeline has three stages. The first gathers and combines the references. The second prepares the views. The third builds the model.

```text
blueprints/drafts/  ->  draft reference  ->  six views  ->  progressive-volume-modeling  ->  .glb
```

Stage 0, the draft, happens in `blueprints/drafts/<draft>/`. The art director collects two kinds of reference image there: subject images, which say what to model, and style images, which say how to render it. One generation combines them into a single reference image on a uniform white field. That image is promoted to `reference.<ext>` of a subject folder, and the view stage starts from it.

## Language rules

- Write all documents in **Simplified Technical English (STE)**.
- This rule applies to `README.md`, `AGENTS.md`, `SKILL.md` files, and agent definitions.
- Use American spelling.
- Keep chat answers in the language of the user. The default for this project is French.
- Load the `technical-writing` skill before you write or review long prose.

## Repository map

```text
.agents/skills/          # Local skills. Add new 3D skills here.
.opencode/agents/        # Agent definitions.
assets/img/              # Images for the documentation.
blueprints/              # Subjects and their generated views.
blueprints/drafts/       # Raw material. Not ready for generation.
research/                # Method documents and investigation reports.
scenes/                  # Three.js scenes. One directory per subject.
scripts/                 # TypeScript tools.
opencode.jsonc           # Project configuration and MCP servers.
```

## Scene rules

A scene is one directory under `scenes/<subject>/`. It holds three files, and no build step:

| File | Role |
| :--- | :--- |
| `model.js` | The asset. Exports `buildCar()`. Imports `three` and nothing else: no DOM, no renderer, no network. |
| `scene.js` | The viewer. Owns the renderer, the cameras, the lights, and the script API that capture uses. |
| `index.html` | The page and the import map. |

- `model.js` must stay importable outside a browser. The live scene and the exported `.glb` are then built from the same source.
- Trace on the **calque**: the reference views are planes in the scene, sized in metres from `kx` and `ky`. `bun run scripts/scene/ctl.ts calque --view left --depth front --opacity 0.55`.
- A calque is calibrated on the **subject box**, never on the cropped file: the crop keeps a margin, and scaling on it makes every measurement 0.3 % short.
- Measure in **model units**, not in pixels: `ctl.ts measure --on` picks on the calque and reports millimetres of Z and Y directly. Zoom until `mmPerScreenPx` matches the image's own scale before tracing.
- A calque is masked to its own axis, and `shot` hides it unless asked. A silhouette comparison that included the plate would compare the reference to itself.
- Judge a body on its **binary silhouette**, not on a shaded render. `scripts/scene/compare_silhouette.py` overlays the two masks and prints the deltas in millimetres.
- Serve with `bun run scripts/scene/serve.ts --scene scenes/<subject>`. It serves the scene and the `three` package, and pushes a reload on save. It also serves `/measure/`, the point picker, and `/repo/` for the reference images and their `dimensions.json`.
- Drive the live page with `bun run scripts/scene/ctl.ts`: camera angle, projection, wireframe, node isolation, background, and one-shot captures. Editing `scene.js` to look from another angle is not a loop.
- One browser, reused. `ctl.ts` talks to the single session `scene-ctl`; run `ctl.ts close` when the
  pass ends. `shot.ts` opens its own session and closes it in a `finally`, so `check.ts` leaves no
  process behind. A new `--session` name starts a new headless Chrome that outlives the command;
  fourteen sessions and 238 processes accumulated that way during one refactor.
- Every modelling pass ends with `bun run scripts/scene/check.ts`. It captures, overlays, measures, and checks the orientation.
- Never compare a render to a reference without checking that both show the same flank. A mirrored silhouette still looks plausible.
- Flat views use an orthographic camera. A perspective camera can never line up with an orthographic reference.
- Keep the authoring source of a scene committed. Keep its renders and its `.glb` local.

## Modelling rules

- Every modelling run follows the `volume-modelling` skill: three stages, three gates. No stage
  starts before the previous gate passes, and no gate is softened to make it pass.
- Stage 1 writes `blueprints/<category>/<subject>/dimensions.json`. The real dimensions are an
  input: a specification sheet, a measurement, or a decision of the art director. Never read them
  from the views that the model will be checked against.
- Stage 2 builds the body only. No accessory, no placeholder, no reference box.
- Stage 2 cuts **no hole**. Wheel arches, window openings and lamp recesses belong to stage 3, when
  the part that fills them has been measured. A hole changes the silhouette, and G2 measures the
  silhouette.
- Stage 3 adds one accessory per pass: measured, modelled apart, validated alone, then oriented
  and translated onto the body as its own named node.
- Never merge an accessory into the body mesh.
- Not every locked view has the same authority. `left`, `right`, `front`, `back` and `top` are
  required. `bottom` is optional: the subject usually stands on it, and an image model invents one.
  An optional view informs, it does not decide, and it does not enter a gate.

## Blueprint rules

- One subject is one folder: `blueprints/<category>/<subject>/`.
- Categories are `vehicules`, `characters`, and `objects`.
- A draft is one folder: `blueprints/drafts/<draft>/`. It is not a subject.
- A draft holds `subject/` and `style/` reference images. The draft stage combines them into one
  reference image, on a uniform white field.
- A subject folder holds `reference.<ext>`, the chosen identity image. The art director writes it.
- The promotion of a draft candidate to `reference.<ext>` is the art director's decision.
- A subject folder holds `source.<ext>` only after a cleaning pass runs. The cleaning pass copies
  the reference to `source.<ext>` before it replaces it. Never modify `source.<ext>`.
- Generation reads `reference.<ext>` only. It never reads `source.<ext>`.
- The generator writes draft candidates to the draft root, cleaning candidates to the subject root,
  and view candidates to `blueprints/<category>/<subject>/<view>/`.
- Only the art director chooses. The choice is a copied file named `reference.<ext>`.
- No agent and no model validates an image automatically.
- Never delete a generated candidate. Keep the rejected files in their folder.
- Never move a candidate to an archive folder. There is no `_superseded/`, `old/`, or `archive/`.
- A new generation adds candidates with the next free counter. The folder grows; it never shrinks.
- The counter runs per model and per folder, so `--04` follows `--03` and no name is reused.

## 3D conventions

- Choose the design unit from the deliverable. Use 1 unit = 1 m for game assets. Use 1 unit = 1 mm for fabrication and 3D printing. Read section 3.5 of `research/progressive-volume-modeling.md`.
- Blender and vcad use **Z-up**. glTF and Three.js use **Y-up**. Keep `export_yup=True` in the glTF exporter.
- Put the root origin at the center of the base of the model. The model then sits on the ground at `Y = 0`.
- Put each pivot on its axis of rotation. Examples: door hinge, wheel center, antenna base.
- Apply all transforms before export. Scale must be `1, 1, 1`. Rest rotation must be `0, 0, 0`.
- Name every animatable node with a stable name: `Head`, `Torso_Door`, `Wheel_FL`.
- Use only `Principled BSDF` materials. The glTF exporter maps them to `MeshStandardMaterial` in Three.js.

## MCP servers

Check the servers before you start a 3D task:

```bash
opencode mcp list
```

- `vcad` uses `bunx @vcad/mcp`. It needs no other application.
- `blender` uses `uvx mcp-for-blender`. It needs Blender with the **MCP for Blender** add-on, and the add-on server must run on port `9876`.
- If the Blender tools return `Could not connect to Blender`, ask the user to click **Start MCP Server** in the Blender sidebar.

## Validation rules

- **Blueprints:** a view is ready only when the folder contains a `reference.<ext>` file chosen by the art director.
- **vcad:** call `inspect_cad` before each export. Check the volume, the bounding box, and the triangle count.
- **Blender:** call `get_scene_info` before you change a scene. Call `look` after each geometry change. Check the model from the front, the side, and a three-quarter view.
- **Web:** call `bunx @gltf-transform/cli inspect <file>.glb` after each optimization. Check the file size and the triangle count.
- **Distances:** a distance is read from `scripts/measure/`, never estimated by eye. It converts per axis, `dx` with `kx` and `dy` with `ky`, and the annotated copy is checked before the number is used.

## File rules

- Keep each model in its own directory.
- Keep the authoring source next to the export. Examples: the Loon source, the `bpy` script, or the `.blend` file.
- Do not commit large binary files without approval from the user.
- Do not commit generated blueprint candidates. `.gitignore` excludes them.
- Update `README.md` when you add a skill, a server, or a top-level directory.
