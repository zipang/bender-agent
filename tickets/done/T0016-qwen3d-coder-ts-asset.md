# T0016 — The Qwen 3D Coder delivers a TypeScript asset

- **Track**: Qwen 3D Coder workflow (drafter, prompts, agent instructions)
- **Wave**: 2 (integration)
- **Depends on**: T0013 (the prompt system and the text mode), T0015 (the asset contract and the viewer)
- **Blocks**: nothing
- **Owner**: coding sub-agent, supervised by CTO
- **Started**: 2026-11-18
- **Validation**: 2026-11-18 — one independent review (`POLISH_REQUIRED`) and an 11-item polishing
  round inside `in_progress/`
- **Closed**: 2026-11-18
- **Evidence**: `T0016-red-sportster-candidate.ts` — the one real candidate, `valid`, 6021 bytes
- **Wave 2 opened**: 2026-11-18, after T0015 closed and after the art director rewrote the system
  prompt; amendment R1 aligns the ticket with that rewrite and with T0015's closed contract.
- **References**:
    - the asset contract of
      [`tickets/done/T0015-scene-viewer.md`](../done/T0015-scene-viewer.md), §1 — the single source
      of the module shape, and [`tools/scene-viewer/contract.js`](../../tools/scene-viewer/contract.js)
      — the code that enforces it
    - [`workflows/qwen3d-coder/README.md`](../../workflows/qwen3d-coder/README.md) — the commands and
      the request
    - [`workflows/qwen3d-coder/AGENTS.md`](../../workflows/qwen3d-coder/AGENTS.md) — the prompt and
      candidate rules
    - [`workflows/qwen3d-coder/tools/asset-draft.ts`](../../workflows/qwen3d-coder/tools/asset-draft.ts)
      — the CLI to rename and to change
    - [`workflows/qwen3d-coder/tools/lib/extract.ts`](../../workflows/qwen3d-coder/tools/lib/extract.ts)
      — the HTML extractor to replace
    - [`workflows/qwen3d-coder/tools/lib/candidates.ts`](../../workflows/qwen3d-coder/tools/lib/candidates.ts)
      — the counter, and the `O_EXCL` write
    - [`tickets/review/T0013-prompt-system-and-text-mode.md`](../review/T0013-prompt-system-and-text-mode.md)
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
  candidate, and the same candidate also appears in the viewer's picker, because it lands under
  `blueprints/<category>/<subject>/generated/` (T0015 §10). Bender never asks the model for a page, a
  camera, or a light.

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
workflows/qwen3d-coder/prompts/subjects/red-sportster.txt   added by amendment R1 (§A5)
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

> **Amended by R1 (§A4)**: `--size "<text>"` joins the flags, so the real dimensions reach the user
> turn.

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

> **Superseded by amendment R1 (§A2)**: the art director replaced the four-line card text with a
> template prompt on 2026-11-18. §A2 is the file, byte for byte. The rule that a test compares it byte
> for byte stands.

Exactly these four lines, and a test compares the file byte for byte:

```text
Use only the Three.js core ES module, imported as `three`.
Write one standalone TypeScript module, and nothing else: no HTML, no addons, no examples/js path.
Export one function as the default export; it builds and returns one THREE.Object3D.
Build no camera, renderer, light, ground, grid, background, fog, or animation.
```

### 4. The user turn

> **Superseded by amendment R1 (§A3)**: the turn keeps its content and takes the art director's
> bullet register, and it gains a `* dimensions:` line fed by `--size`. §A3 is the turn.

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

> **Amended by R1 (§A6)**: the system prompt now holds a `typescript` fence, so the **last**
> TypeScript fence wins. The rule below is otherwise unchanged.

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
- The validator **does not inject the `three` import**: T0015 §1 requires it in the asset. A candidate
  that omits it is `invalid: THREE is not defined`, and it stays viewable, because the viewer's
  prelude tolerates the omission (T0015 §1 and §11). The validator reports what the contract says;
  the viewer draws what it can.

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

> **Amended by R1 (§A7)**: E1 asks for the real size, and E2 passes it as `--size`.

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

