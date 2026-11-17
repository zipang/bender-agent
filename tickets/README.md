# Tickets

The Kanban board of this repository. A ticket is one unit of work: a specification, its scope, its
tests, and the gates it must pass. A ticket is not research, and it is not a record of what the
project does.

## The board

| Folder         | Meaning                                                                 |
| :------------- | :---------------------------------------------------------------------- |
| `planned/`     | specified, and ready to pick up                                         |
| `in_progress/` | being implemented. One owner per ticket                                 |
| `review/`      | implemented, reviewed, and every gate green. Waits for the art director |
| `done/`        | accepted, committed, and closed. The evidence stays beside the ticket   |

A ticket moves forward one folder at a time. It moves back to `in_progress/` when a gate fails, or
when the art director asks for a change.

## Names and IDs

- A ticket file is named `TNNNN-short-kebab-title.md`, for example `T0003-accessory-exclusion.md`.
- The ID counts up and is never reused. Find the next free ID by scanning every folder under
  `tickets/`.
- **The next free ID is `T0017`.**
- A commit subject quotes the ID: `✨ feat: <summary> (T0003)`.
- A ticket keeps its evidence beside it: a JSON record, a render, a contact sheet. Evidence is never
  deleted and never archived.
- A closed ticket is never rewritten. A later change is a new ticket that points at it.

## The board, today

### Planned

| ID                                                         | Title                                                                   | Track                                     | Depends on                                                                            |
| :--------------------------------------------------------- | :---------------------------------------------------------------------- | :---------------------------------------- | :------------------------------------------------------------------------------------ |
| [T0009](./planned/T0009-measure-a-distance-rubber-band.md) | Measuring a distance: an anchor, a rubber band, and the length          | Three.js viewer (measurement)             | T0004, T0005 — **draft, specification settled, awaits validation**                    |
| T0010                                                      | `bun run check` runs on committed render fixtures, not the live scene   | Three.js viewer (tools)                   | nothing — **the ticket file is missing from `planned/`; the row is kept as a marker** |
| [T0012](./planned/T0012-qwen3d-coder-glb-asset.md)         | The Qwen 3D Coder workflow, part two: a `.glb` out of a reference image | Qwen 3D Coder workflow (asset generation) | T0011                                                                                 |
| [T0016](./planned/T0016-qwen3d-coder-ts-asset.md)          | The Qwen 3D Coder delivers a TypeScript asset                           | Qwen 3D Coder workflow                    | T0013, T0015                                                                          |

T0003, T0005, and T0004 all touch `picker.js`, so they ran in that order. T0003 gave the left button
to the camera on both families — a left drag pans, a `Shift` + left drag orbits a free view — which is
what forced the two tickets after it: T0005 moved the measurement point to `Ctrl` + left click on
release, so a pan cannot drop one, and T0004 lets the knot editor borrow the left button inside a
knot's grab threshold. T0003 and T0005 are done; **T0004 is the last of the three.**

T0006 and T0007 were opened by the same diagnosis, and neither is on the critical path of the three
above. T0007 comes first because it is the one that makes the machine usable: the page renders every
frame unconditionally, so an idle tab burns nine of sixteen cores, every headless run pegs the box,
and a browser session that outlives its run keeps burning forever.

T0009 answers three gaps that T0005 left: the measurement tool cannot be turned on from the page,
nothing is drawn where a point lands, and the panel still states the pre-T0005 chord. Its eight
decisions (D1–D8) are settled with the art director and its contract is complete, but it is still a
draft: it awaits validation before it leaves `planned/`. It comes after T0004 because the two share
`picker.js` and the canvas `pointerdown`.

T0011 and T0012 open a second question: what a 4B model is worth to this repository. They add a
**fourth workflow**, `workflows/qwen3d-coder/`, beside Three.js, Blender, and vcad. It is its own
tool: it starts where the other modelling workflows start, on a subject with reference images, and it
holds its own rules and its own documents. T0011 drafts a **scene** as a standalone `.html`; T0012
drafts an **asset** and exports it to `.glb`. Both produce unmeasured, stylized candidates that the
art director judges by eye. Both have **no fidelity gate**, and neither replaces workflow D. T0012
comes second because it reads the client and the preflight that T0011 builds.

T0014, T0015, and T0016 answer a decision of 2026-11-17: the Qwen 3D Coder stops writing a page,
and delivers **one TypeScript asset** that a shared viewer draws. T0014 renames `scripts/` to
`tools/`, because the viewer is read by two workflows and belongs to the root. T0015 builds the base
page at `tools/scene-viewer/`: the style and the round grid of the Three.js viewer, six orthographic
views and one free view, six HUD rows, and a spin. T0016 turns the drafter into `asset-draft.ts`,
adds the asset contract to the prompts, and rewrites Workflow E of `bender.md`. The order is strict:
the rename, then the viewer, then the drafter. T0016 also waits for T0013, because both edit the
prompt system. The Three.js viewer stays where it is; a later ticket moves it onto the shared base.

The inference server is not part of this repository. T0011 first shipped one in
`scripts/llama-server/` and removed it inside the same ticket: the workflow now reads an **external
OpenAI-compatible endpoint**, named by `--base-url` and `--model`. The endpoint is a prerequisite of
its operator, so no machine, unit, or path enters the documents.

