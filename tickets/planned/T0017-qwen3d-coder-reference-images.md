# T0017 — The asset drafter reads a reference image

- **Track**: Qwen 3D Coder workflow (drafter, prompts, agent instructions)
- **Wave**: 2 (integration)
- **Depends on**: T0016 (the asset drafter, its prompts, and `--size`)
- **Blocks**: nothing
- **References**:
    - [`tickets/review/T0016-qwen3d-coder-ts-asset.md`](../review/T0016-qwen3d-coder-ts-asset.md)
      — the drafter this ticket extends: `--image`, `--size`, `validateAsset`, `buildUserPrompt`
    - [`workflows/qwen3d-coder/tools/lib/client.ts`](../../workflows/qwen3d-coder/tools/lib/client.ts)
      — the streamed request, and the one image part it sends today
    - [`workflows/qwen3d-coder/tools/lib/endpoint.ts`](../../workflows/qwen3d-coder/tools/lib/endpoint.ts)
      — the `/models` preflight
    - [`workflows/qwen3d-coder/prompts/asset-system.txt`](../../workflows/qwen3d-coder/prompts/asset-system.txt)
      — the template prompt, unchanged by this ticket
    - [`AGENTS.md`](../../AGENTS.md) — the blueprint rules: generation reads `reference.<ext>` only,
      and the real dimensions are an input
    - the model card, section **Optional vision support — October 30, 2026**, and section
      **Load the GGUF with vision in llama.cpp**:
      <https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder> — image input is **optional**, it needs the
      companion projector `mmproj-Qwen3.5-4B-BF16.gguf` (about 644 MiB), the tested invocation is
      `llama-server -m <model>.gguf --mmproj mmproj-Qwen3.5-4B-BF16.gguf --n-gpu-layers all
--flash-attn on --ctx-size 65536 --parallel 1`, and "image tokens share the context window with
      the prompt and generated code"
    - llama.cpp, the server manual, section **For multimodal input (typed content,
      `messages[i].content[j]`)** and section **Timings and context usage**:
      <https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md> — the parts are
      `{ "type": "text", "text": "…" }` and
      `{ "type": "image_url", "image_url": { "url": "data:image/png;base64,…" } }`;
      "Accepts formats supported by `stb_image` (jpeg, png, tga, bmp, gif, ...)";
      `timings.prompt_n` is "number of prompt tokens being processed", `timings.cache_n` is "number of
      prompt tokens reused from cache", and "the total number of tokens in context is equal to
      `prompt_n + cache_n + predicted_n`"; "Clients should check `/models` or `/v1/models` for the
      `multimodal` capability before a multimodal request"
    - llama.cpp, the multimodal manual:
      <https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md> — `--mmproj file.gguf`
      loads the projector, `--no-mmproj` disables it, and the projector is offloaded to the GPU by
      default
    - `Bun.file(path).json()`: <https://bun.com/docs/api/file-io>
    - `Bun.Image`, `new Bun.Image(input)`, `.metadata()`, `.png()`, `.buffer()`, and the platform
      backend table (JPEG, PNG, and WebP are built in on Linux):
      <https://bun.com/docs/runtime/image> — "Bun sniffs the format from the bytes and ignores
      extensions and `Content-Type`", and a decode that cannot finish rejects with
      `ERR_IMAGE_DECODE_FAILED`

## Context & Goal

T0016 gave the model one asset, one prompt, and a check. The art director ran it on
2026-11-18 and the verdict is plain: **the model alone produces poor geometry**. A 4B model that
receives a paragraph of text invents a car from memory. The same model fed a picture of the car has
something to measure itself against.

The model card says this capability exists and is **optional**: the Q4_K_M and Q8_0 GGUF accept image
input when the endpoint loads the Qwen3.5-4B vision projector. The card's own example is exactly our
case — one reference image, a short request — and the workflow already knows how to send one image:
`--image` builds a `image_url` part with a `data:` URL. What is missing is the rest:

