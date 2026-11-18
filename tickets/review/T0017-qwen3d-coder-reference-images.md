# T0017 — The asset drafter reads a reference image

- **Track**: Qwen 3D Coder workflow (drafter, prompts, agent instructions)
- **Wave**: 2 (integration)
- **Depends on**: T0016 (the asset drafter, its prompts, and `--size`)
- **Blocks**: nothing
- **Owner**: coding sub-agent, supervised by CTO
- **Started**: 2026-11-18
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
- **D9 — Both blueprint subjects are rendering tests.** The art director asked on 2026-11-18 that
  `blueprints/vehicules/blue-and-white-minivan-01` be part of the rendering tests of this ticket, not
  only `r5-tl-1972`. The minivan is the case that matters: a second subject, all `webp`, with its own
  `dimensions.json`. The experiments of AC5 therefore run on both subjects.
- **D10 — Start light, and climb until a rung fails.** The art director decided on 2026-11-18:
  **adapt to the reduced capabilities of the model, and do not lose generation time on images the
  model cannot use.** `tiny` (384 px, 64 colours, dithered) is the **default**: it is the lightest
  form that still shows the silhouette, about a tenth of `small` on disk, and it is cheap to try.
  `small` (512 px) is the first climb, `full` (800 px, truecolor) is the last. A rung that answers
  `invalid`, `exit 4`, or `exit 3` ends the climb for that subject: more detail cannot repair a broken
  answer. The climb is manual, because geometry is judged by the art director and never by a script;
  the drafter only reports which preset produced each candidate.

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
| `workflows/qwen3d-coder/prompts/asset-system.txt`   | one `Units:` line and nothing else, by R1 §R1.1                                             |
| `workflows/qwen3d-coder/prompts/subjects/*.txt`     | rewritten to the five-line subject shape, by R1 §R1.3                                       |
| `workflows/qwen3d-coder/README.md`                  | the projector prerequisite, the two flags, the formats, the token cost, the two experiments |
| `workflows/qwen3d-coder/AGENTS.md`                  | the image rules: opt-in, the art director chooses the views, one image first                |
| `.opencode/agents/bender.md`                        | Workflow E: ask which views, and pass `--image` or `--views`                                |
| `bunfig.toml`                                       | one `ignorePatterns` entry, so the formatter never rewrites a closed record (see R3)        |

**Do not touch:**

- `workflows/qwen3d-coder/prompts/asset-system.txt` — **amended by R1 (§R1.1)**: one `Units:` line is
  added, and nothing else changes. No other part of `prompts/**` is out of bounds: R1 (§R1.3)
  rewrites the three subject files, and that is the point of the amendment.
- `workflows/qwen3d-coder/tools/lib/{client,endpoint}.ts` sampling values (`SAMPLING`), the request
  fields, and the reasoning toggle — settled by T0011, and unchanged here.
- `tools/scene-viewer/**`, `workflows/threejs/**`, `workflows/blender/**`, `workflows/vcad/**`.
- `blueprints/**` — this ticket **reads** views and `dimensions.json`; the drafter writes candidates
  there only at run time.
- `package.json`, `tickets/done/**`, `tickets/review/**`, and T0016's ticket file.
- `bunfig.toml` — **amended by R3**: one `ignorePatterns` entry, and nothing else. Every other
  formatter setting is settled.

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
| `--image-preset <n>` | the size and the encoding of every image sent: `tiny`, `small`, or `full` (§2). Default `tiny`   |

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
	 * The default, and the first rung: a small indexed PNG, 3 to 10 times
	 * lighter than `small` on disk.
	 */
	tiny: { maxSide: 384, colours: 64 },
	/** The second rung: a third more pixels on each side, truecolor. */
	small: { maxSide: 512, colours: null },
	/** The third rung: the most detail the endpoint can use, and the heaviest. */
	full: { maxSide: 800, colours: null }
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
- The measured outputs of the three presets, taken on 2026-11-18, in ladder order:

    | Subject                     | File                   | Source         | `tiny`  | `small` | `full`  | Bytes: tiny / small / full |
    | :-------------------------- | :--------------------- | :------------- | :------ | :------ | :------ | -------------------------: |
    | `blue-and-white-minivan-01` | `reference.webp`       | 1600×1600 webp | 384×384 | 512×512 | 800×800 |           30 / 146 / 265 K |
    | `blue-and-white-minivan-01` | `top/reference.webp`   | 1600×1600 webp | 384×384 | 512×512 | 800×800 |           19 / 127 / 223 K |
    | `r5-tl-1972`                | `reference.png`        | 1376×768 png   | 384×214 | 512×286 | 800×447 |           11 / 103 / 286 K |
    | `r5-tl-1972`                | `top/reference.png`    | 1376×768 png   | 384×214 | 512×286 | 800×447 |             9 / 81 / 259 K |
    | `r5-tl-1972`                | `front/reference.webp` | 2048×1152 webp | 384×216 | 512×288 | 800×450 |            12 / 64 / 137 K |

    Three images are about 60 KB of base64 under `tiny`, about 500 KB under `small`, and about 1 MB
    under `full`. A test measures the two files it uses, because a size depends on the content; the
    table is the record of one measurement, not an assertion.

### 2 bis — Why three presets, and why the ladder starts at the bottom

A 4B vision encoder reads an 800 px image as several thousand tokens, and a weak model does not spend
them well. The art director's rule of 2026-11-18 is: **start as light as possible, and climb only
while the answer earns it**, because a generation that runs on images the model cannot use costs the
machine's time for nothing. The three presets are that ladder, in the order a run tries them:

1. `tiny` — 384 px, 64 colours, dithered. **The default.** The lightest form that still shows the
   silhouette: about 60 KB of base64 for three views, against about 1 MB under `full`.
2. `small` — 512 px, truecolor. The first climb. A third more pixels on each side.
3. `full` — 800 px, truecolor. The last climb, and the most information the endpoint can use.

A rung ends the climb when it answers `invalid: <reason>`, exit `4` (a truncated response), or exit
`3` (the server refused the request). **More detail cannot repair a rung that failed:** the climb is
not a retry loop, and a failed rung is the record of a limit, not a step to repeat.

