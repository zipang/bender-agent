# T0015 — The scene viewer: one page for a delivered asset

- **Track**: Shared scene viewer (the base of two workflows)
- **Wave**: 1 (independent of the drafter)
- **Depends on**: T0014 (the root `tools/` directory)
- **Blocks**: T0016 (the Qwen 3D Coder asset drafter)
- **Owner**: coding sub-agent, supervised by CTO
- **Started**: 2026-11-17
- **Validation**: 2026-11-17 to 2026-11-18 — eight review amendments (R1 to R8) by the art director,
  all inside `review/`; the ticket never left the review column
- **Closed**: 2026-11-18
- **Evidence**: `T0015-spin-pole-inverted-axes.png` — the rolled free view reported in R8
- **References**:
    - [`workflows/threejs/viewer/index.html`](../../workflows/threejs/viewer/index.html) — the style, the HUD, and the view bar to simplify
    - [`workflows/threejs/viewer/main.js`](../../workflows/threejs/viewer/main.js) — the composition to reduce
    - [`workflows/threejs/viewer/stage.js`](../../workflows/threejs/viewer/stage.js) — the stage, the lights, the round ground, and the loop
    - [`workflows/threejs/viewer/camera.js`](../../workflows/threejs/viewer/camera.js) — the two cameras, the two controls, and the `SHARED` table
    - [`workflows/threejs/viewer/frame.js`](../../workflows/threejs/viewer/frame.js) — the frame coefficients
    - [`workflows/threejs/AGENTS.md`](../../workflows/threejs/AGENTS.md) — the camera rules and the draw-on-demand rule
    - [`AGENTS.md`](../../AGENTS.md) — the 3D conventions, and the file rules
    - `Bun.Transpiler`:
      <https://bun.com/docs/api/transpiler> — `new Bun.Transpiler({ loader: "ts" })`,
      `.transformSync(code: string): string`, and "the transpiler does not resolve modules or execute
      the code. The result is a string of vanilla JavaScript code."
    - `Bun.serve`:
      <https://bun.com/docs/api/http> — `Bun.serve({ port, development, fetch })`, `server.port`, and
      `server.stop(closeActiveConnections?)`.
    - `Box3.setFromObject(object: Object3D, precise?: boolean): this`, `getSize(target: Vector3)`, and
      `getCenter(target: Vector3)`:
      <https://threejs.org/docs/#api/en/math/Box3>
    - `WebGLRenderer.setAnimationLoop(callback: ((time: number) => void) | null)`:
      <https://threejs.org/docs/#api/en/renderers/WebGLRenderer.setAnimationLoop>
    - `Object3D` — `isObject3D`, `traverse(callback)`, `name`:
      <https://threejs.org/docs/#api/en/core/Object3D>
    - `Group`: <https://threejs.org/docs/#api/en/objects/Group>
    - `OrbitControls` — `enabled`, `target`, `update(deltaTime?)`, `pan(deltaX, deltaY)`, `minZoom`,
      `maxZoom`: <https://threejs.org/docs/#examples/en/controls/OrbitControls>
    - Import maps:
      <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap>
    - Dynamic `import()`:
      <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import>

## Context & Goal

The Qwen 3D Coder workflow must review what the model delivers. Today the model writes its own HTML
page, so it also writes its own camera, its own lights, and its own ground, and no two candidates
can be compared. The art director decided on 2026-11-17: **the model delivers one asset, and the
repository draws it**.

This ticket builds the page that draws it. It is the **base** of the shared viewer, not the finished
viewer. It has the same style, the same round grid, the same HUD, and the same named-view behaviour
as the Three.js viewer, and it drops everything the Three.js workflow adds: the calque, the contour,
the knot editor, the volume, the measurement, and the marquee. The Three.js workflow keeps its own
viewer until a later ticket moves it onto this base.

**Done means** one command opens one page, the page lists every candidate it can draw, the art
director picks one, the page frames it from its own bounding box, and offers six orthographic views,
one free view, and a continuous spin.

Two facts from a real candidate, `blueprints/vehicules/red-sportster/generated/qwen3D-01.ts`, settle
two parts of the contract. First, that file omits the `three` import, so the page would fail on a
module that is otherwise correct: the server adds the import when it is missing, and the contract
says so. Second, the file is one of several candidates in several subjects, and a path typed by hand
does not scale: the server publishes a catalogue, and the page offers it. The candidate also held a
syntax error (`new THREE.Mesh[]`); the art director repaired that line on 2026-11-17, because a
generated file is not a source of truth. A syntax error is still reported, never repaired.

## Scope Boundary

**Create:**

```text
tools/scene-viewer/
├── index.html          the page: the style, the HUD, the view bar, the error box
├── main.js             the composition: the asset, the stage, the rig, the bar, the spin
├── stage.js            the renderer, the environment, the lights, the ground, the HUD, the loop
├── camera.js           the two cameras, the two controls, the named views, the spin
├── frame.js            the frame of a bounding box, and the frozen coefficients
├── measure.js          triangles, meshes, size, and centre of an `Object3D`
├── contract.js         the asset contract check
├── spin.js             the pure spin math
├── views.js            the fixed view table: six orthographic presets and one free view
├── catalogue.ts        the list of candidates: discovery, and the validity of each
├── prelude.ts          the `three` import added when a module has none
├── server.ts           the routes and `createServer()`: the page, the catalogue, the three build, the transpiled asset
├── serve.ts            the CLI: the flags, the listen, and the two printed paths
├── fixtures/cube.ts    one valid asset, with its `three` import
├── fixtures/no-import.ts   one valid asset without the import, for the prelude
├── fixtures/broken.ts  one module with a syntax error, for the catalogue and the error box
├── frame.test.js
├── measure.test.js
├── contract.test.js
├── spin.test.js
├── views.test.js
├── camera.test.js
├── catalogue.test.ts
├── prelude.test.ts
└── server.test.ts
```

**Repair, on 2026-11-17, outside the commit:** line 12 of
`blueprints/vehicules/red-sportster/generated/qwen3D-01.ts` becomes
`const voxelDetails: THREE.Mesh[] = [];`. That file is **committed evidence, not a source file**:
`.gitignore` un-ignores it on purpose (`!blueprints/vehicules/red-sportster/generated/qwen3D-01.ts`),
and commit `d6912c2` ("keep one generated asset to prove the catalogue reads it (T0015)") added it
with that repair. The ticket records the repair because AC9 opens that candidate. The formatter owns
the file: `bun run format` may reformat it, and its transpiled output does not change. Every other
line of that file is untouched. **Corrected 2026-11-17**: this paragraph said "a git-ignored
candidate … changes no tracked file", which `.gitignore` line 36 and `d6912c2` contradict.

**Modify:** `README.md` — the repository tree, one command block that runs the viewer, and four
glossary entries: **Asset catalogue**, **Scene viewer**, **Spin**, and **Root tool** (the root
`tools/`, read by several workflows, as opposed to `workflows/<name>/tools/`, read by one).
**Modify:** `package.json` — two scripts, added on 2026-11-17 by decision of the art director, so the
two viewers are launchable by name and cannot be confused:

```json
"serve:threejs": "bun run workflows/threejs/tools/serve.ts --scene r5-tl-1972 --port 5180",
"serve:viewer":  "bun run tools/scene-viewer/serve.ts"
```

The old `serve` name is gone. A script forwards its extra arguments, so
`bun run serve:viewer --asset <path>` reaches `serve.ts` unchanged.

**Modify:** `workflows/threejs/README.md` and `workflows/threejs/AGENTS.md` — the renamed command
only. The workflow rule "a change that adds a tool, a flag, a file, or a gate updates this workflow's
README.md and AGENTS.md" requires it, and the two files kept a `bun run serve` that no longer exists.
No code under `workflows/threejs/**` is touched.

**Do not touch:**

- `workflows/threejs/**` — its viewer stays the reference, and it keeps its own copy until the later
  migration ticket.
- `workflows/qwen3d-coder/**` — T0016 changes the drafter and its prompts.
- `tools/blueprint/**`, `tools/blueprint-generate/**`, `tools/measure/**` — T0014 moved them, and this
  ticket does not read them.
- `blueprints/**` — the catalogue **reads** the folder to list the candidates and the viewer reads
  one of them; this ticket writes no file there, and it changes no candidate except the one recorded
  above.

No shared file is append-only.

## Contract

### 1. The asset

An **asset** is one standalone TypeScript file. The viewer and T0016 share this contract, word for
word.

- It imports `three` only, as `import * as THREE from "three"`. No addon, no relative import, no
  URL.
- The viewer **tolerates the missing import**: a module that has no `import … from "three"` line is
  served with `import * as THREE from "three";` prepended. §11 defines the rule and its test. The
  contract still requires the line; the tolerance exists because a model forgets it and because the
  candidates that predate T0016 were written without a contract. A **syntax error is never
  repaired**: it is reported with the message `Bun.Transpiler` gives.
- It has one default export: `export default function build(): THREE.Object3D`. The call takes no
  argument, returns synchronously, and returns exactly one object. Use a `THREE.Group` for a
  multi-part object.
- The root origin is at the **centre of the base**, and the base sits at `y = 0`. `+Y` is up.
- The object **faces `+Z`**: its width runs along X, its depth along Z, and its height along Y. The
  six presets read that frame.
- One unit is **one metre**.
- It builds no camera, renderer, light, ground, grid, background, fog, overlay, or animation.
- It reads no file, no network, no DOM, no clock, and no random source.
- It names every node that can move. A name is unique inside the asset.
- `build()` is deterministic: two calls give the same triangle count, the same mesh count, and the
  same bounding box.
- TypeScript is syntax only. Bun strips the types; nothing type-checks the asset. No decorator, no
  JSX, and no `const enum`.

The fixture `fixtures/cube.ts` is the reference implementation: a one-metre cube on the ground,
inside a `Group` named `cube`, with a typed `interface` that must disappear from the served bytes.

### 2. The page (`index.html`)

Copy from `workflows/threejs/viewer/index.html`:

- the `:root`, `html`, `body`, and `canvas` rules;
- the two cursor rules, `body.pan-ready canvas` and `body.pan-dragging canvas`;
- the `#hud` block, with the same type, spacing, border, radius, and blur;
- the `#views` block, with the same buttons and `aria-pressed` styling;
- one `#error` box, styled like the box of `showFailure` in `workflows/threejs/viewer/api.js`.

Drop `#marquee`, `#layers`, `#knots`, and every `body.shot` rule. Keep the import map:

```json
{
	"imports": {
		"three": "/vendor/three/build/three.module.js",
		"three/addons/": "/vendor/three/addons/"
	}
}
```

The HUD keeps these six rows, in this order:

| Row      | Value                                                                   |
| :------- | :---------------------------------------------------------------------- |
| `view`   | the current view name, or `custom`                                      |
| `tris`   | the triangle count of the asset, grouped with `toLocaleString("en-US")` |
| `meshes` | the mesh count of the asset                                             |
| `draws`  | `renderer.info.render.calls` of the last drawn frame                    |
| `size`   | the bounding box in metres, `x × y × z`, two decimals                   |
| `zoom`   | the zoom as `NN %`, 10 % to 1000 %, on BOTH projections                 |

The page heading (`#hud h1`) and the document title are the asset slug: the file base name without
`.ts`. For `modernist-office-chair--01.ts`, the slug is `modernist-office-chair--01`.

The view bar has, from left to right: the **asset picker** (a `select`, §12), one button per view in
this order: `left`, `right`, `front`, `back`, `top`, `bottom`, `free`, a separator, then the **spin**
button: the label `spin`, the title `rotate the camera continuously around the object`, and
`aria-pressed`.

### 3. The view table (`views.js`)

```js
export const VIEWS = Object.freeze({
	left: { azimuth: 0, elevation: 0, perspective: false },
	right: { azimuth: 180, elevation: 0, perspective: false },
	front: { azimuth: 90, elevation: 0, perspective: false },
	back: { azimuth: 270, elevation: 0, perspective: false },
	top: { azimuth: 90, elevation: 89.99, perspective: false, up: [0, 0, -1] },
	bottom: {
		azimuth: 90,
		elevation: -89.99,
		perspective: false,
		up: [0, 0, -1]
	},
	free: { azimuth: 60, elevation: 30, perspective: true }
});

export const DEFAULT_VIEW = "free";
```

The order of the keys is the order of the bar. The table is fixed for both workflows; a later ticket
merges the Three.js table into it. The viewer reads no `scene.json`.

### 4. The measurement and the frame

> **Superseded by amendment R1 (§A1)**: `FRAME_COEFFICIENTS` is replaced by `STAGE_RULES`, and the
> ground, the grid, and the shadow no longer scale with the asset. `orthoHeight` and the throw stand.

```js
// measure.js
export function measureObject(root) →
	{ triangles: number, meshes: number, size: [number, number, number], target: [number, number, number] }
```

- `triangles` sums `geometry.index.count / 3`, or `geometry.attributes.position.count / 3` for a
  non-indexed geometry, over every `isMesh` node.
- `size` is `new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).toArray()`.
- `target` is the **centre** of the same box, from `.getCenter()`.
- All values are in metres.