- the reference images of a blueprint are **six orthographic views**, not one sheet, and the drafter
  can address neither;
- the user turn does not say what the image is, so the model gets a bare picture;
- nothing reports whether the endpoint actually read the image, and an endpoint without the projector
  answers from the text alone without saying so;
- the real dimensions sit in `dimensions.json` beside the views, and the model is still asked to
  guess them;
- the views are 1600 × 1600, which is a heavy prompt for a small model, and the drafter has no way to
  send a lighter copy when the model fails.

**Done means** one command sends a chosen set of blueprint views with the prompt, the turn labels
each one, the run prints the prompt token count that proves the images were read, the real dimensions
come from the blueprint, and the art director can run the two experiments of decision D1 and compare
the candidates in the shared viewer.

## Decisions

- **D1 — One image first, three second.** The art director decided on 2026-11-18: nobody knows yet
  whether this model uses several views well. The first experiment sends **one** image, the second
  sends **three** — `top`, `right`, `back` — and the two candidate sets are compared in the viewer.
  The drafter therefore takes an explicit list of views; it does not decide how many.
- **D2 — Images stay opt-in.** `--image` keeps its existing meaning and `--views` joins it. A run
  without either sends no image, so the workflow keeps one mode that needs no projector. A subject run
  that sends an image to an endpoint without the projector is a waste the operator can avoid.
- **D3 — A view is addressed by name.** The names are the six of the blueprint:
  `front`, `left`, `right`, `back`, `top`, `bottom`. `--views top,right,back` sends those three, in
  that order. `--image` is the subject's `reference.<ext>`, the identity sheet.
- **D4 — The turn labels every image.** A bare picture leaves the model to guess which face it sees.
  Each image is preceded by one line that names it, in the part order of the request.
- **D5 — The dimensions come from the blueprint.** `dimensions.json` holds `real.length`,
  `real.width`, and `real.height`, each with its source. The drafter reads it, and `--size` remains the
  manual override of T0016. A missing or malformed file is not an error: the line is absent, exactly
  like a missing size.
- **D6 — The run proves the images were read.** llama.cpp reports `timings.prompt_n` and
  `timings.cache_n`. A run prints both, because an image costs several thousand prompt tokens and a
  text-only answer does not. Without that number, a missing projector is invisible.
- **D7 — The endpoint is still an input.** This ticket installs nothing, downloads no projector, and
  starts no server. It documents the prerequisite (`--mmproj`, 65 536 tokens of context) in the
  workflow `README.md`, and its `--ask` reports the `multimodal` capability when the endpoint
  publishes it.
- **D8 — The drafter sends PNG, at the size of a preset.** The documented decoder reads what
  `stb_image` reads, one of the two blueprint subjects is written entirely in `.webp`, and the raw
  views are 1600 × 1600 — too many image tokens for a small model on a local endpoint. `Bun.Image`
  decodes WebP and PNG, resizes, and writes an indexed PNG, with no dependency. Every image is sent
  as PNG through one of the three presets of §2. `blueprints/**` is not touched, the source files
  keep their size, and no operator step is added.
- **D10 — The model is small, so the images have a fallback ladder.** The art director decided on
  2026-11-18: **adapt to the reduced capabilities of the model, and retry with smaller, lighter
  reference images when it fails.** `full` (800 px, truecolor) is the default, `small` (512 px) is the
  first retry, `tiny` (384 px, 64 colours, dithered) is the last. The ladder is manual: the art
  director judges the geometry, and the drafter only reports which preset produced each candidate.
- **D9 — Both blueprint subjects are rendering tests.** The art director asked on 2026-11-18 that
  `blueprints/vehicules/blue-and-white-minivan-01` be part of the rendering tests of this ticket, not
  only `r5-tl-1972`. The minivan is the case that matters: a second subject, all `webp`, with its own
  `dimensions.json`. The experiments of AC5 therefore run on both subjects.

