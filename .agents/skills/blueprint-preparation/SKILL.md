---
name: blueprint-preparation
description: Draft and prepare controlled multi-view reference sheets before 3D modeling. Use when a subject needs a first reference image combined from subject and style images, when front, left, back, right, top, and bottom orthographic views are required, when no blueprint exists, when a reference image needs cleanup, or when an image model must extend one reference image into consistent views for a game asset.
---

# Blueprint Preparation

This skill creates a **reference package** before 3D modeling. It does not create the final mesh.
The package is one folder per subject, with one chosen reference image and one folder per view.

## Scope

Use this skill for game characters, vehicles, robots, and props. Support real and imaginary
subjects. Treat every generated view as a hypothesis. Do not treat generated pixels as measured
truth.

## Folder contract

A draft, before the subject exists:

```text
blueprints/drafts/<draft>/
  subject/                      # what to model. One or more images of the subject. Not guaranteed complete.
  style/                        # how to render it. One or more style images.
  notes.md                      # optional. "## Subject", "## Specific subject details", "## Style".
  <model-slug>--01.webp         # draft candidates, at the draft root
  manifest.json                 # written by the generator. Append only.
```

A subject:

```text
blueprints/<category>/<subject>/
  reference.png | reference.webp # the chosen identity image. Written by the art director.
  source.png | source.webp      # the identity bytes before a cleaning pass. Never modified.
  notes.md                      # optional. Camera note and hidden parts.
  manifest.json                 # written by the generator. Append only.
  <model-slug>--01.webp         # cleaning candidates, at the subject root
  front/
  left/
  back/
  right/
  top/
  bottom/
```

Each view folder holds the candidates, then the choice:

```text
front/
  meta-muse-image-1-0--01.webp
  meta-muse-image-1-0--02.webp
  reference.webp                # the art director's choice. Locks the view.
```

Categories in use: `vehicules`, `objects`, `characters`.

Material that is not ready goes to `blueprints/drafts/<name>/`. A draft is not a subject.

## Three stages

### Stage 0: draft the reference image

A draft holds the two kinds of reference image that the art director collected: `subject/`, which
says what to model, and `style/`, which says how to render it. One generation combines them into a
single reference image on a uniform white field.

The model receives the subject images first, then the style images, in file-name order. The prompt
names the role of each range by index, so a wrong order makes the model mix the two roles.

Only the art director promotes a candidate to a subject folder:

```bash
bun run blueprint-generate.ts --promote --draft blueprints/drafts/<draft> \
  --file <candidate> --subject blueprints/<category>/<subject>
```

The promotion copies the candidate to `<subject>/reference.<ext>`.

### Stage 1: clean the reference

Run this stage only when the reference is not isolated on a uniform white field. Artifacts such as
a white outline, a cast shadow, a halo, or speckles propagate to every generated view.

The pass copies the current `reference.<ext>` to `source.<ext>` before it writes anything. The
promoted bytes are then never lost, and the pass can run again from the untouched image.

### Stage 2: generate the views

Generation reads `reference.<ext>`. It never reads `source.<ext>`.

## Core rules

1. The chosen reference image is the only identity authority.
2. Do not write an identity description, an identity JSON file, or a subject spec. A text
   description cannot preserve an arbitrary subject across generations.
3. Use only models that accept a reference image and return a raster image. Check with
   `bun run blueprint-generate.ts --list-models`.
4. Generate one view per request. Keep the model, aspect ratio, and prompt family constant.
5. Use orthographic wording. Do not use words such as cinematic, dramatic, perspective, or action.
6. Request a neutral pose, a neutral camera, and a plain white background.
7. Do not request color changes, new parts, or material redesign.
8. Allow extrapolation of hidden geometry, because one image cannot show the back or the
   underside. Mark every extrapolated region as uncertain in the hand-off note. The art director
   must check it.
9. The art director validates every image. No model decides.
10. Never delete a candidate. The art director keeps the rejected files as evidence.
11. Never move a candidate out of its folder. There is no archive folder, no `_superseded/`, no
    `old/`. A rejected candidate stays next to the accepted one.
12. A new generation appends with the next free counter. The folder only grows. The art director
    asks for a new generation because a view is missing, not because old files are in the way.

## Workflow

### Stage 0: draft the reference image

The subject set is raw evidence, not a controlled set. It can hold several angles of different
quality, and the images may not be perfectly consistent. The prompt must not assume a category:
the subject can be an object, a machine, a vehicle, a character, a creature, or a product.

1. Collect the material in `blueprints/drafts/<name>/subject/` and `blueprints/drafts/<name>/style/`.
2. Name the files with a numeric prefix so the order is explicit: `01.jpg`, `02.jpg`.
3. Run `--ask` first. It spends nothing and lists the gaps in the material: a missing opposite
   view, a missing subject note, a missing detail list, a missing style image. Fill the gaps in
   `notes.md`, then rerun without `--ask`.
4. Generate the combined reference image. Two opposite three-quarter panels give the views stage
   the most to work with:

```bash
cd scripts/blueprint-generate
bun run blueprint-generate.ts --draft blueprints/drafts/<name> \
  --models meta/muse-image-1.0 --variants 3 \
  --style "low-poly stylized video game figurine" --two-view
```

5. Show every candidate. Ask which one becomes the reference.
6. Promote it with `--promote --draft ... --file ... --subject blueprints/<category>/<subject>`.

### Stage 1: clean the reference

Skip this stage when the promoted reference already sits on a uniform white field.

1. Create `blueprints/<category>/<subject>/` if it does not exist.
2. Run the cleaning pass:

```bash
cd scripts/blueprint-generate
bun run blueprint-generate.ts --clean \
  --subject blueprints/vehicules/blue-van-01 \
  --models meta/muse-image-1.0 --variants 2
```

