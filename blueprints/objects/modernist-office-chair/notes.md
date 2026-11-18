# Modernist office chair (1910)

Subject folder for a modernist office chair: walnut frame, yellow leather seat and back.

## Reference

`reference.jpg` is the identity image: one chair, three-quarter front view, on a pure white field.
The whole chair is visible and centred. It was produced in two steps:

1. `opencode/gemini-nano-banana-2.1` generated one image from the prompt
   `a modernist office chair (1910), walnut wood, yellow leather`. The raw result is `source.jpg`.
2. One cleaning pass removed the room: the bookshelves, the desk, the rug, the parquet floor, and
   the window. The chosen cleaning is `reference.jpg`.

`source.jpg` holds the pre-cleaning bytes. It is the original identity image and is never modified.

## Subject

a wooden swivel desk chair, walnut frame, yellow leather, cast iron mechanism.

## What the image shows

- A walnut frame, two arms, and a five-spoke wooden base.
- A yellow leather seat and a yellow leather back, with brass studs along the back edge.
- A dark metal column and a tilt mechanism between the seat and the base.
- Five casters, one at the end of each spoke.

The image shows the front and the left side. It shows no back, no underside, and no pure side
profile, so treat those regions as hypotheses: useful for shape, not measured truth.

## Dimensions

The real size is an **input** of a generation, and it is a decision of the art director.
`dimensions.json` holds it, with its source:

| Axis | Value | Meaning            |
| :--- | ----: | :----------------- |
| `z`  |  0.62 | length, front-back |
| `x`  |  0.66 | width, left-right  |
| `y`  |  0.88 | height             |

The notation `L` and `l` differs only by case and confuses a small model, so a run that needs an
unambiguous size passes `--size` with the three words instead of the compact line.

## Hand-off

`reference.jpg` was sent as a `tiny` PNG (384 × 214, 11 KB) on every run of this subject.

| Candidate | Size bullet                    | Verdict | Measured box, m (x, y, z) |
| :-------- | :----------------------------- | :------ | :------------------------ |
| `--01`    | none                           | `valid` | 1.160 × 2.061 × 0.815     |
| `--02`    | `L=0.62 m, h=0.88 m, l=0.66 m` | `valid` | 0.958 × 1.668 × 1.113     |
| `--03`    | three words, `--size`          | `valid` | 0.868 × 1.451 × 0.853     |

Target: 0.66 (x) × 0.88 (y) × 0.62 (z). All three candidates are too tall, and the root of none sits
exactly at `Y = 0` — `--03` starts at 0.0487. The scale and the origin are the model's, not the
prompt's: `--03` is the best of the three and still overshoots by 65 % in height.

The shared viewer draws any candidate with `bun run tools/scene-viewer/serve.ts --asset <path>`.
