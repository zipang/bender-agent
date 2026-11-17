# T0014 — The root tool directory: `scripts/` becomes `tools/`

- **Track**: Repository layout, every workflow
- **Wave**: 1 (independent)
- **Depends on**: nothing
- **Blocks**: T0015
- **Owner**: coding sub-agent, supervised by CTO
- **Started**: 2026-11-17
- **Closed**: 2026-11-17
- **References**:
    - [`AGENTS.md`](../../AGENTS.md) — the placement rule, and the file rules
    - [`README.md`](../../README.md) — the repository tree, the tool table, and the glossary
    - [`workflows/threejs/AGENTS.md`](../../workflows/threejs/AGENTS.md) — the server and path rules
    - [`tickets/done/T0001-workflow-reorganisation.md`](../done/T0001-workflow-reorganisation.md) — the last layout pass, and its evidence

## Context & Goal

The Qwen 3D Coder workflow needs a scene viewer, and that viewer must be **shared** by two
workflows. The root owns what more than one workflow reads. The viewer therefore belongs to the root,
not to `workflows/qwen3d-coder/`.

The root folder for shared code is `scripts/`, but the code it holds is a set of tools: the blueprint
generator, the blueprint readers, and the measurement picker. The name is wrong, and the new viewer
would make it more wrong. The art director decided on 2026-11-17: rename `scripts/` to `tools/`.

**Done means** the folder is `tools/`, no live file names the old path, and nothing behaves
differently.

## Scope Boundary

**Move, with `git mv`, 18 files:**

```text
tools/blueprint/crop_reference.py
tools/blueprint/measure_view.py
tools/blueprint/read_reference.py
tools/blueprint/view_scale.py
tools/blueprint-generate/blueprint-generate.ts
tools/blueprint-generate/bun.lock
tools/blueprint-generate/package.json
tools/blueprint-generate/tsconfig.json
tools/blueprint-generate/README.md
tools/blueprint-generate/lib/drafts.ts
tools/blueprint-generate/lib/models.ts
tools/blueprint-generate/lib/prompts.ts
tools/blueprint-generate/lib/subjects.ts
tools/blueprint-generate/prompts/blueprint.md
tools/blueprint-generate/prompts/clean.md
tools/blueprint-generate/prompts/draft.md
tools/measure/index.html
tools/measure/report.py
```

**Create:** `tools/layout.test.ts`, the regression gate of this rename.

**Modify, for the path only** — no behavior change:

| File                                                                    | What changes                                                                                                  |
| :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `README.md`                                                             | the repository tree, the pipeline paragraph, the tool table link                                              |
| `workflows/threejs/README.md`                                           | the pipeline path, the commands, the tool table, the sentence that places those tools, the FAQ link           |
| `workflows/threejs/AGENTS.md`                                           | the server and path rules: `workflows/threejs/tools/` for that workflow, the root `tools/` for every workflow |
| `workflows/threejs/tools/serve.ts`                                      | the `/measure/` route                                                                                         |
| `workflows/threejs/tools/api.ts`                                        | one error message                                                                                             |
| `workflows/threejs/tools/check.ts`                                      | the `measure_view.py` path                                                                                    |
| `workflows/threejs/tools/check.test.ts`                                 | one comment                                                                                                   |
| `.opencode/agents/bender.md`                                            | four `cd` commands, one tool path                                                                             |
| `.agents/skills/blueprint-preparation/SKILL.md`                         | six paths                                                                                                     |
| `.agents/skills/blueprint-preparation/references/prompts.md`            | one path                                                                                                      |
| `.agents/skills/blueprint-preparation/references/capability-sources.md` | one path                                                                                                      |
| `.agents/skills/blueprint-preparation/references/model-candidates.md`   | one `cd` command                                                                                              |
| `.agents/skills/volume-modelling/SKILL.md`                              | every path, and the tool table                                                                                |
| `.agents/skills/vcad/reference/server-instructions-0.11.0-main.138.md`  | one regeneration path                                                                                         |
| `tools/blueprint-generate/README.md`                                    | its own commands                                                                                              |
| `tools/blueprint-generate/blueprint-generate.ts`                        | the root comment, two default template paths, two `template:` lines                                           |
| `tools/blueprint/*.py`, `tools/measure/report.py`                       | the usage lines in their doc comments                                                                         |

