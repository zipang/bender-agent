# Bender: 3D model workflows

This repository is a test lab for 3D asset workflows. It builds one asset at a time from reference
images, and it keeps the evidence: the views, the numbers, and the renders.

The project holds **three modelling workflows**, and one of them is active. A reader works in one, so
each has its own folder, its own documents, and its own tools.

| Workflow | Folder | State | Used for |
| :--- | :--- | :--- | :--- |
| **Three.js** | [`workflows/threejs/`](./workflows/threejs/README.md) | **active** | A stylized asset with a locked blueprint, judged by its silhouette |
| **Blender** | [`workflows/blender/`](./workflows/blender/README.md) | inactive | Organic forms, a finished look, rigging, asset libraries |
| **vcad** | [`workflows/vcad/`](./workflows/vcad/README.md) | archived | A part that must fit, a mechanical assembly, a fabrication export |

Start with the active one. The other two describe what the project does not do, and why.

## The pipeline

All three workflows share the same two first stages, because all three read the same inputs.

```text
blueprints/drafts/<draft>/        subject/ and style/ images
  -> one reference image          an image model combines them
  -> blueprints/<category>/<subject>/reference.<ext>
  -> six orthographic views       one call per view, accepted by the art director
  -> dimensions.json              the real dimensions, and a scale per view and per axis
  -> the asset                    a workflow builds it
```

`blueprints/` stays at the root because every workflow reads it. So does the code that prepares it:
`scripts/blueprint-generate/`, `scripts/blueprint/`, and `scripts/measure/`.

The rule that decides where a file lives: **a workflow owns everything it runs, and the root owns
everything more than one workflow reads.**

## The repository

```text
.
├── .agents/skills/        local skills: one per tool or method
├── .opencode/agents/      the agent definitions
├── assets/img/            documentation images
├── blueprints/            the subject inputs and the generated views. Shared by every workflow
├── workflows/
│   ├── threejs/           the active workflow: viewer, scenes, tools, README, AGENTS
│   ├── blender/           README and AGENTS
│   └── vcad/              README, AGENTS, and the session export tool
├── scripts/               tools more than one workflow reads, plus the generator
├── research/              method documents, and what each experiment taught
├── tickets/               the Kanban board: planned, in_progress, review, done
├── test-reports/          what a check writes for a human: overlays and scratches. Git-ignored
├── opencode.jsonc         project configuration and MCP servers
├── AGENTS.md              the rules that hold for every workflow
└── README.md              this file
```

`test-reports/` is where a check writes what a human reads: the silhouette overlays, the scratch
captures, and the contact sheets. The Three.js workflow writes it, and no workflow commits it: it
rebuilds from a check at any time. `workflows/threejs/README.md` names each file it holds.

## Blueprints

Every subject and every draft lives in `blueprints/`, and the folder contract is in
[`blueprints/README.md`](./blueprints/README.md).

```text
blueprints/
  drafts/<draft>/          raw material. Not a subject. Never read by the view stage.
    subject/               what to model
    style/                 how to render it
  <category>/<subject>/
    reference.<ext>        the chosen identity image. Written by the art director
    source.<ext>           the identity bytes before a cleaning pass
    notes.md               camera and hidden-surface notes
    manifest.json          the generation log
    cropped/               the views cropped to their subject
    dimensions.json        the real dimensions, and the two scales of each view
    front/ left/ back/ right/ top/ bottom/
```

Categories are `vehicules`, `characters`, and `objects`.

A draft holds two kinds of image: `subject/`, which says what to model, and `style/`, which says how
to render it. One generation combines them into a reference on a uniform white field, and the art
director promotes the chosen candidate to `reference.<ext>`.

Generation reads `reference.<ext>` only. It never reads `source.<ext>`.

A new generation appends candidates with the next free counter. A rejected candidate stays in its
folder: there is no archive, because a rejected file is evidence about what the prompt produced.

## Subjects

