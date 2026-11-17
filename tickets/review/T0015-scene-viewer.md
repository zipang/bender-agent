# T0015 — The scene viewer: one page for a delivered asset

- **Track**: Shared scene viewer (the base of two workflows)
- **Wave**: 1 (independent of the drafter)
- **Depends on**: T0014 (the root `tools/` directory)
- **Blocks**: T0016 (the Qwen 3D Coder asset drafter)
- **Owner**: coding sub-agent, supervised by CTO
- **Started**: 2026-11-17
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
`const voxelDetails: THREE.Mesh[] = [];`. That file is a git-ignored candidate, not a source file: the
repair changes no tracked file, and the ticket records it because AC9 opens that candidate. Every
other line of that file is untouched.

**Modify:** `README.md` — the repository tree, one command block that runs the viewer, and four
glossary entries: **Asset catalogue**, **Scene viewer**, **Spin**, and **Root tool** (the root
`tools/`, read by several workflows, as opposed to `workflows/<name>/tools/`, read by one).

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
| `zoom`   | the orthographic zoom as `NN %`, and `—` on a free view                 |

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
- `spinStart()` switches to the `free` view when the current view is orthographic, **reads the camera
  back into the state** — `state.azimuth = Math.atan2(offset.z, offset.x)` and `state.distance =
offset.length()`, from `camera.position - state.target` — then disables both controls and clears the
  orbit inertia. Without that read, a spin started after a manual orbit or a wheel dolly snaps the
  camera back to the last preset angle and distance, and the first frame of the spin jumps.
- `spinStep(dtMs)` advances `state.azimuth` with `nextAzimuth` and places the perspective camera from
  the state, without running `OrbitControls.update()`.
- `spinStop()` re-enables the controls of the current projection, copies `state.target` into
  `orbit.target`, and calls `orbit.update()` once so the next drag starts from the spun position.

### 6. The spin (`spin.js`)

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

- **AC1 — One command opens one asset.** `bun run tools/scene-viewer/serve.ts` with no `--asset`
  prints the URL, and the page opens the first valid asset of the catalogue. With
  `--asset tools/scene-viewer/fixtures/cube.ts` it opens the cube instead.
- **AC2 — The HUD.** The panel shows the six rows, the heading reads the asset slug, `tris` and
  `meshes` are non-zero, `size` reads `1.00 × 1.00 × 1.00` for the cube, and `zoom` reads `—` on the
  free view.
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
  git-ignored; it is evidence, not a fixture.
- **AC10 — The gates.** `bun test` at the root is green, and `bun run format` reports no change.
- **AC11 — The manual QA.** The art director opens the page, compares the style with the Three.js
  viewer, and judges the spin. This ticket never takes a screenshot itself.

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