## Scope Boundary

**Create:**

```text
workflows/qwen3d-coder/tools/lib/images.ts         the `--image` / `--views` resolution
workflows/qwen3d-coder/tools/lib/images.test.ts
workflows/qwen3d-coder/tools/lib/dimensions.ts     `dimensions.json` to the `* dimensions:` line
workflows/qwen3d-coder/tools/lib/dimensions.test.ts
```

**Modify:**

| File                                                | What changes                                                                                |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| `workflows/qwen3d-coder/tools/lib/client.ts`        | the typed content parts, the image array, and `prompt_n` / `cache_n` in the result          |
| `workflows/qwen3d-coder/tools/lib/client.test.ts`   | the part order, the two `data:` URLs, and the timings                                       |
| `workflows/qwen3d-coder/tools/lib/prompt.ts`        | the labelled image parts, the `* images:` line, and the resolver of the turn inputs         |
| `workflows/qwen3d-coder/tools/lib/prompt.test.ts`   | the turn with no image, one image, and three views                                          |
| `workflows/qwen3d-coder/tools/lib/endpoint.ts`      | the `multimodal` capability, read when the endpoint publishes it                            |
| `workflows/qwen3d-coder/tools/lib/endpoint.test.ts` | the three states of that capability                                                         |
| `workflows/qwen3d-coder/tools/asset-draft.ts`       | `--views`, the image resolution, the dimensions, the two token counts, the `--ask` lines    |
| `workflows/qwen3d-coder/tools/asset-draft.test.ts`  | the new flag rules, the parts sent to the stream, and the printed tokens                    |
| `workflows/qwen3d-coder/README.md`                  | the projector prerequisite, the two flags, the formats, the token cost, the two experiments |
| `workflows/qwen3d-coder/AGENTS.md`                  | the image rules: opt-in, the art director chooses the views, one image first                |
| `.opencode/agents/bender.md`                        | Workflow E: ask which views, and pass `--image` or `--views`                                |

**Do not touch:**

- `workflows/qwen3d-coder/prompts/**` — the system prompt and the subject prompt files are T0016's,
  and this ticket adds no prompt byte. If an experiment shows the prompt must change, that is a new
  ticket.
- `workflows/qwen3d-coder/tools/lib/{client,endpoint}.ts` sampling values (`SAMPLING`), the request
  fields, and the reasoning toggle — settled by T0011, and unchanged here.
- `tools/scene-viewer/**`, `workflows/threejs/**`, `workflows/blender/**`, `workflows/vcad/**`.
- `blueprints/**` — this ticket **reads** views and `dimensions.json`; the drafter writes candidates
  there only at run time.
- `package.json`, `bunfig.toml`, `tickets/done/**`, `tickets/review/**`, and T0016's ticket file.

No shared file is append-only.

## Contract

### 1. The command

Two image flags join the command of T0016 §1. Neither is required.

```bash
# one image: the subject's reference sheet
bun run workflows/qwen3d-coder/tools/asset-draft.ts \
  --subject blueprints/vehicules/r5-tl-1972 --image \
  --style "low-poly stylized" --name r5 --variants 1

# three views, in this order: top, right, back
bun run workflows/qwen3d-coder/tools/asset-draft.ts \
  --subject blueprints/vehicules/r5-tl-1972 --views top,right,back \
  --style "low-poly stylized" --name r5 --variants 1
```

| Flag                 | Meaning                                                                                          |
| :------------------- | :----------------------------------------------------------------------------------------------- |
| `--image`            | send `<subject>/reference.<ext>`, the identity sheet                                             |
| `--views <l>`        | send `<subject>/<view>/reference.<ext>` for each name of the comma-separated list, in list order |
| `--image-preset <n>` | the size and the encoding of every image sent: `full`, `small`, or `tiny` (§2). Default `full`   |

The rules, each one with exit `1` and one message:

1. `--image` and `--views` together are exclusive. The message names both flags.
2. Either one needs `--subject`. With `--prompt-file`, the message says that text mode sends no image:
   a prompt file has no blueprint beside it.
3. A name outside `front, left, right, back, top, bottom` is refused, and the message lists the six.
4. An empty name, an empty list, or a repeated name is refused.
5. A view file that does not exist is refused, and the message quotes the path it looked for.
6. The bytes sent are **always PNG, at the size and the palette of the preset of §2**. A file that does
   not decode exits `1`, and the message quotes the path and the decoder's error code. The accepted
   source extensions are `.png`, `.jpg`, `.jpeg`, and `.webp`: `Bun.Image` reads all four on Linux, and
   the endpoint's decoder does not have to see the source format at all.
7. `--views` is capped at six images by rule 3 and rule 4. No other cap is invented.
8. `--image-preset` with a name outside `full, small, tiny` exits `1` and lists the three. The flag
   applies to `--image` and to `--views` alike, and it does nothing on a run that sends no image.

`--ask` gains three lines: the images the run would send, in order, each with its label, its path, its
pixel size, and its PNG size in kilobytes; the preset in force; the resolved `* dimensions:` line or its
absence; and the endpoint's `multimodal` capability (§5).

### 2. The image set (`images.ts`)

```ts
export const IMAGE_PRESETS = Object.freeze({
	/**
	 * The default: enough detail for a 4B vision encoder, and the largest that
	 * fits a local run.
	 */
	full: { maxSide: 800, colours: null },
	/**
	 * The first retry: half the pixels on each side, about a quarter of the
	 * image tokens.
	 */
	small: { maxSide: 512, colours: null },
	/**
	 * The last retry: a small indexed PNG, 3 to 10 times lighter than `small`
	 * on disk.
	 */
	tiny: { maxSide: 384, colours: 64 }
});

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export type ResolvedImage = {
	/** `reference` for `--image`, else the view name. */
	label: string;
	/** The absolute path that was read. */
	path: string;
	/** Always `image/png`: every image is normalised, see the rules below. */
	mime: string;
	/** The preset that produced the bytes. */
	preset: ImagePreset;
	/** The pixel width that is sent, after the preset. */
	width: number;
	/** The pixel height that is sent, after the preset. */
	height: number;
	/** The number of PNG bytes that are sent, before base64. */
	bytes: number;
	/** The file bytes, base64, without the data URL prefix. */
	data: string;
};

/** The six names a view may carry, in the order of the blueprint. */
export const VIEW_NAMES = [
	"front",
	"left",
	"right",
	"back",
	"top",
	"bottom"
] as const;

export function resolveImages(input: {
	/** The subject folder. Absent in text mode. */
	subjectDir: string | null;
	/** `--image`. */
	image: boolean;
	/** `--views`, raw. */
	views: string | null;
	/** The resolved `--image-preset`. */
	preset: ImagePreset;
}): ResolvedImage[];
```

- It is a **pure function of the file system**: it reads the files and returns them, and it throws one
  `Error` with the message of the violated rule of §1. The caller maps a throw to exit `1`.
- The reference sheet is found by the same extension order as the existing `findReference`:
  `.png`, `.jpg`, `.jpeg`, `.webp`.
- The label of `--image` is `reference`. The label of a view is the view name.
- The order of the returned array **is** the order of the list the art director typed.
- **`mime` is always `image/png`**, sized and encoded by the preset of `IMAGE_PRESETS`: the endpoint's
  decoder reads what `stb_image` reads, one subject is written entirely in WebP, the raw views are
  1600 × 1600, and this model is small — every pixel it does not need is a token it pays for. The
  pipeline is one chain of the documented `Bun.Image` API:

    ```ts
    const preset = IMAGE_PRESETS[input.preset];
    let image = Bun.file(path).image().resize(preset.maxSide, preset.maxSide, {
    	fit: "inside",
    	withoutEnlargement: true
    });
    image = preset.colours
    	? image.png({ palette: true, colors: preset.colours, dither: true })
    	: image.png();
    const png = await image.buffer();
    ```