- [x] **T16.1 — The extractor**: write the `extractTs` cases first: a `ts` fence, a `typescript`
      fence, an unlabelled fence with `export default`, two blocks (the first wins), an HTML fence, and
      no fence. The last two throw `NoModuleError`.
- [x] **T16.2 — The candidate names**: write the cases first. `candidateFileName("chair", 1)` is
      `chair--01.ts`; the counter file is `.qwen3d-coder-asset.counter`; a second write is `--02`; the
      first file is byte-identical; a bad name throws.
- [x] **T16.3 — The user turn**: write the cases first. The subject turn holds the eleven lines of
      §4, the name, and the metres; the text-mode turn is the file, byte for byte; both prompt files are
      under twenty lines; the system file is the four lines, byte for byte.
- [x] **T16.4 — The validation**: write the cases first, against the three fixtures. A valid group
      passes; `export default {}` fails; a `build()` that throws fails; a group with no mesh fails; a
      missing file fails.
- [x] **T16.5 — The command**: rename the entry point and its test. Add `--name`, the write, the
      validation, the viewer line, and exit `6`. Update the help text and the doc comment.
- [x] **T16.6 — The documents and Bender**: update the workflow README and AGENTS, the root README,
      the demos note, and Workflow E of `bender.md`.
- [x] **T16.7 — The gates**: `bun run format`; `bun test workflows/qwen3d-coder`; `bun test` at the
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

## Contract amendment R1 — the template prompt (2026-11-18)

Written after T0015 closed, and after the art director rewrote
`workflows/qwen3d-coder/prompts/3d-coder-system.txt` by hand (uncommitted at the time of this
amendment). **This section supersedes** §3, §4, §5, and the E1/E2 bullets of §8, and it adds `--size`
to §1. §1, §2, §6, §7, and §A-less parts of §8 stand.

### A1 — Why the hand-written prompt cannot ship as it is

The shape is right, and four points must change before the file becomes the system prompt.

1. **The template has no import.** `export const build = () => { … }` sits alone: no
   `import * as THREE from "three";`. §6 rejects such a candidate as `invalid: THREE is not defined`,
   and T0015 §1 requires the line. The viewer tolerates the omission (§11 of T0015), the validator
   does not, and a template must not teach the model to fail our own check.
2. **The template exports a named `const`.** T0015 §1 — a **closed** contract — requires
   `export default function build(): THREE.Object3D`, and `checkAsset` reads `module.default` only.
   The alternative, teach the viewer and the validator to accept a named `build`, rewrites a closed
   ticket and needs a ticket of its own. The contract wins.
3. **The template throws at run time.** `return cube = new THREE.Mesh(geometry, material);` assigns an
   undeclared binding. An ES module runs in strict mode, so the line throws
   `ReferenceError: cube is not defined` — the same defect as line 111 of
   `demos/voxel-christmas-tree.html` (T0013, Defect 1). A model that copies the template delivers a
   module that throws.
4. **The subject is inside the constant turn.** The three red-sportster bullets are data of one run.
   A constant system turn cannot hold them. They move to a prompt file (§A5), which keeps the art
   director's words.

Evidence that the model needs the correction: the candidate the art director kept,
`blueprints/vehicules/red-sportster/generated/qwen3D-01.ts`, copies the template — and the file loads
in the viewer only because the model itself appended `export default build;` at line 147. The contract
must not depend on that.

### A2 — The system prompt (`prompts/asset-system.txt`)

Exactly these bytes, ending with one newline. They are the art director's prompt of 2026-11-18, with
three corrections agreed with the art director on the same day: the `three` import line (written by
the art director), the default export, and the two lines of the cube body.

````text
Generate a single Typescript file that exports a `build()` function returning a Three.js object following that template :

```typescript
import * as THREE from "three";

/**
 * Build a simple cube
 */
export default function build(): THREE.Object3D {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    return cube;
}
```
````

- A test compares the file byte for byte, as §3 requires.
- The indentation inside the fence is four spaces, as the art director wrote it. `bun fmt` does not
  read a `.txt` file, so the bytes are stable; do not reformat them.
- Every other byte is the art director's: the instruction line, its spacing, and the `Typescript`
  spelling stay as written. Only the three corrections above change, and no line is added.
