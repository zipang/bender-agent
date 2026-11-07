# Workflow reorganisation plan

Status: planned. This document moves the Three.js workflow into one folder, and gives each of the
three modelling workflows its own documentation and its own tools. No step is done.

| Step | State | Commit |
| :--- | :--- | :--- |
| 0 Inventory | done | 2977f58 |
| 1 Workflow folders | planned | |
| 2 Three.js move | planned | |
| 3 Path repair | planned | |
| 4 URL and API | planned | |
| 5 Blender and vcad docs | planned | |
| 6 Root index | planned | |

## 1. Purpose

The repository holds three modelling workflows. One of them is active for a given project, and the
other two are not. Today a single root document describes all three, so a reader who works in one
workflow reads two that he does not use, and the document becomes a survey that serves none.

The Three.js workflow is also scattered. It lives in three sibling folders:

| Folder | Content |
| :--- | :--- |
| `viewer/` | the shared page, its modules, and the view table |
| `scenes/` | one directory per subject, with `scene.json` and `model.js` |
| `scripts/scene/` | the tools: server, API, capture, trace, silhouette comparison |

A reader cannot tell that these three are one workflow, and a move of one without the others
breaks the workflow in a way that the folder names do not predict.

## 2. Current state, measured

### 2.1 Folder inventory

```text
.agents/skills/            local skills. One per tool or method.
.opencode/agents/          the agent definitions
assets/img/                documentation images
blueprints/                the subject inputs, shared by every workflow
research/                  method documents and investigations
scripts/                   the tools, mixed by workflow
scenes/                    Three.js scenes
viewer/                    the Three.js page
tickets/                   work to be done
```

### 2.2 Which scripts belong to which workflow

| Script | Workflow | Role |
| :--- | :--- | :--- |
| `scripts/scene/serve.ts` | Three.js | the dev server and the API |
| `scripts/scene/api.ts` | Three.js | the scene API |
| `scripts/scene/ctl.ts` | Three.js | drive the live page |
| `scripts/scene/shot.ts` | Three.js | capture the named views |
| `scripts/scene/check.ts` | Three.js | capture, overlay, measure, guard |
| `scripts/scene/silhouette.ts` | Three.js | the overlay of a render on a reference |
| `scripts/scene/compare_silhouette.py` | Three.js | the binary mask comparison |
| `scripts/scene/trace_hull.py` | Three.js | the silhouette trace and the hull |
| `scripts/vcad-render/export.ts` | vcad | the session export and the renders |
| `scripts/blueprint-generate/` | shared | stage 0 and the view generation |
| `scripts/measure/` | shared | stage 1, the point picker |
| `scripts/scene/crop_reference.py` | shared | stage 1, the crop |
| `scripts/scene/view_scale.py` | shared | stage 1, the scales and the gate |
| `scripts/scene/measure_view.py` | shared | stage 1, the landmarks of two images |
| `scripts/scene/read_reference.py` | shared | stage 1, read a reference into a profile |

The last five are stage 1. Every workflow reads a cropped, calibrated set of views, so these tools
are not Three.js tools. They move to their own folder, not into the workflow.

### 2.3 Path dependencies

These are the couplings a move must repair. Each one is measured, not estimated.

| Coupling | Where | What breaks |
| :--- | :--- | :--- |
| Repo root | `serve.ts`, `check.ts`: `resolve(import.meta.dir, "../..")` | one level short for a deeper tool folder |
| View table | `shot.ts`, `export.ts`: `resolve(import.meta.dir, "../../viewer/views.json")` | a second relative path to repair |
| Scene route | `serve.ts`: `/scenes/` serves `.js` under `root/scenes` | the route and the guard both name the folder |
| Scene resolution | `api.ts`: `join("scenes", requested)` and `isInside(root/scenes)` | scene names are resolved against a fixed folder |
| Scene id | `api.ts`: `relative(join(root,"scenes"), dirAbs)`, and `dir: "scenes/" + name` | the id and the published path |
| Capture list | `check.ts`: `readdir(root/scenes)` and `"scenes/" + name` | scene discovery |
| Viewer route | `serve.ts`: `/viewer/` maps to `root/viewer` | the shared page URL |
| Client message | `viewer/api.js`: `?scene=scenes/<name>` | a message that names a folder |
| Scene subject | `scenes/*/scene.json`: `"subject": "blueprints/..."` | none. The path is repo-relative, so a deeper scene folder keeps it valid. |
| Package scripts | `package.json`: `serve` and `check` | two commands |
| Documents | `README.md`, `AGENTS.md`, `bender.md`, `volume-modelling/SKILL.md` | many command lines |

The scene subject path is the good news. `scene.json` holds a repo-relative subject, and nothing in
a scene reaches into `blueprints/` by a relative path. So `scenes/` can move without touching a
single subject.

## 3. Target layout

```text
workflows/
  threejs/
    README.md              the workflow: pipeline, tools, artifacts, gates
    AGENTS.md              the rules for an agent that works here
    viewer/                the page, its modules, views.json
    scenes/                one directory per subject
    tools/                 serve, api, ctl, shot, check, silhouette, trace_hull
  blender/
    README.md
    AGENTS.md
    tools/                 empty today
  vcad/
    README.md              archived: the project does not use vcad
    AGENTS.md
    tools/                 export.ts, moved from scripts/vcad-render
scripts/
  blueprint/               crop_reference, view_scale, measure_view, read_reference
  blueprint-generate/      stage 0, unchanged
  measure/                 the point picker, unchanged
blueprints/                unchanged, shared by every workflow
research/                  unchanged
tickets/                   unchanged
```

The rule that makes this layout hold: **a workflow owns everything it runs, and the root owns
everything more than one workflow reads.**

