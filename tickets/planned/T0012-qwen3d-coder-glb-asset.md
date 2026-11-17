# T0012 — The Qwen 3D Coder workflow, part two: a `.glb` out of a reference image

- **Track**: Qwen 3D Coder workflow (asset generation)
- **Wave**: 2 (integration — it reuses the runtime and the transport that T0011 builds)
- **Depends on**: T0011
- **Blocks**: nothing
- **References**:
    - Model card, `ccore/Qwen3.5-4B-GLB-3D-Coder`: https://huggingface.co/ccore/Qwen3.5-4B-GLB-3D-Coder
    - Training dataset, `ccore/ThreeJS-3D-GLB-Assets`: https://huggingface.co/datasets/ccore/ThreeJS-3D-GLB-Assets
    - llama.cpp server flags and API: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
    - llama.cpp multimodal projector: https://github.com/ggml-org/llama.cpp/blob/master/tools/mtmd/README.md
    - glTF-Transform CLI: https://gltf-transform.dev/cli
    - Three.js `GLTFExporter`: https://threejs.org/docs/#examples/en/exporters/GLTFExporter
    - Playwright downloads: https://playwright.dev/docs/api/class-download
    - [`workflows/qwen3d-coder/AGENTS.md`](../../workflows/qwen3d-coder/AGENTS.md) (written by T0011)
    - [`AGENTS.md`](../../AGENTS.md) "3D conventions" and "Validation rules"

## Context & Goal

T0011 opens the fourth workflow and gives it one entry point, `tools/scene-draft.ts`, which writes a
**scene** as a standalone `.html`. A scene is not an asset. This workflow also has to produce an
asset: a prop, a creature, a building, or a vehicle that a Three.js page loads, positions, and
animates.

`ccore/Qwen3.5-4B-GLB-3D-Coder` is the sibling of the T0011 model, with the same base, the same
license (Apache 2.0), and the same runtime. It writes one standalone HTML page that builds a low-poly
asset and carries an **Export GLB** button. The `.glb` is the artifact this ticket wants.

**The word "Godot" in its system prompt is a framing, not a constraint.** The card targets the Godot
editor because it takes `.glb` imports. A `.glb` is binary glTF: engine-agnostic, and the second
deliverable of this repository's own Three.js workflow. `workflows/threejs/README.md` states it:
"the deliverable is a `model.js` that builds the asset with `three` alone, and a `.glb` exported from
it." The repository already holds `.glb` files, and the root `AGENTS.md` already gates them with
`bunx @gltf-transform/cli inspect`.

**Done means:** one command turns a subject reference image and a request into a candidate `.glb`
beside its `.html` source, in the subject folder. The `.glb` is inspected, and its numbers are
recorded. The art director looks at the asset and chooses. No candidate is deleted.

**This workflow produces unmeasured, stylized candidates judged by eye.** It has **no gate**, it does
not run G1, G2, or G3, and it does not replace workflow D.

## Scope Boundary

**Create, inside the workflow that T0011 opens:**

```text
workflows/qwen3d-coder/
├── prompts/
│   └── glb-coder-system.txt  the system prompt, verbatim from the model card
└── tools/
    ├── asset-draft.ts        the entry point and the CLI
    ├── lib/asset-prompt.ts   the user prompt, a pure function of its inputs
    ├── lib/export-glb.ts     serve the page, click Export GLB, capture the download
    └── lib/*.test.ts         the hermetic tests
```

**Modified, append only:**

- `scripts/llama-server/profiles.ts` — one entry, `glb-coder`. No existing line changes.
- `workflows/qwen3d-coder/README.md` — one section for the second entry point.
- `workflows/qwen3d-coder/AGENTS.md` — one rule: an asset is one object, and the export is a
  download, not a repair.
- `.opencode/agents/bender.md` — one section, "Workflow F".
- `opencode.jsonc` — one model, `local/glb-coder`, inside the `local` provider that T0011 declares.
- `tickets/README.md` — the board.

