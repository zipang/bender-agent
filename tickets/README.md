# Tickets

The Kanban board of this repository. A ticket is one unit of work: a specification, its scope, its
tests, and the gates it must pass. A ticket is not research, and it is not a record of what the
project does.

## The board

| Folder | Meaning |
| :--- | :--- |
| `planned/` | specified, and ready to pick up |
| `in_progress/` | being implemented. One owner per ticket |
| `review/` | implemented, reviewed, and every gate green. Waits for the art director |
| `done/` | accepted, committed, and closed. The evidence stays beside the ticket |

A ticket moves forward one folder at a time. It moves back to `in_progress/` when a gate fails, or
when the art director asks for a change.

## Names and IDs

- A ticket file is named `TNNNN-short-kebab-title.md`, for example `T0003-accessory-exclusion.md`.
- The ID counts up and is never reused. Find the next free ID by scanning every folder under
  `tickets/`.
- **The next free ID is `T0004`.**
- A commit subject quotes the ID: `✨ feat: <summary> (T0003)`.
- A ticket keeps its evidence beside it: a JSON record, a render, a contact sheet. Evidence is never
  deleted and never archived.
- A closed ticket is never rewritten. A later change is a new ticket that points at it.

## The board, today

### Planned

| ID | Title | Track | Depends on |
| :--- | :--- | :--- | :--- |
| [T0003](./planned/T0003-orthogonal-view-zoom.md) | Zoom on the orthogonal views, 100 % to 400 % | Three.js viewer | T0002 |

### In progress

No ticket.

### Review

No ticket.

### Done

| ID | Title | Track | Closed |
| :--- | :--- | :--- | :--- |
| [T0001](./done/T0001-workflow-reorganisation.md) | Workflow reorganisation: one folder per workflow | repository layout, all workflows | 2026-11-09 |
| [T0002](./done/T0002-contour-smoothing.md) | Contour smoothing: the path, the two joins, and the knot editor | Three.js contour and volume | 2026-11-09 |

T0002 closes with two items open on purpose. They are not tickets yet:

- **Step 5, partial.** The page builds the contour volume, and the offline hull still reads the
  photograph. The two bodies — `model` and `volume` — are not reconciled.
- **§6.6, open defect.** The contour captures the accessories. The mask that removes them also moves
  the body edge where the two meet, and no route is chosen.

## Work not yet ticketed

A subject the art director raised, and no ticket holds it:

- The `front` witness disagrees with the volume (IoU 0.918 on the traced contour, 0.796 on a reduced
  one). The model sits outside the reference along both shoulders.
- The knot editor is hard to use, beyond the missing zoom that T0003 adds: one view at a time, 9 px
  handles with no hover, no live count while dragging, and no undo.

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
