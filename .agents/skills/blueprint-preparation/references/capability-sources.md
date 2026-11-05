# Image Input Capability Sources

Use capability evidence before a visual test. Do not spend a generation on a model that cannot
receive the reference image.

## Evidence order

1. **Vercel AI Gateway catalog**. Read `modalities.input`, `modalities.output`, `type`, and
   `tags`. This is the first filter and the model discovery source.
2. **Provider documentation**. Check the image editing, image-to-image, or reference-image section.
   Save the URL and the claim.
3. **AI SDK model properties**. For an instantiated image model, inspect `supportsFileInputs` and
   `supportsMaskInputs`. Accept `true` only. Treat `false` and `undefined` as unconfirmed.
4. **Smoke test**. Send one small image with a harmless prompt. This is the final check.

## Capability states

| State | Meaning |
| :--- | :--- |
| `confirmed` | Catalog and smoke test both pass. |
| `catalog-confirmed` | Catalog declares image input and image output. No smoke test yet. |
| `sdk-confirmed` | The SDK property returns `true`. No smoke test yet. |
| `unsupported` | Catalog, SDK, or smoke test says no. |
| `unknown` | No reliable evidence. |
| `error` | The call failed for an infrastructure reason. Not a capability verdict. |

Only `confirmed`, `catalog-confirmed`, and `sdk-confirmed` enter a generation run.

## Catalog query

```bash
curl -s https://ai-gateway.vercel.sh/v1/models > models.json
```

Read one record:

```json
{
  "id": "meta/muse-image-1.0",
  "type": "image",
  "tags": ["image-generation", "vision"],
  "modalities": { "input": ["text", "image"], "output": ["image"] },
  "pricing": { "image": "0.01" }
}
```

The generator applies this filter in `scripts/blueprint-generate/lib/models.ts`. Run:

```bash
bun run blueprint-generate.ts --list-models
```

## Why the catalog filter is necessary

Image output does not imply image input. In the catalog on 2026-11-04, these families declare
image output and text-only input:

```text
bfl/flux-kontext-max
openai/gpt-image-2
bytedance/seedream-4.5
recraft/recraft-v4.1-pro
```

Some of these models accept reference images through a provider-specific field. The catalog does
not show it. Do not rely on undocumented behavior for a production pipeline. Trust the declared
capability, and confirm with a smoke test when a provider documents more.

## Smoke test

```bash
bun run blueprint-generate.ts --subject ../../blueprints/vehicules/blue-and-white-minivan-01 \
  --models provider/model --views front --variants 1
```

Accept the capability only when the model returns an image of the same subject. A text answer is
not an image. An unrelated image is a failed test.

## Vector-output tools

`quiverai/arrow-2` and `quiverai/arrow-2-telos` declare image input, but they produce SVG. A raster
blueprint needs a raster image. The generator rejects them by explicit rule.
