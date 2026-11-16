# T0011 — A fourth workflow: Qwen 3D Coder, llama.cpp, and the scene drafter

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
    - llama.cpp install, as the model card documents it: https://llama.app/install.sh
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
`README.md`. A local llama.cpp server serves the model on `127.0.0.1`. One command turns a subject
reference image and a short note into a candidate `.html` file. The art director opens it and
chooses. The tests are hermetic. The machine numbers are recorded.

**This workflow produces unmeasured, stylized candidates judged by eye.** It has **no gate**, it does
not run G1, G2, or G3, and it does not replace workflow D.

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
    ├── lib/prompt.ts      the user prompt, a pure function of its inputs
    ├── lib/client.ts      the /v1/chat/completions call, streamed
    ├── lib/extract.ts     the HTML document out of the raw response
    ├── lib/candidates.ts  the counter, the write, the never-delete rule
    └── lib/*.test.ts      the hermetic tests
```

### The local runtime

The inference server is **not a 3D tool**. It is a local runtime that knows a repository name, a
quantization, a port, and a context length. It reads no scene, no asset, and no blueprint. This
ticket puts it at the root, in `scripts/`, for the reason the README states: the root owns what more
than one reader uses. T0012 is the second reader.

```text
scripts/llama-server/
├── profiles.ts        the model registry: name, repository, quantization, port, alias, context
├── install.ts         verify llama.cpp, and install it on request
├── serve.ts           start one profile, or reuse the one already listening
├── README.md          the commands, the cache, the memory
└── *.test.ts          the hermetic tests
```

### Modified, append only

- `AGENTS.md` (root) — the workflow table gains one row; "Three workflows" becomes "Four workflows".
- `README.md` (root) — one workflow-table row, the pipeline sentence, the repository tree, and the
  glossary.
- `.opencode/agents/bender.md` — one row in the tool-selection table, and one section, "Workflow E".
- `opencode.jsonc` — one `providers.local` entry.
- `tickets/README.md` — the board.

### Out of scope

Do not touch `workflows/threejs/**`, `workflows/blender/**`, `workflows/vcad/**`, `scripts/blueprint-generate/**`,
`scripts/measure/**`, `blueprints/**` (the script writes there at runtime, never at commit time).

**No `.gitignore` change.** The model weights live in the llama.cpp cache, outside the repository, and
`blueprints/*/*/*` already ignores the candidate folder.

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

### 2. `scripts/llama-server/profiles.ts`

One registry, one entry per model. It holds runtime facts only: no scene, no asset, no 3D word.

```ts
export type Profile = {
	repo: string; // the Hugging Face repository
	quant: string; // the quantization suffix of -hf
	port: number; // the port of the local server
	alias: string; // the model id sent in every request body
	ctx: number; // the context window in tokens
};

export const PROFILES: Record<string, Profile> = {
	"3d-coder": {
		repo: "ccore/Qwen3.5-4B-3D-Coder",
		quant: "Q4_K_M",
		port: 9931,
		alias: "local/3d-coder",
		ctx: 65536,
	},
};
```

T0012 appends one entry and changes no line of this one. A missing profile name is invalid input,
exit code `1`, and the message lists the known names.

### 3. `scripts/llama-server/install.ts`

`--check` is the default and sends nothing. It reports three facts:

1. `llama` — the unified llama.cpp launcher — is on `PATH`, and `llama version` reports its build.
   A bare legacy `llama-server` on `PATH` is accepted as a fallback, and its `--version` is reported
   instead.
2. The two model artifact sizes, quoted from the card: `Q4_K_M` 2.71 GB, `mmproj` 0.68 GB.
3. The exact command to install llama.cpp when it is missing.

The documented install command is the one the model card gives:

```bash
curl -LsSf https://llama.app/install.sh | sh
```

**D3 — the script never installs without `--yes`.** A system install mutates the machine and may need
elevated rights. `--check` reports; `--yes` runs the documented command through the injected runner.
The default path must be safe to run in a test.

**D4 — no download code.** The weights are fetched by llama.cpp itself, through `-hf`, as the server
README documents. The script passes the flag and never writes a file. The cache stays outside the
repository, so no large binary enters the tree and no `.gitignore` rule is needed. The README names
the cache so a reader can delete it.

### 4. `scripts/llama-server/serve.ts`

The model card documents this invocation for the same projector:

```bash
llama-server \
  -m Qwen3.5-4B-3D-Coder-Q4_K_M.gguf \
  --mmproj mmproj-Qwen3.5-4B-BF16.gguf \
  --n-gpu-layers all --flash-attn on \
  --ctx-size 65536 --parallel 1
```

**D9 — the runtime is `llama serve`, not a separate `llama-server`.** The documented install script
(`https://llama.app/install.sh`, consulted on 2026-11-16) installs **one** binary,
`~/.local/bin/llama` (build 12375), and its help lists `serve  HTTP API server`. It does not install
a `llama-server` binary. `llama serve --help` prints the same server flags, from the same
`common params` block. Therefore `install.ts` probes `llama` first and `llama-server` second, and
`serve.ts` spawns `llama serve`. The flag table below is unchanged, and the llama.cpp server README
stays the authority for every flag.

The script starts the server with `llama serve` and passes these documented flags, all quoted from
the server README:

| Flag                     | Documented meaning                                                                                       | Value                            |
| :----------------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------- |
| `-hf, -hfr, --hf-repo`   | "Hugging Face model repository; quant is optional… mmproj is also downloaded automatically if available" | `<profile.repo>:<profile.quant>` |
| `-c, --ctx-size N`       | "size of the prompt context"                                                                             | `<profile.ctx>`                  |
| `-np, --parallel N`      | "number of server slots"                                                                                 | `1`                              |
| `-fa, --flash-attn`      | "set Flash Attention use ('on', 'off', or 'auto')"                                                       | `on`                             |
| `-ngl, --n-gpu-layers N` | "max. number of layers to store in VRAM, either an exact number, 'auto', or 'all'"                       | `all`                            |
| `--host`                 | "IP addresses to listen on (default: 127.0.0.1)"                                                         | `127.0.0.1`                      |
| `--port`                 | "port to listen (default: 9931)"                                                                         | `<profile.port>`                 |
| `-a, --alias`            | "set model name aliases, comma-separated (to be used by API)"                                            | `<profile.alias>`                |

`--jinja` is **not** passed: the server README states its default is already enabled.

Readiness is `GET /v1/health`. The server README states: "This endpoint is public (no API key check).
`/v1/health` also works." The script polls every 500 ms, gives up after 120 s, and reports the last
non-200 status.

`serve.ts` **never starts a second server**. If the port already answers on `/v1/health` with the
same alias, it reuses the process. A port that answers with a **different** alias is a conflict:
exit `2`, and the message names both aliases. The script never kills a process it did not start.

### 5. The inference request

`POST http://127.0.0.1:<port>/v1/chat/completions`, streamed. From the server README: "POST
`/v1/chat/completions`: OpenAI-compatible Chat Completions API". The body is exactly:

```json
{
	"model": "local/3d-coder",
	"messages": [
		{ "role": "system", "content": "<prompts/3d-coder-system.txt, byte for byte>" },
		{ "role": "user", "content": "<lib/prompt.ts>" }
	],
	"temperature": 0.6,
	"top_p": 0.95,
	"top_k": 20,
	"repeat_penalty": 1.0,
	"max_tokens": 16384,
	"stream": true
}
```

The sampling values come from the model card, "Generation settings": temperature 0.6–0.8, top-p
0.90–0.95, top-k 20–40, repeat penalty 1.0. The card's FP16 defaults are temperature 0.6, top-k 20,
top-p 0.95, repetition penalty 1.0. The script takes the low end of every range, which is the
deterministic end.

**D5 — `max_tokens` is a guard, not a model figure.** The card sets no output limit for this model.
The script caps at 16384 so that a runaway generation stops, and exposes `--max-tokens`.

**D6 — a streamed call is required.** Every `data: ` frame carries `choices[0].delta.content`; the
frame `data: [DONE]` ends the stream. A non-streamed call to a 4B model on this machine runs for
minutes and dies on an idle timeout.

### 6. Every sampling parameter, one by one

The model is **not an agent**. It holds no tool, no loop, and no memory. It is a completion model
that the script calls once per variant. Every field below is a field of that one call, or a flag of
the one server. A reader who changes a number must be able to predict what changes.

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

Server-side parameters, which shape the run and not the text:

| Flag                     | Value     | Why                                                                                                                                       |
| :----------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `-c, --ctx-size N`       | **65536** | The card's vision example uses 64K, and image tokens share the window with the prompt and the code. A smaller window truncates the scene. |
| `-np, --parallel N`      | **1**     | One variant at a time. The machine is memory-bound: two slots would halve the rate of both and double the resident memory.                |
| `-ngl, --n-gpu-layers N` | **`all`** | The card uses `all`. On this machine the Vega 8 shares the system RAM, so the value changes the placement, not the bandwidth ceiling.     |
| `-fa, --flash-attn`      | **`on`**  | The card's invocation.                                                                                                                    |

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
  --style "<style>" --variants 2 [--image] [--prompt "<request>"] [--port 9931] \
  [--max-tokens 16384] [--timeout 1800] [--seed N]
```

- `--ask` sends nothing. It lists the gaps: a missing `reference.<ext>`, a missing subject note, a
  missing style. It is the free check, as in `scripts/blueprint-generate`.
- Exit codes: `0` written, `1` invalid input, `2` the server did not become ready, `3` a request
  failed, `4` the response held no complete document, `5` the candidate could not be written.
- The script reports, per variant: the file path, the wall-clock seconds, the output tokens, and the
  decode rate. A failed variant does not stop the next one.

The script imports `scripts/llama-server/profiles.ts` and `serve.ts`. It never spawns
the server itself.

### 12. The provider entry

`opencode.jsonc` gains one entry, so the model is visible in `/models` for a manual chat. From the
OpenCode provider documentation:

```jsonc
"providers": {
  "local": {
    "name": "llama.cpp (local)",
    "package": "@opencode/ai/providers/openai-compatible",
    "settings": { "baseURL": "http://127.0.0.1:9931/v1" },
    "models": { "3d-coder": { "name": "Qwen 3.5 4B 3D Coder" } }
  }
}
```

The `models` map key is the OpenCode model ID; the full reference is `local/3d-coder`. **D8:** no
`capabilities` key is written unless the OpenCode model documentation states the exact key name. The
entry exists for a manual chat only. Bender calls the script, never this provider.

### 13. The workflow's `AGENTS.md`

Short, like the two other workflow rule files. It must state, at least:

- The model is not an agent. One call per variant, no tool, no loop.
- **This workflow has no gate.** No number, no overlay, no render decides. The art director decides.
- Candidates are never deleted, never renamed, never overwritten.
- The script never edits the model's JavaScript. A broken candidate stays as evidence.
- Generation reads `reference.<ext>` only.
- The drafters live in `tools/`. The server lives in `scripts/llama-server/`.
- The runtime is loopback only: no host outside `127.0.0.1` is reached.
- The cost is the machine's. The decode rate is measured, never assumed.

## TDD Tasks

- [x] **T1.1 — The registry and its reader**: failing tests for `profiles.ts`. Assert that a known
      name returns the six fields, that an unknown name exits `1` and lists the known names. Then write
      `scripts/llama-server/profiles.ts`.
- [x] **T1.2 — The install check**: failing tests with an injected `PATH` probe and an injected
      runner. Assert that `--check` spawns nothing, that a present `llama` reports its version,
      that an absent one reports the documented install command, and that `--yes` runs it once. Then
      write `scripts/llama-server/install.ts`.
- [x] **T1.3 — The server lifecycle**: failing tests with an injected spawn and an injected fetch.
      Assert that a healthy port with the same alias is reused and not spawned, that a healthy port with
      a different alias exits `2`, that an unhealthy port is spawned once, that the poll gives up at
      120 s with exit code `2`, and that the child is stopped on exit. Never start a real
      `llama serve` in a test.
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
      `Bun.serve` on port `0`, and asserts every field of section 5, including the sampling values and
      `stream: true`. The same test asserts the **absent** keys of section 6: `min_p`, `typical_p`,
      `xtc_probability`, `xtc_threshold`, `dynatemp_range`, `presence_penalty`, `frequency_penalty`, and
      `seed` must not appear. A second test asserts that `--seed 42` adds `"seed": 42` and changes
      nothing else. Then implement `lib/client.ts`.
- [x] **T1.8 — The stream**: failing tests that feed recorded SSE fixtures through the client. Assert
      that the deltas concatenate in order, that `data: [DONE]` ends the read, that a broken frame is
      skipped, and that `--timeout` aborts the read with exit code `3`.
- [x] **T1.9 — Implementation and wiring**: `tools/scene-draft.ts`, the flags, the exit codes, the
      per-variant report.
- [x] **T1.10 — The fourth workflow**: create the folder, write `AGENTS.md` with every rule of
      section 13, and write `README.md`: the install, the two commands, the cache, the memory, and the
      expected rate. The README states the cost of one scene, not a range of hopes.
- [x] **T1.11 — The documents**: the append-only hunks of section "Scope Boundary". The root
      `README.md` gains its row, its sentence, its tree line, and its glossary entries for **Qwen 3D
      Coder** and for **experimental**. `bender.md` gains one row in the tool-selection table and
      workflow E: read the reference, run `--ask`, ask the art director in one call, run the script, hand
      back the candidate paths with one line of description each, and wait for the choice. Never choose,
      never promote.
- [x] **T1.12 — Gates**: `bun test` is green across the repository. Run `bun run check` once and
      record its result, but do not touch `workflows/threejs/`: that command needs a live browser
      capture, and it already fails with `capture failed (1)` on this machine before this ticket.
- [ ] **T1.13 — The measurement**: one real run on a subject with a locked `reference.<ext>`, one
      candidate. Record in `## Implementation Notes`: the token rate, the wall-clock seconds, the output
      tokens, the resident memory of the server process, and the first-shot quality as one line of
      description.

## Acceptance Criteria

1. `workflows/qwen3d-coder/` exists with `AGENTS.md`, `README.md`, `prompts/`, and `tools/`, and a
   reader can install, launch, and draft from `README.md` alone.
2. `scripts/llama-server/` holds the registry, the install check, and the server starter, and it
   reads no 3D file.
3. `bun test` passes, and no test opens a socket to anything but `127.0.0.1`, downloads a model, or
   takes more than five seconds.
4. `bun run scripts/llama-server/install.ts --check` reports the version or the install command, and
   spawns nothing.
5. One real run writes
   `blueprints/vehicules/r5-tl-1972/generated/qwen3d-coder-scene--01.html`. A second run writes
   `--02`. The first file is unchanged, byte for byte.
6. The candidate opens on its own, and the page draws a scene with `bun` serving the folder.
7. The script reports a decode rate, and the number is in `## Implementation Notes`.
8. `git status` shows changes only inside the scope of this ticket.
9. `opencode.jsonc` still parses, and `local/3d-coder` appears in `/models` once the server runs.
10. The root `README.md` and `AGENTS.md` both name four workflows.

## Implementation Notes

Implemented by the coding sub-agent on 2026-11-16. T1.1 to T1.12 are complete. T1.13, the real
measurement run, is left to the CTO.

### Files created

`scripts/llama-server/`:

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

3. `bun run scripts/llama-server/install.ts --check` — exit 0:

```text
runtime:    llama  (/home/zipang/.local/bin/llama)
version:    version: 1.0.0-dev (build 12375, commit 9d25e0014)
artifact:   Qwen3.5-4B-3D-Coder-Q4_K_M.gguf  2.71 GB
artifact:   mmproj-Qwen3.5-4B-BF16.gguf  0.68 GB
check only: no command was run.
```

4. `bun run workflows/qwen3d-coder/tools/scene-draft.ts --subject blueprints/vehicules/r5-tl-1972 --ask`
   — exit 0, two gaps: the subject note and the style. It sent nothing.

5. `git status --short` shows only the allowed paths: the two new folders, the four documents, and
   the ticket.

There is no separate type-check or lint command in this repository. The gates are `bun test` and
`bun run check`.

### Decisions and deviations

- **D9 holds on this machine.** `llama` is build 12375 at `~/.local/bin/llama`. There is no
  `llama-server` binary. `llama serve --help` carries `-hf`, `-c`, `-np`, `-fa`, `-ngl`,
  `--host`, `--port`, `-a`, and `--mmproj`. `install.ts` probes `llama` first and
  `llama-server` second, and it accepts a binary in `~/.local/bin` when `PATH` does not hold it,
  because the OpenCode service does not always inherit the shell `PATH`. `serve.ts` spawns
  `llama serve`.
- **Child `PATH`.** The documented installer writes `llama` to `~/.local/bin`, and that directory is
  not always on the service `PATH` (it is absent in this session). `systemSpawn` puts `~/.local/bin`
  at the front of the child `PATH` when it is absent, so the command stays `llama serve` and the
  child still finds the binary. A unit test locks the helper.
- **Alias detection.** `GET /v1/health` returns the status only. The alias is read from
  `GET /v1/models` (`data[].id`), which the documented `-a` flag sets. A port that answers health
  but not `/v1/models` is reused, because the workflow cannot prove a conflict. A port that names
  another alias exits 2 and the message names both.
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
2. Run:

    ```bash
    bun run workflows/qwen3d-coder/tools/scene-draft.ts \
      --subject blueprints/vehicules/r5-tl-1972 \
      --style "<style>" --variants 1 --prompt "<request>"
    ```

    The script starts and stops the server itself. To keep the server resident for a second run,
    start `bun run scripts/llama-server/serve.ts --profile 3d-coder` first.

3. Record in this section: the candidate path, the wall-clock seconds, the output tokens, the decode
   rate, the resident memory of the server process (`ps -o rss= -p <pid>`), and one line of
   first-shot quality as a description, not a verdict.
4. Check acceptance criterion 5: the second run writes `--02` and the first file is byte-identical.
