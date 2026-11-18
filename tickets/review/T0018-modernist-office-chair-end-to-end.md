# T0018 — The modernist office chair, end to end

- **Track**: Qwen 3D Coder workflow, and the blueprint it reads
- **Wave**: 1 (independent)
- **Depends on**: T0017
- **Blocks**: nothing
- **References**: the reference image `blueprints/objects/modernist-office-chair/reference.jpg`; the
  drafter of T0017; T0016 for the asset contract; `tools/scene-viewer/` for the render check
- **Owner**: CTO, at the direction of the art director
- **Started**: 2026-11-18

## Context & Goal

The art director asked for one complete pass of the pipeline on a subject that never saw it: one
reference image from an image model, one cleaning pass, a subject folder with its notes and its real
size, and one Qwen 3D Coder generation that the shared viewer draws.

The goal is a **working subject**, not a good-looking chair. The geometry is the art director's
judgement, and this ticket records it without scoring it.

## Scope Boundary

Created under `blueprints/objects/modernist-office-chair/`: `source.jpg`, `reference.jpg`,
`notes.md`, `dimensions.json`, and `generated/modernist-office-chair--0N.ts`.

Modified: `workflows/qwen3d-coder/prompts/subjects/modernist-office-chair.txt`, whose data was
corrected against the reference after the audit of §3.

**Do not touch**: any other subject, any code of the drafter, `tickets/done/**`.

## Contract

1. **The reference is generated, then cleaned.** `opencode/gemini-nano-banana-2.1`, one call with the
   art director's prompt `a modernist office chair (1910), walnut wood, yellow leather`, saved as
   `source.jpg`. One edit call removes the background and writes `reference.jpg` on a pure white
   field. `source.jpg` is never modified, and every candidate stays in the folder.
2. **The real size is an input.** `dimensions.json` holds `length 0.62 m`, `width 0.66 m`,
   `height 0.88 m`, sourced as a decision of the art director on 2026-11-18. No view is measured to
   get it.
3. **The subject prompt is data, at most five lines**, and it describes the object the reference
   shows: identity features and the three dimensions in words. `L` and `l` differ only by case and are
   not used for a run.
4. **At most three generations**, per the budget of T0017 §R2.3.
5. **The five render points of T0017 §R2.1** apply to every candidate: the drafter's verdict, the
   headless asset contract, the catalogue, the transpiled route, and the page globals.

## TDD Tasks

- [x] **T18.1 — The reference**: one generation call, one cleaning call, `source.jpg` preserved.
- [x] **T18.2 — The subject folder**: `notes.md` and `dimensions.json` written before any run.
- [x] **T18.3 — The runs**: three generations at the default preset, each recorded with its command,
      its token counts, its verdict, and its measured bounding box.
- [x] **T18.4 — The checks**: the five points on the valid candidate.
- [x] **T18.5 — The audit**: the Bender agent reads the reference, the notes, and the dimensions, runs
      `--ask`, and reports the gaps. No generation, no edit.
- [x] **T18.6 — The gates**: `bun test` and `bun run format`.

## Acceptance Criteria

- **AC1 — One reference, no background.** `reference.jpg` is 1376 × 768, holds the whole chair on a
  pure white field, and `source.jpg` holds the pre-cleaning bytes unchanged.
- **AC2 — The size is an input.** `dimensions.json` states the three values and their source, and a
  run prints them in its `* dimensions:` bullet.
- **AC3 — A valid candidate, rendered.** At least one candidate is `valid` and passes the five points
  of T0017 §R2.1, point 5 read headless and not captured.
- **AC4 — The budget.** No more than three generations.
- **AC5 — The gates.** `bun test` is green and `bun run format` reports no change.

## Implementation Notes

### The image calls

| Step | Model                             | Result                                                |
| :--- | :-------------------------------- | :---------------------------------------------------- |
| 1    | `opencode/gemini-nano-banana-2.1` | `source.jpg`, 1376 × 768, 787 KB, room background     |
| 2    | `opencode/gemini-nano-banana-2.1` | `reference.jpg`, 1376 × 768, 274 KB, pure white field |

Two calls of the budget of three. The cleaning removed the bookshelves, the desk, the rug, the
parquet floor, and the window, and kept the shape, the wood, the leather, the studs, the base, and the
casters.

### The three generations

All at the default preset, `tiny`, one image, `--style "low poly"`.

```text
--01  no size bullet                                          61 s   valid
     box 1.160 × 2.061 × 0.815 m
--02  dimensions.json, L=0.62 m, h=0.88 m, l=0.66 m           62 s   valid
     box 0.958 × 1.668 × 1.113 m
--03  --size "length 0.62 m (front to back), width 0.66 m
      (left to right), height 0.88 m"                         85 s   valid
     box 0.868 × 1.451 × 0.853 m
```

Target 0.66 × 0.88 × 0.62 m. The three are too tall. `--03` is the closest and still overshoots by
65 % in height, and its root starts at `y = 0.0487` instead of `0`. **The model chooses the scale; the
bullet does not bind it.**

### The five points on `--03`

1. `valid`.
2. `{"checkAsset":{"problems":[]},"checkRoot":[]}`.
3. `/api/assets` → `valid: true  error: null`.
4. `/asset/<path>` → `200`, `text/javascript; charset=utf-8`, `export default: 1`, `from "three": 1`.
5. `{"error":null,"ready":true,"stats":{"triangles":1180,"meshes":53,
"size":[0.8678998806239431,1.4513292346894742,0.8530414175185289],"draws":101}}`.

The module holds no `THREE.Scene`, no camera, no renderer, no `document`, and no `window`.

### What the audit changed

The Bender agent audited the folder before the last run and found three defects, all corrected here:

1. `notes.md` still said that `dimensions.json` was absent — a stale section, written before the file
   existed.
2. The subject prompt file described the **commission**, not the object: it carried no identity
   feature, so the five features of the reference (open wooden arms, brass studs, five flat spokes,
   black mechanism, casters) reached the model on no run.
3. `L=0.62` and `l=0.66` differ only by case. The model answered by building a 1.11 m depth on a
   0.66 m seat, and `--03` passes `--size` with the three words instead.

### Open, and not this ticket's business

- **The origin is not at the base.** `checkRoot` does not test `y = 0`, so a candidate whose root
  floats passes the contract. This is a validation gap, and it needs its own ticket.
- **The scale does not follow the bullet.** A 4B model places absolute coordinates inside groups that
  are already offset. No prompt wording fixed it in three runs.
- **`multimodal: null`.** The endpoint declares no vision projector, and the image is tokenised but
  its reading is not guaranteed. The prompt token counts rise when an image is attached, which proves
  the parts arrive; it proves nothing about what the model does with them.
