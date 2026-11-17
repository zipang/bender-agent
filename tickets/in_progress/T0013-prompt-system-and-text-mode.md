# T0013 — Our prompt system, and a text-only prompt mode

- **Track**: Qwen 3D Coder workflow (prompt and drafter)
- **Wave**: after T0011
- **Owner**: bender, with the art director as reviewer
- **Started**: 2026-11-17
- **Depends on**: T0011 (the client, the preflight, and the candidate writer)
- **Blocks**: T0012 (the asset drafter reuses the same system prompt)
- **References**:
    - `workflows/qwen3d-coder/prompts/3d-coder-system.txt` — the model card's 225-byte system prompt
    - `workflows/qwen3d-coder/tools/lib/prompt.ts` — `buildUserPrompt()`, four blocks
    - `workflows/qwen3d-coder/tools/scene-draft.ts` — the CLI, and its `--subject` requirement
    - `demos/voxel-christmas-tree.html` — the first run, and the evidence of the two defects
    - Three.js r160 `WebGLRenderer` and `Scene.background`:
      <https://threejs.org/docs/#api/en/renderers/WebGLRenderer>
    - ECMAScript modules run in strict mode, so an undeclared assignment throws `ReferenceError`:
      <https://262.ecma-international.org/14.0/#sec-strict-mode-code>

## Context & Goal

The first scene looked wrong, and the cause is not the model's modelling skill.

**Defect 1 — the page renders nothing.** `demos/voxel-christmas-tree.html` assigns `renderer = new
THREE.WebGLRenderer(...)` at line 111 without `const`. A `<script type="module">` is strict mode, so
the assignment throws `ReferenceError: renderer is not defined` and the script stops before the first
frame. A browser capture of the page shows the HTML panel and no `<canvas>` at all.

**Defect 2 — the scene carries a whole set, not one object.** The same file builds a 121-cube ground
grid, a fog, a scene background, an HTML overlay, and an auto-orbit. The art director asked for one
object; the prompt never said "no scenery".

**Cause — we sent almost no rules.** The system prompt is 225 bytes: one import URL and "no addons".
The user prompt is four lines. Nothing states the output contract, the strict-mode rule, or the
absence of decor.

**An interview settled three facts.** Six short questions were sent to the model, one request each,
24.6 s in total, with no scene constraint in the system prompt:

- It ranks **voxel** first among the styles it can produce, ahead of flat-shaded, toon, low-poly, and
  PBR. Its default import is jsdelivr; we keep cdnjs, because it is the one line we control.
- Asked what wording stops it from adding scenery, it answered with a usable list: "No ground plane,
  grid, background color, fog, loading overlay, camera animation, or additional assets. Isolate the
  requested object." Those are exactly the six defects that appeared.
- Its answers about its own JavaScript errors are **unreliable**: it claims `import * as THREE` is an
  error. Its preferences are evidence; its explanations are not.

**Done means** the workflow owns four files — a system prompt, and one short prompt file per subject
— and a documented command that sends a prompt file with no blueprint folder and no reference image.

## Decisions

- **D1 — The system prompt stays the model card's.** A first draft of this ticket replaced it with a
  long contract of our own. The art director reversed that on 2026-11-17 (D7): the card states the
  runtime, and nothing else. The system prompt is four lines, unchanged.
- **D2 — One system prompt, many prompt files.** The system prompt is constant. A prompt file holds
  the user turn for one subject, and nothing else.
- **D3 — Short and imperative.** The prompt is a list of constraints, in the model's own register.
  No prose, no rationale, no apology. "Too much context kills the context."
- **D4 — Numbers, not adjectives.** A voxel prompt gives cube counts. A chair prompt gives
  dimensions in metres. "Modernist" alone decides nothing.
- **D5 — One request per variant.** One variant per pass by default; the art director compares files
  and asks for another pass.
- **D6 — No render gate.** The art director reviews in the browser and can fix a broken page at once.
  The candidate is never edited by a script.
- **D7 — Our prompts are too verbose, and the art director said so.** A long system contract did not
  survive its first contact: the model ignored the `<div>` ban twice, and it framed the camera at a
  guessed distance. The four-line card text returns, and every constraint moves into the prompt file,
  where it stays under twenty lines. Short beats complete.

## The contract

### `prompts/3d-coder-system.txt`

The constant system turn, and it is the model card's text, byte for byte: the cdnjs ES module, no
addons, no `examples/js` path, and the camera controls written inside the HTML. Four lines. A test
fails if a byte changes.

### `prompts/subjects/<slug>.txt`

The user turn of one subject, under twenty lines. A voxel prompt states one cube size and the cube
count of each tier. A furniture prompt states metres and the material of each part. It ends with one
line that names what must not appear: no ground plane, no grid, no fog, no overlay, no camera
animation, isolate the object.

### The command

```bash
bun run workflows/qwen3d-coder/tools/scene-draft.ts \
  --prompt-file workflows/qwen3d-coder/prompts/subjects/<slug>.txt \
  --out blueprints/drafts/<slug>/generated
```

`--prompt-file` replaces `--subject` and the reference image. `--out` names the candidate folder,
because a prompt file has no subject folder to sit beside. `--style` is not required in this mode:
the prompt file holds the whole user turn.

## Scope boundary

- **In scope:** `prompts/3d-coder-system.txt`, `prompts/subjects/*.txt`, the `--prompt-file` and
  `--out` flags in `tools/scene-draft.ts`, the matching tests, `README.md`, `AGENTS.md`.
- **Out of scope:** `lib/client.ts` sampling values, `lib/endpoint.ts`, the candidate counter,
  `demos/`, and every Three.js viewer file.

## Tests

- `--prompt-file` alone sends the file's text as the user turn, and writes one candidate to `--out`.
- `--prompt-file` without `--out` exits `1` and names the missing flag.
- A missing or empty prompt file exits `1` and sends no request.
- `--ask` with a complete prompt file lists no gap, sends nothing, and exits `0`.
- A second run in the same `--out` writes `--02` and leaves `--01` byte-identical.
- `bun test` stays green.

## Acceptance Criteria

- [ ] The system prompt is the model card's four lines, byte for byte.
- [ ] Two prompt files exist, and each one is under 20 lines.
- [ ] One run per prompt file writes exactly one candidate, with no blueprint folder.
- [ ] The art director opens both candidates in a browser and judges them.

## Implementation Notes

Empty until the work starts.
