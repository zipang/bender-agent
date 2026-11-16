# The Qwen 3D Coder workflow

A 4B model drafts one stylized Three.js scene as a standalone HTML file, from a subject reference
image and a short note. The art director opens the file and chooses.

This workflow has **no gate**. It produces unmeasured, stylized candidates, it does not run G1, G2,
or G3, and it does not replace workflow D. Its state is **experimental**.

```text
blueprints/<category>/<subject>/reference.<ext>   +   a style note
  -> one streamed call to an OpenAI-compatible endpoint
  -> blueprints/<category>/<subject>/generated/qwen3d-coder-scene--<NN>.html
  -> the art director opens it, describes it, and chooses
```

## 1. Prerequisites

This workflow ships **no inference runtime**. It starts, installs, and configures nothing. It needs an
**OpenAI-compatible endpoint** that is already running and that publishes the 3D Coder weights. The
operator of that endpoint provides and supervises it.

The drafter names the endpoint with two flags:

| Flag         | Meaning                                                        | Default                    |
| :----------- | :------------------------------------------------------------- | :------------------------- |
| `--base-url` | The root of the OpenAI-compatible API, without the route       | `http://127.0.0.1:9931/v1` |
| `--model`    | The `id` that this endpoint publishes for the 3D Coder weights | `qwen3.5-4b-3d-coder`      |

The default URL is the documented default port of an OpenAI-compatible server. It is a convenience,
not a dependency: any endpoint that speaks `GET /v1/models` and `POST /v1/chat/completions` works,
and the flags point the drafter at another one.

Check the endpoint before a run. The model list must hold the `id` that `--model` names:

```bash
curl -s http://127.0.0.1:9931/v1/models
```

A 2xx answer carries a `data` array with one entry per model, and each entry carries an `id`. An
endpoint that is down ends the run with exit code `2`. An endpoint that publishes another `id` also
ends the run with exit code `2`.

The endpoint must offer **at least 32 768 tokens of context**, and **65 536 preferred**. The system
prompt, the image tokens, and a scene share one window. The client cannot raise the window; it is a
setting of the endpoint. At 4 096 tokens the scene is truncated mid-file and the run ends with exit
code `4`.

The endpoint's operator sets the rest of its requirements where the endpoint is declared. This
workflow states them, reads none of them, and cannot verify any of them:

| Requirement              | Value                                | Why                                                                                       |
| :----------------------- | :----------------------------------- | :---------------------------------------------------------------------------------------- |
| `-np`, `--parallel`      | **1**                                | One variant at a time. A memory-bound host loses rate and memory with two slots.          |
| `-ngl`, `--n-gpu-layers` | **`all`** when the backend has a GPU | The model card uses `all`. On a shared-memory GPU it changes placement, not bandwidth.    |
| `-fa`, `--flash-attn`    | **`on`**                             | The model card's invocation.                                                              |

## 2. Draft one scene

```bash
bun run workflows/qwen3d-coder/tools/scene-draft.ts \
  --subject blueprints/vehicules/r5-tl-1972 \
  --style "low-poly stylized video game figurine" \
  --prompt "a 1972 Renault 5 TL, orange, three doors" \
  --variants 2
```

A subject without a `## Subject` paragraph in `notes.md` needs `--prompt`, because the script never
sends an empty prompt.

| Flag                | Meaning                                             | Default                    |
| :------------------ | :-------------------------------------------------- | :------------------------- |
| `--subject <dir>`   | The subject folder. It must hold `reference.<ext>`  | required                   |
| `--style "<text>"`  | The rendering style, in the art director's words    | required                   |
| `--variants <n>`    | The number of candidates                            | `1`                        |
| `--image`           | Send `reference.<ext>` as an image part             | off                        |
| `--prompt "<text>"` | The scene request, instead of the subject paragraph | `notes.md`                 |
| `--base-url <url>`  | The root of the OpenAI-compatible API               | `http://127.0.0.1:9931/v1` |
| `--model <id>`      | The `id` the endpoint publishes                     | `qwen3.5-4b-3d-coder`      |
| `--max-tokens <n>`  | The output guard. `-1` removes it                   | `16384`                    |
| `--timeout <s>`     | The wall-clock budget of one request                | `1800`                     |
| `--seed <n>`        | A fixed seed, so one run is repeatable              | absent, so random          |
| `--ask`             | List the gaps and check the endpoint. Send nothing  | off                        |

`--base-url` must parse as a URL, its scheme must be `http` or `https`, and it must not end with `/`.
A violation exits `1`.

Run `--ask` first. It is free, and it still checks the endpoint, so a missing service is found before
anyone writes a request:

```bash
bun run workflows/qwen3d-coder/tools/scene-draft.ts \
  --subject blueprints/vehicules/r5-tl-1972 --ask
```