```js
// frame.js
export const FRAME_COEFFICIENTS = Object.freeze({
	distance: 2.982,
	orthoHeight: 1.25,
	groundRadius: 2.556,
	gridSize: 3.408,
	shadowHalf: 1.278
});

export function frameFrom({ size, target }) →
	{ max, target, distance, orthoHeight, groundRadius, gridSize, shadowHalf }
```

`max` is the largest component of `size`. A non-finite or non-positive `max` throws
`frame: the asset has no measurable size`. Every distance is a coefficient times `max`, exactly as
`workflows/threejs/viewer/frame.js` computes it. The target is the centre of the box, in metres.

### 5. The camera rig (`camera.js`)

> **Superseded by amendment R1 (§A3)**: `minZoom`, `maxZoom`, and the distance pair follow
> `freeDistance`. The rest of the rig stands.

Copy `viewBasis` and the `SHARED` table of `workflows/threejs/viewer/camera.js`, with the three
differences this ticket states:

- `enableDamping: true`, `dampingFactor: 0.08`, `zoomToCursor: true`, `screenSpacePanning: true`;
- `minZoom: 1`, `maxZoom: 10`, `maxPolarAngle: Math.PI / 2`;
- `minDistance` and `maxDistance` are **derived from the frame**, not fixed: `minDistance =
frame.distance` and `maxDistance = frame.distance * 8`. The reference viewer hard-codes `3` and `24`
  for an asset whose frame distance is `2.982`, which is the same ratio at one scale. A fixed pair
  silently misframes any asset whose `max` is below `1.01 m` (the camera is pushed out) or above
  `8.05 m` (the dolly range is cut), and an asset has no fixed scale here. A test asserts the ratio on
  the cube and on a 10 cm asset.
- `mouseButtons: { LEFT: PAN, MIDDLE: DOLLY, RIGHT: null }`;
- `orbit.enableRotate = true`, `flat.enableRotate = false`; this is the first difference of the
  `SHARED` table, and it pins the undocumented `Shift` + left-drag swap of `OrbitControls` r187.
- `orbit.maxPolarAngle = Math.PI / 2`, and `flat.maxPolarAngle = Math.PI`. This is the second
  difference, and it is load-bearing: `OrbitControls.update()` clamps the polar angle, so a `bottom`
  preset at -89.99° snaps to the horizon under `π/2`. Measured on r187 with a target at `y = 0.5`:
  a camera at `y = -2` moves to `y = 0.5, z = 2.5` under `π/2`, and stays at `y = -2` under `π`. The
  flat controls never rotate, so the wider clamp is unreachable by a gesture. A test asserts it.

The rig returns the surface of the Three.js rig, minus the plate and knot hooks:

```js
createCameraRig({ views, frame, element, onManual }) → {
	camera, ortho, state, controls, flat,
	frameOrtho, applyCamera, placeCamera, onChange,
	zoomPercent, setZoom, panBy, resetFraming, reset, resize,
	spinStart, spinStep, spinStop,
	get activeCamera(), get activeControls()
}
```

- `placeCamera(name)` resets the framing to 100 % and the target to `frame.target`, then applies the
  preset. A named view is always 100 % and centred.
- `onManual` fires on the perspective `controls`' `start` event. The page sets the view to `custom`.
- A flat view zooms and pans through its own `OrbitControls`. The free view orbits with `Shift` +
  left drag, and pans with a plain left drag.
- `spinStart()` **reads the active camera back into the state** — `azimuth = atan2(offset.z,
offset.x)`, `elevation = asin(offset.y / |offset|)` and `distance = |offset|`, from
  `activeCamera.position - state.target` — then, when the current view is orthographic, sets
  `state.perspective = true` and calls `applyCamera()` with the state it just read. It finally
  disables both controls and clears the orbit inertia. Without that read, a spin started after a
  manual orbit or a wheel dolly snaps the camera back to the last preset angle, elevation and
  distance, and the first frame of the spin jumps. §A17 supersedes the projection swap: it no longer
  resets the framing.
- `spinStep(dtMs)` advances `state.azimuth` with `nextAzimuth` and places the perspective camera from
  the state, without running `OrbitControls.update()`.
- `spinStop()` re-enables the controls of the current projection, copies `state.target` into
  `orbit.target`, and calls `orbit.update()` once so the next drag starts from the spun position.

### 6. The spin (`spin.js`)

> **Superseded by amendment R1 (§A4)**: the step is subtracted, so the camera turns counter-clockwise.
> The period, the guards, and the normalization stand.

```js
export const SPIN_PERIOD_MS = 12_000;

export function nextAzimuth(azimuth, dtMs, periodMs = SPIN_PERIOD_MS): number
```

- One turn takes 12 s, so the camera moves 30° per second.
- A non-finite `dtMs`, or a `dtMs` at or below zero, returns the azimuth unchanged.
- The result is normalized into `[0, 360)`.
- `nextAzimuth(0, 12000) === 0`; `nextAzimuth(0, 3000) === 90`; `nextAzimuth(350, 600) === 8`;
  `nextAzimuth(0, 720000) === 0`.

The page state machine:

1. The spin is **off** when the page opens.
2. A press on `spin` turns it on. If the current view is orthographic, the rig switches to `free`
   first. `currentView` becomes `custom`.
3. The stage calls `rig.spinStep(dt)` on every animation-loop tick. The loop stays awake while the
   spin is on.
4. The spin stops on a second press, on a `pointerdown` on the canvas, or on a press of a view
   button. The camera stays where it stopped, and `currentView` stays `custom`.
5. The `pointerdown` handler is registered in the **capture** phase on the canvas, so it re-enables
   `OrbitControls` before the library handles the same gesture.
6. The wheel does nothing while the spin is on. A press on the canvas stops the spin, and the next
   wheel gesture zooms.

### 7. The stage (`stage.js`)

```js
createStage({ frame, report, rigRef }) → {
	renderer, scene, hud, updateHud, nextFrame, frames, bindRig,
	setRoot, setSpinning, readyOnSecondFrame, get root()
}
```

- The renderer is the same as the Three.js stage: antialias, `preserveDrawingBuffer`, pixel ratio
  capped at 2, ACES tone mapping at 1.05, `PCFShadowMap`.
- The scene is the same: background `0xeef0f2`, `RoomEnvironment` at 0.55, the key/fill/rim/hemisphere
  lights, the circular ground, and the `GridHelper` at y `0.001`. No capture mode.
- The loop is the Three.js loop: `setAnimationLoop` is the only clock, `dirty` and `waiters` are the
  reasons to draw, and the loop **stops** when no reason is left. The spin is a third reason.
- `tick(time)` keeps the previous timestamp. The first spin tick uses `dt = 0`. While the spin is on,
  the stage calls `rig.spinStep(dt)` and does **not** call `activeControls.update()`.
- `setSpinning(true)` calls `rig.spinStart()` and wakes the loop; `setSpinning(false)` calls
  `rig.spinStop()` and wakes the loop one last time.
- `frames()` returns `{ rendered, ticks }`, for the idle check.

### 8. The asset check (`contract.js`)

```js
export function checkAsset(module) → { build: Function | null, problems: string[] }
export function checkRoot(object) → string[]
export function describe(problems) → string
```

`checkAsset` requires `typeof module.default === "function"`. Its problem strings name the file and
the missing export. A named function re-exported as the default
(`export const build = () => …; export default build;`) passes: the check reads the default only.
`checkRoot` requires:

1. `object?.isObject3D === true`;
2. at least one `isMesh` node;
3. a finite, positive size on all three axes.

`describe` joins the problems with a newline and a two-space bullet, like the Three.js
`contract.js`.

### 9. The server (`server.ts`, and the `serve.ts` CLI)

```bash
bun run tools/scene-viewer/serve.ts [--asset <repo path>.ts] [--port 5181]
```

The same command by name is `bun run serve:viewer [flags]`, from the root `package.json`. The
Three.js viewer keeps `bun run serve:threejs`.

`--asset` is optional. When it is present it must end with `.ts`, must exist, must resolve inside the
repository root, and must not resolve inside `node_modules/`. A violation exits `1` and names the
reason. When it is absent, the page asks the catalogue and opens the first valid entry. `--port`
defaults to `5181`.

The server binds `127.0.0.1` only, so the URL it prints is the URL it answers on. `Bun.serve` binds
every interface by default, and `/asset/` serves any `.ts` under the repository root.

| Route                    | Answer                                                                                        |
| :----------------------- | :-------------------------------------------------------------------------------------------- |
| `/`                      | `302` to `/viewer/` with the same query, and `asset` set to `--asset` when the query has none |
| `/viewer/`               | `index.html`                                                                                  |
| `/viewer/*`              | a file of `tools/scene-viewer/`; a directory is `404`, and a path outside the folder is `403` |
| `/vendor/three/build/*`  | `node_modules/three/build/*`                                                                  |
| `/vendor/three/addons/*` | `node_modules/three/examples/jsm/*`                                                           |
| `/api/assets`            | the catalogue, as `application/json`: `{ "assets": CatalogueEntry[] }` (§10)                  |
| `/asset/*`               | the `.ts` at that repository path, **transpiled**, with the prelude of §11                    |
| anything else            | `404`                                                                                         |

The `/asset/` route is the only one that executes a transform:

```js
const transpiler = new Bun.Transpiler({ loader: "ts" });
const source = await Bun.file(absolute).text();
const js = transpiler.transformSync(withThreeImport(source));
return new Response(js, {
	headers: {
		"content-type": "text/javascript; charset=utf-8",
		"cache-control": "no-store"
	}
});
```

`Bun.serve` does not transpile a `.ts` file that it returns with `Bun.file`: it serves the types to
the browser, and the module fails. The route above is the fix, and a test proves it.

`server.ts` exports `readOptions(argv)` and `createServer({ asset, port, root })`. `createServer`
returns the `Server` without listening on a fixed port, so a test starts it on port `0`. The test
imports `server.ts`, never `serve.ts`, so no second server starts. `readOptions` rejects `--asset`
on the rules above, and it accepts its absence.

### 10. The catalogue (`catalogue.ts`)

```ts
export type CatalogueEntry = {
	/** Repository-relative, with forward slashes. */
	path: string;
	/** The file base name, without `.ts`. */
	slug: string;
	/** The subject folder, or `fixtures`. */
	subject: string;
	/** `vehicules`, `characters`, `objects`, or `fixtures`. */
	category: string;
	bytes: number;
	/** Epoch milliseconds, from `stat`. */
	modified: number;
	/** The module transpiles with the prelude of §11. */
	valid: boolean;
	/** The message `Bun.Transpiler` gave, or `null`. */
	error: string | null;
};

export async function listAssets(root: string): Promise<CatalogueEntry[]>;
```

- The walk reads `blueprints/<category>/<subject>/generated/*.ts` for the three categories, plus
  `tools/scene-viewer/fixtures/*.ts`.
- A missing `blueprints/`, category, subject, or `generated/` is not an error: the walk skips it. An
  empty catalogue is a valid answer.
- Files are found with `readdir` and `withFileTypes`, and only `isFile()` entries whose name ends
  with `.ts` are kept. No symlink is followed.
- **One unreadable candidate never takes the listing down.** Each file is read inside its own `try`:
  an `EACCES`, an `ENOENT` between the walk and the read, or a broken link that `isFile()` reported
  gives one entry with `valid: false` and
  `error: "<path>: the candidate could not be read"`. The other entries are still listed, and the
  route still answers `200`. A listing that throws turns a page into a `500` for a file the page will
  never open.
- `valid` is decided by `new Bun.Transpiler({ loader: "ts" }).transformSync(withThreeImport(source))`
  inside a `try`. A throw gives `valid: false` and the error message. The catalogue **never imports
  or executes** a candidate: a listing has no side effect.
- The list is sorted by `path`, with `localeCompare(a, b, "en")`, so two runs give the same order.
- `modified` is `Math.trunc(info.mtimeMs)`: the type says epoch milliseconds, and `mtimeMs` is a
  float.
- The catalogue reads no cache: a handful of files, each a few kilobytes.

### 11. The import prelude (`prelude.ts`)

```ts
export const THREE_IMPORT = 'import * as THREE from "three";\n';
export function withThreeImport(source: string): string;
```

- The rule is anchored on a **namespace binding**, not on any import from `three` and not on the bare
  word: the source already matches `/^\s*import\s+\*\s+as\s+THREE\b[^;]*\bfrom\s*["']three["']/m` →
  it is returned unchanged; otherwise `THREE_IMPORT` is prepended.
- Why so narrow. A file that writes `import { Mesh } from "three"` and uses `THREE.Mesh` does not
  run, and `import type { Group } from "three"` is erased by the transpiler. A namespace import next
  to a named one is legal, so prepending in those cases loses nothing and fixes the file. The reverse
  choice — treat any `from "three"` as enough — lists those files `valid: true` and makes the page
  throw, which is exactly the disagreement §10 forbids.
- The anchor also means a comment that mentions `three`, or a string that holds it, does not stop the
  prelude.
- Known limit, documented rather than solved: a multi-line block comment that holds the exact text
  `import * as THREE from "three"` **at the start of a line** satisfies the rule, so no import is
  added, and the page throws `THREE is not defined` on a file the catalogue called valid. Detecting
  that case needs a parser, and a parser is one call away but only after the rule has run. A comment
  that merely mentions `three`, or that keeps the marker mid-line
  (`/* import * as THREE from "three"; */`), does not match, and gets the prelude.
