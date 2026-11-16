# T0011 — A fourth workflow: Qwen 3D Coder, an external endpoint, and the scene drafter

- **Track**: repository layout (new workflow), then the Qwen 3D Coder workflow
- **Wave**: 1 (independent)
- **Depends on**: nothing
- **Blocks**: T0012
- **Owner**: coding sub-agent, supervised by CTO
- **Started**: 2026-11-16
- **References**:
    - Model card, `ccore/Qwen3.5-4B-3D-Coder`: https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder
    - Training dataset, `ccore/ThreeJS-3D-Scenes`: https://huggingface.co/datasets/ccore/ThreeJS-3D-Scenes
    - llama.cpp server flags and API, `tools/server/README.md`: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
    - llama.cpp multimodal projector, `tools/mtmd/README.md`: https://github.com/ggml-org/llama.cpp/blob/master/tools/mtmd/README.md
    - The OpenAI-compatible endpoint, which the operator provides: `GET /v1/models` and
      `POST /v1/chat/completions`
    - OpenCode provider configuration: https://opencode.ai/docs/providers/
    - Bun test runner: https://bun.com/docs/cli/test
    - [`AGENTS.md`](../../AGENTS.md) "Placement rules", [`README.md`](../../README.md) "The repository"

## Context & Goal

The repository holds three modelling workflows: Three.js (active), Blender (inactive), and vcad
(archived). Each one owns a folder, its own documents, and its own tools. A reader works in one.

Qwen 3D Coder is a **fourth tool**, and it earns a fourth folder:

- It starts at the same point as Blender and Three.js: the subject has reference images, and the
  asset does not exist yet.
- It has its own tool, its own model, its own runtime, and its own failure modes.
- It owns nothing that Three.js owns, and Three.js owns nothing that it needs.

**Done means:** the workflow exists as `workflows/qwen3d-coder/`, with its `AGENTS.md` and its
`README.md`. An **OpenAI-compatible endpoint outside the repository** serves the model. One command
turns a subject reference image and a short note into a candidate `.html` file. The art director
opens it and chooses. The tests are hermetic. The machine numbers are recorded.

**This workflow produces unmeasured, stylized candidates judged by eye.** It has **no gate**, it does
not run G1, G2, or G3, and it does not replace workflow D.

## Revision 2 — the runtime is external

**D10 — the repository ships no inference server.** It does not start, install, or configure one. The
workflow requires an OpenAI-compatible base URL, and that URL is an **input** of the drafter, exactly
as the real dimensions are an input of a modelled asset.

The reason is operational. An inference runtime is a **service**: installed, upgraded, and supervised
by the machine's administrator, listening on a fixed port, with its own model registry and its own
lifecycle. A script in the repository would:

- duplicate a declaration the service already owns, and pass the same `-m` and `--mmproj` arguments
  in a second place, where they drift (the phase-1 scripts passed their own alias, `local/3d-coder`,
  on the same port that the service listens on);
- race the service for the port, and lose or win arbitrarily;
- ship an installer — `curl ... | sh` — in a repository that models assets, which is not the job of a
  modelling workflow;
- be unreadable for the reader of another machine, who runs Ollama, vLLM, or a remote gateway.

The **only** contract the workflow can hold is the OpenAI Chat Completions API. Everything below it
is the operator's problem, and the workflow `README.md` documents what that operator must provide.

**What revision 2 removes** — files committed in `f544140` and deleted here:

```text
scripts/llama-server/profiles.ts  install.ts  serve.ts  README.md  *.test.ts
```

**D11 — the model id comes from the endpoint, not from us.** `/v1/models` names the model, and the
CLI sends that exact `id`. The endpoint publishes `qwen3.5-4b-3d-coder`; the phase-1 alias
`local/3d-coder` was ours, it existed only in our own `--alias` flag, and it is gone.

**D12 — the request disables the thinking phase.** Measured on 2026-11-16 against the 4B model: without
the toggle the answer arrives in `reasoning_content` and `content` can stay empty
(`finish_reason: "length"` at `max_tokens: 16`); with
`chat_template_kwargs: {"enable_thinking": false}` the same request returns `content: "OK"` in
2 tokens. The extractor reads `content`, so the toggle is **mandatory**, not a preference. The server
README documents the field verbatim: "`chat_template_kwargs`: Allows sending additional parameters to
the json templating system. For example: `{"enable_thinking": false}`"
(https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md, section
"POST `/v1/chat/completions`", consulted 2026-11-16).

**D13 — the endpoint must offer at least 32 768 tokens of context.** The client cannot raise the
window: it is a server flag. The system prompt, the image tokens, and a full scene do not fit in
4 096. This is a documented prerequisite, not a code path: `README.md` states the number, and the
operator sets it where the endpoint is declared. A run against a smaller window truncates the answer
and ends in exit code `4`.

## Scope Boundary

### A new workflow folder

```text
workflows/qwen3d-coder/
├── AGENTS.md              the rules of this workflow. Short, like the others
├── README.md              the tutorial: install, launch, draft, review
├── prompts/
│   └── 3d-coder-system.txt    the system prompt, verbatim from the model card
└── tools/
    ├── scene-draft.ts     the entry point and the CLI
    ├── lib/endpoint.ts    the /v1/models preflight: is the endpoint up, does it name the model
    ├── lib/prompt.ts      the user prompt, a pure function of its inputs
    ├── lib/client.ts      the /v1/chat/completions call, streamed
    ├── lib/extract.ts     the HTML document out of the raw response
    ├── lib/candidates.ts  the counter, the write, the never-delete rule
    └── lib/*.test.ts      the hermetic tests
```

### Removed

`scripts/llama-server/` — all seven files, with `git rm`. The directory disappears. Nothing else in
the repository reads it. The `scripts/` folder keeps `blueprint`, `blueprint-generate`, and
`measure`.

### Modified, append only

- `AGENTS.md` (root) — the workflow table gains one row; "Three workflows" becomes "Four workflows".
- `README.md` (root) — one workflow-table row, the pipeline sentence, the repository tree, and the
  glossary.
- `.opencode/agents/bender.md` — one row in the tool-selection table, and one section, "Workflow E".
- `opencode.jsonc` — one `providers.local` entry, and the comment that names the service.
- `tickets/README.md` — the board.