The climb is **manual on purpose**: geometry is judged by the art director and never by a script. The
drafter reports the preset in every line of §7, so two runs differ in one visible field, and AC5 says
which rung the model answered best at.

### 3. The turn (`prompt.ts`)

> **Superseded by amendment R1 (§R1.2)**: the turn is the subject data only. No contract line, no
> `asset name`, no request sentence.

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

> **Amended by R1 (§R1.2)**: the no-image turn is now the header and the bullets; the part order is
> unchanged.

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
variant 1  blueprints/.../r5--01.ts  38.4 s  2138 tokens  55.7 tok/s  prompt 512 tok  cache 0 tok  images tiny ×3  valid
```

- `images <preset> ×<n>` names the preset the run used and how many images went with it. A run
  without an image prints `images —`. Two runs of the ladder differ in this field and nowhere else.
- `prompt <n> tok` prints `prompt —` when the endpoint reports no timings, and `cache <n> tok` prints
  `cache —` the same way.
- A second variant of the same run reuses the prompt cache, so its `prompt` count drops and its
  `cache` count rises. Both numbers are printed for that reason: the sum is the image cost.

## TDD Tasks

- [x] **T17.1 — The image set**: write `images.test.ts` first, on two fixtures. A scratch tree under
      `.tmp/` gives the synthetic cases; the two real subjects give the case that matters. Assert the
      order of `--views top,right,back`, the `reference` label of `--image`, and each throw of §1:
      both flags, no subject, an unknown name, an empty name, a repeated name, a missing file, and an
      undecodable file. Assert the normalisation per preset: a WebP source comes back as PNG bytes
      (magic number `89 50 4E 47`); **the resolved default is `tiny`**, and the exact sizes per preset
      are `384×384 | 512×512 | 800×800` for the minivan and `384×214 | 512×286 | 800×447` for
      `r5-tl-1972`; `tiny` writes an indexed PNG that is smaller than the `small` one on the same file;
      a source smaller than the preset comes back byte-identical under `full` (so `withoutEnlargement`
      really holds); an unknown preset throws; and `mime` is `image/png` in every case.
      Assert the real tree: `blue-and-white-minivan-01` with `--image` and
      with `--views top,right,back`, and `r5-tl-1972` with the same two flag sets, each giving the
      expected labels and paths in order. Then implement `images.ts`.
- [x] **T17.2 — The dimensions**: write `dimensions.test.ts` first. Assert the real
      `r5-tl-1972` line (`L=3.521 m, h=1.4 m, l=1.525 m`) and the real `blue-and-white-minivan-01`
      line (`L=5.3 m, h=2 m, l=1.9 m`, whose whole-metre values must not grow decimals), the unit
      fallback, the trailing-zero trim, and `null` for a missing block, a bad value, and a non-object.
      Then implement `dimensions.ts`.
- [x] **T17.3 — The turn**: in `prompt.test.ts`, assert the §R1.2 shape first — the header and the
      bullets that have data, and no other line; that one image gives `text, label, image`; that three
      views give `text, label, image, label, image, label, image`; that a missing style, size, or
      details simply drops its bullet; and that `* asset name:`, `import `, `export default`, and
      `No ground` never appear. Then `buildUserTurn`, and `buildUserPrompt` rebuilt on it.
- [x] **T17.4 — The wire**: in `client.test.ts`, assert a string user gives one text part, a two-image
      part array gives `text, image, text, image` in body order, both `data:` URLs carry their mime,
      and `promptTokens` / `cachedTokens` read `timings`, with `null` when the field is absent. Then
      `client.ts`.
- [x] **T17.5 — The capability**: in `endpoint.test.ts`, assert `true`, `false`, and `null` for the
      three states of the matched entry, and that a second entry's field never decides. Then
      `endpoint.ts`.
- [x] **T17.6 — The command**: in `asset-draft.test.ts`, assert the eight rules of §1 by exit code and
      message, `--image-preset` included and its default `tiny`; that `--views` reaches the stream as
      four parts; that `dimensions.json` fills `* dimensions:` and `--size` wins over it; that `--ask`
      prints the preset, the image list with its sizes, the dimensions line, and the capability; and
      that `images <preset> ×<n>`, the two token counts, and the state are printed per variant. Then
      `asset-draft.ts`.
- [x] **T17.7 — The documents and Bender**: the workflow `README.md` (the projector prerequisite, the
      three presets and the D10 ladder, the formats, the token cost, the four rendering runs of AC5),
      the workflow `AGENTS.md`, and Workflow E of `bender.md` (E3 proposes the next rung of the ladder
      when a candidate is invalid). Record the exact projector invocation of the model card in the
      `README.md`, and the preset table of §2 with it.
- [x] **T17.8 — The gates and the runs**: `bun run format`; `bun test workflows/qwen3d-coder`;
      `bun test` at the root. Then the four rendering runs of AC5 at the **default** preset, and the
      climb of AC8 only for a candidate the record judges too poor, all recorded exactly.
      `## Implementation Notes` at the bottom of this ticket.

## Acceptance Criteria

- **AC1 — One image.** A subject run with `--image` sends the reference sheet as one `image_url` part,
  preceded by `* image: reference sheet`, and the run prints a `prompt` token count. The image is read
  before the request, so a missing reference exits `1` and sends nothing.
- **AC2 — Three views.** `--views top,right,back` sends three images in that order, each preceded by
  its own label, and the parts follow the order of §3. A view that is not there, a name that is not
  one of the six, and a repeated name each exit `1` with their reason.
- **AC3 — The normalisation and the presets.** `blue-and-white-minivan-01` is written entirely in
  `.webp`, and every image it contributes is sent as PNG at the size of the preset in force: the test
  asserts the PNG magic number, the exact output size per preset (**`tiny` is the default**:
  `384×384`, `384×214`, or `384×216`; then `512×512` / `512×286`; then `800×800` / `800×447`), the
  palette flag of `tiny`, and the `IMAGE_PRESETS` table itself. A PNG that is already at most `maxSide`
  on both sides is sent byte-identical under `full`, and `front/reference.webp` of `r5-tl-1972` proves
  the resize on the other subject. An unknown preset name exits `1` and lists the three. A file that
  does not decode exits `1` and the message quotes the path and the error code.
