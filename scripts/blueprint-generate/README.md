# Blueprint Generator

Three stages, one script. Each stage ends when the art director chooses a file. The script never
scores, ranks, or deletes an image.

| Stage | Input | Output |
| :--- | :--- | :--- |
| 0. Draft | `blueprints/drafts/<draft>/subject/*` and `style/*` | candidates at the draft root |
| 1. Clean | `reference.<ext>` of a subject | cleaning candidates at the subject root |
| 2. Views | `reference.<ext>` of a subject | six view folders of candidates |

## Layout

```text
blueprints/
  drafts/
    r5/                      # a draft. Not a subject yet.
      subject/               # what to model. One or more images of the same object.
        01.jpg  02.jpg
      style/                 # how to render it. One or more style images.
        01.webp
      notes.md               # optional. "## Subject" and "## Style".
      meta-muse-image-1-0--01.webp   # draft candidates, at the draft root
      manifest.json
  vehicules/
    blue-and-white-minivan-01/
      source.webp            # the raw material. Never modified.
      reference.webp         # the chosen identity image. Written by the art director.
      notes.md               # optional. Camera note and hidden parts.
      manifest.json          # written by the script. Append only.
      meta-muse-image-1-0--01.webp    # cleaning candidates, at the subject root
      meta-muse-image-1-0--02.webp
      front/
        meta-muse-image-1-0--01.webp
        meta-muse-image-1-0--02.webp
        reference.webp       # written by the art director. Locks the view.
      left/
      back/
      right/
      top/
      bottom/
  characters/
  objects/
```

The view folders are always `front`, `left`, `back`, `right`, `top`, and `bottom`.

Candidate names are `<model-in-kebab-case>--<NN>.<ext>`. The double hyphen separates the model
slug from the variant number, because model slugs already contain digits and hyphens.

The script reads the returned media type and writes `.png`, `.webp`, or `.jpg` accordingly.

## Three stages

### Stage 0: draft the reference image

A subject starts as a collection of images in `blueprints/drafts/<draft>/`. The art director
gathers two kinds of reference:

- `subject/`: what to model. One or more images of the subject. They are not guaranteed to be
  complete, consistent, or sharp. The model resolves the gaps.
- `style/`: how to render it. One or more images of the wanted visual treatment.

The draft stage combines them into one modeling reference image: the exact subject, the wanted
rendering style, and a uniform pure white background. That image becomes the identity image of the
subject.

```bash
cd scripts/blueprint-generate
bun run blueprint-generate.ts \
  --draft blueprints/drafts/r5 \
  --models meta/muse-image-1.0 \
  --variants 3
```

Images are attached in order: every subject image first, then every style image. The prompt names
the role of each range by index. The order inside a folder is the file-name order, so prefix the
files with `01`, `02`, and so on.

The prompt also takes these optional additions:

- `--pose "<text>"` sets the camera pose of a single-panel reference image. The default is a front
  three-quarter view.
- `--pose-b "<text>"` sets a second pose. `--two-view` is shorthand for `--pose` plus `--pose-b` and
  asks for two opposite three-quarter panels in one row. This is the recommended default: the views
  stage has more to work with.
- `--poses "<a> | <b> | <c>"` sets one pose per panel directly. It wins over the older flags.
- `--subject-note "<text>"` and `--style-note "<text>"` add words from the art director. Without
  them, the script reads `## Subject` and `## Style` from `notes.md`.
- `--specific-subject-details "<text>"` states what must survive and how to read an ambiguous
  reference: the identity features, a part whose position is unclear, a colour a photo gets wrong.
  Without it, the script reads `## Specific subject details` from `notes.md`. This field is the
  strongest rule in the prompt: it wins over every image when they disagree.
- `--max-images <n>` caps the number of reference images in one request. The default is 6. A
  larger set stops the run before it spends anything.

Before spending anything, run `--ask`. It sends no request. It lists the gaps in the material: a
missing opposite view, a missing subject note, a missing detail list, a missing style image. Fill
the gaps in `notes.md`, then rerun without `--ask`.

The candidates land at the draft root. Review them, then promote the chosen one:

```bash
bun run blueprint-generate.ts \
  --promote \
  --draft blueprints/drafts/r5 \
  --file meta-muse-image-1-0--02.webp \
  --subject blueprints/vehicules/renault-5-01
```