- `fit: "inside"` preserves the aspect ratio, and `withoutEnlargement: true` guarantees that an image
  smaller than the preset is never blown up. `palette: true` quantises to an indexed PNG of at most
  `colours` colours, with Floyd–Steinberg dithering, as the `Bun.Image` reference documents.
- A source that is already a PNG, already at most `maxSide` on both sides, **and** sent under the
  `full` preset keeps its source bytes: the chain would re-encode it for nothing. Every other source
  is resized and re-encoded. The format is sniffed by `Bun.Image` metadata, never by the extension.
- A file the decoder cannot finish rejects with `ERR_IMAGE_DECODE_FAILED`, and the function throws
  `Error("<path>: the image could not be decoded (<code>)")`, which the caller maps to exit `1`.
- The measured outputs of the three presets, taken on 2026-11-18:

    | Subject                     | File                   | Source         | `full`  | `small` | `tiny`  | Bytes: full / small / tiny |
    | :-------------------------- | :--------------------- | :------------- | :------ | :------ | :------ | -------------------------: |
    | `blue-and-white-minivan-01` | `reference.webp`       | 1600×1600 webp | 800×800 | 512×512 | 384×384 |           265 / 146 / 30 K |
    | `blue-and-white-minivan-01` | `top/reference.webp`   | 1600×1600 webp | 800×800 | 512×512 | 384×384 |           223 / 127 / 19 K |
    | `r5-tl-1972`                | `reference.png`        | 1376×768 png   | 800×447 | 512×286 | 384×214 |           286 / 103 / 11 K |
    | `r5-tl-1972`                | `top/reference.png`    | 1376×768 png   | 800×447 | 512×286 | 384×214 |             259 / 81 / 9 K |
    | `r5-tl-1972`                | `front/reference.webp` | 2048×1152 webp | 800×450 | 512×288 | 384×216 |            137 / 64 / 12 K |

    Three images are about 1 MB of base64 under `full`, about 500 KB under `small`, and about 60 KB
    under `tiny`. A test measures the two files it uses, because a size depends on the content; the
    table is the record of one measurement, not an assertion.

### 2 bis — Why three presets, and not one cap

A 4B vision encoder reads a 800 px image as several thousand tokens, and a weak model does not spend
them well. The art director's rule of 2026-11-18 is: **adapt to the model, and retry with smaller,
lighter images when it fails.** The three presets are that ladder, in the order a run tries them:

1. `full` — 800 px, truecolor PNG. The default. It is the most information the endpoint can use.
2. `small` — 512 px. Four times fewer pixels, no palette change.
3. `tiny` — 384 px, 64 colours, dithered. The lightest form that still shows the silhouette, and it
   measures about ten times smaller than `small` on disk.

The ladder is **manual on purpose**: geometry is judged by the art director and never by a script. The
drafter reports the preset it used in every line of §7, so two runs differ in one visible field, and
the comparison of AC5 says which one the model answered better.

### 3. The turn (`prompt.ts`)

```ts
export type TurnPart =
	{ type: "text"; text: string } | { type: "image"; image: ChatImage };

export function buildUserTurn(input: UserPromptInput): TurnPart[];
```

`UserPromptInput` gains `images?: ResolvedImage[]` beside the `name` and `size` of T0016.

- **With no image the result is one text part**, and its text is byte-identical to the turn of T0016
  §A3. `buildUserPrompt` keeps its signature and returns that text, so the existing tests and the
  prompt files stay the reference.