The first real run generated 3 898 tokens at 32.0 tokens per second, over 125 s with the cold load
included. The art director kept the output as a demo, and T1.13's acceptance run waits for a subject
with a locked reference.

### In progress

Nothing is in progress. Everything is in `review/`, `planned/`, or `done/`.

### Review

| ID                                                     | Title                                                                         | Track                                              | Note                                                                                                |
| :----------------------------------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| [T0004](./review/T0004-knot-marquee-selection.md)      | Knot editing by marquee selection: select, move, delete                       | Three.js viewer                                    | all gates green; independent review passed after polish; the handle layering fix (T4.10) is in      |
| [T0011](./review/T0011-qwen3d-coder-workflow.md)       | A fourth workflow: Qwen 3D Coder, an external endpoint, and the scene drafter | Repository layout, then the Qwen 3D Coder workflow | all gates green; reviewed after polish; T1.13 deferred to the first subject with a locked reference |
| [T0013](./review/T0013-prompt-system-and-text-mode.md) | Our prompt system, and a text-only prompt mode                                | Qwen 3D Coder workflow (prompt, drafter)           | gates green (90 workflow tests); browser judgement still open                                       |

### Done

| ID                                                            | Title                                                                     | Track                             | Closed     |
| :------------------------------------------------------------ | :------------------------------------------------------------------------ | :-------------------------------- | :--------- |
| [T0001](./done/T0001-workflow-reorganisation.md)              | Workflow reorganisation: one folder per workflow                          | repository layout, all workflows  | 2026-11-09 |
| [T0002](./done/T0002-contour-smoothing.md)                    | Contour smoothing: the path, the two joins, and the knot editor           | Three.js contour and volume       | 2026-11-09 |
| [T0003](./done/T0003-orthogonal-view-zoom.md)                 | Zoom on the orthogonal views, 100 % to 400 %                              | Three.js viewer                   | 2026-11-09 |
| [T0007](./done/T0007-viewer-idles-at-zero.md)                 | The viewer idles at zero: draw on demand, not every frame                 | Three.js viewer                   | 2026-11-09 |
| [T0006](./done/T0006-check-progress-and-orientation-guard.md) | `check.ts` reports its progress, and its orientation guard stops crawling | Three.js viewer (tools)           | 2026-11-09 |
| [T0008](./done/T0008-silhouette-report-presentation.md)       | The silhouette report says what it means                                  | Three.js viewer (tools)           | 2026-11-09 |
| [T0005](./done/T0005-measurement-pick-invocation.md)          | How a measurement point is invoked: Ctrl + left click, on release         | Three.js viewer                   | 2026-11-09 |
| [T0014](./done/T0014-root-tools-directory.md)                 | The root tool directory: `scripts/` becomes `tools/`                      | repository layout, every workflow | 2026-11-17 |
| [T0015](./done/T0015-scene-viewer.md)                         | The scene viewer: one page for a delivered asset                          | Shared scene viewer               | 2026-11-18 |

T0002 closes with two items open on purpose. They are not tickets yet:

- **Step 5, partial.** The page builds the contour volume, and the offline hull still reads the
  photograph. The two bodies — `model` and `volume` — are not reconciled.
- **§6.6, open defect.** The contour captures the accessories. The mask that removes them also moves
  the body edge where the two meet, and no route is chosen.

## Work not yet ticketed

A subject the art director raised, and no ticket holds it:

- The `front` witness disagrees with the volume (IoU 0.918 on the traced contour, 0.796 on a reduced
  one). The model sits outside the reference along both shoulders.
- The knot editor is hard to use, beyond the missing zoom that T0003 adds and the marquee selection
  that T0004 adds: one view at a time, 9 px handles with no hover, and no undo.

## Ticket template

```markdown
# TNNNN — Title

- **Track**: <component or subsystem, as the workflow's AGENTS.md defines it>
- **Wave**: 1 (independent) or 2 (integration)
- **Depends on**: ticket IDs, or `nothing`
- **Blocks**: ticket IDs, or `nothing`
- **References**: the product, design, and method documents the ticket reads, and the official
  documentation URL of every third-party API the ticket calls

## Context & Goal

Why this change is needed, and what "done" means for the product.

## Scope Boundary

The exact files and directories the ticket may create or modify. What is out of scope. Which shared
files are append-only.

## Contract

The types, the interfaces, the payloads, the state transitions, and the invariants. Tests are written
against this section. A third-party call quotes its documented signature and the URL it came from.

## TDD Tasks

- [ ] **Tn.1 — <spec group>**: the failing tests first ...
- [ ] **Tn.2 — <edge cases>**: the failing contract tests ...
- [ ] **Tn.3 — Implementation**: the modules and the wiring ...
- [ ] **Tn.4 — Gates**: the format, lint, typecheck, and test commands of `AGENTS.md` ...

## Acceptance Criteria

Observable, testable outcomes. Never internal implementation detail.
```

An `## Implementation Notes` section is appended at the bottom when work starts or completes. It
records the decisions, the deviations, the review feedback addressed, and the exact gate output.