The pass copies the reference to `source.<ext>` before it writes anything.

3. Show every candidate to the art director. Give the file path of each one.
4. Ask which candidate to keep. Wait for the answer.
5. Copy the chosen file to `reference.<ext>` at the subject root.

Never choose yourself. Two candidates always differ, and only a human sees which one is clean.

### Stage 2: write the note

Write `notes.md` with the camera note and the hidden parts, in English.

### Stage 3: generate the views

```bash
bun run blueprint-generate.ts --subject blueprints/vehicules/blue-van-01 \
  --models meta/muse-image-1.0 --variants 3 --style "low-poly stylized video game figurine"
```

Delete nothing and move nothing. Read every candidate. A new run appends with the next free
counter, so the older candidates stay in the same folder.

### Stage 4: art director review

The art director is the only validator. For each candidate, check:

- silhouette and global proportions,
- part count and part placement,
- colors, materials, and wear marks,
- symmetry and asymmetry,
- view direction,
- perspective and camera convergence,
- cropping and margins,
- agreement with the other accepted views.

Do not use a vision model to approve or reject a view. A vision model can invent errors and can
miss real errors.

Record `accepted`, `needs-revision`, or `rejected` in the manifest, with a reason.

### Stage 5: lock the view

Copy the chosen candidate to `<subject>/<view>/reference.<ext>`, keeping its real extension. The
next run skips that view. The lock is a human decision, written as a file.

### Stage 6: assemble the sheet

Assemble the six accepted views with deterministic TypeScript or an image editor. Keep the same
subject scale in every cell. Add labels outside the silhouette. Do not add dimension arrows unless
a scale anchor exists.

### Stage 7: hand off to 3D

Write the hand-off note with:

- chosen unit profile,
- scale anchor and confidence,
- canonical forward direction,
- accepted view files,
- uncertain regions,
- identity features that must not change,
- recommended L0 envelope and L1 masses,
- excluded details.

The modeling workflow starts only after this hand-off passes.

## Prompt templates

Three text files hold the prompts. Edit them to tune a generation. No code change is needed.

- `scripts/blueprint-generate/prompts/draft.md` for the draft stage.
- `scripts/blueprint-generate/prompts/clean.md` for the cleaning pass.
- `scripts/blueprint-generate/prompts/blueprint.md` for the views.

Placeholders:

| Placeholder | Value | Source |
| :--- | :--- | :--- |
| `{subjectType}` | `vehicule`, `character`, or `object` | `--subject-type`, else the category folder |
| `{subject}` | `vehicle`, `character`, or `object` | the subject type |
| `{subjectCount}` | Number of subject images | the `subject/` folder, draft stage |
| `{styleCount}` | Number of style images | the `style/` folder, draft stage |
| `{styleFirst}` | Index of the first style image | the subject count + 1 |
| `{imageCount}` | Total attached images | subject count + style count |
| `{pose}` | Camera pose | `--pose` |
| `{subjectNote}` | Art director words about the subject | `--subject-note`, else `notes.md` |
| `{specificSubjectDetails}` | What to keep and how to read an ambiguous reference. Wins over every image | `--specific-subject-details`, else `## Specific subject details` in `notes.md` |
| `{styleNote}` | Art director words about the style | `--style-note`, else `notes.md` |
| `{style}` | Rendering style | `--style` |
| `{view}` | `front`, `left`, `back`, `right`, `top`, `bottom` | the view being generated |
| `{referenceViewsBlock}` | The viewpoints held by the reference image, and which panel serves this view | `--reference-views` |
| `{defects}` | Defects to remove | `--defects` |
| `{subjectName}` | Subject or draft folder name | the folder |

The draft prompt names the role of each image range by index. The subject range comes first,
because a subject that is merged with a style object cannot be separated later.

The cleaning prompt states that the attached image **contains** one main subject, and names its
kind. It must not say that the image is the subject.

The cleaning prompt removes the ground as well as the shadow. A subject isolated on white has no
floor, so there is no contact area to preserve.

## Passing the image to the model

The catalog declares two kinds of image producer, and they use different SDK calls.

Type `image` uses `generateImage`. The reference images go in `prompt.images`, in order:

```ts
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: 'meta/muse-image-1.0',
  prompt: { text: promptText, images: subjectBytes.concat(styleBytes) },
  size: '1024x1024',
});
```

Type `language` uses `generateText`. The image is a file content part, and the generated image
comes back in `result.files`:

```ts
import { generateText } from 'ai';

const result = await generateText({
  model: 'google/gemini-nano-banana-2.1',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'file', data: referenceBytes, mediaType: 'image/webp' },
      ],
    },
  ],
});
```

Read the catalog `type` and pick the matching call. Do not guess.

Providers differ on sizing. `meta/muse-image-1.0` rejects `aspectRatio` and needs `size`. The
generator retries once and stores the working parameter in `manifest.json` under `modelParams`.

## Verification

Before modeling, check that:

- every view has a `reference.*` file chosen by the art director,
- the six views describe one subject,
- no view uses obvious perspective,
- no view contains extra or missing parts,
- hidden regions are listed in the note,
- the package supports an L0 envelope and an L1 mass split.

If a view fails, generate new variants for that view only.

## Files

- `scripts/blueprint-generate/prompts/blueprint.md`: the live view prompt template.
- `scripts/blueprint-generate/prompts/clean.md`: the live cleaning prompt template.
- `references/prompts.md`: the prompt rationale and the repair prompt.
- `references/model-candidates.md`: usable and rejected models, with the reason.
- `references/capability-sources.md`: where the capability evidence comes from.
- `scripts/blueprint-generate/`: the generator.