- With one or more images the parts are, in this order:
    1. one text part: the constant first line, the star bullets of §A3, and one extra bullet
       `* images: <n>. Use them for shape and proportion; the dimensions above win.` placed after the
       `* asset name:` bullet;
    2. for each image, in order: a text part `* image: <label>`, then the image part. The label of
       `--image` is `reference sheet`, and the label of a view is `<view> view` — so
       `* image: top view`;
    3. one text part: the constraint lines of §A3, from `* units:` to `* Do not add anything else.`
- A prompt file (text mode) is still one text part and needs no change.
- **One inherited defect goes with this rewrite.** The request line of §A3 ends with a period of its
  own, and a request that already ends in `.` produces `shows a red sportster car..`. The builder
  stops adding its period when the request already ends in `.`, `!`, or `?`, and a test pins the
  case. The `red-sportster.txt` file keeps its bytes.
- The function stays pure: it never reads a file, and the images arrive already resolved.

### 4. The wire (`client.ts`)

```ts
export type ChatImage = { mime: string; data: string }; // unchanged

export type BuildRequestOptions = {
	model: string;
	system: string;
	/** A plain turn, or the typed parts of a turn that carries images. */
	user: string | TurnPart[];
	maxTokens?: number;
	seed?: number | null;
};
```

- `image?: ChatImage | null` is **removed**. Every caller now passes `user`, and a turn with images
  passes parts.
- A string builds one `{ type: "text", text }` part. An array maps one part to one part:
  `{ type: "text" }` → `{ type: "text", text }`, and `{ type: "image", image }` →
  `{ type: "image_url", image_url: { url: "data:<mime>;base64,<data>" } }`, the shape the server
  manual documents for `messages[i].content[j]`.
- The order of the parts is the order of the array. Two images give `text, image, text, image, …`.
- `ChatResult` gains `promptTokens: number | null` and `cachedTokens: number | null`, read from
  `timings.prompt_n` and `timings.cache_n`. An absent or non-finite value is `null`, never `0`:
  a zero is a measurement and a missing field is not.

### 5. The capability (`endpoint.ts`)

`PreflightResult` of success gains one field:

```ts
{
	ok: true;
	id: string;
	multimodal: boolean | null;
}
```

- `multimodal` is `true` when the matched entry of `data[]` holds `multimodal === true`, `false` when
  it holds `multimodal === false`, and `null` when the entry does not publish the field. The server
  manual asks a client to check it; the reference service of this repository is a proxy that does not
  publish it, so `null` is the normal answer here.
- It is **reported, never enforced**. The run prints it in `--ask`, and a run that sends images prints
  it too, so an operator reads the reason of a text-only answer without guessing.

### 6. The dimensions (`dimensions.ts`)

```ts
export function dimensionsLine(json: unknown): string | null;
```

- It reads `real.length.value`, `real.height.value`, and `real.width.value`. Each one must be a finite
  number above zero.
- It returns `L=<length> <unit>, h=<height> <unit>, l=<width> <unit>`, in the art director's order and
  notation of T0016 §A5. The unit is `json.unit` when it is a non-empty string, else `m`.
- Each number is printed with its own decimals trimmed of trailing zeros, at most three decimals:
  `3.521` → `3.521`, `1.4` → `1.4`, `2` → `2`.
- A missing file, invalid JSON, a missing `real` block, or one bad value returns `null`. It never
  throws: a blueprint without dimensions is a normal blueprint.
- The asset drafter resolves the size in this order: `--size`, then
  `dimensionsLine(<subject>/dimensions.json)`, then absent. For `r5-tl-1972` the line is
  `L=3.521 m, h=1.4 m, l=1.525 m`.

### 7. The report

Per variant, the line of T0016 §6 gains the two counts before the state:

```text
variant 1  blueprints/.../r5--01.ts  94.2 s  2138 tokens  31.9 tok/s  prompt 3847 tok  cache 0 tok  images full ×3  valid
```

- `images <preset> ×<n>` names the preset the run used and how many images went with it. A run
  without an image prints `images —`. Two runs of the ladder differ in this field and nowhere else.