**Do not touch, on purpose:**

- `tickets/**` — every ticket is a record, and `tickets/README.md` quotes `scripts/llama-server/` as
  history of T0011. A record keeps the path that was true when it was written.
- `research/**` — investigation records.
- `blueprints/**/manifest.json` — provenance of a generation. The path was true at generation time.
- `.agents/skills/use-bun/**` — Bun's own documentation, which names its `scripts/` folder.
- `workflows/blender/README.md` line 38 — Blender's own `~/.config/blender/<version>/scripts/addons/`.
- `node_modules/**`.

## Contract

- `scripts/` does not exist. The root `tools/` holds exactly `blueprint/`, `blueprint-generate/`, and
  `measure/`, plus the new `layout.test.ts`. It is not the same folder as `workflows/<name>/tools/`:
  a workflow tool stays in its workflow, and a tool that several workflows read lives at the root.
- Every moved file keeps its relative suffix: `tools/blueprint/view_scale.py`, and so on.
- `tools/blueprint-generate/blueprint-generate.ts` resolves the repository root with
  `import.meta.dir` and `../..`. The move keeps the depth, so the value does not change.
- The Three.js server serves `/measure/` from `tools/measure/index.html`, and spawns
  `tools/blueprint/measure_view.py`.
- The default template paths printed by the generator are
  `tools/blueprint-generate/prompts/blueprint.md` and
  `tools/blueprint-generate/prompts/clean.md`.

### `tools/layout.test.ts`

The test walks the live tree from the repository root. It reads every file with one of these
extensions: `.ts`, `.js`, `.mjs`, `.cjs`, `.py`, `.md`, `.json`, `.html`.

It skips these prefixes, which hold records or third-party text:

```text
.git/  node_modules/  .tmp/  test-reports/
tickets/  research/  blueprints/
.agents/skills/use-bun/
```

It skips one file: `workflows/blender/README.md`.

It asserts:

1. `scripts/` does not exist.
2. `tools/blueprint-generate/blueprint-generate.ts`, `tools/blueprint/view_scale.py`, and
   `tools/measure/index.html` exist.
3. No live file contains the literal `scripts/`.

The needle is built at run time from two fragments, `["scri", "pts/"].join("")`, so the test file
cannot match itself.

## TDD Tasks

- [x] **T14.1 — The layout gate**: write `tools/layout.test.ts` first. It fails on the current tree:
      `scripts/` exists, `tools/layout.test.ts` is under the folder it tests, and live files still
      name the old path. Confirm the failure names the old path.
- [x] **T14.2 — The move**: `git mv scripts tools`. Confirm `git status` shows 18 renames.
- [x] **T14.3 — The references**: update every file in the table above. Run the layout test until it
      is green. A remaining hit is a real reference, never a reason to widen the skip list.
- [x] **T14.4 — The gates**: `bun run format`; `bun test` (the whole repository, including the new
      layout test); start the Three.js server and request `/measure/`; confirm `200`. Record the exact
      output in `## Implementation Notes`.

## Acceptance Criteria

- `ls scripts` fails, and `ls tools` lists `blueprint`, `blueprint-generate`, `measure`, and
  `layout.test.ts`.
- No live file names `scripts/`. The layout test proves it.
- `bun test` is green, and its count includes the new layout test.
- `bun run workflows/threejs/tools/serve.ts --scene r5-tl-1972 --port 5180` starts, and
  `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5180/measure/` prints `200`.
- `git status --porcelain` shows `R` for the 18 moved files, and no content-only diff on them beyond
  the documented path lines.

## Implementation Notes

### Decisions

- **The test came first, and it failed on the old tree.** `tools/layout.test.ts` was written before
  the move. Its needle is built at run time, `["scri", "pts/"].join("")`, so the file cannot match
  itself. The skip list is exactly the eight prefixes and the one file of the contract; no entry was
  added.