The script reads `notes.md` and `reference.<ext>`, and never `source.<ext>`. In `notes.md` it reads
the first paragraph under `## Subject`, which is mandatory, and the first paragraph under either
`## Specific subject details` or `## Identity features that must not change`, which is optional.
The first of those two headings wins when both are present.

The first line of output names the endpoint and the model it resolved, so a run is attributable to one
service:

```text
endpoint: http://127.0.0.1:9931/v1  model: qwen3.5-4b-3d-coder
```

Exit codes:

| Code | Meaning                                                                 |
| :--- | :---------------------------------------------------------------------- |
| `0`  | A candidate was written, or `--ask` completed its check, whatever the gaps |
| `1`  | Invalid input: a flag, the subject, the style, or the reference         |
| `2`  | The endpoint is unreachable, or it does not publish the model           |
| `3`  | A request failed                                                        |
| `4`  | The response held no complete document                                  |
| `5`  | The candidate could not be written                                      |

A failed variant does not stop the next one. The script still exits 0 when one candidate is written.

## 3. Review the candidate

The script prints one line per variant: the file path, the wall-clock seconds, the output tokens,
and the decode rate.

Open the file in a browser. The page imports Three.js from cdnjs, so it needs a network connection.
Open it over HTTP when the browser blocks a `file://` module:

```bash
bunx serve blueprints/vehicules/r5-tl-1972/generated
```

Then open `http://localhost:3000/qwen3d-coder-scene--01.html`.

The art director chooses. A rejected candidate stays in the folder, because it is evidence about
what the prompt produced. The script records the last number in `.qwen3d-coder-scene.counter`, so a
number is never reused after a deletion: `--04` follows `--03`, even when `--03` is gone.

## The cost of one scene

The cost is the machine's and the endpoint's. The script measures the decode rate of every run and
prints it, and it never assumes a rate. Ticket `T1.13` records the measured figures of one real run;
until then this document states no number. A run of two variants costs about twice one variant. The
first request may also pay a model load, and later requests may reuse a resident model.

## The request

The body of `POST <base-url>/chat/completions` is fixed, except for the seed and the output guard:

| Field                  | Value                          | Why                                                                    |
| :--------------------- | :----------------------------- | :--------------------------------------------------------------------- |
| `model`                | the `--model` id resolved      | The exact `id` that `GET /models` published, never an alias            |
| `chat_template_kwargs` | `{ "enable_thinking": false }` | Mandatory: without it the answer can hold no `content`                 |
| `temperature`          | `0.6`                          | The low end of the card's range, for repeatable structure              |
| `top_p`                | `0.95`                         | Nucleus sampling, the card's default                                   |
| `top_k`                | `20`                           | The floor of the card's range, for less drift                          |
| `repeat_penalty`       | `1.0`                          | `1.0` disables the penalty, as the card states                         |
| `max_tokens`           | `16384`                        | A guard, not a model figure. `--max-tokens` changes it                 |
| `stream`               | `true`                         | A streamed call is required: an idle timeout kills a non-streamed call |
| `seed`                 | absent                         | `-1` means a random seed per variant. `--seed` adds the field          |

`reasoning_format` is not sent: the server default already routes a thinking template into
`reasoning_content`, and the toggle above stops the thinking from being generated at all.

These fields stay absent, so the endpoint default applies:

| Field               | Effective value | Meaning                     |
| :------------------ | :-------------- | :-------------------------- |
| `min_p`             | `0.05`          | The card sets no value      |
| `typical_p`         | `1.0`           | Disabled                    |
| `xtc_probability`   | `0.0`           | Disabled                    |
| `xtc_threshold`     | `0.10`          | Inert while XTC is disabled |
| `dynatemp_range`    | `0.0`           | No temperature drift        |
| `presence_penalty`  | `0.0`           | Disabled                    |
| `frequency_penalty` | `0.0`           | Disabled                    |

The endpoint applies its samplers from left to right: `penalties`, `dry`, `top_n_sigma`, `top_k`,
`typ_p`, `top_p`, `min_p`, `xtc`, `temperature`. The token cut happens before the temperature
scales the distribution. This workflow keeps that order.

The system prompt is `prompts/3d-coder-system.txt`, the model card's text byte for byte.

The endpoint reports the token count in `timings`. Without `timings` in the response, the reported
count is the number of non-empty delta frames, not tokens. The request itself does not change.

## Files

```text
workflows/qwen3d-coder/
├── AGENTS.md                  the rules of this workflow
├── README.md                  this file
├── prompts/3d-coder-system.txt
└── tools/
    ├── scene-draft.ts         the entry point and the CLI
    └── lib/
        ├── endpoint.ts        the /v1/models preflight
        ├── prompt.ts          the user prompt, a pure function
        ├── client.ts          the streamed request
        ├── extract.ts         the HTML document out of the response
        └── candidates.ts      the counter and the write
```

The endpoint is external, so no file of this workflow starts, installs, or configures it.