- `prompt <n> tok` prints `prompt —` when the endpoint reports no timings, and `cache <n> tok` prints
  `cache —` the same way.
- A second variant of the same run reuses the prompt cache, so its `prompt` count drops and its
  `cache` count rises. Both numbers are printed for that reason: the sum is the image cost.

## TDD Tasks

- [ ] **T17.1 — The image set**: write `images.test.ts` first, on two fixtures. A scratch tree under
      `.tmp/` gives the synthetic cases; the two real subjects give the case that matters. Assert the
      order of `--views top,right,back`, the `reference` label of `--image`, and each throw of §1:
      both flags, no subject, an unknown name, an empty name, a repeated name, a missing file, and an
      undecodable file. Assert the normalisation per preset: a WebP source comes back as PNG bytes
      (magic number `89 50 4E 47`); under `full`, `small`, and `tiny` the exact sizes are
      `800×800 | 512×512 | 384×384` for the minivan and `800×447 | 512×286 | 384×214` for
      `r5-tl-1972`; `tiny` writes an indexed PNG that is smaller than the `small` one on the same file;
      a source smaller than the preset comes back byte-identical under `full` (so `withoutEnlargement`
      really holds); an unknown preset throws; and `mime` is `image/png` in every case.
      Assert the real tree: `blue-and-white-minivan-01` with `--image` and
      with `--views top,right,back`, and `r5-tl-1972` with the same two flag sets, each giving the
      expected labels and paths in order. Then implement `images.ts`.
- [ ] **T17.2 — The dimensions**: write `dimensions.test.ts` first. Assert the real
      `r5-tl-1972` line (`L=3.521 m, h=1.4 m, l=1.525 m`) and the real `blue-and-white-minivan-01`
      line (`L=5.3 m, h=2 m, l=1.9 m`, whose whole-metre values must not grow decimals), the unit
      fallback, the trailing-zero trim, and `null` for a missing block, a bad value, and a non-object.
      Then implement `dimensions.ts`.
- [ ] **T17.3 — The turn**: in `prompt.test.ts`, assert that the no-image turn is one text part and
      equals the T0016 text byte for byte; that one image gives `text, label, image, constraints`; that
      three views give five parts and three labels in order; and that the `* images:` bullet carries
      the count. Then `buildUserTurn`, and `buildUserPrompt` rebuilt on it.
- [ ] **T17.4 — The wire**: in `client.test.ts`, assert a string user gives one text part, a two-image
      part array gives `text, image, text, image` in body order, both `data:` URLs carry their mime,
      and `promptTokens` / `cachedTokens` read `timings`, with `null` when the field is absent. Then
      `client.ts`.
- [ ] **T17.5 — The capability**: in `endpoint.test.ts`, assert `true`, `false`, and `null` for the
      three states of the matched entry, and that a second entry's field never decides. Then
      `endpoint.ts`.
- [ ] **T17.6 — The command**: in `asset-draft.test.ts`, assert the eight rules of §1 by exit code and
      message, `--image-preset` included and its default `full`; that `--views` reaches the stream as
      four parts; that `dimensions.json` fills `* dimensions:` and `--size` wins over it; that `--ask`
      prints the preset, the image list with its sizes, the dimensions line, and the capability; and
      that `images <preset> ×<n>`, the two token counts, and the state are printed per variant. Then
      `asset-draft.ts`.
- [ ] **T17.7 — The documents and Bender**: the workflow `README.md` (the projector prerequisite, the
      three presets and the D10 ladder, the formats, the token cost, the four rendering runs of AC5),
      the workflow `AGENTS.md`, and Workflow E of `bender.md` (E3 proposes the next rung of the ladder
      when a candidate is invalid). Record the exact projector invocation of the model card in the
      `README.md`, and the preset table of §2 with it.
- [ ] **T17.8 — The gates**: `bun run format`; `bun test workflows/qwen3d-coder`; `bun test` at the
      root. Then the four rendering runs of AC5 if the endpoint loads the projector, recorded exactly.
      `## Implementation Notes` at the bottom of this ticket.