- **The order of T14.1 and T14.2.** The test must live at `tools/layout.test.ts`, so `tools/` exists
  before the move. `git mv scripts tools` with `tools/` present would nest the folder as
  `tools/scripts`. So the file went to `.tmp/layout.test.ts` (a prefix the test skips), the empty
  `tools/` was removed with `rmdir`, `git mv scripts tools` ran on a clean destination, and the file
  came back to `tools/layout.test.ts`. Git sees 18 renames and one new file.
- **Path substitution, then table alignment.** `scripts/` became `tools/` in every file of the
  table. Three Markdown tables lost three characters per shortened cell, so the padding of the
  changed rows was restored: the root `README.md` tree and research row, the Three.js tool table and
  its FAQ row, and the `volume-modelling` file table. Only whitespace inside those cells changed.
- **Two sentences that the rename made ambiguous.** In `workflows/threejs/AGENTS.md`, "lives under
  `tools/`" now clashed with the root `tools/`. It reads: a tool that only this workflow runs lives
  in `tools/`, beside this file; a tool that every workflow reads lives in the root `tools/`. The
  same clarification is in the sentence that places the shared tools in `workflows/threejs/README.md`.
- **No behavior change.** `blueprint-generate.ts` keeps `import.meta.dir` and `../..`, and the depth
  is the same. Only string literals, comments, and document paths changed.

### T14.1 — the failing run, before the move

```text
$ bun test tools/layout.test.ts
bun test v1.4.4 (38afee6c8)

tools/layout.test.ts:
error: expect(received).toEqual(expected)

- []
+ [
+   "scripts/ still exists at the repository root",
+ ]

(fail) the root tool folder > the old folder is gone [7.75ms]

error: expect(received).toEqual(expected)

- []
+ [
+   "tools/blueprint-generate/blueprint-generate.ts does not exist",
+   "tools/blueprint/view_scale.py does not exist",
+   "tools/measure/index.html does not exist",
+ ]

(fail) the root tool folder > the moved tools are at the new path [0.34ms]

error: expect(received).toEqual(expected)

- []
+ [
+   ".agents/skills/blueprint-preparation/SKILL.md:130: cd scripts/blueprint-generate",
+   ...
+   "workflows/threejs/README.md:450: | `scripts/measure/report.py`           | the picked points ...",
+ ]

(fail) the root tool folder > no live file names the old path

 0 pass
 3 fail
 3 expect() calls
Ran 3 tests across 1 file. [24.00ms]
```

The three failures name the old path. The third one lists every live hit with its file and line.

### T14.2 — the move

```text
$ git mv scripts tools
$ git status --porcelain | grep -c '^R'
18
```

The 18 staged entries are `R` from `scripts/...` to `tools/...`, one per file of the scope boundary.

### T14.3 — the references

82 occurrences of the old path, on 76 lines, in 21 files. The layout test then printed:

```text
 3 pass
 0 fail
 3 expect() calls
Ran 3 tests across 1 file. [23.00ms]
```

### T14.4 — the gates

```text
$ bun run format
$ bun fmt
Formatted 0 files, 158 unchanged [35.50ms]

$ bun test
bun test v1.4.4 (38afee6c8)

 146 pass
 0 fail
 319 expect() calls
Ran 146 tests across 12 files. [125.00ms]

$ bun run workflows/threejs/tools/serve.ts --scene r5-tl-1972 --port 5180
scene   /home/zipang/Workspace/projects/bender-agent/workflows/threejs/scenes/r5-tl-1972
three   /home/zipang/Workspace/projects/bender-agent/node_modules/three
url     http://127.0.0.1:5180/
watch   on, reload through /__reload

$ curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5180/measure/
200
```

The body of `/measure/` is the point picker, served from `tools/measure/index.html`. The server was
stopped afterwards, and port 5180 is closed (`000`).

The baseline was 143 tests in 11 files. This run has 146 in 12: the new `tools/layout.test.ts` adds
three tests. `bun run check`, `python3 tools/blueprint/*.py`, and
`tools/blueprint-generate/blueprint-generate.ts` were **not** run: this environment lacks `numpy`
and the generator's `node_modules`, and both failures predate this ticket. The diff was read instead:
every changed line is a path, a comment about a path, document padding, or the two clarified
sentences above.