| Subject | State |
| :--- | :--- |
| [`blueprints/vehicules/r5-tl-1972/`](./blueprints/vehicules/r5-tl-1972/) | Renault 5 TL 1972. Six views locked, dimensions from the manufacturer, body built in stage 2 |
| [`blueprints/vehicules/blue-and-white-minivan-01/`](./blueprints/vehicules/blue-and-white-minivan-01/) | Blue and white minivan with a roof surfboard. Reference and views generated, stage 1 not run |

## The Bender agent

> *"Bite my shiny metal `.glb`!"*

**Bender** is a double reference. It points to **Blender** and to **Bender Bending Rodríguez**, the
robot in *Futurama*. It is the agent of this project, and the conversational entry point for the
blueprint and modelling workflows.

- The definition: [`.opencode/agents/bender.md`](./.opencode/agents/bender.md).
- Two modes: a **primary agent**, selected in the interface, and a **subagent**, which another agent
  calls to delegate 3D work.

The skills it loads are in [`.agents/skills/`](./.agents/skills):

| Skill | Role |
| :--- | :--- |
| `volume-modelling` | The method: three gated stages, from the real dimensions to the accessories |
| `blueprint-preparation` | The reference workflow: one draft image, then six orthographic views |
| `threejs-web`, `threejs-*` | The Three.js API, and the glTF optimization rules |
| `agent-browser` | The capture loop: one page, driven from the shell |
| `blender-mcp`, `vcad` | The two inactive workflows |
| `technical-writing` | Simplified Technical English |

## MCP servers

Two servers are configured in [`opencode.jsonc`](./opencode.jsonc). The launch commands use absolute
paths, because the OpenCode service does not always inherit the shell `PATH`.

```bash
opencode mcp list
```

| Server | Command | Needs |
| :--- | :--- | :--- |
| `vcad` | `{env:HOME}/.bun/bin/bunx @vcad/mcp` | nothing else. The kernel is WASM |
| `blender` | `{env:HOME}/.local/bin/uvx mcp-for-blender` | a running Blender, with the add-on server started |

The Blender server reports `connected` even when Blender is closed. The tool call is the first thing
that says otherwise. Setup: [`workflows/blender/README.md`](./workflows/blender/README.md).

## Tickets

Work is a Kanban board, in `tickets/`. The board is [`tickets/README.md`](./tickets/README.md): the
folders, the ID rules, the ticket template, and the status of every ticket.

| Folder | Meaning |
| :--- | :--- |
| `tickets/planned/` | specified, and ready to pick up |
| `tickets/in_progress/` | being implemented |
| `tickets/review/` | implemented, and every gate green. Waits for the art director |
| `tickets/done/` | accepted and closed. The evidence stays beside the ticket |

| Ticket | Content |
| :--- | :--- |
| [`T0001`](./tickets/done/T0001-workflow-reorganisation.md) | One folder per workflow, each with its documents and tools. What was coupled, what moved, and the gates |
| [`T0002`](./tickets/done/T0002-contour-smoothing.md) | The contour staircase: the subpixel edge, the float opening, two emit modes, the contact sheet, and the knot editor |

## Research

What an experiment taught, in `research/`. A research document records a measurement and the rule it
produced, even when the method it describes has since been replaced.

| Document | Content |
| :--- | :--- |
| [`research/progressive-volume-modeling.md`](./research/progressive-volume-modeling.md) | The fidelity ladder from a bounding envelope to a finished asset, and the gates between the stages |
| [`research/threejs-modelling-loop.md`](./research/threejs-modelling-loop.md) | Why the CAD attempt failed, and the measured loop that replaced it |
| [`research/viewer-refactor-plan.md`](./research/viewer-refactor-plan.md) | One reusable page driven by `?scene=`, with one shared view table |
| [`research/blueprint-preparation-investigation.md`](./research/blueprint-preparation-investigation.md) | How an image model produces six consistent views from one reference |
| [`scripts/blueprint-generate/README.md`](./scripts/blueprint-generate/README.md) | The generator: draft, clean, and views. Options, folder contract, prompt templates, and the model filter |

