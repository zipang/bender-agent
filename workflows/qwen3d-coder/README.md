# The Qwen 3D Coder workflow

A local 4B model drafts one stylized Three.js scene as a standalone HTML file, from a subject
reference image and a short note. The art director opens the file and chooses.

This workflow has **no gate**. It produces unmeasured, stylized candidates, it does not run G1, G2,
or G3, and it does not replace workflow D. Its state is **experimental**.

```text
blueprints/<category>/<subject>/reference.<ext>   +   a style note
  -> one streamed call to a local llama.cpp server
  -> blueprints/<category>/<subject>/generated/qwen3d-coder-scene--<NN>.html
  -> the art director opens it, describes it, and chooses
```

## 1. Install the runtime

The runtime is llama.cpp. The model card documents one install command, and the installer puts one
binary in `~/.local/bin/llama`.

```bash
bun run scripts/llama-server/install.ts --check
```

It reports the runtime, its version, and the size of the two model artifacts. It runs no install
command. When the runtime is missing, it prints the documented command:

```bash
curl -LsSf https://llama.app/install.sh | sh
```

Run the install only on purpose:

```bash
bun run scripts/llama-server/install.ts --yes
```

The script never downloads a model. llama.cpp fetches the weights itself, through `-hf`, on the
first launch. The cache is outside the repository:

```text
~/.cache/huggingface/hub/models--ccore--Qwen3.5-4B-3D-Coder   3.4 GB (3.2 GiB)
```

`GB` is the decimal unit (10^9 bytes); `GiB` is the binary unit (2^30 bytes).

Delete that folder to free the space. A later launch downloads the weights again.

## 2. Launch the server

```bash
bun run scripts/llama-server/serve.ts --profile 3d-coder
```

The script starts `llama serve` on `127.0.0.1:9931` with these flags:

```bash
llama serve -hf ccore/Qwen3.5-4B-3D-Coder:Q4_K_M \
  -c 65536 -np 1 -fa on -ngl all \
  --host 127.0.0.1 --port 9931 -a local/3d-coder
```

The script polls `GET /v1/health` every 500 ms and gives up after 120 s. It reuses a server that
already answers with the same alias. A port that answers with another alias is a conflict, and the
script exits 2. It stops only the child that it started. `Ctrl-C` stops that child.

The model stays resident, so the second run costs no load time.

## 3. Draft one scene

```bash
bun run workflows/qwen3d-coder/tools/scene-draft.ts \
  --subject blueprints/vehicules/r5-tl-1972 \
  --style "low-poly stylized video game figurine" \
  --prompt "a 1972 Renault 5 TL, orange, three doors" \
  --variants 2
```

A subject without a `## Subject` paragraph in `notes.md` needs `--prompt`, because the script never
sends an empty prompt.

| Flag                | Meaning                                             | Default                  |
| :------------------ | :-------------------------------------------------- | :----------------------- |
| `--subject <dir>`   | The subject folder. It must hold `reference.<ext>`  | required                 |
| `--style "<text>"`  | The rendering style, in the art director's words    | required                 |
| `--variants <n>`    | The number of candidates                            | `1`                      |
| `--image`           | Send `reference.<ext>` as an image part             | off                      |
| `--prompt "<text>"` | The scene request, instead of the subject paragraph | `notes.md`               |
| `--port <n>`        | The port of the server                              | the profile port, `9931` |
| `--max-tokens <n>`  | The output guard. `-1` removes it                   | `16384`                  |
| `--timeout <s>`     | The wall-clock budget of one request                | `1800`                   |
| `--seed <n>`        | A fixed seed, so one run is repeatable              | absent, so random        |
| `--profile <name>`  | The server profile, from `scripts/llama-server/`    | `3d-coder`               |
| `--ask`             | List the gaps. Send nothing                         | off                      |

Run `--ask` first. It is free:

```bash
bun run workflows/qwen3d-coder/tools/scene-draft.ts \
  --subject blueprints/vehicules/r5-tl-1972 --ask
```

The script reads `notes.md` and `reference.<ext>`, and never `source.<ext>`. In `notes.md` it reads
the first paragraph under `## Subject`, which is mandatory, and the first paragraph under either
`## Specific subject details` or `## Identity features that must not change`, which is optional.
The first of those two headings wins when both are present.

Exit codes:

| Code | Meaning                                                         |
| :--- | :-------------------------------------------------------------- |
| `0`  | A candidate was written                                         |
| `1`  | Invalid input: a flag, the subject, the style, or the reference |
| `2`  | The server did not become ready                                 |
| `3`  | A request failed                                                |
| `4`  | The response held no complete document                          |
| `5`  | The candidate could not be written                              |

A failed variant does not stop the next one. The script still exits 0 when one candidate is written.

## 4. Review the candidate

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

This machine is a Ryzen 7 5800H with 30 GiB of shared memory and no discrete GPU. The figures below
are **estimates**, not measurements: about 10 tokens per second is an estimate for this 4B `Q4_K_M`
model. Ticket `T1.13` replaces the estimates with the measured value of one real run. Every run
prints its own measured rate.

| Output tokens | One variant      | At an estimated 10 tokens per second |
| :------------ | :--------------- | :----------------------------------- |
| 2,000         | light scene      | about 3 min                          |
| 4,000         | a typical scene  | about 7 min                          |
| 8,000         | a detailed scene | about 13 min                         |

A run of two variants costs about twice one variant. The first request also pays the model load,
and later requests reuse the resident model. Ticket `T1.13` records the measured value of one real
run.

## The request

The body of `POST /v1/chat/completions` is fixed, except for the seed and the output guard:

| Field            | Value            | Why                                                           |
| :--------------- | :--------------- | :------------------------------------------------------------ |
| `model`          | `local/3d-coder` | The server alias                                              |
| `temperature`    | `0.6`            | The low end of the card's range, for repeatable structure     |
| `top_p`          | `0.95`           | Nucleus sampling, the card's default                          |
| `top_k`          | `20`             | The floor of the card's range, for less drift                 |
| `repeat_penalty` | `1.0`            | `1.0` disables the penalty, as the card states                |
| `max_tokens`     | `16384`          | A guard, not a model figure. `--max-tokens` changes it        |
| `stream`         | `true`           | A streamed call is required on this machine                   |
| `seed`           | absent           | `-1` means a random seed per variant. `--seed` adds the field |

These fields stay absent, so the server default applies:

| Field               | Effective value | Meaning                     |
| :------------------ | :-------------- | :-------------------------- |
| `min_p`             | `0.05`          | The card sets no value      |
| `typical_p`         | `1.0`           | Disabled                    |
| `xtc_probability`   | `0.0`           | Disabled                    |
| `xtc_threshold`     | `0.10`          | Inert while XTC is disabled |
| `dynatemp_range`    | `0.0`           | No temperature drift        |
| `presence_penalty`  | `0.0`           | Disabled                    |
| `frequency_penalty` | `0.0`           | Disabled                    |

The server applies its samplers from left to right: `penalties`, `dry`, `top_n_sigma`, `top_k`,
`typ_p`, `top_p`, `min_p`, `xtc`, `temperature`. The token cut happens before the temperature
scales the distribution. This workflow keeps that order.

The system prompt is `prompts/3d-coder-system.txt`, the model card's text byte for byte.

The server reports the token count in `timings`. Without `timings` in the response, the reported
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
        ├── prompt.ts          the user prompt, a pure function
        ├── client.ts          the streamed request
        ├── extract.ts         the HTML document out of the response
        └── candidates.ts      the counter and the write
```

The server lives at the repository root, in `scripts/llama-server/`, because the second Qwen
workflow reads it too.