A **deleted** path is also in scope: `scripts/llama-server/` and its seven files.

### Out of scope

Do not touch `workflows/threejs/**`, `workflows/blender/**`, `workflows/vcad/**`, `scripts/blueprint-generate/**`,
`scripts/measure/**`, `blueprints/**` (the script writes there at runtime, never at commit time).

**No `.gitignore` change.** No model weight enters the repository: the weights belong to the endpoint,
wherever its operator keeps them, and `blueprints/*/*/*` already ignores the candidate folder.

**No system configuration.** The service declaration, its unit, and its model registry live outside
this repository and outside this ticket. The workflow documents what they must provide; it never
edits them.

## Contract

### 1. The workflow's place in the repository

The root `README.md` states "The project holds **three** modelling workflows". That sentence and its
table become four rows. The new row:

| Workflow          | Folder                    | State        | Used for                                                                       |
| :---------------- | :------------------------ | :----------- | :----------------------------------------------------------------------------- |
| **Qwen 3D Coder** | `workflows/qwen3d-coder/` | experimental | A first draft of a stylized scene, from a reference image, with no measurement |

**D1 — a new state word, `experimental`.** The existing states are `active`, `inactive`, and
`archived`. None of them is true here: the workflow runs, but it produces no gated asset and it may
be closed if the measurements disappoint. `experimental` is a new project word, so it gets a glossary
entry, in alphabetical order, as the root `AGENTS.md` requires.

**D2 — the folder name is `qwen3d-coder`, not `qwen3Dcoder`.** Every directory in this repository is
lowercase kebab case: `threejs`, `blender`, `vcad`, `blueprint-generate`, `r5-tl-1972`. A capital
letter inside a folder name breaks that pattern and breaks tab completion on a case-sensitive file
system. The display name in prose stays "Qwen 3D Coder".

The root `AGENTS.md` workflow table gains the matching row:

```markdown
| Qwen 3D Coder, experimental | [`workflows/qwen3d-coder/AGENTS.md`](./workflows/qwen3d-coder/AGENTS.md) |
```

The README's pipeline sentence, "All three workflows share the same two first stages", becomes "All
four workflows share the same two first stages". This workflow enters there: it reads
`reference.<ext>` and nothing earlier.

### 2. The endpoint: an input, never a deliverable

The drafter reads two runtime facts from its command line, and nothing else:

| Flag         | Meaning                                                   | Default                    |
| :----------- | :-------------------------------------------------------- | :------------------------- |
| `--base-url` | The root of the OpenAI-compatible API, without the route  | `http://127.0.0.1:9931/v1` |
| `--model`    | The `id` this endpoint publishes for the 3D Coder weights | `qwen3.5-4b-3d-coder`      |

The default URL is loopback on the port that `llama-server` documents as its own default: "port to
listen (default: 9931)". It is a convenience, not a dependency of the workflow: any endpoint that
speaks `GET /v1/models` and `POST /v1/chat/completions` works, and the flags are how a reader points
at another one.

No module of this workflow spawns a process, writes a config file, installs anything, or reads a
model path. No `-m`, no `--mmproj`, no cache directory, no port arithmetic. The word `gguf` does not
appear in the code.

### 3. The preflight