- The function is pure: same input, same output, no file read.
- It is applied in exactly two places: the `/asset/` route before `transformSync`, and the catalogue
  before its validity check. Nowhere else, so the page and the listing always agree.

### 12. The page composition (`main.js`)

- The page resolves its asset in this order:
    1. `?asset=<repo path>` names it;
    2. otherwise `GET /api/assets` runs, and the first entry with `valid: true` is used;
    3. otherwise the error box shows
       `no asset found. Put a .ts module under blueprints/<category>/<subject>/generated/.`
- The asset URL is `/asset/` plus the path, with every segment passed through `encodeURIComponent`.
- The page imports it with `await import(url)`, checks it, calls `build()` **once**, checks the root,
  measures it, and frames it.
- The picker is a `select` named `asset`, filled from the same `GET /api/assets` answer. One
  `<option>` per entry, `value` = `path`, text = `<slug> — <subject>`, and an invalid entry gets the
  suffix ` (invalid)` and the `title` of its error. The `select` shows the current path. It carries
  `aria-label="asset"`, because `name` names a form field and does not label a control.
- When the catalogue failed but `?asset` named a file that loaded, the picker holds one synthetic
  entry for it: `path`, `slug`, `subject: "—"`, `category: "—"`, `bytes: 0`, `modified: 0`,
  `valid: true`, `error: null`. The page says so in a comment; the shape stays `CatalogueEntry`, so
  `window.__assets()` never returns a short object.
- A `change` on the picker navigates: `location.assign("/?asset=" + encodeURIComponent(path))`. A
  navigation resets the camera, the spin, and the error box, which a swap inside the page would keep.
- A failure fills `#error`, sets `window.__error`, and stops before the string `window.__ready`.
- The body gets `pan-ready` at start. A left `pointerdown` adds `pan-dragging`, and `pointerup`,
  `pointercancel`, and `blur` remove it. No handler writes `canvas.style.cursor`.
- The page subscribes to the flat instance's `change` event, so the `zoom` row follows the wheel and
  the pan as they happen.
- The page exposes, for the manual check and a later automation:
  `window.__ready`, `window.__setView(name)`, `window.__spin(on)`,
  `window.__assets()` → the `CatalogueEntry[]` the page received, and
  `window.__stats()` → `{ view, spin, frames, triangles, meshes, size, draws }`.

## TDD Tasks

- [x] **T15.1 — The view table, the measurement, and the frame**: write `views.test.js`,
      `measure.test.js`, and `frame.test.js` first. They assert the seven views and their order, the
      triangle and mesh counts of two boxes, the bounding box of an offset object, the five
      coefficients, and the throw on an empty object.
- [x] **T15.2 — The spin and the camera**: write `spin.test.js` first. Assert the four cases of §6,
      the 12 s period, and normalization. Write `camera.test.js` with a fake canvas and a stubbed
      `window` (`innerWidth`, `innerHeight`): `viewBasis` for `left`, `front`, and `top`, the throw on
      an unknown view, and `placeCamera("bottom")` with a camera `y` below the frame target. The last
      assertion fails if `flat.maxPolarAngle` is `Math.PI / 2`.
- [x] **T15.3 — The asset contract**: write `contract.test.js` first. Cover a missing default, a
      default that is not a function, a return that is not an `Object3D`, a group with no mesh, and
      an empty object with a non-finite size.
- [x] **T15.4 — The catalogue and the prelude**: write `prelude.test.ts` and `catalogue.test.ts`
      first. `withThreeImport` returns a source that already imports `three` unchanged, prepends on a
      source without it, and prepends on a source that only mentions `three` in a comment. The
      catalogue lists `fixtures/cube.ts`, `fixtures/no-import.ts`, and `fixtures/broken.ts`; it marks
      the first two `valid` and the third `valid: false` with its `Unexpected` message; it returns an
      empty list for an empty root; it finds a fake tree under `.tmp/` with
      `blueprints/vehicules/<subject>/generated/a.ts`; and it sorts by path.
- [x] **T15.5 — The server**: write `server.test.ts` first. Start `createServer` on port `0` with
      `fixtures/cube.ts`. Assert the redirect, the page, the three module, the transpiled asset
      (`text/javascript`, no `interface`, no `: THREE.`, and `export default`), `GET /api/assets`
      (`application/json`, the three fixtures, sorted), the prelude on `/asset/…/no-import.ts`,
      exactly one `three` import on `/asset/…/cube.ts`, the `403` on a `.js` asset, the `403` on
      `node_modules`, and the `404` on a missing file. Close the server in `afterAll`, so a failing
      test never leaves a port open.
- [x] **T15.6 — The page**: write `index.html`, `stage.js`, `camera.js`, and `main.js`. Keep the
      comments of the Three.js viewer where the code is copied, and rewrite them where the reason is
      gone: no calque, no knot, no capture mode. The picker is composed with the same CSS variables as
      the buttons, and it does not introduce a new size, color, or radius.
- [x] **T15.7 — The gates**: `bun run format`; `bun test tools/scene-viewer`; `bun test` at the root.
      Then run the manual check of the acceptance criteria, and record the exact output in
      `## Implementation Notes`.
- [x] **T15.8 — The review round**: eight fixes, each with a test that fails before it: 1. `catalogue.ts` reads each candidate in its own `try` (§10). A test makes one file of the
      `.tmp/` tree unreadable with `chmod 0o000` (restored in `afterAll`), and asserts the listing
      still answers `200` with that entry `valid: false`. 2. `spinStart()` reads the camera back into `state` (§5), with the camera assertion of T15.2. 3. `minDistance` and `maxDistance` come from `frame.distance` (§5), with the ratio assertion. 4. `createServer` binds `127.0.0.1` (§9). 5. `server.test.ts` asserts `403` on `/viewer/..%2Fserver.ts` and on
      `/asset/..%2Fpackage.json.ts`, not `403` or `404` on the normalized form. 6. `server.test.ts` asserts `200`, `text/javascript`, and a body starting with
      `throw new Error(` on `/asset/…/fixtures/broken.ts` (§9). 7. `/viewer/<dir>/` answers `404`, and a test asserts it (§9). 8. The picker gets `aria-label="asset"`, and the synthetic entry of §12 has every field.
      Then fix the three comments the review named: the garbled `catalogue.ts` header line, the
      `views.js` claim that both workflows already share the table, and the `prelude.ts` guarantee
      that the narrow rule now actually gives.

## Acceptance Criteria

- **AC1 — One command opens one asset.** `bun run serve:viewer` (the `package.json` script, or its
  long form `bun run tools/scene-viewer/serve.ts`) with no `--asset` prints the URL, and the page opens
  the first valid asset of the catalogue. With `--asset tools/scene-viewer/fixtures/cube.ts` it opens
  the cube instead. `bun run serve:threejs` still opens the Three.js viewer on port `5180`.
- **AC2 — The HUD.** The panel shows the six rows, the heading reads the asset slug, `tris` and
  `meshes` are non-zero, `size` reads `1.00 × 1.00 × 1.00` for the cube, and `zoom` reads `100 %` on
  the free view too — the row is the same number in both projections since amendment R4.
- **AC3 — The seven views.** Each orthographic button gives an orthographic view at 100 % and
  centred, and `zoom` reads `100 %`. The `free` button gives the perspective view, and `zoom` reads
  `—`.
- **AC4 — The spin.** A press on `spin` turns the camera continuously at 30° per second. A second
  press, a press on a view button, and a `pointerdown` on the canvas each stop it. `aria-pressed`
  follows the state.
- **AC5 — The idle loop.** With the spin off, wait two seconds, and check:
  `const a = __stats().frames.ticks; await new Promise(r => setTimeout(r, 2000)); a === __stats().frames.ticks`.
  The expression is `true`.
- **AC6 — The transpile and the prelude.**
  `curl -s http://127.0.0.1:5181/asset/tools/scene-viewer/fixtures/cube.ts` returns JavaScript: no
  `interface`, no type annotation, `export default` present, and exactly one `from "three"`.
  `curl -s http://127.0.0.1:5181/asset/tools/scene-viewer/fixtures/no-import.ts` returns JavaScript
  whose first line is `import * as THREE from "three";`. A module that imports `{ Mesh }` from
  `three` and uses `THREE` gets the prelude too.
- **AC7 — The failures.** A missing file, a module without a default export, a `build()` that
  returns `{}`, and the `broken.ts` syntax error each show the error box with a named reason, and no
  model. `broken.ts` shows the `Bun.Transpiler` message.
- **AC8 — The catalogue.** `curl -s http://127.0.0.1:5181/api/assets` returns
  `application/json`, lists the three fixtures, and marks `broken.ts` `valid: false` with an `error`.
  A candidate that cannot be read is listed as `valid: false` and does not take the listing down. The
  picker shows the same list, marks `broken.ts` `(invalid)`, and a change of selection reloads the
  page on the chosen asset. The server answers on `127.0.0.1` only.
- **AC9 — A real candidate.** With the server running, the picker lists
  `blueprints/vehicules/red-sportster/generated/qwen3D-01.ts`, the page draws it (its missing `three`
  import comes from the prelude), and the HUD shows a non-zero triangle count. That file is
  **committed evidence, not a fixture**: `.gitignore` un-ignores it on purpose, so the formatter owns
  it, `bun run format` may reformat it, and its transpiled output does not change. **Corrected
  2026-11-17**: this line said "git-ignored", which `.gitignore` line 36 and commit `d6912c2`
  contradict.
- **AC10 — The gates.** `bun test` at the root is green, and `bun run format` reports no change.
- **AC11 — The manual QA.** The art director opens the page, compares the style with the Three.js
  viewer, and judges the spin. This ticket never takes a screenshot itself.

## Contract amendment R1 — the stage, the free view, and the spin (2026-11-17)

Requested by the art director while reviewing the running page, after the first validation round.
**This section supersedes** the `FRAME_COEFFICIENTS` of §4, the `minZoom`/`maxZoom` and the
`minDistance`/`maxDistance` of §5, and the sign of `nextAzimuth` in §6. §1, §2, §3, §7–§12 stand
unchanged.

### A1 — The stage follows the asset, in whole even metres

`frame.js` loses the "scale every distance by `max`" design and gains a **stage**: a ground made of
whole metre cells, sized from the asset.

```js
export const STAGE_RULES = Object.freeze({
	gridRatio: 3, // the grid is about three times the largest dimension
	gridMinSize: 2, // metres, and an even integer
	groundMargin: 0.5, // metres of disc around the grid
	gridStep: 1, // metres between the darker lines
	gridSubStep: 0.5, // metres between the lighter lines
	fill: 0.8, // the disc occupies 80 % of the smaller viewport dimension
	fov: 26
});

export const ORTHO_COEFFICIENT = 1.25;

export function stageFrom(size) → { max, gridSize, groundRadius, shadowHalf }
```

- `gridSize = Math.max(gridMinSize, 2 * Math.round((gridRatio / 2) * max))`.
- **Even, whole metres, and the reason is mechanical.** `GridHelper` lays its lines from `-size/2`
  at a step of `size / divisions`. An odd size puts every line on a half-metre, so no line reads as a
  metre line. An even size puts the metre lines on the integers, which is what the art director asked
  for: 1 m cells, 0.5 m sub-cells, and every line at a whole or half metre.
- `groundRadius = (gridSize / 2) * Math.SQRT2 + groundMargin` — **corrected by §A7**: the margin is
  measured past the **corner** of the grid, not past the middle of a side.
- `shadowHalf = groundRadius / 2` — the unchanged ratio of §4, and the shadow stays inside the disc.
- `max` is still `Math.max(...size)`, and a non-finite or non-positive `max` still throws
  `frame: the asset has no measurable size`.
- `orthoHeight` keeps §4's rule: `ORTHO_COEFFICIENT * max`. **The orthographic 100 % is unchanged**:
  the art director accepted it, and the stage is now the backdrop that adapts instead.
- The exact values the tests assert (`groundRadius` and `shadowHalf` at three decimals):

    | `max` (m) | `gridSize` (m) | `groundRadius` (m) | `shadowHalf` (m) |
    | :-------- | -------------: | -----------------: | ---------------: |
    | 0.10      |              2 |              1.914 |            0.957 |
    | 1.00      |              4 |              3.328 |            1.664 |
    | 1.10      |              4 |              3.328 |            1.664 |
    | 1.60      |              4 |              3.328 |            1.664 |
    | 1.70      |              6 |              4.743 |            2.371 |
    | 4.30      |             12 |              8.985 |            4.493 |
    | 8.00      |             24 |             17.471 |            8.735 |

### A2 — The ground is drawn twice, in metres and in half-metres

`stage.js` builds two grids over the same square, so the metre lines read stronger than the
half-metre lines:

| Grid  | Call                                                               | `y`      |
| :---- | :----------------------------------------------------------------- | :------- |
| metre | `new THREE.GridHelper(gridSize, gridSize, 0xb0b6bd, 0xb0b6bd)`     | `0.0018` |
| sub   | `new THREE.GridHelper(gridSize, gridSize * 2, 0xcdd2d7, 0xc3c8ce)` | `0.0010` |

- `gridSize` is an even integer, so both division counts are integers and both grids line up on the
  same lattice: the sub grid's lines fall at 0.5 m and at every metre, and the metre grid paints over
  the coincident ones because it sits higher.
