# The Qwen 3D Coder workflow: agent rules

Rules for an agent that works in `workflows/qwen3d-coder/`. They are short on purpose. The tutorial
is in [`README.md`](./README.md). This file holds what must not be broken.

This workflow produces **unmeasured, stylized candidates**. It has no gate, it does not run G1, G2,
or G3, and it does not replace workflow D. The art director judges every candidate by eye.

## The pass, in order

1. Read the subject's `reference.<ext>` with `read`, and read `notes.md`. In text mode, read the
   prompt file instead.
2. Run the free check, `--ask`. It sends no completion, checks the endpoint, and lists the gaps.
3. Ask the art director everything in one call. Never invent a choice that belongs to the art
   director: the style, the number of variants, the request.
4. Report the answers, the command, and the cost in time. Then run it.
5. Hand the candidate paths back with one line of description per file. Wait for the choice.
6. Never choose a candidate, and never promote one.

## The prompt files

- `prompts/3d-coder-system.txt` is the constant system turn, and it is the model card's text, byte
  for byte: the cdnjs ES module, no addons, and the camera controls inside the HTML. Do not extend it.
  The art director's decision of 2026-11-17 (T0013 D7) is that a long system contract does not hold.
- `prompts/subjects/<slug>.txt` is the user turn of one subject: short lines, numbers instead of
  adjectives, one line per constraint, and a last line that names what must not appear. Keep it under
  twenty lines.
- Text mode sends the file and nothing else: `--prompt-file <f> --out <dir>`. It reads no blueprint
  and no image.
- Do not lengthen a prompt to fix a candidate. Change one constraint, then run again.
- A prompt that grows into prose is a defect. The model answers lists.

## The model is not an agent

- One call per variant. The model holds no tool, no loop, and no memory.
- It is a completion model. The script sends the request once, and the stream ends.

## This workflow has no gate

- No number, no overlay, and no render decides. The art director decides.
- A candidate that looks wrong is evidence about the prompt. It is not a failed gate.

## Candidate rules

- A candidate is never deleted, never renamed, and never overwritten.
- The script writes with `O_EXCL`. A new run adds the next free number, so `--04` follows `--03`.
- The last number is kept in `.qwen3d-coder-scene.counter` in the candidate folder. The next number
  is `max(counter, maximum present) + 1`, so a deleted number is never reused. An unreadable or
  invalid counter falls back to the folder maximum.
- The script never edits the model's JavaScript. A broken candidate stays as evidence.
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