- **The template is itself a valid asset.** A second test extracts the fenced block, writes it to a
  scratch file under `.tmp/`, and runs `validateAsset` on it. It must answer `{ ok: true }`. This is
  the guard that stops the prompt and the validator from drifting apart.
- The file is the **constant** turn. No subject, no style, no dimension appears in it: the art
  director agreed on 2026-11-18 that the three red-sportster bullets move to §A5.

### A3 — The user turn

Subject mode builds these lines, in this order. It **replaces** the eleven lines of §4:

```text
Here is the 3D model to recreate with Three.js primitives:
* subject: <the subject paragraph>
* dimensions: <the size>
* style: <the style>
* details that must survive: <the details>
* asset name: <name>
* units: metres. +Y up. +Z is the front. The origin is the centre of the base.
* Create one standalone TypeScript module that shows <the request>.
* import * as THREE from "three" only.
* export default function build(): THREE.Object3D
* One object: one mesh, or a Group when the object has parts.
* Name every part, and two calls build the same object.
* No ground, grid, background, fog, overlay, camera, renderer, light, or animation.
* Do not add anything else.
```

- Line 1 is constant. The `* subject:`, `* dimensions:`, and `* style:` bullets follow it in that
  order, which is the art director's order.
- `* dimensions:` is present only when the size is known (§A4). A missing size is not an error, but
  Bender always passes one (§A7), because a model that receives no number invents a scale.
- `* details that must survive:` is present only when `notes.md` holds the paragraph, as in §4.
- `* asset name:` carries the resolved name of §1.
- The rest of the lines are the asset contract of T0015 §1 in the model's register.
- **A prompt file holds this whole turn byte for byte**, in text mode, as §4 states.
- `UserPromptInput` gains `name: string` and `size?: string | null`.

### A4 — The `--size` flag

- `--size "<text>"`, optional: the real dimensions, in the art director's notation, for example
  `--size "L=3 m, h=1 m, l=1.5 m"`.
- A present but empty `--size` exits `1`, like an empty `--style`, and the message names the flag.
- `--size` reaches `buildUserPrompt` as `size`. §1's flag list, §7's exit `1` row, and the workflow
  README flag table gain the line.

### A5 — The prompt files of `prompts/subjects/`

Three files, each under twenty lines, each one the §A3 turn:

```text
modernist-office-chair.txt   rewritten in the §A3 shape
voxel-christmas-tree.txt     rewritten in the §A3 shape
red-sportster.txt            new: the art director's bullets of 2026-11-18
```

`red-sportster.txt` preserves the art director's words, verbatim, as bullets of the §A3 turn:

```text
* subject: a red sportster car.
* dimensions: L=3 m, h=1 m, l=1.5 m.
* style: very low poly. Almost voxel style (some 45° angles are allowed).
```

The two rewritten files keep the subject of the file they replace, and they gain the dimensions of
their subject in metres, because §4 of the ticket D3 rule asks for numbers instead of adjectives.

### A6 — The extraction, when the model echoes the template

The template now lives in the system prompt inside a `typescript` fence, and the prompt asks for a file
that follows it. A reply that restates the fenced template before writing its own module is therefore
plausible. §5 returns the first `ts`/`typescript` fence, which would then extract the cube. The rule
becomes:

1. Collect every fence whose info string is `ts` or `typescript`, the template echo included.
2. Return the **last** one, trimmed, with the blank-line trimming of §5.
3. Otherwise, return the trimmed body of the first fence whose body holds `export default`.
4. Otherwise, throw
   `NoModuleError("The response holds no fenced TypeScript module. Nothing was written.")`.

A test gives a response that echoes the template and then writes the module; the module is returned,
not the template.

### A7 — Bender, Workflow E (supersedes the E1 and E2 bullets of §8)

- **E1** asks in one call: the asset name (default: the subject folder name), the object in the art
  director's words, the real size in metres, the style, and the number of variants. Every answer
  reaches the command of E2.
- **E2** runs `asset-draft.ts` with `--name` **and** `--size`, reports the answers, the command, and
  the cost, then runs it.

### A8 — TDD tasks of R1

