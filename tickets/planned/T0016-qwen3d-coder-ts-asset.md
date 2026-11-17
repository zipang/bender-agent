# T0016 — The Qwen 3D Coder delivers a TypeScript asset

- **Track**: Qwen 3D Coder workflow (drafter, prompts, agent instructions)
- **Wave**: 2 (integration)
- **Depends on**: T0013 (the prompt system and the text mode), T0015 (the asset contract and the viewer)
- **Blocks**: nothing
- **References**:
    - the asset contract of
      [`tickets/planned/T0015-scene-viewer.md`](./T0015-scene-viewer.md), §1 — the single source of
      the module shape
    - [`workflows/qwen3d-coder/README.md`](../../workflows/qwen3d-coder/README.md) — the commands and
      the request
    - [`workflows/qwen3d-coder/AGENTS.md`](../../workflows/qwen3d-coder/AGENTS.md) — the prompt and
      candidate rules
    - [`workflows/qwen3d-coder/tools/scene-draft.ts`](../../workflows/qwen3d-coder/tools/scene-draft.ts)
      — the CLI to rename and to change
    - [`workflows/qwen3d-coder/tools/lib/extract.ts`](../../workflows/qwen3d-coder/tools/lib/extract.ts)
      — the HTML extractor to replace
    - [`workflows/qwen3d-coder/tools/lib/candidates.ts`](../../workflows/qwen3d-coder/tools/lib/candidates.ts)
      — the counter, and the `O_EXCL` write
    - [`tickets/in_progress/T0013-prompt-system-and-text-mode.md`](../in_progress/T0013-prompt-system-and-text-mode.md)
      — the prompt system this ticket changes
    - `Bun.Transpiler`, `new Bun.Transpiler({ loader: "ts" })` and `.transformSync()`:
      <https://bun.com/docs/api/transpiler>
    - `Object3D.isObject3D`, `traverse()`, and `Box3.setFromObject()`:
      <https://threejs.org/docs/#api/en/core/Object3D> and
      <https://threejs.org/docs/#api/en/math/Box3>
    - `import()` of a local file in Bun:
      <https://bun.com/docs/runtime/modules>
    - `pathToFileURL()`:
      <https://nodejs.org/api/url.html#urlpathtofileurlpath>

## Context & Goal

The Qwen 3D Coder was asked to write a whole page. It wrote a renderer, a camera, a light rig, a
ground, an overlay, and an auto-orbit, and no two candidates could be compared. The art director
decided on 2026-11-17: **the model delivers an asset, and the repository draws it**.

T0015 built the page. This ticket changes the deliverable. The model now returns **one standalone
TypeScript file**: it imports `three` only, and its default export is a function that returns one
object. The page imports that file, and the art director judges the object, not the page.

**Done means** one command writes `<name>--01.ts` beside the subject, the drafter checks the module
it wrote, and one viewer command shows it.

## Decisions

- **D1 — The HTML output is removed.** The workflow no longer produces a page. The drafter becomes
  `tools/asset-draft.ts`, and the extractor becomes a module extractor. The `demos/*.html` files stay:
  they are the record of the pre-T0016 mode.
- **D2 — The system prompt changes, and this supersedes T0013 D7.** T0013 kept the model card's
  system text because the deliverable was the card's HTML. The deliverable changed, so a three-line
  HTML runtime would contradict it. The new system prompt is four lines and states the module
  runtime only. A test asserts it byte for byte.
- **D3 — The user turn carries the subject.** The subject, the style, the details, the asset name,
  the real size, and the prohibition list go into the user turn, in short lines. A prompt file stays
  under twenty lines.
- **D4 — The candidate counter stays.** The file is `<name>--<NN>.ts`, and the counter file is
  `.qwen3d-coder-asset.counter`. A run never overwrites a candidate.
- **D5 — The extractor is strict.** A response must hold a fenced TypeScript block. No block means
  exit `4`, and nothing is written.
- **D6 — The drafter checks what it wrote.** It imports the candidate, calls `build()`, and checks
  the result. It reports `valid` or `invalid: <reason>`. It never edits and never deletes a
  candidate.
