# Model Candidates

This file lists the models that pass the capability filter and the ones that fail. The filter
comes from the live catalog, not from memory.

Check the list before a run:

```bash
cd scripts/blueprint-generate
bun run blueprint-generate.ts --list-models
```

## Usable models

A model is usable when it declares image input and image output in the AI Gateway catalog, and it
is not a vector-output tool.

| Model ID | Status | Note |
| :--- | :--- | :--- |
| `meta/muse-image-1.0` | validated by the art director | Reference image, new pose, new angle. Documented price 0.01 USD per image. |
| `google/gemini-3-pro-image` | to test | Gemini image model with vision. |
| `google/gemini-3.1-flash-image` | to test | Faster Gemini variant. |
| `google/gemini-3.1-flash-image-preview` | to test | Preview variant of the same family. |
| `google/gemini-3.1-flash-lite-image` | to test | Low-latency Gemini variant. |
| `google/gemini-nano-banana-2.1` | to test | Nano Banana family. |
| `google/gemini-2.5-flash-image` | to test | Previous generation. Keep for comparison. |

The goal is to choose one Gemini model for the view work. Test them on the same subject and the
same prompt, then compare the variants by eye.

## Rejected models

These models generate images but declare text-only input in the catalog. They cannot receive the
reference image, so they cannot preserve the subject.

```text
bfl/flux-2-*
bfl/flux-kontext-*
bfl/flux-pro-*
bytedance/seedream-*
microsoft/mai-image-*
openai/gpt-image-*
prodia/flux-fast-schnell
recraft/recraft-*
spacexai/grok-imagine-image
topaz/wonder-3.5
```

Two models are rejected for a different reason. `quiverai/arrow-2` and `quiverai/arrow-2-telos`
declare image input, but they are specialized in SVG output. Vector output does not serve a
raster blueprint.

## Selection criteria

Do not select a model by visual style. Select it by these properties, judged by the art director on
real subjects:

- subject preservation across views,
- part count and part placement preservation,
- symmetry and asymmetry preservation,
- orthographic camera compliance,
- clean isolation on white,
- usable output resolution,
- latency,
- price per image.

Run at least three variants per view. Two variants of the same prompt always differ. One of them is
usually better, and only a human can decide which one.