**Out of scope.** Do not touch `tools/scene-draft.ts`, `tools/lib/{prompt,client,candidates,extract}.ts`
(reuse them; a change there is a separate ticket), `scripts/llama-server/{install,serve}.ts`,
`workflows/threejs/**`, `workflows/blender/**`, `workflows/vcad/**`, `blueprints/**` at commit time.

**No `.gitignore` change.** `blueprints/*/*/*` already ignores the candidate folder, and the weights
stay in the llama.cpp cache.

## Contract

### 1. The profile

`scripts/llama-server/profiles.ts` gains one entry:

```ts
"glb-coder": {
  repo: "ccore/Qwen3.5-4B-GLB-3D-Coder",
  quant: "Q4_K_M",
  port: 9932,
  alias: "local/glb-coder",
  ctx: 65536,
},
```

The port is `9932`, so both models can run at once without a restart. The whole 17.49 GB safetensors
checkpoint is **not** downloaded: the card offers `Q4_K_M` at 2.71 GB, and its recorded evaluation
used `Q8_0`. `Q4_K_M` is the choice, as in T0011.

`serve.ts` and `install.ts` need no change. A profile is data.

### 2. The inference request

Same endpoint and same SSE handling as T0011, `POST /v1/chat/completions`. The body differs in the
sampling and the cap:

```json
{
	"model": "local/glb-coder",
	"messages": [
		{
			"role": "system",
			"content": "<prompts/glb-coder-system.txt, byte for byte>"
		},
		{ "role": "user", "content": "<lib/asset-prompt.ts>" }
	],
	"temperature": 0.8,
	"top_p": 0.95,
	"top_k": 40,
	"min_p": 0.0,
	"repeat_penalty": 1.0,
	"max_tokens": -1,
	"stream": true
}
```

The values come from the model card, "Sampling settings", and are the card's own numbers, not a
range: temperature 0.8, top-k 40, top-p 0.95, min-p 0.0, repeat penalty 1.0.

**T0011, section 6, defines each field and says what it does.** Only four fields differ here, and
each difference is a fact from this model's card:

| Field         | T0011             | Here         | Why                                                                                                                 |
| :------------ | :---------------- | :----------- | :------------------------------------------------------------------------------------------------------------------ |
| `temperature` | 0.6               | **0.8**      | The card gives 0.8 as a value, not a range.                                                                         |
| `top_k`       | 20                | **40**       | Same reason.                                                                                                        |
| `min_p`       | not sent, so 0.05 | **0.0 sent** | The card pins 0.0, which disables the cut. Sending it is not a change of behavior: it removes an inherited default. |
| `max_tokens`  | 16384             | **-1**       | Decision D1 below.                                                                                                  |

`typical_p`, the XTC pair, `dynatemp_range`, the presence/frequency pair, and `seed` stay absent, for
the reasons T0011 records.

**D1 — `max_tokens: -1` is mandatory.** The card states: "Maximum output tokens: Unlimited — `-1`
where supported", and "An 8K output limit is too restrictive for these generations and can stop the
response during thinking or before the HTML is complete, leaving incomplete or unusable code." The
card also states that thinking must stay enabled, without an effort limit.

Because the token cap is gone, the **wall-clock guard replaces it**: `--timeout`, default `3600`
seconds. An aborted run writes no candidate and exits `3`.

**D2 — the cost is measured, not assumed.** The card states responses average about 20 000 tokens,
that the training examples reach 72 000, and that the recorded evaluation used `Q8_0`. T0011
measures the decode rate on this machine. A 20 000-token response at 8 to 11 tokens per second is 30
to 42 minutes. `## Implementation Notes` records the real number and the asset it produced. If the
measured rate makes a single asset exceed one hour, this ticket stops at gate E2 and reports; it does
not buy hardware.

### 3. The system prompt

`prompts/glb-coder-system.txt` holds the model card's system prompt, byte for byte:

```text
Create game assets for the Godot editor, which uses GLB files. Create whatever the user requests as a good-quality low-poly asset using only Three.js in one complete standalone HTML file. The HTML must show the asset and include an Export GLB button that downloads a working GLB. If the requested asset needs animation, add it and include the animation in the exported GLB; otherwise make it static.
```

It is not edited. The word "Godot" stays: the card warns that generation quality was validated with
this exact prompt.