### Where the ticket and the tree did not agree

- **`workflows/threejs/README.md`** — the row names five changes; the file holds thirteen hits. Two
  prose mentions were not named by the row: the run-propagation paragraph (§10.1) and the sentence
  before it, both naming `measure_view.py`. They were changed with the rest: same path, no new scope.
- **`README.md`** — the row says "the tool table link", but the root `README.md` has no tool table.
  The hit is the last row of the **Research** table, which links the generator's `README.md`. The
  tree and the pipeline paragraph are the other two hits, as the row says.
- **`tools/measure/report.py`** — the row says "the usage lines in their doc comments". The file also
  has a `SystemExit` message on line 138 that names `view_scale.py`. It is the same path fix, inside
  a scoped file.
- **`.agents/skills/blueprint-preparation/SKILL.md`** — the row says "six paths"; the file has eight
  occurrences (four prompt paths, two `cd` commands, and two in the file list).
- **`workflows/threejs/AGENTS.md`** — the row describes rules for "`workflows/threejs/tools/` for that
  workflow, the root `tools/` for every workflow". Only the second bullet carried the old path, and
  after the substitution both bullets said `tools/`. Both were reworded, as recorded above.

Nothing outside the scope boundary changed. `tickets/README.md` already had an unstaged edit before
this pass; it was not touched. No commit was made, and the ticket stays in `tickets/in_progress/`.

### Polish round

Five fixes from the review. All of them stay inside files this ticket already changed.

1. **The positional row count.** "The last five rows" became seven when the rename added two rows to
   the root group, and a position breaks on the next inserted row. The sentence now names the rows by
   what they are: "The rows above that name the root `tools/` prepare a reference, and every workflow
   needs them. They stay under the root `tools/`, not under this folder."
2. **The two `tools/` folders in §1.** `tools/serve.ts` in that file is the workflow folder, so the
   bare list read as workflow-relative. The sentence now names the root once: "the root `tools/`
   holds `blueprint-generate/`, `blueprint/` and `measure/`, the tools that prepare them."
3. **The false regeneration clause, a deliberate deviation.** The vcad reference header said to
   regenerate "with `tools/blueprint-generate` doc capture". That feature does not exist:
   `grep -n capture tools/blueprint-generate/*.ts` returns nothing. The ticket already rewrote that
   line, so a path-only edit would have kept a false instruction alive. The clause is dropped, and the
   honest half stays: "Regenerate by asking the server for `initialize` and copying its `instructions`
   field." The header is authored text; the captured body below the `---` is untouched.
4. **The extension comment.** "The extensions a live file can carry" was false: `.jsonc`, `.toml`,
   `.yml`, `.sh`, `.lock`, and `.gitignore` exist in this tree. The comment now says "The extensions
   this gate reads", and the line above the array states that the set is the list in the T0014
   contract, so a wider set is a ticket change and not a local fix. The task number left the file
   header; the ticket ID and the reason stay.
5. **The failure carries the remedy.** A hit now prepends one line: "N live file(s) name the old path.
   Fix the path; never widen the skip list." `N` counts distinct files, not lines. The line was seen
   to fire: a temporary probe file at the root produced

    ```text
    + [
    +   "1 live file(s) name the old path. Fix the path; never widen the skip list.",
    +   ".layout-probe.md:1: probe: names scripts/ once",
    + ]
    (fail) the root tool folder > no live file names the old path [18.60ms]
    ```

    The probe was deleted immediately, and `git status --porcelain` does not show it.

#### Gate output after the polish

```text
$ bun fmt
Formatted 0 files, 158 unchanged [62.02ms]

$ bun test tools/layout.test.ts
bun test v1.4.4 (38afee6c8)

 3 pass
 0 fail
 3 expect() calls
Ran 3 tests across 1 file. [23.00ms]

$ bun test
bun test v1.4.4 (38afee6c8)

 146 pass
 0 fail
 319 expect() calls
Ran 146 tests across 12 files. [116.00ms]
```

No task was checked off and no task was added. Nothing is committed, and the git index is unchanged
since the 18 staged renames.