- [x] **T16.8 — The system prompt**: rewrite the byte-for-byte case of `prompt.test.ts` against
      `prompts/asset-system.txt` and its §A2 bytes first, and add the case that extracts the fenced
      template and validates it. `prompt.test.ts` is red today for the bytes, and the second case is
      red until §A2 is written. Then write the file. Record the red and the green.
- [x] **T16.9 — The user turn**: write the cases first — the full turn with a size, the turn without
      a size and without details, the order of the bullets, the constant first line, and the throw on
      an empty subject. Then `buildUserPrompt` and its new `name` and `size` inputs.
- [x] **T16.10 — The last fence**: write the echo case first, then narrow §5's rule in `extract.ts`.
      The five cases of T16.1 stay green.
- [x] **T16.11 — The flag, the files, and the gates**: `--size` in `asset-draft.ts` and its test, the
      three prompt files, the README flag table, and then `bun run format`, `bun test
workflows/qwen3d-coder`, and `bun test`. If the endpoint is reachable, one real run with
      `--size`, recorded.

### A9 — Acceptance criteria of R1

- **AC9 — The constant turn.** `prompts/asset-system.txt` is the §A2 bytes, its template imports
  `three`, default-exports `build`, and does not throw when it runs. No subject appears in it.
- **AC10 — The template is an asset.** The fenced block of the system prompt passes `validateAsset`.
- **AC11 — The numbers reach the model.** A subject run with `--size "L=3 m, h=1 m, l=1.5 m"` sends
  a turn whose third bullet is that text; without `--size` the bullet is absent, and the run does not
  fail.
- **AC12 — The echo.** A reply that holds the template and then the module writes the module.
- **AC13 — The gates.** `bun test` at the root is green, and `bun run format` reports no change. The
  suite is green **at the start of the ticket** only after T16.8, because the art director's rewrite
  left `prompt.test.ts` red (`257 pass, 1 fail` measured by the CTO on 2026-11-18).

### A10 — What the reviewer of this amendment must not ask for

- No new ticket to change T0015's asset contract. The prompt follows the contract; the contract does
  not follow the prompt.
- No `* dimensions:` line with a guessed size. A missing size is a missing bullet, never a number
  that the script invented.

## Implementation Notes

### Order taken

I did not follow the literal T16.1 → T16.11 order. I grouped the work by dependency and ran the red
first in each group: **extract (T16.1 + T16.10) → candidates (T16.2) → validate (T16.4) → system
prompt (T16.8) → user turn (T16.9) → command (T16.5 + T16.11) → documents (T16.6) → gates (T16.7)**.
`validate.ts` had to exist before T16.8, because the T16.8 guard validates the fenced template.

### Red runs (exact failures)

- **T16.1 / T16.10 — `extract.test.ts`**, before `extractTs` existed:
  `SyntaxError: Export named 'extractTs' not found in module '.../tools/lib/extract.ts'.` — `0 pass, 1 fail, 1 error`.
- **T16.2 — `candidates.test.ts`**, before `NAME_PATTERN` and the `name` parameter:
  `SyntaxError: Export named 'NAME_PATTERN' not found in module '.../tools/lib/candidates.ts'.` — `0 pass, 1 fail, 1 error`.
- **T16.4 — `validate.test.ts`**, before `validate.ts`:
  `error: Cannot find module './validate' from '.../tools/lib/validate.test.ts'` — `0 pass, 1 fail, 1 error`.
- **T16.8 — `prompt.test.ts`**, with the art director's uncommitted file and the new path:
  `(fail) the system prompt > is the asset template, byte for byte` and
  `(fail) the system prompt > the fenced template is itself a valid asset`, whose validator answer was
  `{ "ok": false, "reason": "the module has no default export that is a function" }` (the old template
  exports `const build`). Result: `9 pass, 2 fail`.
- **T16.9 — `prompt.test.ts`**, before `buildUserPrompt` and the prompt files changed:
  `9 fail` — the five A3 turn cases and the three prompt-file cases, e.g.
  `(fail) buildUserPrompt > the full turn with a size, against the A3 lines` and
  `(fail) the prompt files > red-sportster.txt is under twenty lines and is the A3 turn`. Result:
  `8 pass, 9 fail`.