### 4. The user prompt

`buildAssetPrompt(input)` is a pure function of the same four blocks as T0011, section 8, with one
difference: block 4 asks for **one asset**, not a scene.

```text
Create <the request> as one low-poly asset, viewed on its own against a plain background.
```

A prompt that asks for several objects, a landscape, or a scene is rejected by `validateRequest`
with exit code `1`, because the card's `Export GLB` button exports one asset tree. The rejection
message names the offending words and stays a list, not a rewrite.

### 5. The candidate files

```text
blueprints/<category>/<subject>/generated/qwen3d-coder-glb--<NN>.html    the source the model wrote
blueprints/<category>/<subject>/generated/qwen3d-coder-glb--<NN>.glb     the export
```

Both share one counter. `--01` is the first free number. `O_EXCL` on create. The script never
deletes, never renames, never overwrites. The `.glb` is written only after the run succeeds; a failed
export leaves the `.html` alone, as evidence.

Generation reads `reference.<ext>` only. It never reads `source.<ext>`.

### 6. The export

The page holds the button; the script clicks it and captures the file. Three documented facts define
the contract:

1. Three.js `GLTFExporter` is the documented exporter, and its `save()` is the documented download
   path: https://threejs.org/docs/#examples/en/exporters/GLTFExporter
2. Playwright delivers a download event with a readable stream:
   https://playwright.dev/docs/api/class-download
3. Bun serves a directory as static files with `Bun.serve`.

`exportGlb(html, out)`:

1. Serves the candidate folder on `127.0.0.1` on a free port with `Bun.serve`.
2. Opens `qwen3d-coder-glb--<NN>.html` in a headless browser.
3. Waits for the button whose visible text contains `Export GLB`. It finds the button by its **text**,
   never by a CSS selector: the model writes the markup, so no selector is stable.
4. Waits for the download event, with a 120 s limit after the click.
5. Writes the download stream to `qwen3d-coder-glb--<NN>.glb`.
6. Closes the browser and the server, in a `finally`, on every path.

**D3 — a missing button is a failed run, not a repair.** When the page holds no `Export GLB` button,
or the click produces no download, the run exits `4` and the `.html` stays, as evidence. The script
never edits the model's JavaScript. This is a rule of the workflow, not a preference of this ticket.

The `.glb` is then read back and must satisfy both checks, or the run exits `4`:

- the first four bytes are `glTF`,
- `bunx @gltf-transform/cli inspect <file>.glb` reports at least one mesh.

`bunx` is the documented command in the root `AGENTS.md`, "Validation rules", Web.

### 7. The CLI

```bash
bun run workflows/qwen3d-coder/tools/asset-draft.ts --subject blueprints/<category>/<subject> \
  --prompt "<one asset>" --style "<style>" --variants 1 [--image] [--port 9932] \
  [--timeout 3600]
```

`--ask` sends nothing and lists the gaps. Exit codes are T0011's, with one addition: `4` also covers
an export that produced no `.glb`.

The report, per variant: the `.html` path, the `.glb` path, the wall-clock seconds, the output
tokens, the decode rate, and the triangle count from the inspection.

### 8. The provider entry

One model inside T0011's `local` provider:

```jsonc
"models": {
  "3d-coder": { "name": "Qwen 3.5 4B 3D Coder" },
  "glb-coder": {
    "name": "Qwen 3.5 4B GLB Coder",
    "modelID": "local/glb-coder",
    "limit": { "context": 65536 }
  }
}
```

The `models` map key is the OpenCode model ID and `modelID` is "the model or deployment ID sent to
the provider" (OpenCode provider documentation). The entry exists for a manual chat. Bender calls the
script, never this provider.

### 9. The two gates of this workflow

This workflow has no fidelity gate. It has two **sanity gates**, and both can fail the ticket:

- **E1 — the image speaks.** The card supplies the projector but demonstrates no image-guided export
  for this model. The risk is recorded here, not discovered later.
- **E2 — the asset contract.** The exported `.glb` is measured against the root `AGENTS.md`,
  "3D conventions". The ticket records the deviations and repairs none of them.

## TDD Tasks