- The disc keeps `CircleGeometry(stage.groundRadius, 48)`, at `y = 0`. The disc therefore surrounds
  the grid by `groundMargin` on all four sides.
- No new colour, size, radius, or shadow is introduced into the design system: the two colours are
  the ones §7 already uses for the grid.

### A3 — The free view frames the whole disc

The perspective camera has no zoom factor, so its 100 % is a **distance**. §5's
`distance = 2.982 * max` is replaced by one computed from the disc and the viewport:

```js
export function freeDistance({
	groundRadius,
	aspect,
	fov = STAGE_RULES.fov,
	fill = STAGE_RULES.fill
}) → number
```

- `distance = (2 * groundRadius) / (fill * 2 * Math.tan((fov / 2) * Math.PI / 180) * Math.min(1, aspect))`.
- `Math.min(1, aspect)` is the "smaller viewport dimension": a landscape window is limited by its
  height, a portrait one by its width, and the diameter has to fit the smaller field.
- The elevation is not divided out. The disc is horizontal, so its horizontal extent is the full
  diameter; on every landscape window that is the binding dimension, and on a portrait window the
  same formula keeps the whole disc inside the narrower field. The disc therefore fills at most 80 %
  of the smaller dimension, and often slightly less vertically because it is seen at an angle. That
  is deliberate: "fully visible" wins over "exactly 80 %".
- It throws `freeDistance: the disc or the viewport has no size` on a non-finite or non-positive
  `groundRadius` or `aspect`.
- References the tests assert, at `fov` 26, `fill` 0.8:

    | disc diameter (m) | aspect | distance (m) |
    | :---------------- | -----: | -----------: |
    | 5.0               | 16 / 9 |       13.536 |
    | 5.0               |  4 / 3 |       13.536 |
    | 5.0               |    0.5 |       27.072 |
    | 13.0              | 16 / 9 |       35.193 |

    The formula is `D / (0.8 * 0.4617364 * min(1, a))`, with `0.4617364 = 2 * tan(13°)` and
    `0.3693891 = 0.8 * 0.4617364`: `5 / 0.3693891 = 13.5359`; `13 / 0.3693891 = 35.1932`. **A first
    draft of this table wrote `0.4614`, `13.54`, `27.08` and `35.21`; those values were wrong and are
    corrected here.** The test asserts `toBeCloseTo(…, 3)` against the rows above.

In the rig:

- `state.distance` is the computed `freeDistance({ groundRadius: frame.groundRadius, aspect })`,
  recomputed by `placeCamera("free")`, `reset()`, and `resize()`.
- `minDistance = state.distance / 10` and `maxDistance = state.distance * 10`, so the dolly of the
  free view covers the same 10 %–1000 % as the flat zoom of §5.
- `resize()` keeps the **ratio** the user set: `state.distance *= newReference / oldReference`. A
  window resize must never undo a dolly.
- `SHARED.minZoom = 0.1` and `SHARED.maxZoom = 10`. The HUD reads `10 %` to `1000 %` on a flat view,
  and `—` on the free one, unchanged.
- `placeCamera` for the six orthographic views still resets to 100 % and the frame target, per §5.

### A4 — The spin turns counter-clockwise

`nextAzimuth` subtracts the step instead of adding it:

```js
const next = azimuth - dtMs * (360 / periodMs);
```

- One turn still takes 12 s, so the camera still moves 30° per second, and it now moves the other
  way, which is the direction the art director asked for.
- The guards and the normalization of §6 are unchanged: a non-finite or non-positive `dtMs` returns
  the azimuth unchanged, and the result is normalized into `[0, 360)`.
- The tests of §6 become: `nextAzimuth(0, 12000) === 0`; `nextAzimuth(0, 3000) === 270`;
  `nextAzimuth(10, 600) === 352`; `nextAzimuth(350, 600) === 332`; `nextAzimuth(0, 720000) === 0`.
  **A first draft wrote `344` for the fourth case; the rule it states gives `332` (an 18° step in
  600 ms), and `332` is what the test asserts.**

### A5 — TDD tasks of R1

- [x] **T15.9 — The stage**: rewrite `frame.test.js` first. Assert the seven rows of A1, that
      `gridSize` is an even integer and never below 2 for a 1 cm asset, that `groundRadius` is
      `gridSize / 2 + 0.5`, and that the throw of §4 survives. Then implement `stageFrom` and
      `STAGE_RULES` in `frame.js`.
- [x] **T15.10 — The free distance**: write the four rows of A3 into `frame.test.js` first, plus the
      throw. Then implement `freeDistance`.
- [x] **T15.11 — The rig**: `camera.test.js` first. Assert `minZoom` `0.1` and `maxZoom` `10`, that
      `placeCamera("free")` puts the camera at `freeDistance` for the stubbed window, that
      `setZoom(5)` clamps to `10`, `setZoom(2000)` clamps to `1000`, and that a `resize()` from
      16 / 9 to 4 / 3 keeps `state.distance / reference` unchanged. Then wire `camera.js`.
- [x] **T15.12 — The ground**: the two grids of A2 in `stage.js`. No new test file: `stage.js` stays
      proven through the page and the idle check, as §14 records.
- [x] **T15.13 — The spin**: reverse `nextAzimuth` and its five cases. Then `bun run format`,
      `bun test tools/scene-viewer`, `bun test`, and the manual check of AC12–AC15.

### A6 — Acceptance criteria of R1

- **AC12 — The stage.** A 1 m cube stands on a 4 × 4 m grid whose corners sit 0.5 m inside a
  6.657 m disc; a 4.30 m asset on a 12 × 12 m grid inside a 17.971 m disc. The metre lines read
  clearly heavier than the half-metre lines, and no point of the grid touches the rim of the disc.
- **AC13 — The zoom range.** A flat view reads `100 %` when the page opens, the wheel reaches `10 %`
  and `1000 %`, and `__setView("left")` returns to `100 %`.
- **AC14 — The free view.** Pressing `free` shows the whole disc, inside 80 % of the smaller viewport
  dimension, and the object is inside it. The wheel changes the dolly, and `resize` does not reset it.
- **AC15 — The spin.** `spin` turns the camera counter-clockwise, one turn in 12 s.
- **AC16 — The gates.** `bun test` is green and `bun run format` reports no change.

## Contract amendment R2 — corners, line weight, far plane (2026-11-17)

Second review round, by the art director, on the running page. Two defects and one consequence.
**A7 supersedes** the `groundRadius` rule of A1; A2's grid heights and colours stand.

### A7 — The disc clears the grid at its corners

`groundRadius` is measured to the **corner** of the grid, not to the middle of a side:

```js
groundRadius = (gridSize / 2) * Math.SQRT2 + STAGE_RULES.groundMargin;
```

- The half-diagonal of a square of side `g` is `(g / 2) * sqrt(2)`, by Pythagoras.
- The margin of 0.5 m is therefore 0.5 m of disc beyond **every** corner, and more than that beyond
  the middle of every side. The grid never touches the rim.
- Exact values, at three decimals:

    | `gridSize` (m) | `groundRadius` (m) | disc diameter (m) | `shadowHalf` (m) |
    | -------------: | -----------------: | ----------------: | ---------------: |
    |              2 |              1.914 |             3.828 |            0.957 |
    |              4 |              3.328 |             6.657 |            1.664 |
    |              6 |              4.743 |             9.485 |            2.371 |
    |             12 |              8.985 |            17.971 |            4.493 |
    |             24 |             17.471 |            34.941 |            8.735 |

- A test asserts `groundRadius - (gridSize / 2) * Math.SQRT2 === 0.5` for every grid size of the
  table, so the margin is a property and not a coincidence of one row.
- `freeDistance` is unchanged, and its rows of §A3 use a radius directly, so they still hold. The
  **real** stages now give these distances at 16 / 9, which the page uses and a test asserts:

    | `gridSize` (m) | `groundRadius` (m) | free distance (m) |
    | -------------: | -----------------: | ----------------: |
    |              4 |              3.328 |            18.021 |
    |             12 |              8.985 |            48.649 |
    |             24 |             17.471 |            94.592 |

### A8 — The line weights, carried by alpha, not by width

The metre and half-metre lines look identical on screen. The cause is mechanical: WebGL ignores
`linewidth` above 1 on nearly every driver, so a grid line cannot be drawn thicker. Only its **alpha**
and its **colour** can differ.

`frame.js` gains a pure function so the two layers are a tested contract, not a drawing choice:

```js
export function gridLayers(stage) → Array<{
	size: number; divisions: number; color: number; opacity: number; y: number;
}>
```

- It returns exactly two layers, in draw order:
    1. the sub layer: `{ size: gridSize, divisions: gridSize * 2, color: 0xcdd2d7, opacity: 0.45, y: 0.001 }`
    2. the metre layer: `{ size: gridSize, divisions: gridSize, color: 0xb0b6bd, opacity: 1, y: 0.0018 }`
- The dark grid is drawn last and higher; the sub grid at 45 % alpha over the light background reads
  clearly fainter, and it is the only lever WebGL leaves for "smaller lines".
- No new colour enters the design system: the two colours are the ones §7 already names; only an
  opacity is added.
- `stage.js` maps the array to `GridHelper`s:
  `material.transparent = layer.opacity < 1`, `material.opacity = layer.opacity`, and
  `material.depthWrite = false` on the sub layer so the coincident metre lines are never hidden by it.

### A9 — The far plane follows the stage

The stage now scales with the asset, so a fixed `far = 200` clips the grid of a large subject: a
17.5 m radius seen from 94.6 m is already 112 m away, and a 14 m asset exceeds 200 m.

- The perspective camera's `far` is `Math.max(200, state.distance * 3 + frame.groundRadius)`,
  written wherever `state.distance` changes (`placeCamera`, `reset`, `resize`), followed by
  `updateProjectionMatrix()`.
- A test asserts `rig.camera.far >= rig.state.distance + frame.groundRadius` for a stage whose free
  distance exceeds 200 m.

### A10 — TDD tasks of R2

- [x] **T15.14 — The corner radius**: change the A1 rows of `frame.test.js` to the A7 values first,
      add the `sqrt(2)` property test over the five grid sizes, and update the real-stage
      `freeDistance` rows. Then implement `Math.SQRT2` in `stageFrom`.
- [x] **T15.15 — The layers**: write `gridLayers` tests first — two layers, the values above, the sub
      layer fainter and lower, the metre layer at full alpha. Then implement it and map it in
      `stage.js`.
- [x] **T15.16 — The far plane**: assert the `far` bound first with a distance above 200 m, then wire
      it into `camera.js`.
- [x] **T15.17 — The gates**: `bun run format`, `bun test tools/scene-viewer`, `bun test`, and record
      the outputs.

### A11 — Acceptance criteria of R2

- **AC17 — The corners.** At every corner of the grid, the disc ends 0.5 m further out. The grid
  never touches the rim on the screen, at any zoom.
- **AC18 — The weights.** A metre line is distinguishable from a half-metre line by eye, without
  counting them.
- **AC19 — The gates.** `bun test` is green and `bun run format` reports no change.

## Contract amendment R3 — the depth range (2026-11-17)

Accepted follow-up on R2, by the CTO. **A12 supersedes** `syncFarPlane` of A9: the depth range
belongs to both cameras, not to the perspective one, and the perspective `far` must cover the dolly,
not the 100 % framing.

### A12 — Both cameras carry the depth range

R2 replaced a fixed `far = 200` with `Math.max(200, state.distance * 3 + groundRadius)` on the
perspective camera and left the orthographic camera at `near -50`, `far 200`. Two defects remain:

1. the flat camera stands at `state.distance` on its own axis, so on a large stage it renders nothing;
2. the free view dollies out to `maxDistance = state.distance * 10`, so a `3 x` far plane clips a
   subject the user dollied out to.

One function replaces `syncFarPlane` and is called in the same four places — construction,
`placeCamera`, `reset`, and `resize`:

```js
function syncClipping() {
	// The perspective camera keeps a fixed near plane: the closest dolly is `state.distance / 10`,
	// and a perspective near plane clips only what is in front of the camera.
	camera.near = 0.1;
	// `far` must cover the SLOWEST, farthest dolly, not the 100 % framing: `maxDistance` is ten
	// references away, so a 3 x far plane clips a subject the user dollied out to.
	camera.far = Math.max(200, state.distance * 10 + frame.groundRadius * 2);
	camera.updateProjectionMatrix();

	// The flat camera sits at `state.distance` and never moves along its axis: its wheel changes
	// `ortho.zoom`, not the position. Its depth range therefore brackets the target.
	ortho.near = Math.max(0.01, state.distance / 10);
	ortho.far = state.distance + frame.groundRadius * 2;
	ortho.updateProjectionMatrix();
}
```

- The perspective near plane stays `0.1`: `maxDistance` grows with the stage, and a near plane that
  grew with it would hide the closest dolly.
- `200` stays the floor of the perspective `far`, so the small stages keep the range they were tuned
  with. The flat range needs no floor of its own: `state.distance` is positive, and both bounds are
  derived from it.
- The rig returns `ortho` already (§5), so this is a wiring fix, not a new API.

