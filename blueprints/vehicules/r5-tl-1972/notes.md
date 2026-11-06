# Renault 5 TL 1972

Subject folder for the 1972 Renault 5 TL.

## Reference

`reference.png` is a two-panel sheet: a front three-quarter view from the left, and a rear
three-quarter view from the right, at mid camera height, on a pure white field.

It was produced in two steps:

1. The draft `r5` combined two subject photos and one style image into this sheet.
2. A repair pass removed the plate characters, the Renault badge, and the interior seen through
   the glass. The chosen repair is `google-gemini-nano-banana-2-1--03.png`.

`source.png` holds the pre-repair bytes. It is the original identity image and is never modified.
The rejected repair candidates stay next to the chosen one, as evidence of the decision.

## Camera note

The reference is NOT a single view. It holds two panels side by side:

- left panel: front three-quarter, the front of the vehicle points to the left;
- right panel: rear three-quarter, the front of the vehicle points to the left.

The six orthographic views are generated from this image, so every view run must be told that the
reference holds two panels and that only one panel is used per view.

## Hidden parts

No photograph shows a pure side profile, a top, or an underside. Those regions exist only in the
generated views, so treat them as hypotheses: useful for shape, not measured truth.

## Specific subject details

Three doors only: one door per side, no rear door. The body is orange over the whole shell.

The plates are blank on purpose: no character and no number appears on any plate. Do not invent a
plate text. The badge is absent on purpose: do not add a manufacturer emblem to the grille or the
tailgate.

All windows are opaque dark glass. No interior is visible, and none must be added.

## Accepted views

All six views are locked. Every file is `<view>/reference.<ext>`.

| View | Model | Size | Note |
| :--- | :--- | :--- | :--- |
| front | meta/muse-image-1.0 | 2048x1152 | Clean, no interior visible |
| left | google/gemini-nano-banana-2.1 | 1376x768 | Three doors, opaque glass |
| back | google/gemini-nano-banana-2.1 | 1376x768 | Blank plate frame, low tailgate |
| right | google/gemini-nano-banana-2.1 | 1376x768 | Mirror of the left view |
| top | google/gemini-nano-banana-2.1 | 1376x768 | Roof and bonnet plans |
| bottom | google/gemini-nano-banana-2.1 | 896x1200 | Portrait ratio, not 16:9 |

The bottom view is the least reliable. It was generated with a note that asked for a flat closed
underbody with no driveshaft and no rear axle, and the model kept the flat floor but added a grill
of slots under the rear bumper and light stains on the floor. The art director accepted it for its
style, not for its accuracy. Treat the underbody as uncertain.

## Uncertain regions

These parts are extrapolated, never photographed. Check them before you model them:

- the underbody, the sill profile, and the wheel wells,
- the roof plan and the bonnet plan,
- the grille depth and the lamp housings,
- the exact ride height and the wheelbase.

The front view comes from muse, the five others from nano. Expect a small style drift between the
front and the rest: the muse render is flatter and lighter than the nano renders.

## Hand-off

The blueprint is complete: six locked views, one reference sheet, and one source. The next stage
is progressive volume modeling, and it starts at L0.

Read `reference.png` and the six `<view>/reference.<ext>` files. Do not read `source.png`: it is
the pre-repair image, kept only as evidence.
