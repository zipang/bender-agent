# The Three.js workflow: agent rules

Rules for an agent that works in `workflows/threejs/`. They are short on purpose. The tutorial is in
[`README.md`](./README.md). This file holds what must not be broken.

## The pass, in order

1. Read the reference images with `read`, and the subject's `notes.md`.
2. Run the free check of the generator, `--ask`. It sends no request and lists the gaps.
3. Ask the art director everything in one call. Never invent a choice that belongs to the art
   director: the subject note, the style, the model, the number of variants.
4. Report the answers, the command, and the price. Then run it.
5. Hand the candidates back with a link and one line of description per file. Wait for the choice.
6. Never choose a candidate, and never promote one that was not named.

## Scene rules

- A scene is `scene.json` plus `model.js`, and no build step.
- `model.js` imports `three` only. No DOM, no renderer, no network, no `fetch`.
- Never add a page or a script under `scenes/`. A scene is data plus a model module, and everything
  that draws belongs to `viewer/`.
- Never edit `viewer/` to look from another angle. Drive the page with `tools/ctl.ts`.
- The page draws **on demand**. `renderer.setAnimationLoop` is the only clock, and it runs only while
  there is a reason: a pending change, a caller waiting for a frame, or the active `OrbitControls`'
  `change` event (which also fires while damping decays the inertia). It **stops** when none is left.
  Never render every frame, and never skip behind an early return. Run
  `bun run workflows/threejs/tools/check_idle.ts` after a change to the loop.
- Keep the authoring source of a scene committed. Keep its renders and its `.glb` local.

## The three gates

- No stage starts before the previous gate passes. No gate is softened to make it pass.
- The real dimensions are an **input**: a specification sheet, a measurement, or a decision. Never
  read them from the views the model will be checked against, or the check becomes circular.
- Stage 2 builds the body only, and cuts no hole. A hole changes the silhouette, and G2 measures the
  silhouette.
- Stage 3 adds one accessory per pass: measured, modelled apart, validated alone, then oriented and
  translated onto the body as its own named node. Never merge it into the body mesh.
- `bottom` is optional. It informs, it does not decide, and it does not enter a gate.

## Measurement rules

- Judge a body on its **binary silhouette**, never on a shaded render.
- Check that both images show the same flank before reading any delta. A mirrored comparison still
  looks plausible.
- Flat views use the orthographic camera. A perspective camera cannot line up with an orthographic
  reference.
- Calibrate a calque on the **subject box**, never on the cropped file: the crop keeps a margin.
- Measure in model units, not pixels.
- A distance is read from a tool, never estimated by eye.
- A gate measured on one view is half-measured. Write `not measured` for the others and fail it.

## Camera rules

- The flat views zoom and pan through a **second** `OrbitControls` bound to the orthographic camera.
  Never hand-write a wheel listener, a zoom clamp, a cursor-anchoring formula or a pan vector: the
  library's own gesture is the only implementation.
- Both instances are configured from **one frozen `SHARED` table** in `camera.js`. `enableRotate` is
  the single difference: `true` on the free view, `false` on the flat one.
- `mouseButtons` is `LEFT` pan, `MIDDLE` dolly, `RIGHT` unbound. `Shift` + left drag orbits a free
  view and is inert on a flat one: this swap is in the `OrbitControls` source and not in its
  documentation, it is pinned to r187, and `tools/check_zoom.ts` asserts it so a version bump fails.
- A named view and a capture are always **100 %** and centred. `orthoHeight` is the 100 % frame
  height; the visible height at any zoom is `orthoHeight / zoom`.
- Run `bun run workflows/threejs/tools/check_zoom.ts` after a camera change. It exits non-zero on the
  first failed assertion.

## Contour rules

- The drawn contour reads the **picture**; the hull reads the **opened intervals**. The two are
  separate on purpose: no drawing choice may move the volume.
- The contour is the **boundary walk** of the region, not one `lo`/`hi` pair per pixel column. A
  column pair cannot express an edge that runs along the rows.