**AC20 — The depth range.** On every stage, the free view's farthest dolly and the whole ground disc
are inside the perspective frustum, and the flat view draws the disc from its standoff on its own
axis. `ortho.near` is positive and smaller than `state.distance - groundRadius`, and `ortho.far` is
larger than `state.distance + groundRadius`.

### A13 — TDD tasks of R3

- [x] **T15.18 — The two depth ranges**: write the four cases of `A12` into `camera.test.js` first —
      the small-stage near plane and the 200 m floor, the farthest dolly, the flat frustum around the
      disc, and the three places that rewrite both ranges — then replace `syncFarPlane` with
      `syncClipping` in `camera.js`.

### A14 — Acceptance criteria of R3

- **AC21 — The flat view at every scale.** A flat view of the 96 m stage shows the ground and the
  asset, and a flat view of the 1 m cube is unchanged.
- **AC22 — The farthest free dolly.** The free view zooms out to 1000 % of the framing with the disc
  still drawn.
- **AC23 — The gates.** `bun test` is green and `bun run format` reports no change.

## Implementation Notes

Written by the coding sub-agent. The files are under `tools/scene-viewer/`, plus `README.md` and one
line in `bunfig.toml` (see "Where the ticket did not match reality", item 1). No commit, no move.

### Red before green, group by group

Each test group was written first and run against the missing modules. The exact failure is quoted.

- **T15.1** (`views.test.js`, `measure.test.js`, `frame.test.js`): `0 pass, 3 fail, 3 errors`, each
  `Cannot find module './views.js'` / `'./measure.js'` / `'./frame.js'`.
- **T15.2** (`spin.test.js`, `camera.test.js`): `16 pass, 2 fail, 2 errors`,
  `Cannot find module './spin.js'` and `'./camera.js'`.
- **T15.3** (`contract.test.js`): `0 pass, 1 fail, 1 error`, `Cannot find module './contract.js'`.
- **T15.4** (`prelude.test.ts`, `catalogue.test.ts`): `0 pass, 2 fail, 2 errors`,
  `Cannot find module './prelude.ts'` and `'./catalogue.ts'`.
- **T15.5** (`server.test.ts`): `0 pass, 1 fail, 1 error`, `Cannot find module './server.ts'`.

Two red runs also exposed facts the tests had to state correctly. Both changed a test, not the code
under test:

- `Box3` on a group with no mesh is empty, and `getSize` / `getCenter` answer `[0, 0, 0]` for an empty
  box. The test now asserts `[0, 0, 0]`, which `frameFrom` still rejects.
- `OrbitControls` clamps the camera radius to `minDistance = 3`, so the camera for a 1 m asset sits at
  3 m even though `frame.distance` is `2.982`. The test asserts the clamped position and keeps the
  frame coefficient exact in `frame.test.js`.

### Gates (T15.7)

```text
$ bun run format
Formatted 0 files, 182 unchanged
EXIT=0

$ bun test tools/scene-viewer
 79 pass
 0 fail
 185 expect() calls
Ran 79 tests across 9 files.

$ bun test
 225 pass
 0 fail
 504 expect() calls
Ran 225 tests across 21 files.
```

The root baseline was `146 pass, 0 fail, 12 files`. The new run adds 79 tests and 9 files, so the
totals agree: `146 + 79 = 225`, `12 + 9 = 21`.

### The manual check, recorded exactly

`bun run tools/scene-viewer/serve.ts` (no `--asset`) printed:

```text
scene viewer: http://127.0.0.1:5181/
asset: the first valid asset of the catalogue
```

`curl` against that server:

```text
GET /api/assets
HTTP/1.1 200 OK
Content-Type: application/json;charset=utf-8
blueprints/vehicules/red-sportster/generated/qwen3D-01.ts  vehicules red-sportster True  None
tools/scene-viewer/fixtures/broken.ts                      fixtures  fixtures       False 'Unexpected ]'
tools/scene-viewer/fixtures/cube.ts                        fixtures  fixtures       True  None
tools/scene-viewer/fixtures/no-import.ts                   fixtures  fixtures       True  None

GET /asset/tools/scene-viewer/fixtures/cube.ts
HTTP/1.1 200 OK
Content-Type: text/javascript; charset=utf-8
Cache-Control: no-store
body: `import * as THREE from "three";` then `export default function build() { … }`
`from "three"` count: 1 · `interface` count: 0 · `: THREE.` count: 0

GET /asset/tools/scene-viewer/fixtures/no-import.ts
body starts with: `import * as THREE from "three";`

GET /asset/tools/scene-viewer/fixtures/broken.ts
HTTP/1.1 200 OK
Content-Type: text/javascript; charset=utf-8
body: `throw new Error("Unexpected ]");`

GET /viewer/                  -> 200 text/html; charset=utf-8, contains `id="hud"`
GET /                         -> 302, Location: /viewer/
GET /assets/../package.json   -> 404  (the URL parser normalizes the path to /package.json)
GET /viewer/../../package.json-> 404  (same normalization)
GET /viewer/..%2Fserver.ts    -> 403  (the path survives normalization and leaves the folder)
GET /viewer/..%2F..%2Fpackage.json -> 403
GET /asset/node_modules/three/package.json -> 403
GET /asset/tools/scene-viewer/main.js      -> 403
GET /nope                     -> 404
GET /viewer/main.js           -> 200 text/javascript
GET /vendor/three/build/three.module.js     -> 200 text/javascript
GET /vendor/three/addons/controls/OrbitControls.js -> 200 text/javascript
GET /asset/blueprints/vehicules/red-sportster/generated/qwen3D-01.ts
HTTP/1.1 200 OK, body line 1 is the prelude, `from "three"` count 1, `export default` present
```

The server was stopped with `pkill -f tools/scene-viewer/serve.ts` after the check.

### Where the ticket did not match reality

1. **`bun run format` cannot pass with a deliberately broken `.ts` file.** `bun fmt` parses every
   `.ts` under the root, and `fixtures/broken.ts` is a syntax error by design. The gate exited `2`
   with `An element access expression should take an argument` and formatted the other files. The
   fix is one exclusion in the root `bunfig.toml`:
   `ignorePatterns = ["tools/scene-viewer/fixtures/broken.ts"]`. That file is outside the ticket's
   Scope Boundary, so this edit is reported here and left for the CTO to accept or move. The fixture
   is excluded, never repaired.
2. **`checkAsset(module)` cannot name the file with one argument.** The contract asks both for that
   signature and for problem strings that name the file. The module carries no path. The function now
   takes an optional second argument, `checkAsset(module, file = "the asset")`, and the page passes
   the catalogue path. A one-argument call still works.
3. **`createServer` does listen when it is called.** `Bun.serve` binds a port at construction, so
   "returns the `Server` without listening on a fixed port" is implemented as a `port` that defaults
   to `0`. The test passes `0` and reads `server.port`. `serve.ts` passes the default `5181`.
4. **The ticket does not say how a transpiler message crosses HTTP.** `/asset/` answers `200` with
   `throw new Error("<message>");` when `transformSync` throws. The page's `await import(url)` then
   rejects with the transpiler's own words, which is what AC7 asks to see. A `500` would reach the
   page as a MIME error and lose the message.
5. **`OrbitControls` clamps more than the polar angle.** It also clamps the radius to `minDistance`,
   so a 2.982 m frame distance places the camera at 3 m. The frame coefficient is unchanged and is
   asserted exactly in `frame.test.js`. Only the camera position is clamped.
6. **`/assets/../package.json` never reaches the `/viewer/` route.** The URL parser normalizes `..`
   before the handler sees it, so the answer is the `404` fallback, which the ticket allows. The
   `403` branch is proven with `..%2F`, where the escape survives normalization.
7. **`bun fmt` rewrote `tickets/README.md`.** The board edit that moved T0015 to `in_progress/` was
   unformatted, and the first `bun run format` re-padded two tables. No row changed. The file is
   outside Scope Boundary and this is reported for the CTO.

### Design decisions

- **The error box** is a `#error` rule in the stylesheet, not an inline `style.cssText`. The values
  are the values of `showFailure` in `workflows/threejs/viewer/api.js`, as §2 requires. They are the
  only colors on the page that the sheet did not already hold, and the ticket asks for them.
- **The picker** reuses the button's type, padding, border, radius, text color and hover. Its only
  dimension is `max-width: 380px`, a value already in the copied sheet (`#knots`). No new size,
  weight, color, radius or shadow was introduced. The separator copies `#knots .sep`.
- **The HUD heading and the title** are set after the asset is measured, so a failed load never
  shows a plausible slug above an error box.
- **The import is the only executing step.** A syntax error arrives as a rejected `import()`, a
  missing default arrives from `checkAsset`, and a `build()` that throws is caught by the same
  `try`. Every one of them stops before `window.__ready`.
- **The picker navigates** with `location.assign("/?asset=…")`, as §12 says, so the camera, the spin
  and the error box reset with the asset.

### Test coverage

| File                | What it proves                                                                                                                                                                         |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `views.test.js`     | The seven presets, their order, the frozen table, one free view, `DEFAULT_VIEW`                                                                                                        |
| `measure.test.js`   | Indexed and non-indexed triangle counts, mesh count, offset box, zero box                                                                                                              |
| `frame.test.js`     | The five coefficients, the multiplication, the throw on an empty or infinite box                                                                                                       |
| `spin.test.js`      | 12 s period, 30°/s, the four §6 cases, normalization, non-positive intervals                                                                                                           |
| `camera.test.js`    | `viewBasis` for left/front/top, the unknown-view throw, the `SHARED` table parity, `flat.maxPolarAngle === π`, the `bottom` camera below the target, spin start/step/stop              |
| `contract.test.js`  | Missing or non-function default, named default re-export, the three root problems, `describe`                                                                                          |
| `prelude.test.ts`   | Import kept, prelude added, comment and string do not count, purity                                                                                                                    |
| `catalogue.test.ts` | The three fixtures and their flags, the `Unexpected ]` message, sorting, an empty root, a missing root, a fake tree under `.tmp/`                                                      |
| `server.test.ts`    | `readOptions` rules, the redirect, the page, the three module and addon, the transpile, the prelude, the catalogue, `404`, `403` on `.js` and `node_modules`, `403`/`404` on an escape |

The loop, the spin and the page composition are proven headlessly: `__stats().frames` is the idle
check, `spin.test.js` is the spin math, and `server.test.ts` is every HTTP answer. No browser was
launched and no screenshot was taken. Visual QA stays with the art director (AC11).

### Review round

The eight fixes of T15.8, each measured before and after. The ticket is the authority, and §5, §9,
§10, §11 and §12 were re-read first.

#### Red before green, fix by fix

The suite before this round was `79 pass, 0 fail` in 9 files. After the new tests were written and
before any code changed, `bun test tools/scene-viewer` gave `72 pass, 15 fail`.

- **B1 — one unreadable candidate.** The new `.tmp/` tree holds
  `blueprints/vehicules/test-subject/generated/unreadable.ts` at mode `0o000`. Every listing test
  failed with the same error, which is the defect:

    ```text
    EACCES: permission denied, open '…/.tmp/scene-viewer-test/tree/blueprints/vehicules/test-subject/generated/unreadable.ts'
    (fail) listAssets and the fixtures > lists the three fixtures and parses each one
    (fail) listAssets and the fixtures > marks the broken fixture invalid with the transpiler message
    (fail) listAssets and an unreadable candidate > lists an unreadable candidate as invalid and keeps the other entries
    (fail) listAssets on a scratch tree > finds blueprints/<category>/<subject>/generated/*.ts
    (fail) listAssets on a scratch tree > reads the three categories and skips a non-file and a non-ts file
    (fail) listAssets on a scratch tree > marks a syntax error on the scratch tree
    (fail) listAssets on a scratch tree > returns the list sorted by path
    ```

    One locked file took the whole listing down, which is the `500` at `/api/assets`.

- **D1 — the spin restart.** `3.47294962666615` m of jump on the first `spinStep(0)` after a manual
  camera move. The assertion wants `< 1e-6`.
- **D3 — the distance clamp.** `minDistance` read `3` where the frame distance is `2.982`, and
  `maxDistance` read `24`. The 10 cm asset had no test to fail, so the assertion was new.
- **D3, second effect.** `placeCamera("left")` put the camera at `x = 3` and `placeCamera("bottom")`
  at `y = -2.5`, because the fixed `3` clipped the frame distance. Both assertions now read
  `2.982`.
- **D5 and D6 — no red.** The `403` on `/viewer/..%2Fserver.ts` and on `/asset/..%2Fpackage.json.ts`,
  and the `200` + `throw new Error(` on `broken.ts`, passed on their first run: the behaviour was
  already correct, and the old test was simply weaker (it accepted `[403, 404]` on the normalized
  path). The assertions are still new, and they are the regression gate the review asked for.
- **D8 — the directory.** `/viewer/fixtures/` answered `200` with the page:

    ```text
    (fail) the viewer server > does not answer a directory with the page
    ```

- **Prelude narrowing.** Two failures, `prepends the line on a named import that is not the
namespace` and the block-comment case, because the old rule anchored on any `from "three"`.

#### After the fixes

```text
$ bun run format
Formatted 0 files, 182 unchanged
EXIT=0

$ bun test tools/scene-viewer
 87 pass
 0 fail
 204 expect() calls
Ran 87 tests across 9 files.

$ bun test
 233 pass
 0 fail
 523 expect() calls
Ran 233 tests across 21 files.
```