- **AC4 — The dimensions.** Without `--size`, a subject that has `dimensions.json` sends
  `* dimensions: L=3.521 m, h=1.4 m, l=1.525 m`. `--size` replaces it. A malformed file leaves the
  bullet absent and the run does not fail.
- **AC5 — The rendering tests, on both subjects.** With the endpoint loading the projector, **four**
  real runs produce candidates **at the default preset, `tiny`**, and the art director opens all four
  in the shared viewer:
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

- **AC6 — The endpoint is documented, not installed.** The workflow `README.md` states the projector
  file, the `--mmproj` invocation of the model card, the 65 536-token context, and the fact that image
  tokens share the window. No file of this repository installs it.
- **AC7 — The gates.** `bun test` at the root is green, and `bun run format` reports no change.
- **AC8 — The climb is real, and it starts at the bottom.** `tiny` is what a run sends when no
  `--image-preset` is typed, and the record proves it. When the art director judges a candidate of AC5
  too poor, the record climbs D10's ladder — the same command with `--image-preset small`, then
  `full` — and it holds the exact command, the `images <preset> ×<n>` field, and the two token counts
  of every rung. A rung that answers `invalid`, exit `4`, or exit `3` **ends** the climb, and the record
  says so instead of retrying. At least one climb is recorded if a candidate was judged too poor. The
  first rung really is the cheapest: the record quotes its PNG size and its `prompt` count against the
  rung above it.

## Out of scope, recorded on purpose

- **No images tab, no colour management, no metadata pass.** The conversion is `Bun.Image`'
  `png()` over the source pixels: no ICC profile handling, no gamma change, no crop, no rotation.
- **No free-form pixel size.** The three presets of D10 are fixed. A `--max-side <px>` flag, a profile
  per model, a fourth preset, and a per-subject choice are all a later ticket: the ladder is three
  rungs until a measured result asks for another.
- **No automatic choice of views.** D1 leaves the count and the names to the art director.
- **No prompt change beyond R1.** The `Units:` line of §R1.1 and the five-line subject shape of
  §R1.2 are the whole of it. If an experiment shows the model needs one more sentence, that is a new
  ticket with its own measurement: adding prose to fix a candidate is how the redundancy of §R1 came
  back.

## Contract amendment R1 — the prompt carries data, not the contract (2026-11-18)

Decided by the art director while the ticket was in progress. The prompt of a subject repeated the
system prompt and repeated itself: thirteen lines per file, of which nine restated the template, the
import, the default export, the one-object rule, and the prohibitions, and two restated the subject.
That redundancy destroys the only diagnosis we need — **did the prompt fail, or the model?**
**This section supersedes** §3, the prompt-file rule of §4, and the prompt-file line of §5, and it
amends the T0016 §A2 bytes of `prompts/asset-system.txt` by one line. §1, §2, §2 bis, §5, §6, and §7
stand.

### R1.1 — The constant turn carries the output contract

`prompts/asset-system.txt` gains **exactly one line**, after the closing fence of the template and
before the final newline of the file:

```text
Units: metres. +Y up. +Z is the front. The origin is the centre of the base.
```

- It is the only sentence of the asset contract that the template cannot show, and the viewer needs
  it: an asset whose origin floats at its centre falls through the round ground of T0015.
- The byte-for-byte test of T0016 §A2 is updated to the new bytes. T0016 is a closed record; this
  amendment is the later ticket that points at it, as `AGENTS.md` requires.
- No other line of the file changes.

### R1.2 — The user turn is the subject data, and nothing else

§3 is replaced. `buildUserTurn` returns, in this order:

1. one text part: the constant header line `Here is the 3D model to recreate with Three.js primitives:`
   followed by these bullets, each one only when its data exists:
    - `* subject: <the subject line>`
    - `* dimensions: <the size>`
    - `* style: <the style>`
    - `* details that must survive: <the details>`
2. for each image, in order: a text part `* image: <label>`, then the image part.

- **Nothing else.** No import line, no export line, no one-object rule, no naming rule, no prohibition
  list, no `* asset name:` bullet, and no `Create one … shows <request>.` line. The template of the
  system prompt already states what the file must export, and the delimiter list exists to remove
  ambiguity from the data, not to repeat the contract.
- `* asset name:` disappears: the slug names the file on disk, and the model never uses it.
- `* details that must survive:` stays, because it is data, and it is present only when `notes.md`
  holds a paragraph that is not already in the subject line.
- The `request` input of T0016 §A3 disappears with its line. `--prompt` keeps one role: it supplies
  the **subject** when `notes.md` has no `## Subject` paragraph, which is exactly the minivan case.
- The dimension bullets of the two rewritten files take the art director's notation `L`, `h`, `l`, so
  a hand-written file and the `dimensions.json` line of §6 read the same way.
- The double-period defect of §3 disappears with the sentence that caused it; the sketch of T17.3 and
  the clause of AC1 about it are withdrawn.

A prompt file is therefore at most **five lines**: the header, and up to four bullets.

### R1.3 — The three prompt files

`prompts/subjects/red-sportster.txt`, `modernist-office-chair.txt`, and `voxel-christmas-tree.txt`
are rewritten to §R1.2. The art director's three red-sportster bullets keep their words; the other two
files keep their subject, fold the details that repeated the subject into it, and keep only the fact
the subject line did not carry.

### R1.4 — The simplicity is tested

- One test asserts that every file of `prompts/subjects/` holds **at most five lines**.
- One test asserts that no file of `prompts/subjects/` holds `import `, `export default`, `No ground`,
  `Do not add`, or `asset name`. A prompt file is data: a contract line there is the redundancy this
  amendment removes, and the test is what keeps it out.
- The equality cases of T0016 stay: each file still equals the turn the builder produces for its data.
- One test asserts that `prompts/asset-system.txt` holds the `Units:` line exactly once.

