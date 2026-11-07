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

## Evidence rules

- A stage ends with the `.glb` and one WebP per named view. Numbers alone cannot be judged.
- Every capture pass uses one browser session and closes it. `ctl.ts close` ends it. `shot.ts` and
  `check.ts` close their own, even on failure.
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