The root baseline before this round was `225 pass, 21 files`. The round adds 8 tests, so
`225 + 8 = 233`, and the file count stays 21.

#### The curl checks of the amended §9

```text
$ bun run tools/scene-viewer/serve.ts
scene viewer: http://127.0.0.1:5181/
asset: the first valid asset of the catalogue

/viewer/..%2Fserver.ts        -> 403 text/plain;charset=utf-8
/asset/..%2Fpackage.json.ts   -> 403 text/plain;charset=utf-8
/viewer/fixtures/             -> 404 text/plain;charset=utf-8
/viewer/                      -> 200 text/html; charset=utf-8
/api/assets                   -> 200 application/json;charset=utf-8

GET /asset/tools/scene-viewer/fixtures/broken.ts
HTTP/1.1 200 OK
Content-Type: text/javascript; charset=utf-8
Content-Length: 33
body: throw new Error("Unexpected ]");

/api/assets entries: 4
blueprints/vehicules/red-sportster/generated/qwen3D-01.ts True  None
tools/scene-viewer/fixtures/broken.ts                      False 'Unexpected ]'
tools/scene-viewer/fixtures/cube.ts                        True  None
tools/scene-viewer/fixtures/no-import.ts                   True  None

$ ss -ltn | grep 5181
LISTEN 0 512 127.0.0.1:5181 0.0.0.0:*   (Bun, pid 69446)
```

The socket is bound to `127.0.0.1` and to nothing else, so the printed URL is the URL that answers.
The server was stopped after the check.

#### What changed

| Fix    | Code                                                                                                                                                         |
| :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1     | `catalogue.ts`: the `stat` and the read share one `try`, and a failure answers one entry with `valid: false` and `"<path>: the candidate could not be read"` |
| D1     | `camera.ts` (`camera.js`): `spinStart()` reads `azimuth` and `distance` back from `camera.position - state.target` before it disables the controls           |
| D3     | `camera.js`: `minDistance = frame.distance`, `maxDistance = frame.distance * 8`, on both instances                                                           |
| D4     | `server.ts`: `Bun.serve({ hostname: "127.0.0.1", … })`                                                                                                       |
| D5, D6 | `server.test.ts`: `403` on the two encoded traversals, `200` + `throw new Error(` on `broken.ts`                                                             |
| D8     | `server.ts`: only the empty rest answers `index.html`, a trailing slash is `404`                                                                             |
| D7     | `main.js`: `aria-label="asset"`, and the synthetic entry carries `category`, `bytes` and `modified`                                                          |
| —      | `catalogue.ts`: `modified: Math.trunc(info.mtimeMs)`, per §10                                                                                                |

The prose fixes:

- `catalogue.ts`: the fixture constant now reads "The built-in fixtures of this tool, listed beside
  the candidates of `blueprints/`", and the header says how the listing and the page agree: the same
  narrow prelude, the same transpiler, and the one exception of an unreadable file, which the page
  never opens because it takes the first valid entry.
- `views.js`: "destined for both workflows, one table. The Three.js viewer still reads its own copy
  today, and a later ticket merges it onto this one."
- `prelude.ts`: the guarantee now states a namespace binding, with the `import { Mesh }` and
  `import type` cases named, and keeps the documented block-comment limit.

#### New divergences

1. **The block-comment limit of §11 does not reproduce for a comment that starts the line.** With
   `/^\s*import…/m`, a namespace import written on its own line inside `/* … */` still matches, so
   the prelude adds nothing. The limit reproduces only when the comment does not start the line,
   for example `/* import * as THREE from "three"; */`. The test uses that form, and the comment in
   `prelude.ts` says "an import written inside a block comment", because that is the case the rule
   can hit.
2. **§9's table says a directory is `403`, and T15.8 says `/viewer/<dir>/` is `404`.** The two
   sentences disagree. This round implements T15.8 and the gate: `/viewer/fixtures/` is `404`, and
   so is `/viewer/fixtures` without the slash, because no file lives there. The `403` is kept for a
   path that leaves the folder, which is what the encoded traversal test asserts.
3. **The root `README.md` has no section that lists how the repository is run.** The only commands
   it names are in `package.json` and in the workflow documents. The command block was added at the
   end of "## The repository", the section that describes the repository. It gives the exact command,
   the optional `--asset` flag, and the host and port.
4. **Two of the eight fixes had no red step** (D5 and D6): their behaviour was already correct and
   only the assertion was missing or too loose. Recorded rather than manufactured.

The two comment corrections in `prelude.ts` and `prelude.test.ts` followed the review. Prose only, no behaviour change.

### Amendment — the launcher scripts, 2026-11-17

Found in review: `tools/scene-viewer/serve.ts` existed and `README.md` documented it, but
`package.json` named no script for it, and the one `serve` script still started the Three.js viewer.
So the new page had no discoverable name, and `serve` promised nothing about which viewer it opened.
Fixed by decision of the art director, outside the original Scope Boundary and recorded here:

| File                          | Change                                                                 |
| :---------------------------- | :--------------------------------------------------------------------- |
| `package.json`                | `serve` → `serve:threejs`, and a new `serve:viewer`                    |
| `README.md`                   | the command block runs `bun run serve:viewer [--asset <repo path>.ts]` |
| `workflows/threejs/README.md` | `bun run serve` → `bun run serve:threejs` in the viewer command block  |
| `workflows/threejs/AGENTS.md` | the two root commands are renamed, and the shared viewer is named      |

The two `workflows/threejs/` files change by prose only, so that the rule of that workflow — "a change
that adds a tool, a flag, a file, or a gate updates this workflow's `README.md` and `AGENTS.md` in the
same commit" — still holds. No code, no test, and no gate of that workflow changes.

The long form stays documented, because it names the file that runs. `bun run serve:viewer --asset
<path> --port 0` was measured on 2026-11-17: Bun forwards the arguments and `serve.ts` receives them.

```text
$ bun run serve:viewer --asset tools/scene-viewer/fixtures/cube.ts --port 0
$ bun run tools/scene-viewer/serve.ts --asset tools/scene-viewer/fixtures/cube.ts --port "0"
scene viewer: http://127.0.0.1:42187/
asset: tools/scene-viewer/fixtures/cube.ts
```

No test asserts a script name: `package.json` is not loaded by any code, and `serve.ts` owns the
behaviour that the tests already cover.

A ticket in `done/` is a record and is never rewritten. `tickets/done/T0001-workflow-reorganisation.md`
still quotes `bun run serve`: it describes the repository before this amendment, not the current one.

## Implementation Notes — amendment R1

Written by the coding sub-agent, 2026-11-17. The amendment is implemented as §A1 to §A6 state it,
with five arithmetic divergences recorded below. No earlier section of this ticket was rewritten.
The ticket stays in `in_progress/`; nothing is committed.

### Files changed

| File                                | Change                                                                                                                                              |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/scene-viewer/frame.js`       | `FRAME_COEFFICIENTS` → `STAGE_RULES`, `ORTHO_COEFFICIENT`; new `stageFrom` and `freeDistance`; `frameFrom` rebuilt on the stage, without `distance` |
| `tools/scene-viewer/camera.js`      | `SHARED` zoom `0.1`–`10`; the free distance and the 10 %–1000 % dolly; `resize()` keeps the dolly ratio                                             |
| `tools/scene-viewer/stage.js`       | two `GridHelper` instances over one square, metre at `0.0018`, sub at `0.0010`; the disc is unchanged                                               |
| `tools/scene-viewer/spin.js`        | the step is subtracted, so the camera turns counter-clockwise                                                                                       |
| `tools/scene-viewer/frame.test.js`  | the stage rows, the even-integer rule, the free-distance rows and its throw                                                                         |
| `tools/scene-viewer/camera.test.js` | the new zoom range, the free distance, the two clamps, the resize ratio, the reversed azimuth                                                       |
| `tools/scene-viewer/spin.test.js`   | the five cases of A4, with the sign reversed                                                                                                        |

`main.js` and `index.html` are untouched: `main.js` already calls `rig.placeCamera(currentView)` at
start and `stage.js` already calls `rig.resize()` on the window event, so no wiring change was
needed. `stage.js` keeps no test file, per T15.12: the page and the idle check prove it.

### Red before green, task by task

The first red run covered T15.9, T15.10, T15.11 and T15.13 together, against the unmodified code:

```text
$ bun test tools/scene-viewer/frame.test.js tools/scene-viewer/spin.test.js tools/scene-viewer/camera.test.js
tools/scene-viewer/frame.test.js:
# Unhandled error between tests
SyntaxError: Export named 'ORTHO_COEFFICIENT' not found in module '…/tools/scene-viewer/frame.js'.

tools/scene-viewer/camera.test.js:
# Unhandled error between tests
SyntaxError: Export named 'freeDistance' not found in module '…/tools/scene-viewer/frame.js'.

(fail) nextAzimuth > turns thirty degrees per second, counter-clockwise
  Expected: 270 · Received: 90
(fail) nextAzimuth > normalizes the result into [0, 360)
  Expected: 352 · Received: 28
(fail) nextAzimuth > normalizes an azimuth that arrives outside the range
  Expected: 280 · Received: 100

 3 pass
 5 fail
 2 errors
 11 expect() calls
Ran 8 tests across 3 files.
```

- **T15.9** — red for the right reason: `ORTHO_COEFFICIENT` (and `STAGE_RULES`, `stageFrom`) did not
  exist. After `frame.js` gained the stage, all rows passed on the first run.
- **T15.10** — red for the right reason: `freeDistance` did not exist. After it was implemented the
  four rows failed on the **ticket's own arithmetic** (see "Where the ticket did not match reality",
  item 2), not on the code.
- **T15.11** — red for the right reason: `camera.test.js` could not even load, because it imports
  `freeDistance`. The first post-implementation run also reported `Expected: 330 · Received: 270`:
  `spinStart()` read the camera back from a rig that had never been placed, so the read gave the
  origin. The test now places `free` first, as the page does.
- **T15.13** — red for the right reason: the old `+` step gave `90`, `28` and `100` where the
  reversed rule gives `270`, `352` and `280`.

One test-side arithmetic error of mine was also caught by that run and corrected before green: the
dolly range is `distance / 10` to `distance * 10`, so its ratio is **100**, not 10.

### Gates

```text
$ bun run format
Formatted 0 files, 182 unchanged
EXIT=0

$ bun test tools/scene-viewer
 101 pass
 0 fail
 307 expect() calls
Ran 101 tests across 9 files.

$ bun test
 247 pass
 0 fail
 626 expect() calls
Ran 247 tests across 21 files.
```

The scene-viewer suite was `87 pass` in 9 files before this round, and the root suite `233 pass` in
21 files. This round adds 14 tests (`101 - 87 = 14`, `247 - 233 = 14`) and no file.

```text
$ bun run check
$ bun run workflows/threejs/tools/check.ts --subject blueprints/vehicules/r5-tl-1972 --prefix r5-L3
[  0.0s] scene     r5-tl-1972
[  0.0s] capture   8 view(s): left,right,front,back,top,front-3q,rear-3q,iso
error: agent-browser open failed (1) [open]: ✗ Navigation failed: net::ERR_CONNECTION_REFUSED
error: capture failed (1)
      at run (…/workflows/threejs/tools/check.ts:174:14)
