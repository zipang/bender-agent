# Blueprint Prompt Rationale

The live prompt is `scripts/blueprint-generate/prompts/blueprint.md`. Edit that file to tune a
generation. This document explains why the prompt is shaped that way.

## Structure

The prompt has two layers.

1. **Shared layer.** The task, the style, the camera rules, the background, and the corrections.
2. **View layer.** One paragraph that states the camera position and the facing direction.

The shared layer never changes between views. Only the view layer changes. This keeps the subject
description constant, which reduces identity drift.

## Placeholders

| Placeholder | Why it exists |
| :--- | :--- |
| `{subjectType}` | A figurine of a vehicule and a figurine of a character need different framing habits. |
| `{style}` | Style must stay constant across the six views. A style change between views breaks the set. |
| `{view}` | The template states the view name inside the sentence, which reinforces the camera request. |
| `{subjectName}` | Reference only. It helps a human read the log. |

## Why `DO NOT` and `DO` lines

A negative instruction alone is weak. A positive correction works better when the model already
adds the defect.

- `DO NOT use shadows` removes the drop shadow and the contact shadow.
- `DO NOT add any support, base, pedestal, or separate accessory` removes the stand, because a
  model may otherwise read "figurine" as "figurine on a base".
- `DO remove any artifact that is not the main subject` handles halos, speckles, and stray marks.
- `DO keep the same proportions, materials, colors, and wear` protects the identity features.

## Why the image is named as the subject

The sentence `The subject of the attached reference image is the subject to reproduce` prevents a
common failure. Without it, a model can treat the attached image as a style reference and design a
new subject in that style.

## Why hidden details are allowed

`Extrapolate the hidden details of the reference subject` is deliberate. A single reference image
does not show the back, the underside, or the far side. Without permission to extrapolate, the model
either repeats the visible face or leaves the surface empty.

The cost is invention. The art director must check every extrapolated region and record it in the
hand-off note as uncertain.

## Repair prompt

Use this when the art director rejects a view for one specific defect.

```text
Regenerate only the {view} orthographic view from the same attached reference image.
Keep the subject identical. Correct only this defect: [ART_DIRECTOR_NOTE].
Do not change any other part. True orthographic camera, pure white background, full silhouette,
no shadows, no support, no extra accessory.
```

## Non-binding observation

This prompt is optional and it never approves or rejects an image. The art director decides.

```text
Describe the visible differences between the attached reference image and the candidate image.
Do not classify the candidate as correct or incorrect. List observations only.
```