- **T16.5 / T16.11 — `asset-draft.test.ts`**, first run of the new test file: `11 fail`, all because
  the injected responses were raw module text. The new extractor requires a fence, so every run exited
  `4` (`variant 1  failed: The response holds no fenced TypeScript module. Nothing was written.`). I
  corrected the test fixtures to fenced `ts` blocks and the run went to `40 pass, 0 fail`. This was a
  test-fixture defect, not a production defect.

### Green gate outputs

- `bun test workflows/qwen3d-coder/tools/lib/extract.test.ts` → `10 pass, 0 fail`.
- `bun test workflows/qwen3d-coder/tools/lib/candidates.test.ts` → `18 pass, 0 fail`.
- `bun test workflows/qwen3d-coder/tools/lib/validate.test.ts` → `7 pass, 0 fail`.
- `bun test workflows/qwen3d-coder/tools/lib/prompt.test.ts` → `11 pass` after T16.8, then `17 pass, 0 fail` after T16.9.
- `bun test workflows/qwen3d-coder/tools/asset-draft.test.ts` → `40 pass, 0 fail`.
- `bun test workflows/qwen3d-coder` → `118 pass, 0 fail`, `291 expect() calls`, `Ran 118 tests across 7 files`.
- `bun test` at the root → `286 pass, 0 fail`, `774 expect() calls`, `Ran 286 tests across 22 files`.
- `bun run format` → `Formatted 0 files, 188 unchanged [44.69ms]` (output: `$ bun fmt` then the line).
- The starting workflow suite was `89 pass, 1 fail` (the prompt byte test); the starting root total was
  `258` tests. Both are now fully green.

### Files changed

Created: `tools/lib/validate.ts`, `tools/lib/validate.test.ts`, `tools/fixtures/valid-asset.ts`,
`tools/fixtures/not-an-asset.ts`, `tools/fixtures/broken-asset.ts`,
`prompts/subjects/red-sportster.txt`.
Renamed with `git mv`: `tools/scene-draft.ts` → `tools/asset-draft.ts`,
`tools/scene-draft.test.ts` → `tools/asset-draft.test.ts`,
`prompts/3d-coder-system.txt` → `prompts/asset-system.txt`.
Modified: `tools/asset-draft.ts`, `tools/asset-draft.test.ts`, `tools/lib/extract.ts`,
`tools/lib/extract.test.ts`, `tools/lib/candidates.ts`, `tools/lib/candidates.test.ts`,
`tools/lib/prompt.ts`, `tools/lib/prompt.test.ts`, `prompts/asset-system.txt`,
`prompts/subjects/modernist-office-chair.txt`, `prompts/subjects/voxel-christmas-tree.txt`,
`README.md` (workflow row, tree line, glossary), `workflows/qwen3d-coder/README.md`,
`workflows/qwen3d-coder/AGENTS.md`, `.opencode/agents/bender.md`, `demos/README.md`.
Nothing under `tools/scene-viewer/**`, `workflows/threejs/**`, `workflows/blender/**`,
`workflows/vcad/**`, `package.json`, or `bunfig.toml` was touched.

### The real run (AC8)

Endpoint reachable (`qwen3.5-4b-3d-coder`). Command and exact stdout:

```text
$ bun run workflows/qwen3d-coder/tools/asset-draft.ts \
    --prompt-file workflows/qwen3d-coder/prompts/subjects/red-sportster.txt \
    --out blueprints/drafts/red-sportster/generated \
    --name red-sportster --variants 1
endpoint: http://127.0.0.1:9931/v1  model: qwen3.5-4b-3d-coder
prompt: workflows/qwen3d-coder/prompts/subjects/red-sportster.txt
variant 1  blueprints/drafts/red-sportster/generated/red-sportster--01.ts  71.1 s  2138 tokens  31.9 tok/s  valid
1 candidate(s) written to blueprints/drafts/red-sportster/generated. The art director chooses.
view  bun run tools/scene-viewer/serve.ts --asset blueprints/drafts/red-sportster/generated/red-sportster--01.ts
EXIT=0
```

The candidate is 6021 bytes. It opens with `import * as THREE from "three";` and
`export default function build(): THREE.Object3D { const car = new THREE.Group(); … }`, builds a
`Group` named `red-sportster`, and closes with `return car;`. One variant only, no retry. The run wrote
under `blueprints/drafts/`, which `.gitignore` line 43 ignores, so the candidate is not committed.