error: script "check" exited with code 1
```

This is the pre-existing failure the brief names, unchanged in substance: the capture stage cannot
reach its browser. It is not caused by this round, and it was not repaired.

### Where the ticket did not match reality

1. **§A4's `nextAzimuth(350, 600) === 344` contradicts the rule it states.** With
   `next = azimuth - dtMs * (360 / periodMs)`, the step is 18°, so the result is `332`. `344` is
   6° of step, which is 60 °/s at 600 ms, or a 36 s period. The rule is normative, so the test
   asserts `332`, with a comment naming the discrepancy.
2. **§A3's reference distances use a wrong constant.** The text says `0.4614 = 2 * tan(13°)`, but
   `2 * tan(13°) = 0.4617364`, so `fill * 2 * tan(13°) = 0.3693891`, not `0.36912`. The formula as
   written therefore answers `13.5359`, `27.0717` and `35.1932` where the table quotes `13.54`,
   `27.08` and `35.21`; the restated brief quotes `27.09`, so the ticket disagrees with itself as
   well. The formula is normative: the tests assert `13.536`, `27.072` and `35.193` at three
   decimals, and a comment records the constant. The three-decimal form the brief asks for cannot
   hold: `13.546` is 0.010 m away from the formula's own answer.
3. **The `bun run check` failure now sits at `check.ts:174:14`.** The brief quotes `152:17`. The
   message is the same `capture failed (1)`, preceded by
   `agent-browser open failed (1) … ERR_CONNECTION_REFUSED`; this checkout's `check.ts` is longer
   than the line number implies. Recorded, not repaired.
4. **§A3 fixes the dolly pair but not when it follows.** `minDistance = distance / 10` and
   `maxDistance = distance * 10` are written once at construction in the text, but `placeCamera`,
   `reset` and `resize` all move `state.distance`, and `OrbitControls.update()` clamps the camera
   radius to the stale pair. One `syncDistanceLimits()` now rewrites both instances wherever the
   distance changes, so the range is always 10 %–1000 % of the current framing. The ratio the user
   dollied survives `resize` because the reference is tracked in `lastReference`, which is the
   previous `freeDistance` and not the current `state.distance`.
5. **§4's `frameFrom` shape lists `distance`, which A1 removes.** A test now asserts
   `frame.distance` is `undefined`: the free distance belongs to the viewport, not to the asset, and
   a stale per-asset field would be the second source of truth the rig must not have. The `target`
   and `orthoHeight` fields stand.
6. **A2's sub-grid height `0.0010` is written `0.001`.** It is the same number; the formatter
   normalizes a trailing zero in a decimal literal. The metre grid is `0.0018`.

### What is not proven here

No browser was launched, no screenshot was taken, and no capture loop was run. AC12 to AC15 are
proven headlessly by the pure tests and the in-process server: the stage sizes are `frame.test.js`,
the free framing, the zoom range and the resize ratio are `camera.test.js`, and the spin direction
is `spin.test.js`. The visual judgement — metre lines darker than sub-metre lines, the disc margin,
the spin direction by eye — stays with the art director under AC11.

## Implementation Notes — amendment R2

Written by the coding sub-agent, 2026-11-17. The amendment is implemented as §A7 to §A9 state it.
No earlier section of this ticket was rewritten. The ticket stays in `in_progress/`; nothing is
committed. Six places where the ticket did not match reality are recorded at the end, and one of
them leaves an edit outside the Scope Boundary for the CTO.

### Files changed

| File                                | Change                                                                                                                                        |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/scene-viewer/frame.js`       | `groundRadius` measured to the grid corner with `Math.SQRT2`; new `gridLayers`; the header states both rules                                  |
| `tools/scene-viewer/stage.js`       | the two `GridHelper`s come from `gridLayers(frame)`; `transparent`, `opacity`, and `depthWrite = false` on the sub layer                      |
| `tools/scene-viewer/camera.js`      | `syncFarPlane()`: `far = Math.max(200, state.distance * 3 + frame.groundRadius)`, called at construction, in `placeCamera`, `reset`, `resize` |
| `tools/scene-viewer/frame.test.js`  | the A7 rows at three decimals, the `sqrt(2)` property test, the three real-stage distances, a `gridLayers` block, the header                  |
| `tools/scene-viewer/camera.test.js` | one stale reference distance (`13.5359` → `18.021`) and a `the far plane` block of three tests                                                |

`main.js`, `index.html`, and the other modules are untouched: `stage.js` already receives the frame,
and `createStage` keeps no test file per T15.12.

### Red before green, task by task

The first red run was one run for T15.14, T15.15 and T15.16 together, against the unmodified code:

```text
$ bun test tools/scene-viewer/frame.test.js tools/scene-viewer/camera.test.js
tools/scene-viewer/frame.test.js:

# Unhandled error between tests
-------------------------------
SyntaxError: Export named 'gridLayers' not found in module '…/tools/scene-viewer/frame.js'.
-------------------------------

tools/scene-viewer/camera.test.js:
(fail) createCameraRig > starts on the free view at the disc distance
  Expected: 18.021 · Received: 13.535862107137985

(fail) the far plane > follows a free distance beyond 200 m
  Expected: >= 926.8728297925755 · Received: 200

(fail) the far plane > is rewritten wherever the distance changes
  Expected: 2491.6184893777267 · Received: 200

 17 pass
 4 fail
 1 error
 72 expect() calls
Ran 21 tests across 2 files.
```

- **T15.14** — red, but the missing `gridLayers` export aborted `frame.test.js` before any assertion
  ran, so the five radius rows were not the failure that run showed. To give that task real evidence,
  the new `frame.test.js` was run a second time against the pre-R2 formula: a throwaway copy under
  `.tmp/r2-check/` held the current `frame.js` with only the radius line reverted to
  `gridSize / 2 + groundMargin` (the copy was deleted after the run). It failed six tests:

    ```text
    (fail) stageFrom > sizes the grid in whole even metres, the disc around it, and the shadow inside it
      Expected: 1.914 · Received: 1.5 · difference 0.414
    (fail) stageFrom > clears every corner of the grid by the ground margin
      Expected: 0.5 · Received: 0.08578643762690485 · difference 0.41421356237309515
    (fail) stageFrom > keeps the two-metre floor on a one-centimetre asset
      Expected: 1.914 · Received: 1.5
    (fail) frameFrom > adds the target and the orthographic height to the stage
      Expected: 8.985 · Received: 6.5
    (fail) frameFrom > frames a one-metre cube at the known stage
      Expected: 3.328 · Received: 2.5 · difference 0.828
    (fail) freeDistance > frames the real stages at 16 / 9
      Expected: 18.021 · Received: 13.535862107137985 · difference 4.485

     13 pass
     6 fail
     94 expect() calls
    ```

    The corner property test is the sharp one: the old rule leaves `0.0858 m` past the corner on the
    2 m grid, instead of the `0.5 m` the rule states. After `Math.SQRT2` was written into
    `stageFrom`, every row passed on its first run.

- **T15.15** — red for the right reason in the first run (`gridLayers` did not exist). After it was
  implemented and mapped in `stage.js`, the three new tests passed on their first run. `stage.js`
  itself keeps no test file per T15.12: the mapping is four lines over a tested array, and the page
  and the idle check prove it.
- **T15.16** — red for three reasons in the first run. The first is not a far-plane failure at all:
  A7 grew the cube's disc from 5 m to 6.657 m, so the rig's reference distance moved from
  `13.5359 m` to `18.0213 m`, and the old assertion was stale. The other two are the defect:
  `far` stayed `200` where the stage needs `926.873 m` and `2491.618 m`.

After the three implementations:

```text
$ bun test tools/scene-viewer/frame.test.js tools/scene-viewer/camera.test.js
 39 pass
 0 fail
 221 expect() calls
Ran 39 tests across 2 files.
```

The arithmetic of §A7 and of its real-stage table was recomputed from the formulas before the tests
were written, and every printed value holds: `1.914 / 3.328 / 4.743 / 8.985 / 17.471` and
`18.021252 / 48.649412 / 94.591651` at `16 / 9`, with the constant `0.8 * 2 * tan(13°) =
0.3693891`.

### Gates (T15.17)

```text
$ bun run format
Formatted 0 files, 183 unchanged
EXIT=0

$ bun test tools/scene-viewer
 108 pass
 0 fail
 364 expect() calls
Ran 108 tests across 9 files.

$ bun test
 254 pass
 0 fail
 683 expect() calls
Ran 254 tests across 21 files.
```

The scene-viewer suite was `101 pass` in 9 files before this round, and the root suite `247 pass` in
21 files. This round adds 7 tests (`108 - 101 = 7`, `254 - 247 = 7`) and no file: four in
`frame.test.js` (the three real-stage distances are one test, plus the three `gridLayers` tests) and
three in `camera.test.js`. One `frame.test.js` test was replaced, not removed: "surrounds the grid
by the ground margin on every side" became "clears every corner of the grid by the ground margin".

The second gate is already accounted for: the first `bun run format` of this round reported
`Formatted 1 file, 182 unchanged`, because it reformatted a tracked blueprint candidate (see
"Where the ticket did not match reality", item 2). The run above is the one after that change, and
it is the state of the tree.

```text
$ bun run check
[  0.0s] scene     r5-tl-1972
[  0.0s] capture   8 view(s): left,right,front,back,top,front-3q,rear-3q,iso
error: agent-browser open failed (1) [open]: ✗ Navigation failed: net::ERR_CONNECTION_REFUSED
error: capture failed (1)
      at run (…/workflows/threejs/tools/check.ts:174:14)
error: script "check" exited with code 1
EXIT=1
```

This is the pre-existing failure the brief names, unchanged in substance and at the same line as
R1 recorded it. It is not caused by this round, and it was not repaired.

### Where the ticket did not match reality

1. **§A9 names only the perspective camera, and the orthographic camera has the same problem.**
   `flat` stands at `state.distance` on its own axis with a fixed `near = -50`, `far = 200`
   (`camera.js`), and A3 made that standoff the free distance. On the 96 m stage of the new far-plane
   test the ortho camera sits 1105 m from the asset and its 200 m frustum would clip the whole
   scene. A9's sentence is limited to "the perspective camera", so the orthographic frustum is left
   alone and this is recorded rather than changed. A later amendment should give the ortho camera the
   same treatment, most likely `near = -far` and the same `far` bound.