- **D7 — The viewer is the review page.** The drafter prints the exact viewer command for every valid
  candidate. Bender never asks the model for a page, a camera, or a light.

## Scope Boundary

**Rename with `git mv`:**

```text
workflows/qwen3d-coder/tools/scene-draft.ts        -> tools/asset-draft.ts
workflows/qwen3d-coder/tools/scene-draft.test.ts   -> tools/asset-draft.test.ts
workflows/qwen3d-coder/prompts/3d-coder-system.txt -> prompts/asset-system.txt
```

**Create:**

```text
workflows/qwen3d-coder/tools/lib/validate.ts
workflows/qwen3d-coder/tools/lib/validate.test.ts
workflows/qwen3d-coder/tools/fixtures/valid-asset.ts
workflows/qwen3d-coder/tools/fixtures/not-an-asset.ts
workflows/qwen3d-coder/tools/fixtures/broken-asset.ts
```

**Modify:**

| File                                                  | What changes                                                                                                          |
| :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `workflows/qwen3d-coder/tools/asset-draft.ts`         | `--name`, the asset write, the validation, exit `6`, the viewer line                                                  |
| `workflows/qwen3d-coder/tools/asset-draft.test.ts`    | the renamed entry point, and the new cases                                                                            |
| `workflows/qwen3d-coder/tools/lib/extract.ts`         | `extractTs` and `NoModuleError` replace the HTML pair                                                                 |
| `workflows/qwen3d-coder/tools/lib/extract.test.ts`    | the new cases                                                                                                         |
| `workflows/qwen3d-coder/tools/lib/candidates.ts`      | the name parameter, the `.ts` suffix, and the new counter file                                                        |
| `workflows/qwen3d-coder/tools/lib/candidates.test.ts` | the new names and the new counter                                                                                     |
| `workflows/qwen3d-coder/tools/lib/prompt.ts`          | the asset blocks, the name, and the new system path                                                                   |
| `workflows/qwen3d-coder/tools/lib/prompt.test.ts`     | the new text, and the twenty-line limit                                                                               |
| `workflows/qwen3d-coder/prompts/asset-system.txt`     | the four-line asset runtime                                                                                           |
| `workflows/qwen3d-coder/prompts/subjects/*.txt`       | the two prompt files, rewritten for an asset                                                                          |
| `workflows/qwen3d-coder/README.md`                    | the deliverable, the commands, the flags, the exit codes, the review step, the folder tree, the system-prompt section |
| `workflows/qwen3d-coder/AGENTS.md`                    | the workflow goal, the prompt rules, the system-prompt rule, and the candidate rules                                  |
| `.opencode/agents/bender.md`                          | Workflow E, and expertise item 6                                                                                      |
| `README.md`                                           | the workflow table row, and the glossary entry                                                                        |
| `demos/README.md`                                     | one note: the HTML demos are the pre-T0016 record                                                                     |

**Do not touch:**

- `workflows/qwen3d-coder/tools/lib/client.ts` and `endpoint.ts` — the sampling values and the
  preflight are settled.
- `workflows/qwen3d-coder/tools/lib/{candidates,extract}.ts` beyond the changes above.
- `tools/scene-viewer/**` — T0015 owns it.
- `workflows/threejs/**`, `workflows/blender/**`, `workflows/vcad/**`.
- `blueprints/**` — the drafter writes there only at run time.
- `tickets/done/**`, `tickets/review/**`, and the in-progress T0013 — records.

No shared file is append-only.

## Contract

### 1. The command

```bash
bun run workflows/qwen3d-coder/tools/asset-draft.ts \
  --subject blueprints/<category>/<subject> \
  --style "<style>" \
  --name <slug> \
  --variants <n> \
  [--prompt "<request>"] [--image]
```

```bash
bun run workflows/qwen3d-coder/tools/asset-draft.ts \
  --prompt-file workflows/qwen3d-coder/prompts/subjects/<slug>.txt \
  --out <dir> \
  --name <slug> \
  --variants <n>
```

`--name` is optional:

- in subject mode, the default is the subject folder name;
- in text mode, the default is the prompt file base name, without `.txt`.

The resolved name must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. A violation exits `1`.

`--name` joins the existing flags. `--prompt-file` and `--subject` stay exclusive. `--image` still
needs a subject. `--ask` sends nothing, and it now also reports an invalid name.

### 2. The output

```text
blueprints/<category>/<subject>/generated/<name>--<NN>.ts   subject mode
<out>/<name>--<NN>.ts                                       text mode
```

- The counter file is `.qwen3d-coder-asset.counter`.
- The next number is `max(counter, maximum present) + 1`.
- A write uses `O_EXCL`, and it never overwrites.
- The write creates the folder when it is missing.
- The suffix is `.ts`, and the prefix is the resolved name.

### 3. The system prompt (`prompts/asset-system.txt`)

Exactly these four lines, and a test compares the file byte for byte:

```text
Use only the Three.js core ES module, imported as `three`.
Write one standalone TypeScript module, and nothing else: no HTML, no addons, no examples/js path.
Export one function as the default export; it builds and returns one THREE.Object3D.
Build no camera, renderer, light, ground, grid, background, fog, or animation.
```

### 4. The user turn

Subject mode builds these lines, in this order:

```text
Subject: <the subject paragraph>
Style: <the style>
Details that must survive: <the details>            (only when notes.md holds them)
Asset name: <name>
Units: metres. +Y up. Faces +Z. Origin at the centre of the base.
Create one standalone TypeScript module that shows <the request>.
import * as THREE from "three" only.
export default function build(): THREE.Object3D
Name every part. Two calls build the same object.
No ground, grid, background, fog, overlay, camera, renderer, light, or animation.
Do not add anything else.
```

- The asset contract of T0015 §1 is the authority. The prompt restates it in the model's register.
  A single mesh is an `Object3D`; a multi-part object is a `Group`.
- A prompt file holds this whole user turn, byte for byte, in text mode.
- The two files under `prompts/subjects/` follow the same shape, and each stays under twenty lines.

### 5. The extraction (`extractTs`)

```ts
export class NoModuleError extends Error {}
export function extractTs(raw: string): string;
```

- Scan the fenced blocks with the info string and the body.
- Return the **trimmed** body of the first block whose info string is `ts` or `typescript`.
- Otherwise, return the trimmed body of the first block whose body holds `export default`.
- Otherwise, throw
  `NoModuleError("The response holds no fenced TypeScript module. Nothing was written.")`.
- A block that holds HTML, or a response with no fence, throws.
- The bytes between the first and the last non-empty line of the fence are returned unchanged. The
  leading and trailing blank lines are dropped.

### 6. The validation (`validateAsset`)

```ts
export type Validation = { ok: true } | { ok: false; reason: string };
export async function validateAsset(path: string): Promise<Validation>;
```

- Import the candidate with `await import(pathToFileURL(path).href)`.
- `module.default` must be a function.
- Call it once. A throw is `invalid: <message>`.
- The result must have `isObject3D === true`.
- The result must hold at least one `isMesh` node.
- `new THREE.Box3().setFromObject(root)` must give a finite, positive size on all three axes.
- The function never edits, moves, or deletes the file.

The command reports every written candidate:

```text
variant 1  blueprints/.../modernist-office-chair--01.ts  12.4 s  982 tokens  79.2 tok/s  valid
variant 2  blueprints/.../modernist-office-chair--02.ts  13.1 s  918 tokens  70.1 tok/s  invalid: build() returned no Object3D
```

After the loop, the command prints one viewer line per valid candidate:

```text
view  bun run tools/scene-viewer/serve.ts --asset blueprints/.../modernist-office-chair--01.ts
```

### 7. The exit codes

| Code | Meaning                                                                                      |
| :--- | :------------------------------------------------------------------------------------------- |
| `0`  | At least one candidate was written **and** is valid; or `--ask` completed, whatever the gaps |
| `1`  | Invalid input: a flag, the subject, the style, the name, or the reference                    |
| `2`  | The endpoint is unreachable, or it does not publish the model                                |
| `3`  | A request failed                                                                             |
| `4`  | The response held no complete module                                                         |
| `5`  | A candidate could not be written                                                             |
| `6`  | Candidates were written, and none is a valid asset                                           |