### Divergences (the ticket did not match reality)

1. **T16.1 "two blocks (the first wins)" vs §A6 "the last TypeScript fence wins".** R1 supersedes §5,
   so `extractTs` returns the **last** `ts`/`typescript` fence. I kept the T16.1 "first wins" case
   meaningful by using two **unlabelled** blocks, where the fallback rule ("the first block whose body
   holds `export default`") genuinely applies. Both cases are green.
2. **`--ask` and an invalid name.** §1 says a name violation exits `1`; §1 also says `--ask` "now also
   reports an invalid name". A normal run exits `1` on an invalid name. `--ask` lists the invalid name
   as a gap and returns `0`, so it still checks the endpoint and sends nothing. A test covers both.
3. **The no-mesh validation case has no fixture in the Create list.** T16.4 names three fixtures, but
   also asks for "a group with no mesh fails". That module is written to a scratch folder under
   `.tmp/` inside the test and removed after it. Scratch files must live inside the repository so that
   `three` resolves from `node_modules`; the same reason puts the T16.8 template scratch under `.tmp/`.
4. **The two rewritten prompt files need dimensions and a style that the ticket does not give.**
   §A5 asks them to gain the dimensions of their subject in metres. I chose `L=0.6 m, w=0.6 m,
h=0.8 m` for the chair and `L=0.5 m, w=0.5 m, h=1.5 m` for the tree, with a style and details that
   fit the §A3 shape. `red-sportster.txt` uses the three §A5 bullets verbatim, wrapped in the constant
   §A3 lines, because a text-mode prompt file is the whole user turn.
5. **T16.5 tests were written after the implementation.** The `git mv` had already produced the red
   state, and I implemented the command and its test together. The first test run was red for a test
   defect (unfenced responses, item above), which I fixed; that run is recorded rather than a red for a
   missing export.
6. **`--size` and the command.** T16.11 lists `--size`, but the flag lives in `asset-draft.ts` beside
   `--name`, so both flags landed in the T16.5 edit. `asset-draft.test.ts` covers `--size` reaching the
   turn, an empty `--size`, and an invalid `--name`.
7. **Wording of the validator reasons.** The ticket fixes only the shape `invalid: <reason>` and the
   `THREE is not defined` example. The reasons the validator emits are: the module's import error
   message; `the module has no default export that is a function`; the thrown message of `build()`;
   `build() returned no Object3D`; `the asset has no mesh, so there is nothing to draw`; and the
   three-axis size message.
8. **`tickets/README.md` was already modified before this ticket started** (shown by `git status` on
   the first inspection). I did not touch it.

## Implementation Notes — review round

The independent reviewer returned `POLISH_REQUIRED`, and the CTO accepted every item. I applied them
in the order given. Nothing else was reopened, nothing was committed, and the ticket stayed in
`tickets/in_progress/`.

1. **`demos/README.md`, the surviving `scene-draft` command.** Added one sentence above the block:
   the two runs predate T0016, the entry point is now `tools/asset-draft.ts`, and a candidate is a
   `.ts` asset, not an HTML page. The command is unchanged, because it records what really ran.
2. **`tools/asset-draft.ts`, the total-failure fallback.** `return firstFailure ?? 0` became
   `return firstFailure ?? 3`, so the branch can no longer answer `0` with nothing written. The
   comment keeps the fact that the branch is unreachable with `--variants >= 1`.
3. **`tools/asset-draft.ts`, the unguarded validator call.** Red first: added the injected-validator
   test, reverted the call to `const validation = await validate(path);`, and ran it. The result was
   `error: traverse exploded ... at runCli (asset-draft.ts:560:28)` — `1 fail`. I then wrapped the
   call in `try` / `catch` and mapped a throw to `{ ok: false, reason: <message> }`. The test now
   passes and proves that the run continues to the next variant and still prints its `view` line.
   File: `tools/asset-draft.ts`, test in `tools/asset-draft.test.ts`.
4. **The text-mode turn is not byte-for-byte.** Red first: put a trailing newline in the text-mode
   fixture and asserted that `sent.user` keeps it. The result was
   `- * asset name: subject\n- "` against `+ * asset name: subject"` — `1 fail`. The reader used
   `readFileSync(...).trim()`. It now reads `raw`, uses `raw.trim()` only for the emptiness check, and
   sends `raw`. This defect predated this work; the notes record it as inherited and fixed. File:
   `tools/asset-draft.ts`, test in `tools/asset-draft.test.ts`.
5. **`.opencode/agents/bender.md`, the stale cost figure.** Deleted the "about 4,000 output tokens
   … about seven minutes" estimate. E2 now says to state no decode rate and no cost before `T1.13`
   measures them, and to report the measured cost of the run after it ends.
6. **`workflows/qwen3d-coder/README.md` §3.** Added one sentence: a candidate that omits
   `import * as THREE from "three"` is `invalid: THREE is not defined` for the drafter, and the
   viewer still opens it because the viewer adds the line (T0015 §11); the validator reports what the
   contract says, the viewer draws what it can (contract §6).
7. **`workflows/qwen3d-coder/README.md`, the catalogue sentence.** Qualified it: in subject mode the
   candidate also appears in the viewer's catalogue because it lands under `generated/`; a text-mode
   folder under `blueprints/drafts/` is not walked.
8. **The ticket References line.** Changed the `tools/scene-draft.ts` reference to
   `tools/asset-draft.ts`. This is the one edit inside the ticket outside these notes.
9. **`tools/asset-draft.ts`, the `--ask` header.** "gap(s) in the subject material" became
   "gap(s) to fill before a draft", which is true in subject mode and in text mode.
10. **`tools/lib/candidates.ts`, `nextNumber`.** Red first: added `expect(() => nextNumber(tempDir(),
"Bad Name")).toThrow()`; it failed with `Received function did not throw` and `Received value: 1`.
    Added `assertName(name)` at the top of `nextNumber`. `19 pass, 0 fail`. The guard is now
    self-contained. Files: `tools/lib/candidates.ts`, `tools/lib/candidates.test.ts`.
11. **`tools/lib/prompt.test.ts`, the prompt files.** Added one equality case per file:
    `text.trimEnd()` equals `buildUserPrompt({...})` for that file's inputs. All three files match
    the builder as written. The only failure was in my own test input: I passed the red-sportster
    request with its sentence period (`"a red sportster car."`), so the builder appended a second
    period and produced `shows a red sportster car..`. The file is correct per §A3 (the request is
    `a red sportster car`, and the builder adds the period), so I corrected the test input and did
    not change the file. No prompt file was edited.

### Gate outputs after the review round

```text
$ bun run format
$ bun fmt
Formatted 0 files, 189 unchanged [41.90ms]
```

```text
$ bun test workflows/qwen3d-coder
 123 pass
 0 fail
 298 expect() calls
Ran 123 tests across 7 files. [94.00ms]
```

```text
$ bun test
 291 pass
 0 fail
 781 expect() calls
Ran 291 tests across 22 files. [164.00ms]
```

The suite grew from `118` to `123` workflow tests (the throwing validator, the byte-for-byte
newline, the `nextNumber` guard, and the three file-equality cases). No production rule was softened.

## Closed

Accepted by the art director on 2026-11-18, on the terms the ticket set: one standalone TypeScript
module, a validator that reports what it finds, the shared viewer as the review page, and no gate of
its own.

- **Gates at close**: `bun test` 291 pass, 0 fail, 781 `expect()` calls, 22 files; `bun run format`
  0 file changed; `bun test workflows/qwen3d-coder` 123 pass in 7 files.
- **Evidence beside this ticket**: `T0016-red-sportster-candidate.ts`, the candidate of the one real
  run of AC8, `valid`, 6021 bytes. It copies the template the system prompt teaches, and it holds the
  `import * as THREE from "three";` line that T0016 §A2 added, which is the whole point of the round.
- **Left local on purpose**: `blueprints/drafts/red-sportster/generated/` holds the generated folder
  and its counter. The folder is git-ignored, and the candidate above is its copy.
- **What the next ticket inherits**: T0017 sends the blueprint images with the prompt, because the
  model left alone produces poor geometry. It also fixes one cosmetic defect found here: a request
  that ends in a period got a second one.