Before the first request the drafter runs `GET <base-url>/models`. The response is the documented
OpenAI list: "The returned list always has one single element" for a bare `llama-server`, one entry
per configured model for a router or a multi-model service, and each entry carries the `id` (section
"GET `/v1/models`", https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

| Observation                                     | Exit | Message                                                               |
| :---------------------------------------------- | :--- | :-------------------------------------------------------------------- |
| the connection fails, or the status is not 2xx  | `2`  | the URL, the network error, and one line: which prerequisite to check |
| the body is not a JSON object with `data[]`     | `2`  | the URL, and the first 200 characters received                        |
| `data[]` holds no entry whose `id` is `--model` | `2`  | the requested id **and** the ids that are available, comma-separated  |

The check is the same for the real run and for `--ask`, because a reader who runs `--ask` must learn
that the endpoint is down before writing a request. `--ask` still sends no completion.

A 2xx with an empty `data[]` is an endpoint that is up but serves nothing: exit `2`, with
"the endpoint names no model". Never send a completion to an id that the endpoint did not list.

### 4. The request body's model field and the thinking toggle

The body of section 5 carries two fields that the endpoint, not the model card, dictates:

```json
{
	"model": "<--model>",
	"chat_template_kwargs": { "enable_thinking": false }
}
```

**D11** — `model` is the exact `id` read at section 3, never a rewritten alias, never `local/...`.
The server README states it: "By default, model `id` field is the path to model file, specified via
`-m`. You can set a custom value for model `id` field via `--alias` argument."

**D12** — `chat_template_kwargs.enable_thinking` is `false`, and the value is quoted from the server
README. A test asserts the exact object. Removing the field is a regression that turns every
successful completion into an empty `content` and exit code `4`.

`reasoning_format` is not sent. The server default (`auto`) already routes a thinking template into
`reasoning_content`; the toggle above stops the thinking from being generated at all. Sending both
would layer two mechanisms on one behaviour.

### 5. The inference request

`POST <base-url>/chat/completions`, streamed. From the server README: "POST
`/v1/chat/completions`: OpenAI-compatible Chat Completions API". The body is exactly:

```json
{
	"model": "<--model>",
	"messages": [
		{ "role": "system", "content": "<prompts/3d-coder-system.txt, byte for byte>" },
		{ "role": "user", "content": "<lib/prompt.ts>" }
	],
	"temperature": 0.6,
	"top_p": 0.95,
	"top_k": 20,
	"repeat_penalty": 1.0,
	"max_tokens": 16384,
	"stream": true,
	"chat_template_kwargs": { "enable_thinking": false }
}
```

The sampling values come from the model card, "Generation settings": temperature 0.6–0.8, top-p
0.90–0.95, top-k 20–40, repeat penalty 1.0. The card's FP16 defaults are temperature 0.6, top-k 20,
top-p 0.95, repetition penalty 1.0. The script takes the low end of every range, which is the
deterministic end.

**D5 — `max_tokens` is a guard, not a model figure.** The card sets no output limit for this model.
The script caps at 16384 so that a runaway generation stops, and exposes `--max-tokens`.

**D6 — a streamed call is required.** Every `data: ` frame carries `choices[0].delta.content`; the
frame `data: [DONE]` ends the stream. A non-streamed call to a 4B model can run for
minutes and dies on an idle timeout.

### 6. Every sampling parameter, one by one

The model is **not an agent**. It holds no tool, no loop, and no memory. It is a completion model
that the script calls once per variant. Every field below is a field of that one call. A reader who
changes a number must be able to predict what changes. The flags that shape the run belong to the
endpoint's operator; they are listed at the end of this section as **requirements**, not as values
this workflow sets.

The meanings are quoted from the llama.cpp server README. The flag table and the
`/v1/chat/completions` parameter table are the two authorities:
https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md

| Parameter                               | Documented meaning                                                                                           | Value here                                   | Why this value                                                                                                                                                                                                                                                                                               |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `temperature`                           | "temperature (default: 0.80)", "Adjust the randomness of the generated text"                                 | **0.6**                                      | The card gives 0.6–0.8. The low end makes the HTML, the variable names, and the structure repeatable. The high end invents more and breaks more. A scene is code, not prose.                                                                                                                                 |
| `top_p`                                 | "top-p sampling (default: 0.95, 1.0 = disabled)"                                                             | **0.95**                                     | Nucleus sampling: it keeps the smallest set of tokens whose probability sums to `p`, and discards the tail. The card gives 0.90–0.95, and it defaults this field to 0.95. At `1.0` the cut is disabled and the whole vocabulary stays reachable.                                                             |
| `top_k`                                 | "top-k sampling (default: 40, 0 = disabled)", "Limit the next token selection to the K most probable tokens" | **20**                                       | The card gives 20–40. The floor, for the same reason as the temperature: less drift, fewer duplicated variable names. `0` would disable it.                                                                                                                                                                  |
| `min_p`                                 | "min-p sampling (default: 0.05, 0.0 = disabled)"                                                             | **not sent**                                 | The card sets no value for this model. An unrequested field is a change the card did not ask for, so the server default of **0.05** applies. The effective value is recorded here so that nobody reads "absent" as "disabled". T0012 sends `0.0` explicitly, because **its** card does.                      |
| `repeat_penalty`                        | "penalize repeat sequence of tokens (default: 1.00, 1.0 = disabled)"                                         | **1.0**                                      | The card states 1.0, and **1.0 means disabled**. The model was trained without a repetition penalty. The card records the consequence: "The bugs observed so far have generally involved duplicate variable names". Do not raise this number to fix a duplicate name: a second variant is the tool for that. |
| `typical_p`                             | "locally typical sampling, parameter p (default: 1.00, 1.0 = disabled)"                                      | **not sent**, so `1.0`                       | Disabled at its documented default. The card says nothing about it.                                                                                                                                                                                                                                          |
| `xtc_probability`, `xtc_threshold`      | "xtc probability (default: 0.00, 0.0 = disabled)", "xtc threshold (default: 0.10, 1.0 = disabled)"           | **not sent**, so `0.0` and `0.10`            | XTC removes tokens that the model expects. It is a creative-diversity tool, and it is off by default.                                                                                                                                                                                                        |
| `dynatemp_range`                        | "dynamic temperature range"                                                                                  | **not sent**, so `0.0`                       | A temperature that drifts during the run is the opposite of a repeatable artifact.                                                                                                                                                                                                                           |
| `presence_penalty`, `frequency_penalty` | "repeat alpha presence penalty (default: 0.00, 0.0 = disabled)"                                              | **not sent**, so `0.0`                       | Both are off. They are an alternative to `repeat_penalty`, and the card sets neither.                                                                                                                                                                                                                        |
| `max_tokens`                            | The OpenAI-compatible name of `n_predict`; the slot parameters report `n_predict: -1`                        | **16384**                                    | Decision D5. `--max-tokens` changes it, and `-1` removes it.                                                                                                                                                                                                                                                 |
| `seed`                                  | "RNG seed (default: -1, use random seed for -1)"                                                             | **not sent**, so `-1`, so random per variant | Three variants must differ. `--seed N` adds the field, which makes one run reproducible for a test or a bug report.                                                                                                                                                                                          |
| `stream`                                | "Both synchronous and streaming mode are supported"                                                          | **`true`**                                   | Decision D6.                                                                                                                                                                                                                                                                                                 |

**The sampler order matters, and the server documents it.** `--samplers` defaults to
`penalties;dry;top_n_sigma;top_k;typ_p;top_p;min_p;xtc;temperature`. The list is applied left to
right, so the token cut happens **before** the temperature scales the distribution. A temperature of
0.6 acts on a distribution that `top_k` and `top_p` have already trimmed. This ticket does not change
the order.

**One documented inconsistency, recorded.** The flag table gives `--repeat-penalty` a default of
`1.00`, and the `/v1/chat/completions` table describes `repeat_penalty` with "Default: `1.1`". The
two documents disagree. It has no effect here, because the script always sends the value explicitly.
A later reader who removes the field inherits the ambiguity.

Endpoint requirements, which shape the run and not the text. This workflow **checks none of them**;
`workflows/qwen3d-coder/README.md` states them as the operator's contract:

| Requirement              | Value                                | Why                                                                                                                                            |
| :----------------------- | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `-c, --ctx-size N`       | **≥ 32768, 65536 preferred**         | The system prompt, the image tokens, and a scene share one window. At 4 096 the scene is truncated mid-file and the run ends in exit code `4`. |
| `-np, --parallel N`      | **1**                                | One variant at a time. The machine is memory-bound: two slots would halve the rate of both and double the resident memory.                     |
| `-ngl, --n-gpu-layers N` | **`all`** when the backend has a GPU | The card uses `all`. On an integrated GPU that shares system memory, the value changes placement, not the bandwidth ceiling.                   |
| `-fa, --flash-attn`      | **`on`**                             | The card's invocation.                                                                                                                         |

The operator sets these where the endpoint is declared. This workflow only states the requirement; it
reads none of them, and it cannot verify any of them.

### 7. The system prompt

`prompts/3d-coder-system.txt` holds the model card's system prompt, byte for byte:

```text
Use only the Three.js core ES module from
https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js.
Do not import addons or legacy examples/js paths;
implement any camera controls directly inside the HTML.
```

### 8. The user prompt

`buildUserPrompt(input)` is a pure function of the same four blocks as the viewer's scene contract,
with one difference: it names the request, not a file.

1. `Subject: <the first paragraph under "## Subject" in notes.md, or the --prompt value>`
2. `Style: <--style>`
3. `Details that must survive: <the subject details paragraph, when present>`
4. `Create one self-contained HTML file with Three.js from cdnjs that shows <the request>.`

Block 3 is optional; the other three are not. An empty input throws, and the script never sends an
empty prompt. The test asserts the exact output against a fixture, so a silent drift in the wording
fails the build.

### 9. The candidate file

```text
blueprints/<category>/<subject>/generated/qwen3d-coder-scene--<NN>.html
```

- The counter is per folder. `--01` is the first free number; `--04` follows `--03`. A number is
  never reused after a deletion.
- `O_EXCL` on create. An existing file is never overwritten.
- The script never deletes and never renames a candidate. `--variants 3` writes three.
- Generation reads `reference.<ext>` only. It never reads `source.<ext>`.
- The image, when `--image` is passed, is sent as an `image_url` content part with a
  `data:image/<type>;base64,` URL, the documented OpenAI-compatible form.

**D7 — the candidates stay beside the subject, not in the workflow folder.** The root `AGENTS.md`
already places a generated candidate beside the subject it belongs to, and the art director reviews
it there. It also already states that a candidate is never deleted. A candidate in
`workflows/qwen3d-coder/` would sit away from the reference it has to be compared against.

### 10. The extracted document

The model emits its reasoning, then the HTML. `extractHtml(raw)` is pure and total:

- It returns the substring from the first `<!DOCTYPE html` or `<html` to the last `</html>`,
  inclusive.
- It strips a leading ` ```html ` fence and a trailing ` ``` ` when both wrap the
  document.
- It throws `NoHtmlError` when the response holds no `<html` or no `</html>`, because an incomplete
  run must not be written as a candidate.

Fixtures cover: reasoning only, a plain document, a fenced document, a document with trailing prose,
and a truncated document.

### 11. The CLI

```bash
bun run workflows/qwen3d-coder/tools/scene-draft.ts --subject blueprints/<category>/<subject> \
  --style "<style>" --variants 2 [--image] [--prompt "<request>"] \
  [--base-url http://127.0.0.1:9931/v1] [--model qwen3.5-4b-3d-coder] \
  [--max-tokens 16384] [--timeout 1800] [--seed N]
```

- `--ask` sends nothing but the preflight. It lists the gaps: a missing `reference.<ext>`, a missing
  subject note, a missing style. It is the free check, as in `scripts/blueprint-generate`.
- Exit codes: `0` written, `1` invalid input, `2` the endpoint is unreachable or does not name the
  model, `3` a request failed, `4` the response held no complete document, `5` the candidate could not
  be written.
- The script reports, per variant: the file path, the wall-clock seconds, the output tokens, and the
  decode rate. A failed variant does not stop the next one.
- The first line of output names the endpoint and the model it resolved, so a run is attributable to
  one service: `endpoint: http://127.0.0.1:9931/v1  model: qwen3.5-4b-3d-coder`.

The script imports no module outside `workflows/qwen3d-coder/`. It spawns no process and installs
nothing.

### 12. The provider entry

`opencode.jsonc` gains one entry, so the model is visible in `/models` for a manual chat. From the
OpenCode provider documentation:

```jsonc
"providers": {
  "local": {
    "name": "Local OpenAI-compatible endpoint",
    "package": "@opencode/ai/providers/openai-compatible",
    "settings": { "baseURL": "http://127.0.0.1:9931/v1" },
    "models": { "qwen3.5-4b-3d-coder": { "name": "Qwen 3.5 4B 3D Coder" } }
  }
}
```

The `models` map key is the OpenCode model ID **and** the `id` the endpoint publishes; the full
reference is `local/qwen3.5-4b-3d-coder`. **D8:** no `capabilities` key is written unless the OpenCode
model documentation states the exact key name. The entry exists for a manual chat only. Bender calls
the script, never this provider. The comment above the entry names the prerequisite service, so a
reader does not look for a launcher in this repository.

### 13. The workflow's `AGENTS.md`

Short, like the two other workflow rule files. It must state, at least:

- The model is not an agent. One call per variant, no tool, no loop.
- **This workflow has no gate.** No number, no overlay, no render decides. The art director decides.
- Candidates are never deleted, never renamed, never overwritten.
- The script never edits the model's JavaScript. A broken candidate stays as evidence.
- Generation reads `reference.<ext>` only.
- The drafters live in `tools/`. **This workflow starts no server and installs nothing**: the model
  is served by an OpenAI-compatible endpoint that the operator provides, and the endpoint is named by
  `--base-url` and `--model`.
- The endpoint is a prerequisite, not a deliverable. A run against an unreachable endpoint fails with
  exit code `2`; the fix is the operator's, never a script in this repository.
- The cost is the machine's. The decode rate is measured, never assumed.

## TDD Tasks

- [x] ~~**T1.1 — The registry and its reader**~~ — **removed in revision 2** with
      `scripts/llama-server/profiles.ts`.
- [x] ~~**T1.2 — The install check**~~ — **removed in revision 2** with
      `scripts/llama-server/install.ts`.
- [x] ~~**T1.3 — The server lifecycle**~~ — **removed in revision 2** with
      `scripts/llama-server/serve.ts`.
- [x] **T1.4 — The system prompt and the user prompt**: failing tests. Assert
      `prompts/3d-coder-system.txt` byte for byte against the model card. Assert the four-block output of
      `buildUserPrompt` against a fixture, and assert that an empty input throws. Then implement
      `lib/prompt.ts`.
- [x] **T1.5 — The extraction**: failing tests for the five fixtures of section 10, including the
      truncated document that must throw `NoHtmlError`. Then implement `lib/extract.ts`.
- [x] **T1.6 — The candidate counter**: failing tests in a temporary directory. Assert `--01`, then
      `--02`, then `--03`. Assert that an existing file is never overwritten. Assert that no code path
      deletes a file. Then implement `lib/candidates.ts`.
- [x] **T1.7 — The request body**: a failing test that captures the JSON sent to an in-process
      `Bun.serve` on port `0`, and asserts every field of section 5, including the sampling values,
      `stream: true`, `model`, and `chat_template_kwargs: { "enable_thinking": false }`. The same test
      asserts the **absent** keys of section 6: `min_p`, `typical_p`,
      `xtc_probability`, `xtc_threshold`, `dynatemp_range`, `presence_penalty`, `frequency_penalty`, and
      `seed` must not appear. A second test asserts that `--seed 42` adds `"seed": 42` and changes
      nothing else. Then implement `lib/client.ts`.
- [x] **T1.8 — The stream**: failing tests that feed recorded SSE fixtures through the client. Assert
      that the deltas concatenate in order, that `data: [DONE]` ends the read, that a broken frame is
      skipped, and that `--timeout` aborts the read with exit code `3`.
- [x] **T1.9 — Implementation and wiring**: `tools/scene-draft.ts`, the flags, the exit codes, the
      per-variant report.
- [x] ~~**T1.10 — The fourth workflow**~~ — done in phase 1; rewritten by **T1.16** for the endpoint.
- [x] **T1.11 — The documents**: the append-only hunks of section "Scope Boundary". The root
      `README.md` gains its row, its sentence, its tree line, and its glossary entries for **Qwen 3D
      Coder** and for **experimental**. `bender.md` gains one row in the tool-selection table and
      workflow E: read the reference, run `--ask`, ask the art director in one call, run the script, hand
      back the candidate paths with one line of description each, and wait for the choice. Never choose,
      never promote.
- [x] **T1.12 — Gates**: `bun test` is green across the repository. Run `bun run check` once and
      record its result, but do not touch `workflows/threejs/`: that command needs a live browser
      capture, and it already failed with `capture failed (1)` before this ticket.

Revision 2 tasks, after the checkpoint `f544140`:

- [x] **T1.14 — The preflight**: failing tests for `lib/endpoint.ts` with an injected `fetch`. Assert
      the four rows of section 3: a refused connection exits `2` with the URL; a non-2xx exits `2`; a
      body without `data[]` exits `2`; a list without the requested id exits `2` and prints the ids it
      holds. Assert that a list that holds the id resolves to that exact string, and that the request
      never addressed another route. Then implement the module.
- [x] **T1.15 — The removal**: `git rm -r scripts/llama-server`. Remove the imports of `profiles.ts`
      and `serve.ts` from `tools/scene-draft.ts` and from `tools/scene-draft.test.ts`; replace
      `--port` and `--profile` with `--base-url` and `--model`; delete the `ensure` dependency from
      `SceneDraftDeps`; delete every test that starts, reuses, or conflicts a server. Add the failing
      tests first: `--base-url` is required to end with no trailing slash, an invalid URL exits `1`,
      and the reported endpoint line names both values.
- [x] **T1.16 — The documents of revision 2**: `workflows/qwen3d-coder/README.md` gains a
      **Prerequisites** section that names the OpenAI-compatible endpoint, the two flags, the
      `GET /v1/models` check, and the 32 768-token minimum — with no launch command, no installer, and
      no machine-specific path, unit name, or registry file. `AGENTS.md` gains the two rules of
      section 13. `opencode.jsonc` carries the corrected model id and a comment that states the
      endpoint is external. The root `README.md` and root `AGENTS.md` keep four workflows and lose
      every "local llama.cpp server" wording.
- [x] **T1.17 — Gates, second pass**: `bun test` green; `bun run check` recorded unchanged; one
      copyediting pass for stale words (`llama-server`, `llama serve`, `install.sh`, `-hf`,
      `local/3d-coder`, `--profile`, `--port`) in every file this ticket touched.
- [ ] **T1.13 — The measurement — deferred**: one real run on a subject with a locked
      `reference.<ext>`, one candidate. Record in `## Implementation Notes`: the token rate, the
      wall-clock seconds, the output tokens, the resident memory of the server process, and the
      first-shot quality as one line of description. **Not done in T0011.** The first real run had no
      blueprint subject, and its figures are recorded under "The first successful run". The
      acceptance run needs a subject with a locked reference, and the art director moved the ticket
      to review without it on 2026-11-16.

## Acceptance Criteria

1. `workflows/qwen3d-coder/` exists with `AGENTS.md`, `README.md`, `prompts/`, and `tools/`, and a
   reader can find the endpoint, check it, and draft from `README.md` alone.
2. `scripts/llama-server/` **does not exist**, and no file of the repository spawns, installs, or
   configures an inference server.
3. `bun test` passes, and no test opens a socket to anything but `127.0.0.1`, downloads a model, or
   takes more than five seconds.
4. `bun run workflows/qwen3d-coder/tools/scene-draft.ts --subject <dir> --ask` exits `0` when the
   endpoint is up, and `2` with the URL when it is not. A run against the service names the endpoint
   and the model on its first line.
5. One real run writes
   `blueprints/vehicules/r5-tl-1972/generated/qwen3d-coder-scene--01.html`. A second run writes
   `--02`. The first file is unchanged, byte for byte.
6. The candidate opens on its own, and the page draws a scene with `bun` serving the folder.
7. The script reports a decode rate, and the number is in `## Implementation Notes`.
8. `git status` shows changes only inside the scope of this ticket.
9. `opencode.jsonc` still parses, and `local/qwen3.5-4b-3d-coder` appears in `/models` once the
   service runs.
10. The root `README.md` and `AGENTS.md` both name four workflows and state that the runtime is an
    external endpoint.

## Implementation Notes

Implemented by the coding sub-agent on 2026-11-16. T1.1 to T1.12 are complete. T1.13, the real
measurement run, is left to the CTO.

### Files created

`scripts/llama-server/` — **all seven files removed in revision 2**; the list stays as the record of
the checkpoint `f544140`:

- `profiles.ts` — the runtime registry, the name reader, and exit code 1.
- `install.ts` — the `--check` probe and the `--yes` install, both injected.
- `serve.ts` — the health probe, the reuse rule, the alias conflict, the 120 s poll, and the child
  stop.
- `README.md` — the commands, the lifecycle, the cache, and the memory.
- `profiles.test.ts`, `install.test.ts`, `serve.test.ts`.

`workflows/qwen3d-coder/`:

- `AGENTS.md` — every rule of section 13.
- `README.md` — the install, the two commands, the flags, the exit codes, the cost, the cache, the
  memory, and the request table with the effective values.
- `prompts/3d-coder-system.txt` — the model card text, byte for byte, with a final newline.
- `tools/scene-draft.ts` — the CLI, the `--ask` check, the exit codes, and the per-variant report.
- `tools/lib/prompt.ts`, `client.ts`, `extract.ts`, `candidates.ts`.
- `tools/lib/prompt.test.ts`, `extract.test.ts`, `candidates.test.ts`, `client.test.ts`,
  `tools/scene-draft.test.ts`.

### Modified, append only

- `AGENTS.md` — one workflow-table row, and "Three" becomes "Four".
- `README.md` — the fourth row, the pipeline sentence, the tree, and the glossary entries
  **Experimental** and **Qwen 3D Coder**. The **Workflow** entry now holds four.
- `.opencode/agents/bender.md` — tool-selection item 6, and "Workflow E".
- `opencode.jsonc` — the `providers.local` entry, with no `capabilities` key (D8). The file
  parses with `Bun.JSONC.parse`.
- `tickets/README.md` was already changed by the CTO to move T0011 to `in_progress/`. This work
  did not touch it.

No `.gitignore` change. No model weight enters the repository.

### Tests

`bun test` — 136 pass, 0 fail, 305 `expect()` calls, 13 files, about 93 ms. The 83 new tests:

| File                                                  | Tests |
| :---------------------------------------------------- | ----: |
| `scripts/llama-server/profiles.test.ts`               |     6 |
| `scripts/llama-server/install.test.ts`                |     9 |
| `scripts/llama-server/serve.test.ts`                  |    13 |
| `workflows/qwen3d-coder/tools/lib/prompt.test.ts`     |     8 |
| `workflows/qwen3d-coder/tools/lib/extract.test.ts`    |     7 |
| `workflows/qwen3d-coder/tools/lib/candidates.test.ts` |    11 |
| `workflows/qwen3d-coder/tools/lib/client.test.ts`     |    15 |
| `workflows/qwen3d-coder/tools/scene-draft.test.ts`    |    14 |

All tests are hermetic. The only socket is an in-process `Bun.serve` on `127.0.0.1`, port 0, for
the body capture of T1.7. No test starts `llama serve`, downloads a model, or writes outside a
temporary folder. The slowest file is under 200 ms.

### Gate results

1. `bun test`

```text
 136 pass
 0 fail
 305 expect() calls
Ran 136 tests across 13 files. [93.00ms]
```

2. `bun run check` — run once, unchanged:

```text
error: capture failed (1)
  at run (.../workflows/threejs/tools/check.ts:152:17)
error: script "check" exited with code 1
```

The cause is `agent-browser open failed (1): net::ERR_CONNECTION_REFUSED`. It is the pre-existing
failure that needs a live browser capture. `workflows/threejs/` is untouched.

3. The phase-1 install check no longer applies: revision 2 deletes the script, and the endpoint is
   the operator's responsibility.

4. `bun run workflows/qwen3d-coder/tools/scene-draft.ts --subject blueprints/vehicules/r5-tl-1972 --ask`
   — exit 0, two gaps: the subject note and the style. It sent nothing.

5. `git status --short` shows only the allowed paths: the two new folders, the four documents, and
   the ticket.

There is no separate type-check or lint command in this repository. The gates are `bun test` and
`bun run check`.

### Decisions and deviations

- **Phase-1 runtime decisions, superseded.** D9 (one unified `llama` launcher), the child `PATH`
  handling, and the alias detection all described the code that revision 2 deletes:
  `scripts/llama-server/`. The decisions go with the code. The history stays in commit `f544140`.
- **Output tokens and rate.** The body of section 5 is sent exactly, so `stream_options` is not
  added. The client takes `timings.predicted_n` and `timings.predicted_per_second` from the last
  frame that carries them. Without `timings`, it counts the non-empty `delta.content` frames and
  divides by the wall-clock seconds. T1.13 should quote the server figure when the stream carries it.
- **Counter.** `nextNumber` is the maximum present plus one, not the first hole, so `--04` follows
  `--03`. The module has no delete, no rename, and no truncate path, and the test asserts it. A
  manual deletion of the highest file would free its number again: the tool itself never creates the
  hole.
- **Image part.** The text part comes first, then `image_url` with the
  `data:<mime>;base64,<bytes>` URL. The reference is read only when `--image` is passed, but it is
  always required as the subject input.
- **Timeout.** `--timeout` is per request, in seconds, default 1800. The read is bounded by a
  deadline, so a stream that never closes aborts with exit code 3.
- **Failure code of a run.** A run exits 0 when at least one candidate is written. When every variant
  fails, it exits with the first failure: 4 for an incomplete document, 3 for a request failure.
- **A formatter detail.** The OpenCode `bun fmt` hook reformatted tables in edited Markdown. The
  shared documents were restored and the hunks re-applied verbatim, so the diff of the shared files
  is append only.

### Polish round

The independent reviewer returned `POLISH_REQUIRED` with 13 findings. All 13 are applied inside this
ticket's scope. No finding was rejected.

1. **Runnable draft example.** The `--subject --style --variants` example in
   `workflows/qwen3d-coder/README.md` now passes `--prompt`, and one sentence states that a subject
   without `## Subject` in `notes.md` needs `--prompt`.
2. **No number reuse.** `tools/lib/candidates.ts` keeps `.qwen3d-coder-scene.counter` in the candidate
   folder. The next number is `max(counter, maximum present) + 1`, the counter is written after a
   successful write, and an unreadable or invalid counter falls back to the folder maximum. A test
   writes `--01`, `--02`, `--03`, deletes `--03`, and asserts that the next write is `--04`. The
   workflow `AGENTS.md` and `README.md` name the counter file and the no-reuse rule.
3. **Root `README.md`.** The sentence is again `The other three describe the paths beside it.`
4. **Crash instead of hang.** `serve.ts` exposes `ServerHandle.exited` and `ServerCrashedError`.
   `ensureServer` stops the readiness poll as soon as the child exits and throws with the exit code,
   pid, and port. `serveMain` races the stop signal against the child exit and returns `2` with a
   message that names the exit code. The tests inject the exit promise, so no process starts.
5. **Accepted details headings.** `parseNotes` reads `## Specific subject details`, then
   `## Identity features that must not change`. The workflow `README.md` lists both, `## Subject`
   stays mandatory, and the details heading stays optional. Two tests cover the second heading and
   the order of preference.
6. **Exit code `5`.** A candidate that cannot be written now exits `5`, separately from a request
   failure (`3`) and an incomplete document (`4`). The write is injected through `SceneDraftDeps`, so
   only a write error maps to `5`. The code, this ticket's section 11, and the workflow `README.md`
   exit-code table all carry `5`.
7. **`--profile`.** The workflow `README.md` flag table documents it, with `3d-coder` as the default.
   The workflow `AGENTS.md` does not list flags, so it gains no entry.
8. **Dead code.** The empty `afterEach` is gone from `client.test.ts`, the redundant
   `timings as Timings | null` cast is gone from `client.ts`, and `serveCommand` no longer takes the
   unused `bin` parameter.
9. **Honest token count.** `client.ts` documents that without server `timings` the reported count is
   the number of non-empty delta frames, not tokens. The workflow `README.md` request section says so
   too. The request body is unchanged.
10. **What the script reads.** The workflow `README.md` now says that the script reads `notes.md` and
    `reference.<ext>`, and never `source.<ext>`.
11. **Estimates until T1.13.** The decode rate and the seven-minute cost are marked as estimates in
    the workflow `README.md` and in `.opencode/agents/bender.md`, and both name `T1.13` as the ticket
    that replaces them with the measured value. No number was invented.
12. **Alias source.** `scripts/llama-server/README.md` states that `/v1/health` carries no alias, and
    that the alias is read from `GET /v1/models` after `GET /v1/health` returns 200. The lifecycle
    rules stay, with one new rule for a child that exits before readiness.
13. **One cache figure.** Both READMEs use `3.4 GB (3.2 GiB)`, and one clause explains that `GB` is
    the decimal unit and `GiB` the binary unit.

`bun test` after the polish round: 147 pass, 0 fail, 330 `expect()` calls, 13 files, about 127 ms.
The round adds 11 tests: 4 in `candidates.test.ts`, 3 in `serve.test.ts`, 2 in `prompt.test.ts`, and
2 in `scene-draft.test.ts`. Two older candidate tests and three scene-draft tests now ignore the
counter file when they list a folder, which the new file makes necessary.

### For T1.13

1. `blueprints/vehicules/r5-tl-1972/notes.md` has no `## Subject` paragraph, so pass
   `--prompt` with the subject in the art director's words.
2. Check the endpoint first: `curl -s http://127.0.0.1:9931/v1/models`. It must list
   `qwen3.5-4b-3d-coder`. Its context must be at least 32 768, set where the endpoint is declared. A
   model that is unloaded starts on the first completion, so the first run pays the load time.
3. Run:

    ```bash
    bun run workflows/qwen3d-coder/tools/scene-draft.ts \
      --subject blueprints/vehicules/r5-tl-1972 \
      --style "<style>" --variants 1 --prompt "<request>"
    ```

4. Record in this section: the candidate path, the wall-clock seconds, the output tokens, the decode
   rate, the resident memory of the model process (`ps -o rss= -p <pid>`, on the process that holds
   the weights), and one line of first-shot quality as a description, not a verdict.
5. Check acceptance criterion 5: the second run writes `--02` and the first file is byte-identical.

### Revision 2 — the pivot, recorded

A local OpenAI-compatible endpoint was already serving the model when phase 1 was written: it
published `qwen3.5-2b` and `qwen3.5-4b-3d-coder` on `127.0.0.1:9931`. Phase 1 had built a second
runtime for the same port with a different alias, so the two could not agree. Measured on 2026-11-16
before the pivot:

```console
$ curl -s http://127.0.0.1:9931/v1/models
{"data":[{"id":"qwen3.5-2b","status":{"value":"unloaded"}},
         {"id":"qwen3.5-4b-3d-coder","status":{"value":"unloaded"}}]}
```

A completion on `qwen3.5-4b-3d-coder` returned HTTP 200, cold load 5.1 s, and confirmed D12: with
`max_tokens: 16` and no toggle, `content` was empty and `reasoning_content` held the thinking; with
`chat_template_kwargs: {"enable_thinking": false}`, `content` was `"OK"` in 2 tokens.

Phase 1 is kept as the commit `f544140`, a checkpoint that is superseded, not a state to restore.


### Revision 2 — implementation

Implemented by the coding sub-agent on 2026-11-16. Tasks T1.14, T1.15, T1.16, and T1.17 are complete.
T1.13, the real measurement run, remains for the CTO.

#### Files

- **Created:** `workflows/qwen3d-coder/tools/lib/endpoint.ts` — the `/models` preflight, pure over an
  injected `fetch`, returning `{ ok: true; id }` or `{ ok: false; exitCode: 2; message }`.
- **Created:** `workflows/qwen3d-coder/tools/lib/endpoint.test.ts` — 10 tests: the four rows of
  section 3, the empty list, the exact-`id` success, the tolerant entry, and the route assertion.
- **Deleted:** `scripts/llama-server/` — all seven files, staged with `git rm` before this pass; not
  recreated.
- **Modified:** `tools/scene-draft.ts` — the two `scripts/llama-server` imports and every spawn path
  are gone; `--base-url` and `--model` replace `--port` and `--profile`; the preflight runs once per
  run, before the first variant, `--ask` included; the first line is
  `endpoint: <base-url>  model: <resolved id>`.
- **Modified:** `tools/lib/client.ts` — the body carries the resolved `model` and
  `"chat_template_kwargs": { "enable_thinking": false }`, and nothing else changed.
- **Rewritten:** `tools/scene-draft.test.ts` — the server tests are gone; the file adds the two new
  flags, the trailing-slash and invalid-URL rejections, the exit-`2` paths, and the attribution line.
- **Modified:** `tools/lib/client.test.ts` — the body capture asserts `model` and the thinking toggle.
- **Rewritten:** `workflows/qwen3d-coder/README.md` — a **Prerequisites** section, the two flags, the
  `GET /v1/models` check, the 32 768-token minimum (65 536 preferred), the flag table, the exit
  table, and the request table. No install, launch, cache, or machine-specific wording remains.
- **Modified:** `workflows/qwen3d-coder/AGENTS.md` — the endpoint rules of Contract section 13.
- **Modified:** `opencode.jsonc` — `Local OpenAI-compatible endpoint`, the model id
  `qwen3.5-4b-3d-coder`, and a comment that the endpoint is external.
- **Modified:** root `README.md` and `AGENTS.md` — the tree line, the external-endpoint statement, and
  the glossary entry. Four workflows stay.
- **Modified:** `.opencode/agents/bender.md` — workflow E no longer describes starting a server.

#### Gate results

`bun test`:

```text
 135 pass
 0 fail
 290 expect() calls
Ran 135 tests across 11 files. [100.00ms]
```

`bun run check` — run once, unchanged:

```text
error: capture failed (1)
  at run (.../workflows/threejs/tools/check.ts:152:17)
error: script "check" exited with code 1
```

The cause is the pre-existing failure that needs a live browser capture.
`workflows/threejs/` is untouched.

#### Decisions and deviations

- **Test count.** The preflight adds 10 tests and the rewritten CLI file adds 10 net tests. The
  phase-1 server tests are deleted with their code, so the repository total falls from 147 to 135.
- **Long-body quirk.** The endpoint test now feeds 400 plain bytes rather than a JSON wrapper, so the
  "first 200 characters" assertion measures the real cut instead of the 8-character JSON prefix.
- **Removed flags are tested as removed.** `scene-draft.test.ts` asserts that `--port` and `--profile`
  return exit `1`, so those two words survive only as negative assertions, never as usage.
- **Formatter.** The OpenCode `bun fmt` hook reformatted shared Markdown on save. The three shared
  documents were restored and the intended hunks re-applied through the shell, so their diffs stay
  minimal.
- **No number invented.** `README.md` states no decode rate; the script prints the measured rate and
  T1.13 records it.

### Polish round, revision 2

The independent reviewer returned `POLISH_REQUIRED`; all 13 findings are applied.

- **README (workflow):** exit `0` now covers `--ask` with gaps; "65 536 preferred"; the duplicated
  `-c` row is gone; the `--base-url` contract (parse, `http`/`https`, no trailing `/`, exit `1`) is
  stated; the endpoint-down paragraph is two declarative sentences.
- **Code:** `resolveModel` returns `{ ok: true; id } | { ok: false; code: 2 }` and the call sites
  discriminate on `ok`; the redundant empty-request check and its message are reduced; the fallback
  `return` carries its invariant comment; the preflight comment says once per run.
- **`endpoint.ts`:** the missing-model failure carries the shared prerequisite sentence; the CLI
  passes `Math.min(options.timeout * 1000, 10_000)` as the preflight budget, and the 10 s cap stays.
- **`client.ts`:** the remaining buffer is flushed when the stream closes; one test covers a last
  frame with no trailing blank line; the `timings` comment now says llama.cpp appends it and a plain
  gateway does not.
- **`scene-draft.test.ts`:** `DEFAULT_BASE_URL` and `DEFAULT_MODEL` are imported, so the defaults
  live once.

`bun test`: 136 pass, 0 fail, 291 `expect()` calls, 11 files, 96 ms.

`bun run check`: unchanged, `error: capture failed (1)` at `workflows/threejs/tools/check.ts:152:17`;
`workflows/threejs/` is untouched.

Portability grep over the touched files (`llama-swap`, `Skylab`, `NixOS`, `nixos`, `systemd`,
`systemctl`, `/share`, `~/.local`, `/home/`): no occurrence.

### The first successful run (T1.13, partial)

On 2026-11-16 the model produced its first usable scene. The subject has no blueprint image, so the
run used the workflow's own modules (`buildUserPrompt`, `buildRequestBody`, `streamChat`,
`extractHtml`) from a throwaway script outside the repository: no image part was sent, and no
candidate entered `blueprints/`.