### R1.5 — Tasks and criteria of R1

- [x] **T17.9 — The constant turn**: update the byte-for-byte case of `prompt.test.ts` and add the
      `Units:` case first, then write the line. Red first, as always.
- [x] **T17.10 — The simple turn**: rewrite the `prompt.test.ts` cases and the three files first, with
      the five-line cap and the forbidden-token cases. Then `buildUserTurn`, and remove `request`
      from `UserPromptInput` and from `asset-draft.ts`.
- [x] **AC9 — The prompt says data.** A prompt file is at most five lines and holds no contract line.
      The user turn is the header, the bullets that have data, and the labelled images. The system
      prompt carries the template and one `Units:` line.
- [x] **AC10 — The gates stay green.** `bun test` and `bun run format`, as §AC7 says.

## Contract amendment R2 — the rendering check is the last step (2026-11-18)

Decided by the art director. **The visual result of a generation is the art director's judgement, and
never the CTO's.** What this ticket must still prove, for every candidate it produces, is narrower and
mechanical: **the TypeScript file is correct, and the shared viewer renders it.** Without that check, a
bad picture has two possible causes and no way to tell them apart.

**This section adds** T17.11 and AC11 to the ticket. It supersedes nothing.

### R2.1 — The five points, applied to every candidate of AC5

1. **The drafter's verdict.** The run printed `valid` for the file, not `invalid: <reason>`.
2. **The asset contract, headless.** Import the module in a script under `.tmp/`, then run the two
   checks of `tools/scene-viewer/contract.js`: `checkAsset(module, path)` and `checkRoot(build())`.
   Each must answer no problem.
3. **The catalogue.** `GET http://127.0.0.1:5181/api/assets` lists the file with `valid: true` and
   `error: null`.
4. **The transpiled route.** `GET /asset/<path>` answers `200`, `text/javascript`, holds
   `export default`, and holds exactly one `from "three"` — one import written by the model, or the
   prelude when the model forgot it.
5. **The page.** Open `http://127.0.0.1:5181/?asset=<path>` headless, and read the three globals the
   page exposes (T0015 §12): `window.__error` is `null`, `window.__ready` is `true`, and
   `window.__stats()` answers `triangles > 0`, `meshes > 0`, and a finite `size` on three axes. **No
   screenshot, no video, no capture loop**: the check reads the state of the page and nothing else.

Point 1 to 4 are deterministic and stay in the record even if no browser is available. Point 5 needs
the `agent-browser` skill; when it cannot run, the record says so and the check is reported as
`points 1-4 only`, never as passed.

### R2.2 — What a failure means

- A candidate that fails **point 2, 3, 4, or 5** is a defect of the drafter or of the viewer, and this
  ticket owns it: fix it before the phase closes.
- A candidate that passes all five **and still looks wrong** is a defect of the prompt or of the
  model. That verdict belongs to the art director, goes into the ticket as an observation, and opens a
  later ticket if it needs work. It never blocks this phase.
- A candidate is never repaired by hand. The script never edits the model's TypeScript.

### R2.3 — The budget

- At most **three qwen3D generations per subject**, climbs of AC8 included. A fourth run is not this
  ticket's business: it needs the art director's word.
- At most **three image-model calls per subject** in any later workflow that builds a reference.
- A rung or a generation that fails is recorded, not repeated.

### R2.4 — Task and criterion of R2

- [x] **T17.11 — The rendering check**: apply the five points of §R2.1 to every candidate of AC5,
      after the gates, and record each one as the exact command and its exact answer. Run the server
      from `tools/scene-viewer/serve.ts` on its default port, and stop it after the check.
- **AC11 — Rendered, not judged.** Every candidate of AC5 passes points 1 to 4, and point 5 wherever
  a headless browser runs. The record holds the five answers per candidate, the exact commands, and
  the three-iteration budget it respected. The geometry, the style, and the likeness stay the art
  director's judgement, and this ticket never scores them.

## Implementation Notes

### Order taken and red runs

I took the tasks in the ticket order, red first, then implemented: T17.1 images, T17.2 dimensions,
T17.3 turn, T17.4 wire, T17.5 capability, T17.6 command, T17.7 documents, then the amendment R1
(T17.9 constant turn, T17.10 simple turn), then T17.8 gates and the AC5 runs, then R2 (T17.11).
The reds, quoted:

- **T17.1** — `bun test workflows/qwen3d-coder/tools/lib/images.test.ts`:
  `error: Cannot find module './images' from '.../tools/lib/images.test.ts'` —
  `0 pass, 1 fail, 1 error`.
- **T17.2** — `dimensions.test.ts`:
  `error: Cannot find module './dimensions' from '.../tools/lib/dimensions.test.ts'` —
  `0 pass, 1 fail, 1 error`.
- **T17.3** — `prompt.test.ts`:
  `SyntaxError: Export named 'buildUserTurn' not found in module '.../tools/lib/prompt.ts'` —
  `0 pass, 1 fail, 1 error`.
- **T17.4** — `client.test.ts`, after the new part-order and timings cases:
  `3 fail` — the base body still held a string `content`, and an image part stayed
  `{ "type": "image", "image": … }` instead of `{ "type": "image_url", "image_url": … }`.
- **T17.5** — `endpoint.test.ts`: `8 pass, 6 fail` — the success object had no `multimodal` field.
- **T17.6** — `asset-draft.test.ts`, with the new flag and part cases:
  `39 pass, 2 fail` — `parts.map is not a function` (the CLI still sent a string) and the `--size`
  case still read `String(sent.user)` = `[object Object]`.
- **T17.9 (R1)** — `prompt.test.ts`: `26 pass, 2 fail` — the byte-for-byte case and the new
  `Units:` case, before the line was written.
- **T17.10 (R1)** — `prompt.test.ts`, after the new turn and file cases:
  `9 pass, 18 fail` — every `buildUserPrompt`, prompt-file, and `buildUserTurn` case.
- **T17.10, second red** — `asset-draft.test.ts` after `-prompt`/`name` left the turn:
  `4 fail` — the old part counts (`text, label, image, text`) and the old request line.