## Acceptance Criteria

- **AC1 — One image.** A subject run with `--image` sends the reference sheet as one `image_url` part,
  preceded by `* image: reference sheet`, and the run prints a `prompt` token count. The image is read
  before the request, so a missing reference exits `1` and sends nothing. A request that already ends
  in a period gives one period, not two.
- **AC2 — Three views.** `--views top,right,back` sends three images in that order, each preceded by
  its own label, and the parts follow the order of §3. A view that is not there, a name that is not
  one of the six, and a repeated name each exit `1` with their reason.
- **AC3 — The normalisation and the presets.** `blue-and-white-minivan-01` is written entirely in
  `.webp`, and every image it contributes is sent as PNG at the size of the preset in force: the test
  asserts the PNG magic number, the exact output size per preset (`800×800`, `512×512`, `384×384` for
  the minivan; `800×447`, `512×286`, `384×214` for the `1376×768` r5 views), the palette flag of
  `tiny`, and the `IMAGE_PRESETS` table itself. A PNG that is already at most `maxSide` on both sides
  is sent byte-identical under `full`, and `front/reference.webp` of `r5-tl-1972` proves the resize on
  the other subject. An unknown preset name exits `1` and lists the three. A file that does not decode
  exits `1` and the message quotes the path and the error code.
- **AC4 — The dimensions.** Without `--size`, a subject that has `dimensions.json` sends
  `* dimensions: L=3.521 m, h=1.4 m, l=1.525 m`. `--size` replaces it. A malformed file leaves the
  bullet absent and the run does not fail.
- **AC5 — The rendering tests, on both subjects.** With the endpoint loading the projector, **four**
  real runs produce candidates, and the art director opens all four in the shared viewer:
    - `r5-tl-1972` with `--image`;
    - `r5-tl-1972` with `--views top,right,back`;
    - `blue-and-white-minivan-01` with `--image`;
    - `blue-and-white-minivan-01` with `--views top,right,back`.

    `blue-and-white-minivan-01` has no `## Subject` paragraph in its `notes.md`, so its runs pass
    `--prompt` with the subject in one line; that is the documented way to supply the request. The
    record holds, per run, the exact command, the stdout with both token counts, the candidate path,
    and its `valid` or `invalid: <reason>` state. The comparison of the four candidate sets in the
    viewer is the art director's work, and it decides D1 — one image against three. No script judges
    geometry.

- **AC8 — The ladder is real.** When a candidate is `invalid`, or the art director judges it poor,
  the record continues down D10's ladder — the same command with `--image-preset small`, then
  `tiny` — and it holds the exact command, the `images <preset> ×<n>` field, and the two token counts
  of every step it took. At least one step down the ladder is recorded if any candidate of AC5 failed.
  A run under `tiny` really is lighter: the record quotes its PNG size against the `full` one.

- **AC6 — The endpoint is documented, not installed.** The workflow `README.md` states the projector
  file, the `--mmproj` invocation of the model card, the 65 536-token context, and the fact that image
  tokens share the window. No file of this repository installs it.
- **AC7 — The gates.** `bun test` at the root is green, and `bun run format` reports no change.

## Out of scope, recorded on purpose

- **No images tab, no colour management, no metadata pass.** The conversion is `Bun.Image`'
  `png()` over the source pixels: no ICC profile handling, no gamma change, no crop, no rotation.
- **No free-form pixel size.** The three presets of D10 are fixed. A `--max-side <px>` flag, a profile
  per model, a fourth preset, and a per-subject choice are all a later ticket: the ladder is three
  rungs until a measured result asks for another.
- **No automatic choice of views.** D1 leaves the count and the names to the art director.
- **No change to the prompt bytes.** If three views need a new sentence in the system prompt, that is
  a new ticket against T0016's `prompts/asset-system.txt`.
