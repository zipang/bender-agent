# Workflow reorganisation plan

Status: **complete.** All seven steps passed their gates. This document records what was coupled,
what moved, and what each gate measured. The layout it describes is the one in place.

| Step | State | Commit |
| :--- | :--- | :--- |
| 0 Inventory | done | 2977f58 |
| 1 Workflow folders | done | 78d84d9 |
| 2 Three.js move | done | c786ffe |
| 3 Path repair | done | 87ba954 |
| 4 URL and API | done | 87ba954 |
| 5 Blender and vcad docs | done | e8f1bdb |
| 6 Root index | done | 33d289d |

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

**What shipped is simpler than what this section planned, and the plan is kept as written.**

As planned, the move made `?scene=` accept a path relative to the repository root, and kept a bare
name beside it:

```text
?scene=workflows/threejs/scenes/r5-tl-1972
?scene=r5-tl-1972        -> workflows/threejs/scenes/r5-tl-1972
```

Two spellings for one scene meant two things to keep in step, and the first one leaked: a bookmark
of the old `scenes/<name>` form failed with "resolves outside workflows/threejs/scenes/". Adding the
old form back as a third spelling would have settled the symptom and kept the cause.

So the end state is **one form**: the directory name.

```text
?scene=r5-tl-1972
```

A path is refused with a message that names the form, before it is resolved. The folder behind the
name is the resolver's business, not the caller's. `--scene` follows the same rule and lists the
known names when it gets one that does not exist.

The guard stays as planned: a scene outside the workflow's `scenes/` folder is refused.

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

`/scene/` was replaced by the real path. The rule in section 6 says a module is served at its real
path, and the model URL is built from the scene id, so an alias would have hidden the one thing a
failed import needs: where the file actually is. A scene module now answers at
`/workflows/threejs/scenes/<name>/<file>.js`, under a guard that refuses everything outside that
folder and every file that is not a module.

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
| 2 | Three.js move | `git mv viewer scenes` under `workflows/threejs/`, then `git mv scripts/scene` to `workflows/threejs/tools`, then split the five stage-1 tools into `scripts/blueprint/`. Gate: the files are at their new paths and no content has changed. **Done.** Thirty-four pure renames, 0 insertions, 0 deletions. |
| 3 | Path repair | Fix the root resolution, the view-table path, the scene-folder resolution, and the two `package.json` commands. Gate: `bun run serve` starts, `?scene=r5-tl-1972` opens, and all nine views capture byte-identical to the baseline. **Done.** `tools/paths.ts` holds the root once. Nine views identical, five IoU identical, `bun run check` runs end to end. |
| 4 | URL and API | Add the `/scene/` route, keep `/viewer/`, update the scene id and the client message. Gate: a scene module with a relative import loads, `baseline.json` stays unserved, and the API document reports the new paths. **Done**, and shipped inside the same commit as step 3: a route and its guard cannot be separated from the ids that feed it. `/scene/` became the real path, for the reason in section 4.2. |
| 5 | Blender and vcad docs | Write the two pairs of documents. vcad states that the project does not use it, and points at the reason. Gate: each document answers what the workflow does and where its tools are. **Done.** |
| 6 | Root index | The root `README.md` becomes an index: three workflows, which one is active, the shared inputs, the glossary. The root `AGENTS.md` keeps only the rules that hold for every workflow. Gate: no command line in the root document points at a moved path. **Done.** `workflows/threejs/README.md` holds the workflow chapter: the pipeline, the tool inventory, the artifact map, and the failure modes. |

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
| A capture fails with `window.__setView is not a function` | the pass wrote a render into the watched subject, and the page reloaded mid-capture | an output directory never reloads its own reader: `model/` is not watched |

## 7. What the move proved

An agent reads more than a `README.md`. The repair that the gate required covered three more
documents, and each one would have sent a reader to a path that does not exist:

| Document | What it is |
| :--- | :--- |
| `.opencode/agents/bender.md` | The agent definition: the workflow it describes, with its commands |
| `.agents/skills/volume-modelling/SKILL.md` | The method, with the commands of one modelling pass |
| `.agents/skills/vcad/SKILL.md` | The vcad tools, with the export command |

So the documentation duty of a move is wider than one file. A path that a document quotes is a
promise, and the promise is kept in every document that makes it.

The two research documents keep their old paths on purpose. They record a state at a date, and a
note at the top says so. Rewriting their paths would make a record claim to describe today.

## 8. Open points

- A workflow selector in the page. It needs the server to know more than one workflow, which is a
  feature, not a move.
- The shared stage-1 tools in `scripts/blueprint/`. They could become a package. Today they are
  scripts, and a package adds a build step the project does not want.
- `assets/img/`. It holds documentation images for the root document. A workflow that needs its own
  images should get its own `assets/`, and this plan does not decide that.
- The skills under `.agents/skills/`. They describe methods, not workflows. A skill that is used by
  one workflow could move under that workflow, and this plan leaves that decision open.