- A contour is a **path**, not a point list: `start`, then `L` and `C` segments.
- `--tolerance` decides the shape, `--pitch` only the resolution. Never pass a pitch as if it were a
  tolerance.
- `poly` and `bezier` read **one** path. A second fit is a second dataset, and a comparison between
  two datasets proves nothing.
- Print the measured deviation. A fit that meets its tolerance is a fact about the output, not a
  claim about the algorithm.
- Choose a tolerance on a rendered contact sheet, never from a table.
- A step that moves an edge must not also redefine **which** edge it is.
- Judge a contour against the volume it produces, not against itself. The `volume` layer rebuilds
  the intersection of the three paths, so a simplification is measured on the surface it changes.
- A used view agrees with its own contour by construction. **The witness views are the
  measurement.** Never report a contour result from `left`, `back` and `top` alone.
- One function places a view: `viewer/plate.js`. The plate and the extruded prism read it, so the
  picture and the volume cannot drift by the crop margin.
- One function flattens a path: `viewer/path.js`. A second flattening is a second outline.

## Knot rules

- The contour is a list of **knots**: points the outline passes through. `scenes/<sub>/contours.js`
  holds them. A knot is not an off-curve handle.
- The knots are the **source**. `poly` and `bezier` are two joins of the SAME knots, so a switch
  between them moves the line between two knots and never a knot itself.
- A view absent from `contours.js` keeps its traced path. The feature is non-destructive: the first
  edit seeds the knots from the traced path's on-curve vertices.
- `reduce` re-derives from the **traced ring** every time, never from the current knots. Two reduces
  in a row must give the same answer as one.
- The join of a fresh seed is `poly`. Straight lines through the traced vertices reproduce the
  accepted fit to within its tolerance; a Catmull-Rom through the same points bulges past it.
- The volume reads the knots. A knot edit rebuilds the volume; a knot **drag** rebuilds the outline
  only, and the volume on release, because the intersection costs about two seconds.
- One reader of the file, one writer: `viewer/knots.js` joins; the viewer's `save` command writes
  through `POST /api/contours`. Never hand-edit `contours.js` and never let a second tool write it.

## Evidence rules

- A stage ends with the `.glb` and one WebP per named view. Numbers alone cannot be judged.
- A check writes what a human reads into `test-reports/` at the repository root: the overlays, the
  scratches, the contact sheets. It is git-ignored and rebuilds from a check. A path the terminal
  prints is relative to the root, never absolute. A caller may still pass an absolute `--out`.
- Every capture pass uses one browser session and closes it. `ctl.ts close` ends it. `shot.ts`,
  `check.ts`, `check_zoom.ts` and `check_idle.ts` close their own, even on failure, and on `Ctrl-C`
  too. One helper owns the session: `tools/session.ts`. It closes in a `finally`, on `SIGINT` and on
  `SIGTERM`, names the session with the process id, sweeps a session of a dead run at open, and
  bounds every `agent-browser` call with a timeout. A wedged browser fails loudly, it never waits
  forever.
- Capture in capture mode (`?shot=1`). Without it the page draws the ground, the grid and the HUD,
  and a silhouette mask then reads the gradient background as subject.
- Describe a render in one line, and say that it is a description, not a verdict.

## Document rules

- A change that adds a tool, a flag, a file, or a gate updates this workflow's `README.md` and
  `AGENTS.md` in the same commit.
- A new project word gets an entry in the root `README.md`, in alphabetical order.
- Write prose in Simplified Technical English. Keep chat answers in the user's language.

## Server and path rules

- The root is computed once, in `tools/paths.ts`. Never compute it again in a tool.
- A tool that only this workflow runs lives in `tools/`. A tool that every workflow reads lives under
  `scripts/`. A tool is never placed by convenience.
- A scene is named by its directory name, and only by that name: `?scene=r5-tl-1972`. Never a path,
  never a second spelling.
- A scene module is served at its real path. An alias hides the one thing an import failure needs.
- The subject watch ignores `model/`: an output never reloads its own reader.
- `bun run serve` and `bun run check` are the two root commands. They are the ones the documents
  quote.
