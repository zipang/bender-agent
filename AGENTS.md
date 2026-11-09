# AGENTS.md

Rules for agents that work in this repository. This file holds only what applies to **every**
workflow. The rules of one workflow are in its own folder:

| Workflow | Rules |
| :--- | :--- |
| Three.js, active | [`workflows/threejs/AGENTS.md`](./workflows/threejs/AGENTS.md) |
| Blender, inactive | [`workflows/blender/AGENTS.md`](./workflows/blender/AGENTS.md) |
| vcad, archived | [`workflows/vcad/AGENTS.md`](./workflows/vcad/AGENTS.md) |

## Purpose

This repository builds 3D assets for web animation from reference images. Three workflows exist, and
one is active at a time. They share the inputs in `blueprints/` and the tools that prepare them.

```text
blueprints/drafts/  ->  draft reference  ->  six views  ->  dimensions.json  ->  the asset
```

## Language rules

- Write all documents in **Simplified Technical English (STE)**.
- This rule applies to every `README.md`, every `AGENTS.md`, every `SKILL.md`, and the agent
  definitions.
- Use American spelling.
- Keep chat answers in the language of the user. The default for this project is French.
- Load the `technical-writing` skill before you write or review long prose.

## Placement rules

- A workflow owns everything it runs. Its tools and its documents live in its own folder.
- The root owns everything more than one workflow reads: `blueprints/`, and the code that prepares a
  reference.
- A new top-level directory needs a reason that names the workflows that read it.
- Update the root `README.md` when you add a skill, a server, a workflow, or a top-level directory.
- A new project word gets an entry in the root `README.md` glossary, in alphabetical order.
- A change that adds a tool, a flag, a file, or a gate updates the documents of its workflow in the
  same commit.

## Ticket rules

- Work is on a Kanban board in `tickets/`. The board, the ID rules, and the ticket template are in
  [`tickets/README.md`](./tickets/README.md).
- One ticket is one file, named `TNNNN-short-kebab-title.md`. An ID counts up and is never reused.
- A ticket moves through `planned/`, `in_progress/`, `review/`, and `done/`, one folder at a time.
- Start a ticket only when every ticket under its `Depends on` is in `review/` or `done/`.
- A ticket in `planned/` names its files, its contract, its tests, and its gates. A ticket that names
  a third-party API without the documented signature and the documentation URL is not ready.
- A commit subject quotes the ticket ID: `✨ feat: <summary> (T0003)`.
- A ticket in `done/` is a record. Never rewrite it. A later change is a new ticket that points at it.
- Evidence stays beside its ticket in `done/`. Never delete it, and never move it to an archive.
- Only the art director accepts a ticket, unless the art director delegates that decision.

## Blueprint rules

- One subject is one folder: `blueprints/<category>/<subject>/`.
- Categories are `vehicules`, `characters`, and `objects`.
- A draft is one folder: `blueprints/drafts/<draft>/`. It is not a subject.
- A draft holds `subject/` and `style/` reference images. The draft stage combines them into one
  reference image, on a uniform white field.
- A subject folder holds `reference.<ext>`, the chosen identity image. The art director writes it.
- The promotion of a draft candidate to `reference.<ext>` is the art director's decision.
- A subject folder holds `source.<ext>` only after a cleaning pass runs. The cleaning pass copies the
  reference to `source.<ext>` before it replaces it. Never modify `source.<ext>`.
- Generation reads `reference.<ext>` only. It never reads `source.<ext>`.
- The generator writes draft candidates to the draft root, cleaning candidates to the subject root,
  and view candidates to `blueprints/<category>/<subject>/<view>/`.
- Only the art director chooses. The choice is a copied file named `reference.<ext>`.
- No agent and no model validates an image automatically.
- Never delete a generated candidate. Keep the rejected files in their folder.
- Never move a candidate to an archive folder. There is no `_superseded/`, `old/`, or `archive/`.
- A new generation adds candidates with the next free counter. The folder grows. It never shrinks.
  The counter runs per model and per folder, so `--04` follows `--03` and no name is reused.

## Dimensions and gates

- The real dimensions are an **input**: a specification sheet, a measurement, or a decision of the
  art director. **Never read them from the views that the model will be checked against.** The check
  becomes circular, every error is normalized away, and every gate passes.
- Every modelling run follows the `volume-modelling` skill: three stages, three gates. No stage starts
  before the previous gate passes, and no gate is softened to make it pass.
- Not every locked view has the same authority. `left`, `right`, `front`, `back` and `top` are
  required. `bottom` is optional: the subject usually stands on it, and an image model invents one.
  An optional view informs, it does not decide, and it does not enter a gate.
- A gate measured on one view is half-measured. Write `not measured` for the others, and treat the
  gate as failed.

## 3D conventions

- Choose the design unit from the deliverable. Use 1 unit = 1 m for a game asset. Use 1 unit = 1 mm
  for fabrication and 3D printing. Read section 3.5 of `research/progressive-volume-modeling.md`.
- Blender and vcad use **Z-up**. glTF and Three.js use **Y-up**. Keep `export_yup=True` in the glTF
  exporter.
- Put the root origin at the centre of the base of the model, so it sits on the ground at `Y = 0`.
- Put each pivot on its axis of rotation: a door hinge, a wheel centre, an antenna base.
- Apply all transforms before the export. Scale is `1, 1, 1` and the rest rotation is `0, 0, 0`.
- Name every animatable node with a stable name: `Head`, `Torso_Door`, `Wheel_FL`.
- Use only `Principled BSDF` materials. The glTF exporter maps them to `MeshStandardMaterial`.

## Validation rules

- **Blueprints:** a view is ready only when its folder contains a `reference.<ext>` chosen by the art
  director.
- **Images:** a distance is read from a tool, never estimated by eye. It converts per axis, `dx` with
  `kx` and `dy` with `ky`.
- **Web:** call `bunx @gltf-transform/cli inspect <file>.glb` after each optimization. Check the file
  size and the triangle count.
- **Blender and vcad:** the rules are in the workflow folder. Both require a look at the geometry
  after each change, and an inspection before the export.

## MCP servers

Check the servers before you start a 3D task:

```bash
opencode mcp list
```

- `vcad` uses `bunx @vcad/mcp`, and needs no other application.
- `blender` uses `uvx mcp-for-blender`. It needs Blender with the **MCP for Blender** add-on, and the
  add-on server must run on port `9876`. When a tool returns `Could not connect to Blender`, ask the
  user to click **Start MCP Server** in the Blender sidebar.

## File rules

- Keep each model in its own directory.
- Keep the authoring source next to the export: the Loon source, the `bpy` script, the `.blend` file,
  or `model.js`.
- Do not commit large binary files without the approval of the user.
- Do not commit generated blueprint candidates. `.gitignore` excludes them.
- Keep the authoring source of a scene committed. Keep its renders and its `.glb` local.