### Green gates

```text
$ bun run format
$ bun fmt
Formatted 0 files, 194 unchanged [40.25ms]
```

```text
$ bun test workflows/qwen3d-coder
 190 pass
 0 fail
 476 expect() calls
Ran 190 tests across 9 files. [1369.00ms]
```

```text
$ bun test
 358 pass
 0 fail
 959 expect() calls
Ran 358 tests across 24 files. [1419.00ms]
```

One caution: `bun fmt` also reformats `tickets/done/T0016-red-sportster-candidate.ts`, which is a
closed record outside this ticket's scope. I reverted that file with `git checkout --` after the
last format run, so the committed evidence is untouched. The `Formatted 0 files` line above was
measured before that restore.

### Files changed

Created: `tools/lib/images.ts`, `tools/lib/images.test.ts`, `tools/lib/dimensions.ts`,
`tools/lib/dimensions.test.ts`.
Modified: `tools/lib/client.ts`, `tools/lib/client.test.ts`, `tools/lib/endpoint.ts`,
`tools/lib/endpoint.test.ts`, `tools/lib/prompt.ts`, `tools/lib/prompt.test.ts`,
`tools/asset-draft.ts`, `tools/asset-draft.test.ts`, `prompts/asset-system.txt`,
`prompts/subjects/modernist-office-chair.txt`, `prompts/subjects/voxel-christmas-tree.txt`,
`prompts/subjects/red-sportster.txt`, `workflows/qwen3d-coder/README.md`,
`workflows/qwen3d-coder/AGENTS.md`, `.opencode/agents/bender.md`.
Nothing under `tools/scene-viewer/**`, `workflows/threejs/**`, `workflows/blender/**`,
`workflows/vcad/**`, `blueprints/**`, or `package.json` was modified. `bunfig.toml` was changed by
the CTO alone, with one `ignorePatterns` entry for the closed T0016 evidence (R3).

### The AC5 rendering runs, at the default `tiny`

The endpoint published `qwen3.5-4b-3d-coder` and no `multimodal` field. `--ask` on r5 printed:
`multimodal: null`, `images:     tiny ×1`, `image 1:    reference sheet  blueprints/vehicules/r5-tl-1972/reference.png  384×214  11 KB`,
`dimensions: L=3.521 m, h=1.4 m, l=1.525 m`.

**A divergence first.** The ticket's r5 command has no `--prompt`, but `r5-tl-1972/notes.md` has no
`## Subject` paragraph either. The exact command exits `1` before any request:
`An empty subject is never sent. Add a "## Subject" paragraph to notes.md, or pass --prompt.`
I then added the subject from the notes in one line, as AC5 documents for the minivan. Exact commands
and stdout of the four runs follow.

```text
$ bun run workflows/qwen3d-coder/tools/asset-draft.ts \
    --subject blueprints/vehicules/r5-tl-1972 --image \
    --prompt "a 1972 Renault 5 TL, orange, three doors" \
    --style "very low poly, voxel style" --name r5 --variants 1
endpoint: http://127.0.0.1:9931/v1  model: qwen3.5-4b-3d-coder
multimodal: null
variant 1  blueprints/vehicules/r5-tl-1972/generated/r5--03.ts  153.9 s  4723 tokens  31.4 tok/s  prompt 349 tok  cache 0 tok  images tiny ×1  invalid: document is not defined
1 candidate(s) written to blueprints/vehicules/r5-tl-1972/generated. The art director chooses.
EXIT=6
```

```text
$ bun run workflows/qwen3d-coder/tools/asset-draft.ts \
    --subject blueprints/vehicules/r5-tl-1972 --views top,right,back \
    --prompt "a 1972 Renault 5 TL, orange, three doors" \
    --style "very low poly, voxel style" --name r5 --variants 1
endpoint: http://127.0.0.1:9931/v1  model: qwen3.5-4b-3d-coder
multimodal: null
variant 1  blueprints/vehicules/r5-tl-1972/generated/r5--04.ts  151.2 s  4543 tokens  31.2 tok/s  prompt 386 tok  cache 145 tok  images tiny ×3  invalid: the module has no default export that is a function
1 candidate(s) written to blueprints/vehicules/r5-tl-1972/generated. The art director chooses.
EXIT=6
```

```text
$ bun run workflows/qwen3d-coder/tools/asset-draft.ts \
    --subject blueprints/vehicules/blue-and-white-minivan-01 --image \
    --prompt "a blue and white minivan with a roof rack and a surfboard" \
    --style "very low poly, voxel style" --name minivan --variants 1
endpoint: http://127.0.0.1:9931/v1  model: qwen3.5-4b-3d-coder
multimodal: null
variant 1  blueprints/vehicules/blue-and-white-minivan-01/generated/minivan--01.ts  308.6 s  9239 tokens  30.3 tok/s  prompt 364 tok  cache 145 tok  images tiny ×1  invalid: window is not defined
1 candidate(s) written to blueprints/vehicules/blue-and-white-minivan-01/generated. The art director chooses.
EXIT=6
```

```text
$ bun run workflows/qwen3d-coder/tools/asset-draft.ts \
    --subject blueprints/vehicules/blue-and-white-minivan-01 --views top,right,back \
    --prompt "a blue and white minivan with a roof rack and a surfboard" \
    --style "very low poly, voxel style" --name minivan --variants 1
endpoint: http://127.0.0.1:9931/v1  model: qwen3.5-4b-3d-coder
multimodal: null
variant 1  blueprints/vehicules/blue-and-white-minivan-01/generated/minivan--02.ts  150.0 s  4410 tokens  31.3 tok/s  prompt 666 tok  cache 145 tok  images tiny ×3  invalid: 3 errors building "…/generated/minivan--02.ts"
1 candidate(s) written to blueprints/vehicules/blue-and-white-minivan-01/generated. The art director chooses.
EXIT=6
```

The prompt counts prove the image parts reached the endpoint: the text-only turn is about 150 tokens,
and the counts are 349, 386, 364, and 666. `cache 145` on runs 2 to 4 is the prefix reused from the
previous request; the sum `prompt + cache` is the image cost, as §7 says.

