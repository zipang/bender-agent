# The Qwen 3D Coder workflow: agent rules

Rules for an agent that works in `workflows/qwen3d-coder/`. They are short on purpose. The tutorial
is in [`README.md`](./README.md). This file holds what must not be broken.

This workflow produces **one standalone TypeScript asset per variant**. It has no gate, it does not
run G1, G2, or G3, and it does not replace workflow D. The shared scene viewer draws the asset, and
the art director judges it by eye.

## The pass, in order

1. Read the subject's `reference.<ext>` with `read`, and read `notes.md`. In text mode, read the
   prompt file instead.
2. Run the free check, `--ask`. It sends no completion, checks the endpoint, and lists the gaps.
3. Ask the art director everything in one call. Never invent a choice that belongs to the art
   director: the asset name, the style, the real size, the number of variants, the request.
4. Report the answers, the command, and the cost in time. Then run it.
5. Hand the candidate paths back with their `valid` or `invalid` state, and the viewer command of
   every valid candidate. Wait for the choice.
6. Never choose a candidate, and never promote one.

## The prompt files

- `prompts/asset-system.txt` is the constant system turn: the art director's template prompt, byte
  for byte, plus one `Units:` line after the fence. It holds no subject, no style, and no dimension.
  A test compares it byte for byte, a second test validates its fenced template as an asset, and a
  third counts the `Units:` line. Do not extend it.
- `prompts/subjects/<slug>.txt` is the user turn of one subject, and it carries **data only**: the
  constant first line, then the bullets that have data (`subject`, `dimensions`, `style`, `details`).
  **At most five lines.** No import line, no export line, no naming rule, no prohibition: the system
  prompt holds the contract, and a test keeps a contract line out of every file.
- Text mode sends the file and nothing else: `--prompt-file <f> --out <dir>`. It reads no blueprint
  and no image.
- Do not lengthen a prompt to fix a candidate. Change one constraint, then run again.
- A prompt that grows into prose is a defect. The model answers lists.

## The reference images

- An image is opt-in. `--image` sends the identity sheet; `--views <list>` sends the named views, in
  list order. A run with neither sends no image, so the workflow keeps one mode that needs no
  projector.
- The art director chooses the views. D1 asks for one image first, then `top,right,back`, and compares
  the two candidate sets in the viewer. Never add a view that was not asked for.
- Every image is sent as PNG, at a preset of the ladder. `tiny` (384 px, 64 colours) is the default,
  `small` (512 px) is the first climb, and `full` (800 px) is the last. One subject is written in
  WebP; the drafter converts it, and `blueprints/**` stays read only.
- Climb only when the art director judges a candidate too poor, and report the preset of every run. A
  rung that answers `invalid`, exit `4`, or exit `3` ends the climb: more detail cannot repair a
  broken answer.
- The real dimensions come from `<subject>/dimensions.json` when `--size` is absent. Never read them
  from the views that the asset is checked against.
- An endpoint reads an image only when its operator loads the vision projector. The drafter reports
  the `multimodal` capability and the prompt token counts; it enforces neither.

## The asset contract

- The asset is one standalone TypeScript module: `import * as THREE from "three";` and
  `export default function build(): THREE.Object3D`. It imports `three` only.
- The root origin is at the centre of the base, `+Y` is up, the object faces `+Z`, and one unit is
  one metre.
- It builds no camera, renderer, light, ground, grid, background, fog, overlay, or animation.
- The drafter validates every candidate it writes: `valid`, or `invalid: <reason>`. It never edits
  the file. A broken candidate stays as evidence.
- The viewer is the review page. `tools/scene-viewer/**` is not part of this workflow; the drafter
  prints its command.

## The model is not an agent

- One call per variant. The model holds no tool, no loop, and no memory.
- It is a completion model. The script sends the request once, and the stream ends.

## This workflow has no gate

- No number, no overlay, and no render decides. The art director decides.
- A candidate that looks wrong is evidence about the prompt. It is not a failed gate.

## Candidate rules

- A candidate is one TypeScript file named `<name>--<NN>.ts`. The name is the resolved asset name,
  and the number is zero padded to two digits.
- A candidate is never deleted, never renamed, and never overwritten.
- The script writes with `O_EXCL`. A new run adds the next free number, so `--04` follows `--03`.
- The last number is kept in `.qwen3d-coder-asset.counter` in the candidate folder. The next number
  is `max(counter, maximum present) + 1`, so a deleted number is never reused. An unreadable or
  invalid counter falls back to the folder maximum.
- The script never edits the model's TypeScript. A broken candidate stays as evidence.
- As an image, generation reads `reference.<ext>` only. It never reads `source.<ext>`.
- A candidate lives beside its subject, in `blueprints/<category>/<subject>/generated/`. In text
  mode it lives in the folder that `--out` names.

## Files and runtime

- The drafters live in `tools/`. **This workflow starts no server and installs nothing.** The model
  is served by an OpenAI-compatible endpoint that the operator provides, and the endpoint is named by
  `--base-url` and `--model`.
- The endpoint is a prerequisite, not a deliverable. A run against an unreachable endpoint fails with
  exit code `2`; the fix is the operator's, never a script in this repository.
- The model is not downloaded by a script, and no model path, cache directory, or process belongs to
  this repository.
- The cost is the machine's. The decode rate is measured, never assumed. Until ticket `T1.13`
  measures it, `README.md` states no number.

## Document rules

- A change that adds a flag, a file, or a command updates `README.md` and this file in the same
  commit.
- Write prose in Simplified Technical English. Keep chat answers in the user's language.