The promotion copies the candidate to `<subject>/reference.<ext>` and records it under
`promotions` in the draft manifest. It refuses to overwrite an existing reference.

### Stage 1: clean the reference

The identity image often carries artifacts: a white outline around the subject, a cast shadow, a
halo, speckles. Those artifacts propagate to every generated view. Run this stage only when the
subject is not isolated on a uniform white field.

```bash
bun run blueprint-generate.ts \
  --clean \
  --subject blueprints/vehicules/blue-and-white-minivan-01 \
  --models meta/muse-image-1.0 \
  --variants 2
```

Before anything is written, the current `reference.<ext>` is copied to `source.<ext>`, unless a
source already exists. The original identity bytes are then never lost, and the pass can be
repeated from the untouched image.

The candidates land at the subject root. Review them and copy the chosen one to
`reference.<ext>`, at the same level. That copy is the choice.

### Stage 2: generate the views

```bash
bun run blueprint-generate.ts \
  --subject blueprints/vehicules/blue-and-white-minivan-01 \
  --models meta/muse-image-1.0 \
  --variants 3
```

Generation reads `reference.<ext>`. A locked view is skipped.

A reference image can hold several panels: the draft stage produces a two-panel sheet. The view
prompt must then know it, or the model reproduces both panels in every view. Name the viewpoints
with `--reference-views`, in panel order:

```bash
bun run blueprint-generate.ts \
  --subject blueprints/vehicules/r5-tl-1972 \
  --models meta/muse-image-1.0 \
  --reference-views "a front three-quarter view from the left | a rear three-quarter view from the right"
```

The prompt then lists the panels and tells the model that one panel serves the view being
generated. Without the flag, the prompt states that the reference holds one single viewpoint.

Generate every ready subject under `blueprints/`. `drafts/` is skipped, and a subject without a
chosen reference is skipped:

```bash
bun run blueprint-generate.ts --all --models meta/muse-image-1.0 --variants 2
```

## Commands

Run the commands from `scripts/blueprint-generate`. The subject path resolves from the repository
root, so it always starts with `blueprints/`.

List the models that accept a reference image and return an image:

```bash
cd scripts/blueprint-generate
bun run blueprint-generate.ts --list-models
```

## Options

| Option | Meaning | Default |
| :--- | :--- | :--- |
| `--draft <dir>` | Stage 0. A draft folder with `subject/` and `style/` | off |
| `--promote` | Copy one draft candidate to `<subject>/reference.<ext>` | off |
| `--file <name>` | The candidate to promote, inside the draft folder | required with `--promote` |
| `--pose <text>` | Camera pose of the draft reference image | front three-quarter |
| `--pose-b <text>` | Second panel pose. Shorthand for two poses | off |
| `--two-view` | Two opposite three-quarter panels in one row | off |
| `--poses <list>` | One pose per panel, separated by `|` | off |
| `--subject-note <text>` | Art director words about the subject | `notes.md` |
| `--specific-subject-details <text>` | What to keep and how to read an ambiguous reference. Wins over images | `notes.md` |
| `--style-note <text>` | Art director words about the style | `notes.md` |
| `--ask` | List the gaps in the material. Sends no request | off |
| `--max-images <n>` | Maximum reference images in one draft request | 6 |
| `--draft-template <path>` | Draft prompt template | `prompts/draft.md` |
| `--subject <dir>` | One subject folder | required unless `--all` or `--draft` |
| `--all` | Every ready subject under `blueprints/<category>/<subject>/` | off |
| `--models <ids>` | Comma separated `provider/model` IDs | required to generate |
| `--variants <n>` | Candidates per request and per model | 1 |
| `--views <list>` | `front,left,back,right,top,bottom` | all |
| `--reference-views <list>` | Viewpoints held by the reference image, in panel order, separated by `|` | one single viewpoint |
| `--aspect <ratio>` | Requested aspect ratio | `1:1` |
| `--style <text>` | Rendering style injected into the prompt | `low-poly stylized video game figurine` |
| `--subject-type <t>` | `vehicule`, `character`, or `object` | read from the category folder |
| `--template <path>` | View prompt template | `prompts/blueprint.md` |
| `--clean` | Clean the reference image instead of generating views | off |
| `--defects <text>` | Defects to remove | white outline, cast shadow, halo, speckles |
| `--clean-template <path>` | Clean prompt template | `prompts/clean.md` |
| `--concurrency <n>` | Parallel requests | 2 |
| `--list-models` | Print compatible models and prices | off |