A failed variant does not stop the next one. The command still exits `0` when one candidate is
valid.

### 8. Bender, Workflow E

`.opencode/agents/bender.md` changes exactly as follows:

- The heading becomes `## Workflow E: draft an asset with the Qwen 3D Coder`.
- The intro says the workflow produces **one standalone TypeScript module per variant**, and the
  shared scene viewer draws it.
- **E1** reads `reference.<ext>` and `notes.md`, runs `--ask`, then asks in one call: the asset name
  (default: the subject folder name), the object in the art director's words, the real size in
  metres, the style, and the number of variants.
- **E2** runs `asset-draft.ts` with `--name`, reports the answers and the command, then runs it. The
  endpoint is external: the workflow starts no server.
- **E3** lists every candidate with its path and its `valid` or `invalid` state, gives the exact
  viewer command for every valid candidate, describes each one in one line, and waits for the
  choice. It never chooses and never promotes.
- Expertise item 6 becomes **A TypeScript asset draft (`qwen3d-coder`)**, with the same action.
- No section asks Qwen for an HTML page, a camera, a light, or a ground.

## TDD Tasks

- [ ] **T16.1 — The extractor**: write the `extractTs` cases first: a `ts` fence, a `typescript`
      fence, an unlabelled fence with `export default`, two blocks (the first wins), an HTML fence, and
      no fence. The last two throw `NoModuleError`.
- [ ] **T16.2 — The candidate names**: write the cases first. `candidateFileName("chair", 1)` is
      `chair--01.ts`; the counter file is `.qwen3d-coder-asset.counter`; a second write is `--02`; the
      first file is byte-identical; a bad name throws.
- [ ] **T16.3 — The user turn**: write the cases first. The subject turn holds the eleven lines of
      §4, the name, and the metres; the text-mode turn is the file, byte for byte; both prompt files are
      under twenty lines; the system file is the four lines, byte for byte.
- [ ] **T16.4 — The validation**: write the cases first, against the three fixtures. A valid group
      passes; `export default {}` fails; a `build()` that throws fails; a group with no mesh fails; a
      missing file fails.
- [ ] **T16.5 — The command**: rename the entry point and its test. Add `--name`, the write, the
      validation, the viewer line, and exit `6`. Update the help text and the doc comment.
- [ ] **T16.6 — The documents and Bender**: update the workflow README and AGENTS, the root README,
      the demos note, and Workflow E of `bender.md`.
- [ ] **T16.7 — The gates**: `bun run format`; `bun test workflows/qwen3d-coder`; `bun test` at the
      root. If the endpoint is reachable, run one real pass and record the candidate and its validation.
      Record the exact output in `## Implementation Notes`.

## Acceptance Criteria

- **AC1 — One file.** A subject run writes `<name>--01.ts` beside the subject. The file imports
  `three` only and default-exports a function.
- **AC2 — The validator.** Each written candidate is reported `valid` or `invalid: <reason>`. The
  valid ones print the exact `tools/scene-viewer/serve.ts --asset <path>` command.
- **AC3 — The extractor.** A fenced TypeScript response writes a file. A response without a fence
  exits `4` and writes nothing.
- **AC4 — The counter.** Two runs write `--01` then `--02`, and `--01` stays byte-identical.
- **AC5 — The prompts.** The system prompt is the four lines of §3, byte for byte. The two subject
  prompt files are under twenty lines and carry the asset contract.
- **AC6 — Bender.** Workflow E names an asset, the `--name` flag, `asset-draft.ts`, and the viewer
  command. It never asks Qwen for HTML, a camera, a light, or a ground.
- **AC7 — The gates.** `bun test` at the root is green, and `bun run format` reports no change.
- **AC8 — The end-to-end review.** With a reachable endpoint, one real run produces a valid asset,
  and the art director opens it with the viewer command printed by the drafter. If the endpoint is
  down, the run exits `2`, and the record says so; the unit tests decide the rest.
