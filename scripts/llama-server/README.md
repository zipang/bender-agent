# The local llama.cpp server

One local runtime for the Qwen workflows. It knows a repository name, a quantization, a port, an
alias, and a context size. It reads no scene, no asset, and no blueprint.

The runtime lives at the root because more than one workflow reads it. The scene drafter of
`workflows/qwen3d-coder/` is the first reader. The asset drafter of ticket `T0012` is the second.

## Commands

```bash
bun run scripts/llama-server/profiles.ts 3d-coder   # print one profile
bun run scripts/llama-server/install.ts --check    # read the runtime state, run nothing
bun run scripts/llama-server/install.ts --yes      # install llama.cpp on purpose
bun run scripts/llama-server/serve.ts --profile 3d-coder
```

`profiles.ts` holds the registry. An unknown name exits 1 and lists the known names. To add a model,
append one entry. Change no existing line.

`install.ts` probes `llama` first, then a legacy `llama-server`. It accepts a binary in
`~/.local/bin` when `PATH` does not hold it. The documented install command is the model card's:

```bash
curl -LsSf https://llama.app/install.sh | sh
```

The documented install script installs one unified binary, `llama`. `llama serve` accepts the server
flags, so this repository uses it and does not look for a separate `llama-server` binary.

`serve.ts` starts the server with the documented flags:

| Flag     | Value                                                            |
| :------- | :--------------------------------------------------------------- |
| `-hf`    | `<repo>:<quant>`, for example `ccore/Qwen3.5-4B-3D-Coder:Q4_K_M` |
| `-c`     | the profile context size                                         |
| `-np`    | `1`                                                              |
| `-fa`    | `on`                                                             |
| `-ngl`   | `all`                                                            |
| `--host` | `127.0.0.1`                                                      |
| `--port` | the profile port                                                 |
| `-a`     | the profile alias                                                |

`--jinja` is not passed, because its default is enabled. The mmproj file is downloaded by llama.cpp
with the weights, because the repository holds one.

## Lifecycle

- A port that answers `GET /v1/health` with 200 is checked further: `/v1/health` carries no alias, so
  the alias is read from `GET /v1/models`. The same alias means the server is reused.
- A port that answers with another alias is a conflict. The script exits 2 and names both aliases.
- An unhealthy port is spawned once. The script polls every 500 ms and gives up after 120 s.
- A child that exits before it becomes ready stops the poll at once. The script reports its exit code
  and exits 2, instead of waiting the full 120 s.
- The script stops only the child that it started. It never kills another process.
- The child gets `~/.local/bin` at the front of its `PATH` when the shell does not hold it, because
  the installer writes `llama` there.

## The cache

The weights stay outside the repository, in the llama.cpp cache:

```text
~/.cache/huggingface/hub/models--ccore--Qwen3.5-4B-3D-Coder
```

| Artifact                          | Size             |
| :-------------------------------- | :--------------- |
| `Qwen3.5-4B-3D-Coder-Q4_K_M.gguf` | 2.71 GB          |
| `mmproj-Qwen3.5-4B-BF16.gguf`     | 0.68 GB          |
| Total                             | 3.4 GB (3.2 GiB) |

`GB` is the decimal unit (10^9 bytes); `GiB` is the binary unit (2^30 bytes).

No script writes a model file. Delete the folder to reclaim the space.

## Memory

The machine has 30 GiB of shared memory and no discrete GPU. The 4B `Q4_K_M` weights take about
3.4 GB (3.2 GiB). The 65,536-token context adds its key-value cache in the same memory. `-ngl all`
on a Vega 8 changes where the layers run, not the memory ceiling. One slot (`-np 1`) keeps one
request in flight, so the memory stays predictable.