| Fact       | Value                                                                   |
| :--------- | :---------------------------------------------------------------------- |
| Prompt     | a Christmas tree in its pot, voxel style, cubes only                     |
| Output     | 451 lines, 11 611 bytes, one `BoxGeometry`, no other primitive           |
| Wall clock | 125.3 s, cold load included                                             |
| Tokens     | 3 898 generated, 32.0 tok/s                                             |
| Memory     | 871 MB resident for `llama-server`, weights in `mmap`                   |

The art director kept it as a marker: `demos/voxel-christmas-tree.html`, with its prompt and its
measurements in `demos/README.md`.

**T1.13 stays open.** The ticket asks for a subject with a locked `reference.<ext>`, one candidate
written through the CLI, and a second run that must write `--02` without touching `--01`. None of
that happened here. The numbers above are the first decode-rate measurement, not the acceptance run.

### Review

Moved to `tickets/review/` on 2026-11-16 by decision of the art director, after the first real run
whose output is `demos/voxel-christmas-tree.html`.

- `bun test`: 136 pass, 0 fail, 291 `expect()` calls, 11 files.
- `bun run check`: still `error: capture failed (1)` at `workflows/threejs/tools/check.ts:152:17`.
  Pre-existing, and `workflows/threejs/` is untouched.
- The independent reviewer returned `POLISH_REQUIRED` on revision 2; all 13 findings are applied.
- **T1.13 is deferred, not done.** The acceptance run needs a subject with a locked
  `reference.<ext>`, a candidate written through the CLI, and a second run that writes `--02` without
  touching `--01`. The first run had no blueprint subject.
