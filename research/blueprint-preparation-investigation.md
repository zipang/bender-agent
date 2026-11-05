# Blueprint Preparation Investigation

## Purpose

This report defines a reference workflow before 3D modeling. The workflow starts from one reference
image and creates a controlled six-view reference package.

The target application is game asset production. The package supports characters, vehicles,
robots, and props. It supports real and imaginary subjects.

## 1. Problem statement

A single image contains identity, silhouette, visible parts, and camera information. It does not
contain the complete volume. It also does not identify the camera model with certainty.

A generative model that produces a side view can change the subject. It can add parts, remove
parts, mirror an asymmetry, or use perspective. A model that produces a top or bottom view must
invent most of the visible surface.

The workflow therefore separates four tasks:

1. isolate the subject,
2. generate one controlled view from the reference image,
3. let the art director accept or reject it,
4. assemble the accepted views into a sheet.

A blueprint package is a reviewed reference set. It is not a truth source.

## 2. The image is the identity

An early version of this workflow tried to lock identity in a JSON file. That approach fails. A
text description cannot preserve an arbitrary subject across image generations. Words cannot carry
silhouette, part count, surface breaks, and asymmetry with enough precision.

The identity references are:

1. the source image,
2. the accepted generated views.

Remove every identity spec, identity JSON, and subject schema from the workflow. Keep only the
image and the prompt that states the requested change.

## 3. Reference image input is the first filter

Most image models generate from text only. They cannot receive the reference image, so they cannot
preserve the subject. This is a technical limitation, not a quality difference.

Keep a model only when it declares both:

- image input,
- image output.

Use the Vercel AI Gateway capability catalog as the first filter:

<https://vercel.com/ai-gateway/models?modality=image&features=vision>

The same data is available as JSON:

```bash
curl -s https://ai-gateway.vercel.sh/v1/models
```

For each model, read:

```json
{
  "type": "image",
  "tags": ["image-generation", "vision"],
  "modalities": { "input": ["text", "image"], "output": ["image"] }
}
```

Reject a model when `modalities.input` does not contain `image`. Reject a vector-output tool.
`quiverai/arrow-2` and `quiverai/arrow-2-telos` declare image input, but they produce SVG. Vector
output does not serve a raster blueprint.

Capability metadata is not a guarantee of behavior. Confirm with one smoke test before a full run.
See `references/capability-sources.md` in the skill.

## 4. Recommended workflow

### Stage A: subject folder

Create `blueprints/<category>/<subject>/` with exactly one image:

```text
blueprints/vehicules/blue-and-white-minivan-01/reference.webp
```

Add `notes.md` only when the reference needs one sentence of context, such as which face looks at
the camera.

### Stage B: model filter

List the usable models before spending anything:

```bash
cd scripts/blueprint-generate
bun run blueprint-generate.ts --list-models
```

### Stage C: view generation

Generate the six views. Each view is a separate request with the same reference image, the same
prompt template, and the same style. Generate at least two variants per view. Two variants of the
same prompt always differ, and one is usually better.

The prompt is a text file, not code: `scripts/blueprint-generate/prompts/blueprint.md`. It holds
one shared section and one section per view, with placeholders for the subject type, the view name,
and the rendering style. Tuning the prompt never requires a code change.

```bash
bun run blueprint-generate.ts --subject ../../blueprints/vehicules/blue-van-01 \
  --models meta/muse-image-1.0 --variants 3
```

### Stage D: art director review

The art director is the only validator. No vision model approves, scores, or rejects an image. A
vision model can invent defects and can miss real ones.

For each candidate, the art director checks identity, proportions, part count, colors, materials,
asymmetry, view direction, perspective, cropping, and agreement with the other views.

### Stage E: lock the accepted view

The art director copies the chosen candidate to `<subject>/<view>/reference.png`. That file is the
decision. The next run skips the view.

### Stage F: sheet assembly

Assemble the accepted views with deterministic TypeScript or an image editor. Do not ask an image
model to assemble the sheet when pixel alignment matters.

### Stage G: 3D hand-off

Write the accepted views, the unit profile, the scale anchor, the uncertain regions, the L0
envelope, and the L1 mass list. The modeling workflow starts after this hand-off.

## 5. Passing the reference image

The AI Gateway catalog declares two kinds of image producer, and they use different SDK calls.

### Type `image`

The model is a dedicated image model. Use `generateImage`. The reference image goes in
`prompt.images`:

```ts
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: 'meta/muse-image-1.0',
  prompt: { text: viewPrompt, images: [referenceBytes] },
  size: '1024x1024',
});
```

### Type `language`

The model is a language model that emits images. Use `generateText`. The reference image is a file
content part, and the generated image comes back in `result.files`:

```ts
import { generateText } from 'ai';

const result = await generateText({
  model: 'google/gemini-nano-banana-2.1',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: viewPrompt },
        { type: 'file', data: referenceBytes, mediaType: 'image/webp' },
      ],
    },
  ],
});

const image = result.files.find((file) => file.mediaType.startsWith('image/'));
```

Both paths are needed. A model of type `language` rejects `generateImage` with a clear error:
"Model is a language model, not an image model." The generator reads the catalog type and picks the
correct call.

## 6. Sizing differs by provider

`meta/muse-image-1.0` rejects `aspectRatio` and asks for `size`. The generator sends
`aspectRatio` first. If the provider returns an unsupported-feature warning, it retries once with a
concrete `size`, then stores the working parameter in `manifest.json` under `modelParams`. Later
runs do not repeat the failed call.

## 7. Prompt findings

The first prompts described the subject and asked for a view. That produced usable images, but the
model drifted on small attached parts and sometimes added a contact shadow.

The current template fixes four things:

1. It names the attached image as the subject. Without that sentence, a model can treat the image
   as a style reference and design a new subject.
2. It states the style once, through `{style}`, so the six views share one look.
3. It permits extrapolation of hidden geometry. Without that permission, the model repeats the
   visible face or leaves the rear empty.
4. It pairs `DO NOT` with `DO`. A negative instruction alone is weak. A positive correction is
   stronger.

The template keeps the subject out of the text. Only the camera, the style, the background, and the
defect corrections are described.

## 8. Measured results

Two runs on `blueprints/vehicules/blue-and-white-minivan-01` with `meta/muse-image-1.0`:

| Run | View | Variants | Result |
| :--- | :--- | ---: | :--- |
| 1 | front | 2 | Two usable front views. The surfboard is shortened and the shark fin is missing. |
| 2 | left | 2 | One useful profile. The surfboard and the shark fin survive. |

Observations:

- The model preserves the color scheme, the wheel pattern, the license plate, and the body shape.
- The roof load drifts. The surfboard changes length, and the fin disappears in the front view.
- The front view is nearly symmetric and reads as a usable orthographic view.
- Two variants per view are a minimum. Some variants lose a distinctive part.

Consequence for the workflow: the art director must check small attached parts. A model can keep
the main body and lose a small identity feature.

## 9. Risks

### Hidden geometry

The model invents surfaces that the reference does not show. Record the region as uncertain in the
note. Use the result to guide a proxy volume only.

### Perspective drift

The model can return a three-quarter view while the prompt says side view. Reject the image. Words
alone do not guarantee orthographic projection. Repeating the camera sentence in the prompt helps,
but the art director is the real filter.

### Identity drift on attached parts

Small parts on the roof, on the back, or under the body drift first. Ask for at least two variants
and check every attached part.

### Symmetry invention

The model can remove an intentional asymmetry. State the asymmetry in `notes.md`.

### False measurement

A clean sheet can look precise while its geometry remains approximate. Use a scale anchor whenever
one exists.

## 10. Decision

Implement `blueprint-preparation` as a pre-modeling skill with a folder contract:

```text
blueprints/<category>/<subject>/reference.(png|webp)
blueprints/<category>/<subject>/<view>/<model-slug>--<NN>.<ext>
blueprints/<category>/<subject>/<view>/reference.png
```

The generator is `scripts/blueprint-generate/blueprint-generate.ts`. It filters by capability, generates
variants, appends to a manifest, and never validates.

Model choice and variant count remain parameters of the job. `meta/muse-image-1.0` is validated.
Pick the best Gemini image model next, then compare it against Muse on the same subjects.

## Sources

- <https://github.com/vercel/ai/blob/main/skills/use-ai-sdk/SKILL.md>
- <https://ai-sdk.dev/docs/ai-sdk-core/image-generation>
- <https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image>
- <https://vercel.com/ai-gateway/models?modality=image&features=vision>
- <https://ai-gateway.vercel.sh/v1/models>
- <https://skills.sh/scenario-labs/skills/scenario-blender-blockout>
- <https://skills.sh/w1ne/kernelcad-skills/blockout-model>
- <https://skills.sh/w1ne/kernelcad-skills/image-replicator>