- [ ] **T2.1 — The profile**: a failing test that reads `profiles.ts` and asserts the `glb-coder`
      entry of section 1, and asserts that `3d-coder` is unchanged. Then append the entry.
- [ ] **T2.2 — The system prompt and the asset prompt**: failing tests. Assert
      `prompts/glb-coder-system.txt` byte for byte against the model card. Assert the four-block output
      against a fixture. Assert that a scene-like request is rejected with exit code `1`, and that a
      single asset is accepted. Then implement `lib/asset-prompt.ts`.
- [ ] **T2.3 — The request body**: a failing test against an in-process `Bun.serve` on port `0`.
      Assert every field of section 2, including `max_tokens: -1`, `min_p: 0.0` sent explicitly, and the
      card's sampling. Assert that `typical_p`, the XTC pair, `dynatemp_range`, the presence/frequency
      pair, and `seed` are absent, as T0011's section 6 requires. Then wire `asset-draft.ts` to T0011's
      `lib/client.ts`.
- [ ] **T2.4 — The button finder**: failing tests on recorded DOM fixtures. Assert that a button with
      the text `Export GLB` is found, that a button labelled `Download` is not, that a `<div>` that only
      contains the text is not a button, and that zero matches raise `NoExportButtonError`.
- [ ] **T2.5 — The download capture**: failing tests with an injected browser port (a fake with
      `page`, `download`, `close`). Assert that a download is written byte for byte, that a missing
      download raises after 120 s, and that the browser and the server close on the success path and on
      every error path.
- [ ] **T2.6 — The `.glb` check**: failing tests on two recorded fixtures, one real `.glb` and one
      text file. Assert the magic bytes, and assert that the inspector result is read from the process
      output without a live model.
- [ ] **T2.7 — Implementation and wiring**: `asset-draft.ts`, the flags, the report, the exit codes.
- [ ] **T2.8 — The documents**: the append-only hunks of section "Scope Boundary". The workflow
      `README.md` gains its second command. The workflow `AGENTS.md` gains its export rule. `bender.md`
      gains workflow F: read the reference, run `--ask`, ask the art director in one call, run the script,
      hand back the `.glb` path with the inspection numbers and one line of description, and wait for the
      choice. Never choose, never promote, never rewrite the model's JavaScript.
- [ ] **T2.9 — Gate E1, the image speaks**: two real runs with the same request, one with `--image`
      and one without. The art director compares the two assets. The gate passes when the two assets
      differ in a way that follows the reference. When they are indistinguishable, **the image path does
      not work**: stop, record the finding, and report to the art director.
- [ ] **T2.10 — Gate E2, the asset contract**: inspect the exported `.glb` and record, in
      `## Implementation Notes`: the node names, the bounding box on the three axes, the position of the
      origin, the scale, the rest rotation, the triangle count, the material types, and the animation
      clip names. Compare each against the root `AGENTS.md`, "3D conventions". **Do not fix anything in
      this ticket.** The table states the cleanup cost, and a later ticket pays it.
- [ ] **T2.11 — Gates**: `bun test` and `bun run check` are green.

## Acceptance Criteria

1. `bun test` passes, and no test opens a socket outside `127.0.0.1`, downloads a model, or needs a
   GPU.
2. One real run writes `qwen3d-coder-glb--01.html` and `qwen3d-coder-glb--01.glb` in the subject's
   `generated/` folder. The `.glb` starts with the four bytes `glTF` and passes
   `bunx @gltf-transform/cli inspect`.
3. A second run writes `--02`. The `--01` files are unchanged, byte for byte.
4. A page without an `Export GLB` button exits `4`, keeps its `.html`, and writes no `.glb`.
5. `bun run scripts/llama-server/serve.ts --profile glb-coder` serves on `9932` while the `3d-coder`
   profile serves on `9931`, and neither stops the other.
6. The report states the wall-clock seconds and the decode rate for the real run.
7. Gate E1 has a written verdict and the two assets it compared.
8. Gate E2 has the full table of section T2.10. It reports deviations; it does not repair them.
9. `git status` shows changes only inside the scope of this ticket.

## Implementation Notes

Filled when work starts and completes.
