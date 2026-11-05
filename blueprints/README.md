# Blueprints

One folder per subject. Each subject holds the chosen identity image and one folder per view.
Before a subject exists, the material lives in a draft folder.

```text
blueprints/
  drafts/                 # research. Not a subject. The view generator skips it.
    <draft>/
      subject/            # what to model. One or more images of the subject. Not guaranteed complete.
      style/              # how to render it. One or more style images.
      notes.md            # optional. "## Subject", "## Specific subject details", "## Style".
      <model-slug>--01.webp   # draft candidates, at the draft root
      manifest.json
  vehicules/
    <subject>/
      reference.webp      # the chosen identity image. Written by the art director.
      source.webp         # the original identity bytes, kept when a cleaning pass runs.
      <model-slug>--01.webp  # cleaning candidates, at the subject root
      notes.md            # optional. Camera note and hidden parts.
      manifest.json       # written by the generator
      front/ left/ back/ right/ top/ bottom/
  characters/
  objects/
```

## Draft folder

A draft is not a subject. It gathers the reference images that the art director collected:

- `subject/`: what to model. Several images of the same object, in file-name order.
- `style/`: how to render it. The wanted visual treatment.

The draft stage combines them into one modeling reference image. The art director promotes the
chosen candidate to `reference.<ext>` of a subject folder. That promotion is the decision.

A draft never receives generated views. `drafts/` is skipped by the view stage.

## Subject folder

- The name is kebab case: `blue-van-01`.
- `reference.<ext>` is the chosen identity image. The art director writes it.
- `source.<ext>` holds the original identity bytes. The cleaning stage writes it, once, before it
  replaces the reference. Never edit it.
- Generation reads `reference.<ext>` only.
- `notes.md` tells which face looks at the camera and which parts are hidden.

## View folder

A view folder holds:

- the candidates, named `<model-slug>--<NN>.<ext>`,
- `reference.<ext>` once the art director accepts one candidate.

`reference.<ext>` locks the view. The next generation run skips it.

A new run appends with the next free counter. A candidate never leaves its view folder. There is
no archive folder, no `_superseded/`, no `old/`. A rejected candidate stays next to the accepted
one, because the rejected files are the evidence of the decision.