2. **The candidate `blueprints/vehicules/red-sportster/generated/qwen3D-01.ts` is tracked, not
   git-ignored.** The page of this ticket and item 1 of the R1 notes both call it git-ignored, and the
   Scope Boundary says "this ticket writes no file there". Commit `d6912c2` ("keep one generated
   asset to prove the catalogue reads it", 23:06 today) added it to the repository, and this round's
   first `bun run format` therefore reformatted it: `143` insertions and `109` deletions. The change
   is whitespace and comment layout only; the transpiled code is token-identical, measured by
   stripping comments and whitespace from both transpiler outputs (`3238` characters each), and the
   file still transpiles and still exports its default. It is kept formatted because the gate
   `bun run format` must report no change (AC19), and because it is a generated candidate, not a
   source. The CTO can accept it, or add the file to `ignorePatterns` in `bunfig.toml` and revert
   it; both decisions are outside this sub-agent's Scope Boundary, and neither is taken here.
3. **The A7 table is at three decimals, so its test rows cannot use ten.** The R1 rows were exact
   short numbers (`1.5`, `2.5`), so they asserted `toBeCloseTo(…, 10)`. `1.914` is the rounded
   `1.914214`, and no ten-decimal assertion can accept it. The rows now assert `3` decimals, which is
   the precision §A7 states, and the unrounded rule is still proven by the `sqrt(2)` property test at
   12 decimals.
4. **AC12 of R1 already quoted the A7 diameters.** It says a 1 m cube stands "inside a 6.657 m disc"
   and a 4.30 m asset "inside a 17.971 m disc", which are the corner-based diameters; A1's own rule
   gave 5 m and 13 m. The two sections disagreed, and A7 resolves the disagreement in favour of
   AC12. No text changed, and this item records why AC12 needed no edit.
5. **A dolly can still leave the far plane behind.** `maxDistance = state.distance * 10` while
   `far = 3 * state.distance + groundRadius`, so a dolly past about three times the framing clips the
   ground. That is the same as the fixed `200 m` it replaces and §A9 fixes the formula, so the ratio
   is implemented as written. It shows only after an extreme wheel dolly.
6. **`syncFarPlane` also removes one `updateProjectionMatrix()` call from `resize()`.** §A9 asks for
   the update "followed by `updateProjectionMatrix()`"; `resize()` used to call it after setting
   `camera.aspect`, and `syncFarPlane` now does both, once instead of twice. Same matrix, one call.

### What is not proven here

No browser was launched, no screenshot was taken, and no capture loop was run. AC17 and AC18 are
visual judgements and stay with the art director: `frame.test.js` proves the geometry that makes them
possible (0.5 m past every corner, a darker metre layer at full alpha, a fainter sub layer below it),
and `camera.test.js` proves the far bound. Nothing here changes an acceptance criterion of R1 or of
the original ticket.

## Implementation Notes — amendment R3

Written by the coding sub-agent, 2026-11-17. The amendment is implemented as §A12 to §A14 state it.
No earlier section was rewritten: the two sentences that claimed the candidate is git-ignored carry a
**Corrected 2026-11-17** marker instead, and the earlier notes are left as the record of what was
known at the time. The ticket stays in `in_progress/`; nothing is committed.

### Files changed

| File                                        | Change                                                                                                      |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| `tools/scene-viewer/camera.js`              | `syncFarPlane()` → `syncClipping()`: both cameras, four call sites; the perspective `far` follows the dolly |
| `tools/scene-viewer/camera.test.js`         | the `the far plane` block becomes `the depth range`: four tests, the flat frustum, the farthest dolly       |
| `tickets/in_progress/T0015-scene-viewer.md` | §A12–§A14, T15.18, this section, and two corrections of the ignored-file claim                              |

`frame.js`, `stage.js`, `main.js`, `index.html`, `catalogue.ts`, `prelude.ts`, `server.ts`, `serve.ts`,
`package.json`, `README.md`, `bunfig.toml`, and `blueprints/**` are untouched by this round.

### Red before green (T15.18)

The four tests were written first, and run against the R2 code:

```text
$ bun test tools/scene-viewer/camera.test.js
(fail) the depth range > puts the farthest dolly of the free view inside the perspective frustum
  the `>=` assertion at camera.test.js:436 rejects the 3 x plane: 3520.1095 where the bound is
  `state.distance * 10 + groundRadius` = 11053.209 + 204.147 = 11257.356

(fail) the depth range > brackets the disc in the flat frustum
  Expected: > 1309.4676721739656 · Received: 200

(fail) the depth range > is rewritten wherever the distance changes
  Expected: 11461.50269788585 · Received: 3520.1095105584454

 18 pass
 3 fail
 74 expect() calls
Ran 21 tests across 1 file.
```

All three are the defect R2 recorded as "not proven" and left alone: the perspective `far` covers the
100 % framing instead of the farthest dolly, and the flat camera keeps `near -50 / far 200` at a
1105 m standoff. The fourth test — the small stage's `near 0.1` and `far 200` — passed before the
change, because R2 already put the `200 m` floor there; it is the regression gate for the new
formula.

After `syncClipping` replaced `syncFarPlane` in the four call sites:

```text
$ bun test tools/scene-viewer/camera.test.js
 22 pass
 0 fail
 80 expect() calls
Ran 22 tests across 1 file.
```

One test-side detail: the R2 helper `farBound` computed `Math.max(200, distance * 3 + radius)`. It
now computes `Math.max(200, distance * 10 + radius * 2)`, because a stale helper would have made the
old formula look correct under a renamed constant.

### Gates

```text
$ bun run format
Formatted 0 files, 183 unchanged
EXIT=0

$ bun test tools/scene-viewer
 109 pass
 0 fail
 373 expect() calls
Ran 109 tests across 9 files.

$ bun test
 255 pass
 0 fail
 692 expect() calls
Ran 255 tests across 21 files.

$ bun run check
[  0.0s] scene     r5-tl-1972
[  0.0s] capture   8 view(s): left,right,front,back,top,front-3q,rear-3q,iso
error: agent-browser open failed (1) [open]: ✗ Navigation failed: net::ERR_CONNECTION_REFUSED
error: capture failed (1)
      at run (…/workflows/threejs/tools/check.ts:174:14)
error: script "check" exited with code 1
EXIT=1
```

The scene-viewer suite was `108 pass` in 9 files before this round, and the root suite `254 pass` in
21 files. The delta is `+1` on both sides: `the far plane` held three tests and `the depth range`
holds four, and no file was added. `bun run check` is the pre-existing capture failure, at the same
line as R1 and R2 recorded, and it was not repaired.

### The ignored-file claim, corrected

The claim was wrong, and the file is right:

- `.gitignore` line 36 is `!blueprints/vehicules/red-sportster/generated/qwen3D-01.ts`, under a
  comment that states the file is committed on purpose;
- commit `d6912c2` ("keep one generated asset to prove the catalogue reads it (T0015)") added it with
  the line-12 repair.

So the candidate stays formatted as R2 left it, `bunfig.toml` keeps the one exclusion it had
(`fixtures/broken.ts`), and the file is not restored. Two sentences carried the false claim:

1. **§Scope Boundary**, in the "Repair" paragraph: it now says the file is committed evidence, that
   `.gitignore` un-ignores it on purpose, that `bun run format` may reformat it, and that its
   transpiled output does not change. The original words are quoted in the marker.
2. **AC9**: the sentence the brief quotes is in AC9, not in §Scope Boundary. It said "That file is
   git-ignored; it is evidence, not a fixture." It now says the file is committed evidence, that the
   formatter owns it, and it carries the same dated marker.

The reformatting itself was measured in R2 and did not change the transpiled code: the outputs are
token-identical after comments and whitespace are stripped (`3238` characters each), and the file
still transpiles and still exports its default.

### What this supersedes, and what is not proven

- R2's notes, item 1 ("§A9 names only the perspective camera…") and item 5 ("a dolly can still leave
  the far plane behind") describe the two defects this round fixes. They stay as written, and A12 is
  now the rule.
- No browser was launched, no screenshot was taken, and no capture loop was run. AC21 and AC22 are
  visual judgements and stay with the art director; `camera.test.js` proves the geometry that makes
  them possible — the flat frustum around the disc at a 1105 m standoff, and the `far` plane beyond
  the 1000 % dolly — and nothing else here changes an acceptance criterion of R1 or R2.

## Contract amendment R4 — the zoom row in the free view (2026-11-17)

Third review remark, by the art director, on the running page: the `zoom` row of the HUD read a
dash on a free view. **A15 supersedes** the `—` of §2 and of R1's AC14.

### A15 — One zoom number, two projections

- `zoomPercent()` of the rig returns an integer in `[10, 1000]` in **both** projections:
    - flat: `Math.round(ortho.zoom * 100)`, unchanged;
    - free: `Math.round((state.distance / radius) * 100)`, where `radius` is
      `camera.position.distanceTo(orbit.target)`. `state.distance` is the 100 % reference of the free
      view, so the two projections read the same scale, and the dolly limits of §A3
      (`distance / 10` … `distance * 10`) give the same 10 %–1000 % range as the flat zoom.
    - The value is clamped to `[10, 1000]` after rounding, and a non-finite or non-positive radius
      answers `100` instead of a blank.
- `stage.js` writes `${rig.zoomPercent()} %` whenever a rig exists, with no projection test.
- `main.js` subscribes the zoom row to the perspective instance's `change` event as well as the
  flat one, so a wheel dolly updates the row while it happens. The event list is the only source of
  the update: no polling, and the idle loop stays asleep.
- The HUD row is therefore `NN %` on the six flat views and on the free view, and `—` only before a
  rig exists.

### A16 — Task and gates

- [x] **T15.19 — The zoom row**: a failing test on `zoomPercent()` in the free view (100 % at the
      reference, 200 % at half the radius, 50 % at twice, 1000 % and 10 % past the limits), the
      `placeCamera("left")` fixture in the flat-zoom test, then `camera.js`, `stage.js`, `main.js`.
      `bun test` is green.
- **AC24 — The row.** Both projections print a percentage between 10 % and 1000 %, and the free
  view's number follows the wheel live.

## Contract amendment R5 — the spin starts where the camera is (2026-11-17)

Last review remark, by the art director: pressing `spin` must start from the **current** free camera
position and zoom. It jumped, because the read-back restored only the azimuth and the radius.

### A17 — Read azimuth, elevation and radius from the active camera

- `spinStart()` reads **all three** components of `activeCamera.position - state.target`:
  `azimuth = atan2(offset.z, offset.x)`, `elevation = asin(offset.y / |offset|)`,
  `distance = |offset|`. §5 restored only the first and the third, so a hand orbit that changed the
  elevation jumped vertically on the first frame, and a wheel dolly jumped in depth.
- A flat view cannot orbit. The spin keeps the direction and the standoff it just read and takes the
  perspective projection through `applyCamera()`; it no longer calls `placeCamera("free")`, which
  reset the framing to the preset. The projection change and the close-up-to-disc framing change
  that a flat view implies are the only motion the press causes.
- The motion itself is unchanged: `spinStep` rewrites the azimuth and places the camera from
  `(azimuth, elevation, distance)`, so the camera turns around the **vertical axis through the
  target**, at a constant elevation and a constant radius, without touching `OrbitControls`.
- Known limit, recorded rather than solved: a spin started from the `top` or `bottom` preset inherits
  its 89.99° elevation, and a rotation at that elevation barely moves the camera. The rule is
  "start from the current camera", and the presets are the current camera.

### A18 — Task and gates

- [x] **T15.20 — The read-back**: a failing test on a manual camera at 64° and 0.7 × the disc radius
      (100 % starts at 30° and 1.0 ×), asserting `spinStart()` + `spinStep(0)` moves the camera less
      than 1e-6 m and that the state holds `64` and the radius. Then `spinStart()` in `camera.js`.
      `bun test` is green (111 tests in the viewer folder).
- **AC25 — The spin.** Pressing `spin` after any orbit or dolly turns the camera without a jump in
  angle, elevation, or zoom, and the turn stays at the elevation the camera had.

## Contract amendment R6 — a failure leaves the page usable (2026-11-17)

Review remark, by the art director: opening `fixtures/broken.ts` showed the right message, but the
box could not be closed and the view bar never appeared. Two defects, one cause each.

### A19 — The picker is built before the asset loads

`boot()` built the whole bar after the rig, and the rig after the asset. A candidate that does not
parse threw before the bar existed, so the only way to another candidate was a manual reload.

- `buildPicker(assets, path)` is a top-level function, and `boot()` calls it **before** the import.
  It appends the picker to `#views` and nothing else.
- The view buttons and the spin button stay where they are, after the rig: they call `setView` and
  `setSpin`, which need a rig, and a failed load creates none. A broken asset therefore leaves a bar
  with the picker only — a control that works — and no control that would throw.
- The contract of §12 is unchanged: a failure still stops before `window.__ready`.

### A20 — The error box has a dismiss control

- `#error` becomes a container: a `<pre id="error-text">` for the message and a
  `<button id="error-close" type="button">dismiss</button>`. The styling of the box is the §2 plate
  unchanged; the button borrows the padding, radius and type of `#views button` and the palette of
  the box, so no new size, weight or colour enters the sheet.
- The listeners are wired **once**, at module scope: a click on `dismiss` hides the box, and `Escape`
  hides it too. Wiring them inside `fail()` would stack a listener per failure.
- A dismissal shows the page as it stands: a broken asset has no model, so the canvas stays empty and
  the picker stays at the bottom, ready for the next choice.

### A21 — Acceptance

- **AC26 — The failure.** Opening `?asset=tools/scene-viewer/fixtures/broken.ts` shows the box with
  the transpiler message, the box closes on `dismiss` and on `Escape`, and the picker is present and
  navigates to another candidate. No console error is raised by the viewer itself.

## Contract amendment R7 — a failure keeps the stage (2026-11-18)

Review remark, by the art director: a candidate that does not load left a blank page. The message is
about the **model**, not about the scene: the grid, the disc, the HUD and the view bar must stay, and
the stage must simply hold no model. This supersedes the closing sentence of §A20.

### A22 — The stage is built before, and without, the asset

- `boot()` no longer throws on a load failure. It keeps `loadError`, and the asset section sets
  `root = null` and `measured = null`.
- The frame falls back to the stage of a **one-metre cube** — `frameFrom({ size: [1, 1, 1], target:
[0, 0.5, 0] })` — when there is no measurement, so the empty page opens on the same ground a small
  candidate would get: a 4 × 4 m grid inside a 6.657 m disc, framed by the free view's 100 %.
- `createStage` runs in every case; `stage.setRoot(root)` runs only when an asset loaded. The ground,
  the lights, the idle loop, the HUD and the view bar are the ones the page always builds.
- The HUD rows `tris`, `meshes` and `size` read **`—`**, never `0`: a zero is a measurement, and a
  failure has none. `stage.js` accepts `null` in the report for that.
- `window.__stats()` answers `null` for those three fields, and `window.__ready` stays unset: the page
  is drawable, and the asset is not loaded.
- `fail(loadError)` is called **last**, after the rig, the bar and the first HUD update, so the
  message sits over a page that already draws.
- The contract of §12 stands otherwise: the box is dismissable (A20) and the picker works (A19).

### A23 — Acceptance

- **AC27 — The empty stage.** Opening `?asset=tools/scene-viewer/fixtures/broken.ts` shows the box,
  and behind it the round disc, the metre grid, the HUD with `—` for the three asset rows, and the
  full view bar. The named views, the free view, the zoom range and the spin all work on the empty
  stage; only the model is missing.

## Contract amendment R8 — the pole up vector (2026-11-18)

Review remark, by the art director: pressing `spin` on `top` or `bottom` gave a free view with some
axes inverted. All four side presets transitioned correctly.

### A24 — The free view is always upright

- The `top` and `bottom` presets of `views.js` carry `up: [0, 0, -1]`, with the reason written there:
  an orthographic camera at ±89.99° cannot use the world `+Y` as its up vector, and `-Z` puts the
  asset's width on the screen's horizontal.
- `spinStart()` read the direction and the distance from the active camera but kept `state.up`, so
  the perspective camera inherited `[0, 0, -1]` from the pole preset. `OrbitControls` builds its
  spherical from `camera.up`: the ground lay on its side, and every orbit gesture after the spin
  moved the camera on swapped axes.
- The switch to the perspective projection now resets `state.up = [0, 1, 0]` before `applyCamera()`,
  so the free view is upright whatever preset the spin was started from. A side preset that already
  carries no `up` is unaffected: it resolves to `[0, 1, 0]` by the same default of §5.
- The elevation is kept as it was read, per §A17: a spin started from a pole turns at that pole, and
  the ground disc is single-sided, so the view from below shows the grid and the asset through it.

### A25 — Acceptance

- **AC28 — The pole transition.** From `top` or `bottom`, `spin` gives an upright free view, the
  ground lies flat, and a left drag after the stop orbits on the same axes as any other free view.
  The new test asserts `camera.up` is `[0, 1, 0]` after `spinStart()` and after `spinStop()`, and
  that the flat preset really did carry `[0, 0, -1]` before the press.

## Closed

Accepted by the art director on 2026-11-18, after eight review amendments (R1 to R8) that were all
iterations of the same review: the stage that follows the asset, the free view that frames the disc,
the counter-clockwise spin, the zoom row in both projections, the corners of the disc, the weight of
the grid lines, the depth range, the failure path, the empty stage, and the pole up vector.

- **Evidence beside this ticket**: `T0015-spin-pole-inverted-axes.png`, the screenshot the art
  director sent when the free view came out rolled after a spin started from `bottom` (R8).
- **Gates at close**: `bun test` 258 pass, 0 fail, 708 `expect()` calls, 21 files; `bun run format`
  0 changed; `bun run check` unchanged at the pre-existing `capture failed (1)`.
- **Left local on purpose**: `blueprints/vehicules/red-sportster/generated/qwen3D-01.ts` is
  reformatted by the gate and committed with this ticket; `workflows/threejs/scenes/r5-tl-1972/contours.js`
  holds knot data the art director saved in an earlier session, and is not part of this ticket.
