# T0020 — Ford Capri Mk III Blueprint Commit

- **Track**: blueprint-rules
- **Wave**: 1
- **Depends on**: nothing
- **Blocks**: nothing
- **References**: AGENTS.md, README.md, tickets/README.md, tools/blueprint/crop_reference.py, tools/blueprint/view_scale.py, workflows/threejs/tools/trace_hull.py, .agents/skills/volume-modelling/SKILL.md

## Context & Goal

Commit the validated Ford Capri Mk III blueprint as a reference example of the complete workflow, after finalizing two rules:

1. A finalized reference is `reference.webp` and the only format kept — the original (JPEG/PNG) is converted, verified (lossy: q92, RMSE < 2/255; lossless: lossless WebP, byte-identical decode-back), then removed.
2. `cropped/<view>.webp` is a committed modelling input, written lossless WebP and verified by `crop_reference.py` (decode-back byte-identical). `measured/` and `test-reports/` stay derived and local.

## Scope Boundary

**In scope:**

- `blueprints/vehicules/ford-capri-mk-iii/` (entire subject folder, excluding `measured/` which is derived/local)
- `blueprints/vehicules/r5-tl-1972/` (converted references + crops)
- `blueprints/vehicules/blue-and-white-minivan-01/dimensions.json` (updated crop paths)
- Tools: `tools/blueprint/crop_reference.py`, `tools/blueprint/view_scale.py`, `workflows/threejs/tools/trace_hull.py`
- Configuration: `.gitignore` (whitelists `cropped/`, `cropped/*.webp`, `cropped/manifest.json`)
- Documentation: `AGENTS.md`, `README.md`, `workflows/threejs/README.md`, `.agents/skills/volume-modelling/SKILL.md`

**Out of scope:**

- `workflows/threejs/scenes/r5-tl-1972/contours.js` (modified but left untouched)
- `models/` (untracked, local only)
- `blueprints/vehicules/ford-capri-mk-iii/measured/` (derived, stays local)

## Contract

- `reference.webp` is the only reference format kept; original `.jpg`/`.jpeg`/`.png` removed after verification.
- All `cropped/<view>.webp` files are lossless WebP, verified by `crop_reference.py` decode-back comparison.
- `dimensions.json` paths updated to `.webp` for all three subjects.
- `view_scale.py --write` ran on all six required views → `scales: pass`, `g1: pass`.
- `measurements.json` records wheelbase landmark on `right` (horizontal/kx) and `top` (vertical/ky) — spread 1.69%.
- Gate G1 passes: real dimensions anchored by manufacturer figures (length 4.376 m, width 1.698 m, height 1.298 m; wheelbase 2563 mm; tracks 1363/1394 mm; tyres 195/60 R14).

## TDD Tasks

- [ ] **T20.1 — Verification**: `find blueprints -path "*/cropped/*" -name "*.png"` returns 0; `find blueprints/vehicules -name "reference.png" -o -name "reference.jpg" -o -name "reference.jpeg"` returns 0.
- [ ] **T20.2 — Crop integrity**: `crop_reference.py` decode-back verification passes on all cropped files (lossless, byte-identical).
- [ ] **T20.3 — Scales**: `view_scale.py --write` on all six views exits 0; `dimensions.json` shows `scales: pass`, `g1: pass`.
- [ ] **T20.4 — Landmark**: wheelbase spread 1.69% on `right`/`top`; `report.py --annotate --write` reports `g1: pass`.
- [ ] **T20.5 — Documentation**: AGENTS.md, README.md, workflows/threejs/README.md, volume-modelling SKILL.md reflect the new rules.

## Acceptance Criteria

- Six required views locked in `blueprints/vehicules/ford-capri-mk-iii/{front,back,left,right,top,bottom}/reference.webp`; `rear-3q/reference.webp` auxiliary.
- All three subjects (`ford-capri-mk-iii`, `r5-tl-1972`, `blue-and-white-minivan-01`) use `reference.webp` only.
- `cropped/` committed with lossless WebP + `manifest.json` for all three subjects.
- `dimensions.json` updated, G1 passes, spread < 2%.
- Tool fixes applied: lossless crop output + verification, trace_hull reads .webp with .png legacy fallback, view_scale uses `spread_pct`.
- Documentation updated per new rules.
- Commit subject: `✨ feat: commit Ford Capri blueprint + reference.webp rule + lossless crops (T0020)`.
- `workflows/threejs/scenes/r5-tl-1972/contours.js` and `models/` remain untouched.
