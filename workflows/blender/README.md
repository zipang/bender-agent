# The Blender workflow

Status: **not the active workflow of this project.** The R5 and the minivan are built in Three.js.
This document describes what the Blender workflow is, how its server is set up, and what it is
good at, so the knowledge survives without being mixed into the workflow that runs today. Section 4
adds one exception: a modelling phase that runs under evaluation, from a complete blueprint folder.

## 1. What Blender is, here

Blender is a polygon modeller, and the server is `mcp-for-blender`. It drives a **running** Blender
instance: the tools do not start one, and a call fails when the add-on is not listening.

| Property          | Value                                               |
| :---------------- | :-------------------------------------------------- |
| Server            | `{env:HOME}/.local/bin/uvx mcp-for-blender`         |
| Transport         | a socket to the add-on, `localhost:9876` by default |
| Coordinate system | Z up, front along `-Y`                              |
| Units             | 1 unit = 1 metre for a game asset                   |
| Export            | glTF 2.0 `.glb`, with `export_yup=True`             |

The MCP server reports `connected` even when Blender is closed, because the MCP process is up.
The tools then answer:

```text
Could not connect to Blender. Make sure the Blender addon is running.
```

The fix is in Blender, not in the config: **3D Viewport > `N` > MCP for Blender > Start MCP Server**.

## 2. Setup, once per machine

1. Install the `uv` launcher. The Astral installer puts `uvx` in `~/.local/bin`.
2. Install the add-on:

```bash
uvx mcp-for-blender install-addon
```

It copies `blender_mcp.py` to `~/.config/blender/<version>/scripts/addons/`.

3. In Blender: **Edit > Preferences > Add-ons**, search **Interface: MCP for Blender**, enable it.
4. Open the sidebar, select the **MCP for Blender** tab, click **Start MCP Server**.

Check the connection from the shell:

```bash
opencode mcp list
```

## 3. What this workflow is good at

| Task                         | Why Blender                                                           |
| :--------------------------- | :-------------------------------------------------------------------- |
| Organic and blended forms    | subdivision, sculpting, retopology                                    |
| A finished look              | PBR materials, HDRI lighting, cameras, render passes                  |
| Rigging and animation        | armatures, skin weights, keyframes, and a glTF clip                   |
| Asset libraries              | `search_assets` and `import_asset`: Poly Haven, Poly Pizza, Sketchfab |
| Cleanup of imported geometry | merge by distance, normals, decimation, UV unwrap                     |

It is a poor tool for a shape that must be exact against a drawing. A measured silhouette is better
built from numbers, and that is the reason the Three.js workflow exists. See
[`../threejs/README.md`](../threejs/README.md). The phase below is the exception, and it is an
evaluation, not the production path.

## 4. The blueprint-driven modelling phase (evaluation)

Status: **evaluation.** This phase models a subject in Blender from a complete blueprint folder. It
measures the third-party skill [`blender-modeler`](../../.agents/skills/blender-modeler/README.md),
and it does not replace the Three.js workflow.

### 4.1 When the phase starts

The phase starts only when the blueprint is complete, because the model is judged against it. Bender
checks these files before any spend:

| Condition                                                             | Where                                        |
| :-------------------------------------------------------------------- | :------------------------------------------- |
| Length, width, and height, each with its own source                   | `dimensions.json`                            |
| The subject, the camera note, and the hidden parts                    | `notes.md`                                   |
| A `reference.<ext>` chosen by the art director in every required view | `front/`, `back/`, `left/`, `right/`, `top/` |
| `bottom/` is optional                                                 | `bottom/`                                    |

This is the same condition as gate G1, read from the files instead of from a run. A missing file
stops the phase: Bender reports the gap and generates no model.

### 4.2 Who does what

| Role                         | Work                                                                                       |
| :--------------------------- | :----------------------------------------------------------------------------------------- |
| The art director             | Chooses the asset, the stage, the asset class, and accepts or rejects every result         |
| **Bender**                   | Reads the blueprint, asks the questions, writes the brief, dispatches, judges, reports     |
| **`blender-modeler-runner`** | Runs the model in Blender. Loads only the `blender-modeler` skill, and never another skill |

Bender never models in this phase, and the runner never judges. The phase costs no image credit: the
runner drives the local Blender in the background.

The runner runs on `openrouter/qwen/qwen4-max`, so the phase tests a strong long-context model on the
loop. The model is one line of `.opencode/agents/blender-modeler-runner.md`, and the art director
changes it there.

### 4.3 The stages

The stage names are those of the `blender-modeler` skill, not the G1 to G3 gates of
[`volume-modelling`](../../.agents/skills/volume-modelling/SKILL.md):

| Stage          | Content                                                    |
| :------------- | :--------------------------------------------------------- |
| `spec`         | The named parts, the real dimensions, the attachment graph |
| `blockout`     | Primitives at the spec sizes, in clay, with no bevel       |
| `detail`       | Lathe profiles, bevels, aprons, gaps, handles, feet        |
| `materials`    | `Principled BSDF` materials, with variation and bump       |
| `presentation` | `mk.studio()`, and the final render in `final.png`         |

One stage is one dispatch. A new stage is a new brief, written after the review of the previous one.
Every stage has its own gate in the skill: zero check errors, and the critique checklist passes.

### 4.4 What the phase reports

Every dispatch reports the spec, the `model.py`, the `.blend`, the check exit code and its error
count, and one review sheet with 8 views. Bender opens the sheet, compares the silhouette with the
locked views, and marks every number as `reported by the sub-agent`. The art director decides.

### 4.5 The limits of the phase

- The model is judged against the views that were generated from one reference image. A wrong view
  becomes a wrong model, and this phase cannot see it: only the art director can.
- `blender-modeler` is strongest on hard-surface subjects: furniture, products, props, mechanical
  parts. A character or a creature is out of its documented range.
- The output is not a delivered asset. It becomes one only when the art director accepts it, and
  after the asset contract of [`AGENTS.md`](./AGENTS.md) passes.

## 5. The tools

Two skills are in play, and they do not overlap:

| Need                                      | Document                                                         |
| :---------------------------------------- | :--------------------------------------------------------------- |
| The live MCP tool catalog, and `look`     | `.agents/skills/blender-mcp/SKILL.md`                            |
| The measured loop of the evaluation phase | `.agents/skills/blender-modeler/SKILL.md`, and `scripts/bmod.py` |

The evaluation phase runs `bmod.py` from the repository root:

```bash
python3 .agents/skills/blender-modeler/scripts/bmod.py --where
```

It prints the Blender executable that the launcher selects. `BLENDER_EXE` overrides the search.

When a Blender-generated asset joins a Three.js scene, the rules are in [`AGENTS.md`](./AGENTS.md).

## 6. Where the documentation lives

| Question                                             | Document                                                                                         |
| :--------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| What are the Blender tools, and how are they called? | `.agents/skills/blender-mcp/SKILL.md`                                                            |
| What builds the model in the evaluation phase?       | `.agents/skills/blender-modeler/SKILL.md`, and `scripts/bmod.py`                                 |
| What are the rules for an agent that drives Blender? | [`AGENTS.md`](./AGENTS.md)                                                                       |
| What method does the project follow today?           | [`../threejs/README.md`](../threejs/README.md)                                                   |
| What does the fidelity ladder require in general?    | [`../../research/progressive-volume-modeling.md`](../../research/progressive-volume-modeling.md) |