## Glossary

- **Art director**: The human who accepts or rejects every generated image and every candidate. The project has no automatic visual validation.
- **Asset**: One 3D model, with its meshes, materials, and animations, ready for the web.
- **Bender**: The agent of this project. It is also the robot that the project models as a test case.
- **Blueprint candidate**: One generated image for one view, named `<model-slug>--<NN>.<ext>`. The art director picks one.
- **Blueprint package**: The reference image, the six accepted view images, and the generation manifest of one subject.
- **Calque**: A reference view placed in the scene as a plane, sized in metres from the two scales of that view. It is traced over, never rendered into a capture.
- **Contour**: The closed outline of one orthogonal view, in the local metres of that view's plate. It is a list of **knots**, joined by lines or by a smooth curve. It comes from the cropped file, and it is drawn over the reference picture. The contour volume reads it: change a knot, and the volume changes.
- **Crop**: A derived file `cropped/<view>.png`: a cut of the locked reference, with a small margin, identical to the same rectangle at the pixel. A crop never resamples, so the contour inherits the native resolution of the reference. Rebuild it at any time.
- **Design unit**: The unit of the numbers of a document. Metres for a game asset, millimetres for a machined part.
- **Draft**: Raw material in `blueprints/drafts/`. A draft is not a subject.
- **Envelope**: The coarse box that contains the target volume at the first step of the fidelity ladder.
- **Fidelity gate**: A number and a render that a stage passes before the next stage starts.
- **Knot**: A point of a contour that the outline passes through. The knots are the source of the contour, in `scenes/<subject>/contours.js`; two join modes, `poly` and `bezier`, read the same knots. A knot is not an off-curve handle.
- **Ladder**: The sequence of fidelity stages in [the method document](./research/progressive-volume-modeling.md).
- **Locked view**: A view folder that contains `reference.<ext>`. The generator skips a locked view.
- **Loon**: The compact S-expression language of vcad.
- **Marquee**: The selection rectangle the knot editor draws with `Shift` + left drag. Every knot of the view inside it joins the selection. It is transient, and it is never saved.
- **Mass**: One named volume of an object.
- **Orthographic view**: A view without perspective convergence. Parallel edges remain parallel.
- **Pass**: One iteration of the loop: render, compare, diagnose, change one thing.
- **Pivot**: The origin of a node. It is the centre of rotation for animation.
- **Reference**: The image `reference.<ext>` of a view, chosen by the art director. It is the identity of that view, and the generator never overwrites it. Its native size sets the resolution of the crop, the contour and the measured scale.
- **Scene**: One directory holding `scene.json` and `model.js`. The viewer renders it, and the browser loads the source with no build step.
- **Section**: The set of vertical columns of the body at one station along its length. It is the three-way intersection of one interval from each view.
- **Selection**: The set of knots the knot editor acts on as one object. It is transient: it is never written to `contours.js` and never enters the save payload. A drag on a selected knot moves the whole set; `Delete` removes it, unless fewer than three knots would remain.
- **Silhouette overlay**: A comparison image where red is present in the reference only, blue in the model only, and magenta in both.
- **Skill**: A folder with a `SKILL.md` file, holding instructions and helper files that an agent loads on demand.
- **Station**: One position along the length of the body, where a section is taken. The hull's lattice pitch is the distance between two stations.
- **STE**: Simplified Technical English. It is the writing standard of every document in this repository.
- **Ticket**: One unit of work on the Kanban board in `tickets/`. It has an ID `TNNNN`, a scope boundary, a contract, test-first tasks, and acceptance criteria. It moves through `planned/`, `in_progress/`, `review/`, and `done/`, and it never changes after it closes.
- **Workflow**: One way to build an asset, from the shared inputs to the same deliverable. This project holds three, and one is active.
- **Z-up / Y-up**: Blender and vcad use Z as the vertical axis. glTF and Three.js use Y.