`blueprints/` stays at the root because every workflow reads it. `scripts/blueprint/` stays at the
root for the same reason. A tool that only the Three.js workflow runs lives under
`workflows/threejs/tools/`.

## 4. Contracts after the move

### 4.1 The scene identifier

Today `?scene=` accepts `scenes/<name>` and resolves it against a fixed folder. After the move it
accepts a path relative to the repository root:

```text
?scene=workflows/threejs/scenes/r5-tl-1972
```

A bare name still works, and the server resolves it against the workflow's own `scenes/` folder:

```text
?scene=r5-tl-1972        -> workflows/threejs/scenes/r5-tl-1972
```

The guard changes with it. The check is no longer "inside `scenes/`" but "inside the scene folder of
the running workflow". A scene outside it is refused, as a traversal attempt is refused today.

### 4.2 The served routes

| Route | Serves |
| :--- | :--- |
| `/` | redirect to the viewer, with the scene of `--scene` |
| `/viewer/*` | `workflows/threejs/viewer/*`, unchanged as a public path |
| `/scene/*.js` | the modules of the running scene, so a relative import resolves |
| `/vendor/three/*` | the `three` package, unchanged |
| `/api/*` | the scene API, unchanged |
| `/repo/*` | read-only files under the repository root |
| `/measure/` | the point picker, unchanged |

The public path `/viewer/` stays, though the folder moves. A capture and a document both name a URL,
and changing it for a folder rename is churn with no benefit. The server maps the URL to the new
folder in one line.

### 4.3 The dev commands

```bash
bun run serve          # from the root, unchanged
bun run check          # from the root, unchanged
```

`package.json` keeps the same two names, and its commands point at the new paths. A workflow-local
command is a convenience, and the root command is the one the documents quote.

## 5. Migration plan

No step starts before the previous one passes its gate. The repository must serve the R5 scene at
every step, so a failure is visible at once.

| # | Step | Content |
| :--- | :--- | :--- |
| 0 | Inventory | Record the scene list, the view table hash, and one capture per named view as the baseline. Gate: the baseline renders and the IoU is recorded. **Done.** `tickets/reorg-baseline.json` holds the nine sha256, the model numbers, the five IoU values, the five API answers, and the four guards. |
| 1 | Workflow folders | Create `workflows/threejs`, `workflows/blender`, `workflows/vcad` with an empty `README.md` and `AGENTS.md` each. Gate: nothing else changes, and the server still runs. |
| 2 | Three.js move | `git mv viewer scenes` under `workflows/threejs/`, then `git mv scripts/scene` to `workflows/threejs/tools`, then split the five stage-1 tools into `scripts/blueprint/`. Gate: the files are at their new paths and no content has changed. |
| 3 | Path repair | Fix the root resolution, the view-table path, the scene-folder resolution, and the two `package.json` commands. Gate: `bun run serve` starts, `?scene=r5-tl-1972` opens, and all nine views capture byte-identical to the baseline. |
| 4 | URL and API | Add the `/scene/` route, keep `/viewer/`, update the scene id and the client message. Gate: a scene module with a relative import loads, `baseline.json` stays unserved, and the API document reports the new paths. |
| 5 | Blender and vcad docs | Write the two pairs of documents. vcad states that the project does not use it, and points at the reason. Gate: each document answers what the workflow does and where its tools are. |
| 6 | Root index | The root `README.md` becomes an index: three workflows, which one is active, the shared inputs, the glossary. The root `AGENTS.md` keeps only the rules that hold for every workflow. Gate: no command line in the root document points at a moved path. |

### 5.1 Gates

| Gate | Check |
| :--- | :--- |
| Scene identity | `size`, `triangles`, `target`, `deviation` unchanged after the move |
| Capture | Nine views byte-identical to the step-0 baseline |
| Silhouette | IoU identical to the step-0 values |
| API | `/api/scene`, `/api/asset`, `/api/model`, `/api/scenes`, `POST /api/measure` all answer |
| Guards | A scene outside the workflow folder is 403, a missing one is 404, and a traversal is 403 |
| Documents | No document quotes a command that does not run |
| No stray folder | The root holds no workflow-specific folder after step 2 |

### 5.2 What the move must not do

- It must not change a model, a material, or a section. A move that also edits geometry cannot be
  judged.
- It must not rename a scene. A scene id appears in `baseline.json`, in a document, and in a
  capture command.
- It must not delete the vcad code. vcad is unused, not wrong. `workflows/vcad/` keeps its export
  tool, and its document says why the project does not use it.

## 6. Failure modes to keep

| Symptom | Cause | Rule |
| :--- | :--- | :--- |
| The server starts and serves an empty page | the root resolution points one level too high | the root is computed once, in one module |
| A capture writes a blank image | the view table moved | the table is resolved from one place |
| A scene module fails to import | a relative import resolved against `/api/` | modules are served at a real path |
| A traversal reaches a file outside the tree | the guard names a folder that moved | the guard names the running workflow's folder |
| The documents quote a command that fails | the move did not update them | a move updates the documents in the same commit |
| Two workflows share a tool | the tool was placed by convenience | a tool that one workflow runs lives in that workflow |

## 7. Open points

- A workflow selector in the page. It needs the server to know more than one workflow, which is a
  feature, not a move.
- The shared stage-1 tools in `scripts/blueprint/`. They could become a package. Today they are
  scripts, and a package adds a build step the project does not want.
- `assets/img/`. It holds documentation images for the root document. A workflow that needs its own
  images should get its own `assets/`, and this plan does not decide that.
- The skills under `.agents/skills/`. They describe methods, not workflows. A skill that is used by
  one workflow could move under that workflow, and this plan leaves that decision open.
