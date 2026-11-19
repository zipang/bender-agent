# T0019 — The `blender-modeler` skill, and its evaluation phase

- **Track**: Blender workflow (evaluation), skills, agent definitions
- **Wave**: 3 (evaluation)
- **Depends on**: nothing; the blueprint package is the input, not a ticket
- **Blocks**: the first `blender-modeler` run on a complete blueprint
- **Owner**: Bender, agent and document work
- **Started**: 2026-11-19
- **References**:
    - <https://github.com/calebrisc/blender-modeler> — the upstream skill, MIT, by Cale Briscoe.
      Its `README.md` states the two modes, the four stages, and the headless launcher
      `python scripts/bmod.py --model model.py --out out --mode both`.
    - the vendored copy: [`../../.agents/skills/blender-modeler/`](../../.agents/skills/blender-modeler/)
    - [`../../AGENTS.md`](../../AGENTS.md) — the blueprint rules, the dimension rule, and the gates
    - [`../../workflows/blender/README.md`](../../workflows/blender/README.md) — section 4, the phase
    - [`../../.opencode/agents/bender.md`](../../.opencode/agents/bender.md) — workflow F

## Context & Goal

The Three.js workflow builds a stylized asset from sections, and it is the production path. It is
weak where a form must be blended: rounded furniture, cast housings, a prop with a fillet on every
edge. Blender is the tool for those forms, and the project has no measured method for it: the
`blender-mcp` skill holds the tool catalog and nothing else.

`blender-modeler` supplies that method: one spec, one editable `model.py`, a geometry check that
returns numbers, eight fixed review views, and a gate per stage. The goal of this ticket is to
**vendor the skill, and to make its use explicit** in the repository, so that a modelling phase can
run from a complete blueprint folder and be judged on facts.

The phase is an **evaluation**. It produces no delivered asset, and it replaces no gate.

## Scope Boundary

| File                                         | Change                                                               |
| :------------------------------------------- | :------------------------------------------------------------------- |
| `.agents/skills/blender-modeler/**`          | the vendored skill, unmodified upstream files                        |
| `.agents/skills/blender-modeler/README.md`   | one provenance note, and the dead image table removed                |
| `.opencode/agents/blender-modeler-runner.md` | new sub-agent: one skill, one stage, one report                      |
| `.opencode/agents/bender.md`                 | workflow F, and two selection rows                                   |
| `workflows/blender/README.md`                | section 4, the phase; sections 5 and 6 renumbered                    |
| `workflows/blender/AGENTS.md`                | one paragraph: the phase is not the MCP path                         |
| `AGENTS.md`                                  | one paragraph: the evaluation is the only exception to the gate rule |
| `README.md`                                  | the skills row, and the Blender workflow state                       |

## Contract

1. `.agents/skills/blender-modeler/` holds `SKILL.md`, `references/`, `scripts/`, `tests/`,
   `LICENSE`, `CHANGELOG.md`, `README.md`, and `.gitignore`. The two example images of upstream
   `docs/` are **not** vendored: a 2.4 MB binary needs the approval of the art director.
2. `SKILL.md` keeps its frontmatter, so the skill loads as `blender-modeler`.
3. `.opencode/agents/blender-modeler-runner.md` declares `mode: subagent`,
   `model: openrouter/qwen/qwen4-max`, and a skill policy that allows `blender-modeler` only.
4. The runner writes only under `blueprints/<category>/<subject>/model/<asset>-blender/`, and never
   reads a dimension from a view image.
5. `bender.md` holds workflow F: F1 proves the blueprint complete, F2 asks five questions in one
   pass, F3 dispatches one stage, F4 judges without accepting, F5 records the evaluation.
6. `workflows/blender/README.md` section 4 states the start condition, the roles, the stages, the
   report, and the limits of the phase.

## Gates

| Gate  | Check                                                                       | Result                                               |
| :---- | :-------------------------------------------------------------------------- | :--------------------------------------------------- |
| G19.1 | the upstream suite passes on the vendored copy, headless, on this machine   | 19 of 19 tests, Blender 5.3.0                        |
| G19.2 | `bmod.py --where` selects the Blender executable                            | `/usr/bin/blender`, Blender 5.3.0                    |
| G19.3 | the skill loads, and its description states when to use it                  | `blender-modeler` is in the skill list               |
| G19.4 | every document that names the phase agrees on the paths and the stage names | the five documents read back, one table per document |
| G19.5 | the runner declares no skill except `blender-modeler`                       | the frontmatter, read by the art director            |

## Test plan

1. `python3 .agents/skills/blender-modeler/scripts/bmod.py --where` — prints the executable.
2. `python3 tests/run_tests.py` in the skill folder — drives Blender headless, about 30 s.
3. A read of the five documents, against the contract above.
4. The first real check is the first dispatch on a complete blueprint. This ticket does not run it:
   the art director chooses the subject.

## Evidence

- the upstream suite, 2026-11-19: `RESULT 19 0`, `All tests passed`, Blender 5.3.0.
- the same suite writes its scratch images to `/tmp/blender_modeler_tests/`. They are not evidence of
  this repository, and the skill owns that path.