## Prompt templates

Three text templates. Edit them to tune a generation. No code change is needed.

### `prompts/draft.md`

One `[shared]` section that names the role of each image range, plus two alternatives for the
style block: `[style]` when style images exist, `[no-style]` when they do not.

| Placeholder | Value |
| :--- | :--- |
| `{subject}` | `vehicle`, `character`, or `object` |
| `{subjectCount}` | Number of subject images |
| `{styleCount}` | Number of style images |
| `{styleFirst}` | Index of the first style image |
| `{imageCount}` | Total number of attached images |
| `{style}` | Rendering style |
| `{pose}` | Camera pose |
| `{subjectNote}` | Art director words about the subject |
| `{styleNote}` | Art director words about the style |

### `prompts/blueprint.md`

One `[shared]` section and one section per view. `[shared]` runs for every view, and the matching
view section is appended after it.

| Placeholder | Value | Source |
| :--- | :--- | :--- |
| `{subjectType}` | `vehicule`, `character`, or `object` | `--subject-type`, else the category folder |
| `{style}` | Rendering style | `--style` |
| `{view}` | `front`, `left`, `back`, `right`, `top`, `bottom` | the view being generated |
| `{referenceViewsBlock}` | The viewpoints held by the reference, and which panel serves this view | `--reference-views` |
| `{subjectName}` | Subject folder name | the folder |

### `prompts/clean.md`

One `[shared]` section.

| Placeholder | Value | Source |
| :--- | :--- | :--- |
| `{subject}` | `vehicle`, `character`, or `object` | the subject type |
| `{defects}` | The artifacts to remove | `--defects` |
| `{editsBlock}` | The authorized content changes, one bullet each | `--edits` |
| `{panelNote}` | How many panels the repair must preserve | `--panels` |
| `{subjectName}` | Subject folder name | the folder |

An unknown placeholder stops the run with an error. A missing section stops the run with an error.

## Model filter

The script fetches `https://ai-gateway.vercel.sh/v1/models` before it spends anything. A model is
usable only when it declares image input and image output. A model that generates images from text
only is rejected. Models that return vector formats are rejected.

The catalog declares two kinds of image producer, and they use different SDK calls:

| Catalog `type` | SDK call | Reference image | Result |
| :--- | :--- | :--- | :--- |
| `image` | `generateImage` | `prompt.images` | `result.image` |
| `language` | `generateText` | file content part | `result.files` |

The script picks the call from the catalog. `meta/muse-image-1.0` is of type `image`.

Stage 0 sends several images in one request: the subject set first, then the style set. The catalog
does not declare a per-model image limit, so `--max-images` guards the request size.

One request per model learns whether the provider accepts `aspectRatio` or needs `size`. The result
is stored in `manifest.json` under `modelParams`, so later runs do not repeat the retry.

## Variant numbering

Numbers are additive. A second run writes `--04` and later. An existing candidate is never
overwritten.

Candidates never leave their view folder. There is no archive folder. A rejected candidate stays
next to the accepted one, because the rejected files are the evidence of the decision.

The folder grows until the art director has chosen a reference for every view. The art director
asks for a new generation because a view is still missing, not because the old files are in the
way.

## Locking a view

1. Review the candidates in `<subject>/<view>/`.
2. Copy the chosen file to `<subject>/<view>/reference.<ext>`, keeping its real extension.
3. The next run skips that view.

The script detects the lock by content hash. The lock is the presence of a `reference.*` file in the
view folder.

## Manifest

`manifest.json` records every attempt: slot, model, variant, file, media type, prompt, prompt
version, aspect ratio, latency, byte size, price estimate, timestamp, and the review state.

The slot is a view name, `reference` for a cleaning candidate, or `draft` for a draft candidate.

`promotions` records every draft candidate that the art director promoted to a subject: the file,
the target, the content hash, and the time.

`modelParams` caches whether each provider accepts `aspectRatio` or needs `size`.

`reference` records the identity image of the subject: file, media type, and content hash.

The script writes `selected: true` on the entry whose bytes match the `reference.*` file of the
slot. This is bookkeeping. It is not a quality decision. A draft entry is never marked selected;
promotion is the decision.

## Cost

`manifest.json` and the console show a price estimate per model when the catalog publishes one.
The estimate is informational. Check the provider billing page for the real price.