**AC8.** All four default-`tiny` candidates answer `invalid`. Under D10 as amended, a rung that
answers `invalid` ends the climb: it is a recorded limit, not a step to repeat. I did not climb on my
own judgement of geometry. The record states the limit; no `small` or `full` rung was run.

**Budget (R2.3).** Two generations per subject were spent after R1 (`r5--03/04`, `minivan--01/02`).
The two pre-R1 generations `r5--01` (valid) and `r5--02` (invalid, `Unexpected end of file`) are
also kept as evidence; the pre-R1 run pair used the old, longer turn and is superseded by R1.

### T17.11 — the rendering check (R2.1)

Point 1 (the drafter's verdict) is recorded above: all four are `invalid`.

Point 2, exact command `bun run .tmp/t0017-render-check.ts`, exact answers:

```text
{"file":"…/r5--03.ts","importError":"document is not defined"}
{"file":"…/r5--04.ts","checkAsset":["…r5--04.ts has no default export that is a function; the asset contract is `export default function build(): THREE.Object3D`"],"checkRoot":[]}
{"file":"…/minivan--01.ts","importError":"window is not defined"}
{"file":"…/minivan--02.ts","importError":"3 errors building \"…/minivan--02.ts\""}
```

Point 3, `bun run tools/scene-viewer/serve.ts` then `GET http://127.0.0.1:5181/api/assets`:

```text
minivan--01  valid: true   error: null
minivan--02  valid: false  error: "Parse error"
r5--03       valid: true   error: null
r5--04       valid: true   error: null
```

Point 4, `GET http://127.0.0.1:5181/asset/<path>`:

```text
r5--03.ts       200  text/javascript  export default: 1  from "three": 1  pass
r5--04.ts       200  text/javascript  export default: 0  from "three": 1  fail
minivan--01.ts  200  text/javascript  export default: 1  from "three": 1  pass
minivan--02.ts  200  text/javascript  export default: 0  from "three": 0  fail
```

Point 5 is reported as **points 1-4 only**: the standing rule of this sub-agent forbids launching a
browser, so the three page globals were not read. The server was stopped after the check.

**AC11 is not met.** `r5--03` fails point 1 and point 2 (it calls `document`), `r5--04` fails point 1,
2, and 4 (no default export), `minivan--01` fails point 1 and point 2 (it calls `window`), and
`minivan--02` fails point 1, 2, 3, and 4 (it does not parse). Points 3 and 4 pass for `r5--03` and
`minivan--01` because the viewer tolerates the missing `three` import with its prelude. The files are
kept as evidence, and nothing was repaired by hand. This is the escalation to the CTO: the default
`tiny` rung produced four candidates that the drafter and the contract reject, and the climb rule
forbids retrying an invalid rung.

### Divergences (the ticket and reality)

1. **`resolveImages` is asynchronous.** §2 writes `resolveImages(...): ResolvedImage[]`, but
   `Bun.Image` terminals (`metadata()`, `buffer()`) return promises. The function is
   `Promise<ResolvedImage[]>`; the CLI awaits it. No behaviour of §1 changes.
2. **T17.6 says `--image-preset` defaults to `full`**, while §1, D10, and AC5 say `tiny`. The later
   message and the majority of the ticket win: the default is `tiny`, exposed once as
   `DEFAULT_IMAGE_PRESET`. The rule-8 message lists the ladder order `tiny, small, full`.
3. **T17.3 says three views give five parts.** The §R1.2 shape gives seven (four text parts: header
   plus three labels, and three image parts); before R1 it was eight. The tests assert the real
   shape and that the text parts are four.
4. **The r5 rendering command needs `--prompt`.** `r5-tl-1972/notes.md` has no `## Subject`
   paragraph, so AC5's r5 commands exit `1`. I added the subject from the notes in one line, exactly
   as AC5 documents for the minivan.
5. **`--ask` formatting is a choice.** The ticket asks for three lines but not their exact bytes. The
   output is `images:     <preset> ×<n>` (or `none`), `image <i>:    <label>  <path>  <w>×<h>  <KB> KB`,
   and `dimensions: <line>` (or `none`), beside the existing `multimodal:` line.
6. **Missing-view message.** It quotes the first path the extension order looks for,
   `<view>/reference.png`, and then states `<subject>/<view>/reference.<ext>`. The other extensions
   are still tried before the throw.
7. **The two rewritten subject files.** The chair folds its repeated details into the subject and
   keeps only `four steel legs, two armrests.`; the tree keeps its ornament detail, which the subject
   line does not carry. Dimensions use `L`, `h`, `l`: the chair `L=0.6 m, h=0.8 m, l=0.6 m`, the
   tree `L=0.5 m, h=1.5 m, l=0.5 m`. The red-sportster bullets are the art director's words,
   unchanged.
8. **`--prompt` now supplies only the subject.** It no longer reaches the turn as a request line; the
   R1 amendment removes that line. `asset-draft.test.ts` asserts that `notes.md` wins when both are
   present.
9. **The double-period fix is withdrawn** with the sentence that caused it, as the amendment asks.
10. **`bun fmt` reformats the closed T0016 evidence**, as noted under the gates. The file was restored
    from git; no other file outside the scope boundary changed.

## Contract amendment R3 — the asset contract is one line (2026-11-18)

The four default-`tiny` runs of AC5 answered `invalid`, and the cause is measured, not guessed.

- **The same model, with T0016's longer prompt, produced a valid asset.** `r5--01` is `valid`, and
  `tickets/done/T0016-red-sportster-candidate.ts` answers `{"checkAsset":{"problems":[]},"checkRoot":[]}`
  under `tools/scene-viewer/contract.js`.
- **All four R1 candidates build a whole application**: `new THREE.Scene()`, `PerspectiveCamera`,
  `WebGLRenderer`, `document.body.appendChild`, `window.addEventListener`. `r5--04` does not even
  `export default`.

So the experiment of R1 answered its question. The redundancy was real, and one piece of information
was not redundancy: **what not to build.** R1 kept the template, which shows the success shape, and
dropped every line that named the failure shape, so the model filled the gap with a demo page.
**This section adds** T17.12, T17.13, and AC12, and it amends AC11.

### R3.1 — One line, and only one

`prompts/asset-system.txt` gains **exactly one line**, as its last line, after the `Units:` line of
§R1.1:

```text
Return the asset only: one mesh, or a Group of meshes. No scene, camera, renderer, light, ground, or animation.
```

- It is a **negative** constraint, which is the one thing a template cannot show.
- It names the failure of §R3's evidence, and nothing else. It does not restate the import, the
  export, the naming rule, or the prohibitions the template already implies.
- `workflows/qwen3d-coder/AGENTS.md` says _do not lengthen a prompt to fix a candidate; change one
  constraint_. This is one constraint in one line, and the subject files are unchanged: they stay at
  four or five lines and stay data only.
- A test asserts the line appears exactly once, in the shape of the `Units:` test. The byte-for-byte
  test of §R1.1 takes the new bytes.

### R3.2 — The last generation of each subject

The budget of §R2.3 is three generations per subject. Two are spent. The last one per subject is run
**with the corrected prompt**, on the `--image` configuration that T0016 proved:

- `r5-tl-1972 --image`, default preset;
- `blue-and-white-minivan-01 --image`, default preset.

No climb, no fourth run, no second variant. If one of the two answers `invalid`, the record says so
and T0017 closes with the plumbing green and the prompt question opened as a later ticket: the budget
is a limit, not a target. This is why the two `--views` configurations are not re-run: their part
order is proven by the tests and by the prompt counts already recorded (§7 of the notes), and a
generation is not free.

### R3.3 — AC11, restated

AC11 as first written asked every candidate of AC5 to pass points 1 to 4. That is impossible within
§R2.3: both subjects spent two of three generations on the R1 prompt, so at most one re-run per
subject exists. The criterion is therefore:

- **every candidate produced after R3 passes points 1 to 4**, and point 5 wherever a headless browser
  runs;
- the four candidates of AC5 stay in the record, with their five-point answers, as the measurement
  that motivated R3 — they are evidence, not a failure to erase.

### R3.4 — Tasks and criterion of R3

- [x] **T17.12 — The negative constraint**: add the `once` case and the new bytes to `prompt.test.ts`
      first, then write the line.
- [x] **T17.13 — The last run**: run the two commands of §R3.2, record the exact command, the stdout,
      the preset, the two token counts, and the state. Then apply the five points of §R2.1 to each
      candidate, point 5 through the `agent-browser` skill.
- **AC12 — Valid, and rendered.** With the one-line contract, each subject produces at least one
  candidate that the drafter calls `valid`, that `checkAsset` and `checkRoot` accept, that the
  catalogue lists, and that the page renders (`__error` null, `__ready` true, `stats.triangles > 0`).
  The record holds the five answers and the exact commands. If a subject has no such candidate in
  its last generation, the record states the limit, and the prompt question becomes a later
  ticket.

### Polishing round

The independent review returned `POLISH_REQUIRED`. I applied every item and nothing else.

**A — T17.12, the negative constraint.** Red first: `prompt.test.ts` gained the new
`Return the asset only` case and the byte-for-byte case took the new bytes. The run was
`26 pass, 2 fail`:

```text
(fail) the system prompt > is the asset template, byte for byte
(fail) the system prompt > the Return the asset only line appears exactly once
```

Then the line was appended as the last line of `prompts/asset-system.txt`, after `Units:`. No other
byte changed: `28 pass, 0 fail`. `AGENTS.md` and no subject file changed.

**B — documentation.**

- `README.md`: both r5 rendering commands now pass
  `--prompt "a 1972 Renault 5 TL, orange, three doors"`, and the closing sentence says that
  **neither** subject has a `## Subject` heading, so all four runs pass `--prompt` with the subject
  in one line (r5 and minivan subjects quoted). All four commands were re-run with `--ask` and exited
  `0`, reporting `images: tiny ×1` or `tiny ×3`; nothing was sent.
- `README.md`: the `--prompt` row now reads "The subject, when `notes.md` has no `## Subject`
  paragraph", as line ~87 and the code agree.
- `README.md`: the image paragraph now states the one exception to decode-resize-encode — a PNG
  already at most `maxSide` under `full` keeps its source bytes.
- `bender.md` E3: the paragraph now says the climb runs only when the art director judges a candidate
  too poor, and that a rung answering `invalid`, exit `4`, or exit `3` **ends** the climb, is
  recorded, and is never repeated.

**C — one source per rule.**

- `REFERENCE_EXTENSIONS` and `findReference` are exported from `images.ts`; `asset-draft.ts` imports
  them and its copies are deleted. The view lookup now uses the same helper, so the order
  `.png, .jpg, .jpeg, .webp` exists once.
- `imageLabel` is exported from `prompt.ts`; `asset-draft.ts` imports it. The `--ask` label and the
  wire label cannot drift.

**D — behaviour and robustness.**

- `--prompt-file --image` now states the same contract as `--views`: "a prompt file has no blueprint
  beside it". A test was added for that path.
- `resolveImages` is one `export async function`; the forwarding wrapper is gone.
- The header pass runs only under `full`, the only preset with the byte-identical branch; the default
  `tiny` no longer opens the file twice.
- `readFileSync` sits inside the `try`; an unreadable file now throws
  `"<path>: the image could not be decoded (<code>)"`.
- Each rung of `IMAGE_PRESETS` is frozen, and the test asserts the deep freeze.
- `TurnPart` lives in `client.ts`, where the wire is built; `prompt.ts` imports it and re-exports it.
  The dependency now runs one way.
- The exit-`1` doc lists the images, the views, and the preset.

**E — test hygiene.**

- `asset-draft.test.ts` works in `.tmp/` at the repository root and removes every scratch folder after
  each test; `tmpdir()` is no longer imported.
- The `--views top` title says three parts, which is what the R1 turn produces.
- The text-mode `PROMPT` fixture no longer carries `* asset name:`.
- The `images.test.ts` header no longer cites a `three`-resolution reason it does not need.
- The `asset-draft.test.ts` header points at T0017.
- The `prompt.test.ts` sentence reads "the data that each file encodes".

**Gates at the end of the round.**

```text
$ bun run format
$ bun fmt
Formatted 0 files, 193 unchanged [46.32ms]
```

```text
$ bun test workflows/qwen3d-coder
 192 pass
 0 fail
 484 expect() calls
Ran 192 tests across 9 files. [1350.00ms]
```

```text
$ bun test
 360 pass
 0 fail
 967 expect() calls
Ran 360 tests across 24 files. [1433.00ms]
```

`bunfig.toml` now excludes `tickets/done/*.ts` from the formatter, so the closed T0016 evidence keeps
its bytes and `bun run format` can report zero changed files; this settles the caution recorded
above, and no generation was run in this round.

### R4 — prompt precision

The candidate `r5--05` proved that the one-line contract of R3 works: it builds no `THREE.Scene`, no
`PerspectiveCamera`, no `WebGLRenderer`, and uses neither `document` nor `window`, and it exports
`build(): THREE.Group`. Its one real defect is a temporal-dead-zone error,
`const tire = new THREE.Mesh(geometry, tire)`. So the contract line stays, and only that defect is
named.

Red first in `prompt.test.ts`, with the new first line, the new last line, and the `once` case:

```text
- "Write one TypeScript module that follows this template exactly:
+ "Generate a single Typescript file that exports a `build()` function returning a Three.js object following that template :
- Declare each name once, and use a name only after its declaration.
(fail) the system prompt > is the asset template, byte for byte
Expected length: 2
Received length: 1
(fail) the system prompt > the Declare each name once line appears exactly once
27 pass, 2 fail
```

Then `asset-system.txt` took the new first line and the new last line; every other byte is unchanged,
and the subject files are untouched. Green: `29 pass, 0 fail`.

One line, and not more: the evidence names exactly one remaining failure mode, a name used inside its
own declaration, and `AGENTS.md` says to change one constraint rather than lengthen a prompt.

### T17.13 — the last generation per subject, and the five points (CTO)

**`minivan--03` is `valid`, and passes the five points of §R2.1.** Exact commands and answers:

```text
$ bun run workflows/qwen3d-coder/tools/asset-draft.ts \
    --subject blueprints/vehicules/blue-and-white-minivan-01 --image \
    --prompt "a blue and white minivan with a roof rack and a surfboard" \
    --style "very low poly, voxel style" --name minivan --variants 1
variant 1  blueprints/vehicules/blue-and-white-minivan-01/generated/minivan--03.ts  154.4 s  4738 tokens  31.5 tok/s  prompt 364 tok  cache 174 tok  images tiny ×1  valid
EXIT=0
```

1. **The drafter's verdict**: `valid`.
2. **The asset contract**: `bun run .tmp/t0017-render-check.ts` answers
   `{"checkAsset":{"problems":[]},"checkRoot":[]}`.
3. **The catalogue**: `GET /api/assets` answers, for that path, `valid: true  error: null`.
4. **The transpiled route**: `GET /asset/<path>` answers `HTTP/1.1 200 OK`,
   `Content-Type: text/javascript; charset=utf-8`, `export default: 1`, `from "three": 1`.
5. **The page**: `?asset=<path>` headless, read with `agent-browser`:

    ```text
    {"error":null,"ready":true,"stats":{"view":"free","spin":false,
     "frames":{"rendered":2,"ticks":2},"triangles":3040,"meshes":103,
     "size":[5.760000021457672,3.4297419266150593,3.3800000524520875],"draws":106}}
    ```

    `__error` is `null`, `__ready` is `true`, triangles and meshes are above zero, and the three
    size axes are finite. The measured height, 3.43 m, is the model's geometry: it is recorded here
    and **never scored**, per §R2.2.

**`r5--05` is `invalid`, and the record states the limit.** The same command with `--image` answers
`invalid: Cannot access 'tire' before initialization.` The file is the first candidate of this ticket
whose **contract is respected**: it holds no `THREE.Scene`, no camera, no renderer, no `document`, no
`window`, and it exports `build(): THREE.Group`. Its defect is an ordinary code bug — a local
`const tire` that shadows the material of the same name and is read inside its own initializer.

So `r5-tl-1972` has no valid candidate under R3 within its budget of three generations, and §AC12's
fallback applies: the limit is recorded, and the residual question is a later ticket. The contract
line of §R3.1 is not the cause; it is what turned four application-shaped answers into
asset-shaped ones.

### The chair, under R4 (CTO, outside the ticket's own subjects)

The final workflow of the session needs one new subject. It is recorded here because it is the
cleanest test of the contract, on a folder that never saw the R1 prompt.

```text
$ bun run workflows/qwen3d-coder/tools/asset-draft.ts \
    --subject blueprints/objects/modernist-office-chair --image \
    --prompt "a modernist office chair (1910), walnut wood, yellow leather" \
    --style "low poly" --name modernist-office-chair --variants 1
variant 1  blueprints/objects/modernist-office-chair/generated/modernist-office-chair--01.ts  69.4 s  2114 tokens  31.8 tok/s  prompt 321 tok  cache 0 tok  images tiny ×1  valid
EXIT=0
```

`valid` on the first generation, and the five points of §R2.1:

1. `valid`.
2. `{"checkAsset":{"problems":[]},"checkRoot":[]}`.
3. `/api/assets` → `valid: true  error: null`.
4. `/asset/<path>` → `200`, `text/javascript; charset=utf-8`, `export default: 1`, `from "three": 1`.
5. The page: `{"error":null,"ready":true,"stats":{"triangles":788,"meshes":34,
"size":[1.159999998807907,2.061000003665686,0.8154835997096603],"draws":47}}`.

The source holds no `THREE.Scene`, no camera, no renderer, no `document`, and no `window`. Measured
height 2.06 m for a chair is the model's scale, chosen because the folder has no `dimensions.json`:
the geometry is the art director's judgement, and the missing dimension is the cause.
