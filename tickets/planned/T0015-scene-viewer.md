# T0015 — The scene viewer: one page for a delivered asset

- **Track**: Shared scene viewer (the base of two workflows)
- **Wave**: 1 (independent of the drafter)
- **Depends on**: T0014 (the root `tools/` directory)
- **Blocks**: T0016 (the Qwen 3D Coder asset drafter)
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

**Modify:** `README.md` — the repository tree, and four glossary entries: **Asset catalogue**, **Scene
viewer**, **Spin**, and **Root tool** (the root `tools/`, read by several workflows, as opposed to
`workflows/<name>/tools/`, read by one).

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

Copy `viewBasis` and the `SHARED` table of `workflows/threejs/viewer/camera.js` without a change:

- `enableDamping: true`, `dampingFactor: 0.08`, `zoomToCursor: true`, `screenSpacePanning: true`;
- `minZoom: 1`, `maxZoom: 10`, `minDistance: 3`, `maxDistance: 24`, `maxPolarAngle: Math.PI / 2`;
- `mouseButtons: { LEFT: PAN, MIDDLE: DOLLY, RIGHT: null }`;
- `orbit.enableRotate = true`, `flat.enableRotate = false`; this is the single difference of the
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
- `spinStart()` switches to the `free` view when the current view is orthographic, disables both
  controls, and clears the orbit inertia.
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

| Route                    | Answer                                                                                        |
| :----------------------- | :-------------------------------------------------------------------------------------------- |
| `/`                      | `302` to `/viewer/` with the same query, and `asset` set to `--asset` when the query has none |
| `/viewer/`               | `index.html`                                                                                  |
| `/viewer/*`              | a file of `tools/scene-viewer/`, and a path outside that folder is `403`                      |
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
- `valid` is decided by `new Bun.Transpiler({ loader: "ts" }).transformSync(withThreeImport(source))`
  inside a `try`. A throw gives `valid: false` and the error message. The catalogue **never imports
  or executes** a candidate: a listing has no side effect.
- The list is sorted by `path`, with `localeCompare(a, b, "en")`, so two runs give the same order.
- The catalogue reads no cache: a handful of files, each a few kilobytes.

### 11. The import prelude (`prelude.ts`)

```ts
export const THREE_IMPORT = 'import * as THREE from "three";\n';
export function withThreeImport(source: string): string;
```

- The rule is anchored on an **import statement**, not on the bare word: the source already matches
  `/^\s*import\b[^;]*\bfrom\s*["']three["']/m` → it is returned unchanged, otherwise
  `THREE_IMPORT` is prepended.
- The anchor matters: a comment that mentions `three`, or a string that holds it, does not stop the
  prelude. A file that imports `Mesh` from `three` does.
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
  suffix ` (invalid)` and the `title` of its error. The `select` shows the current path.
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

- [ ] **T15.1 — The view table, the measurement, and the frame**: write `views.test.js`,
      `measure.test.js`, and `frame.test.js` first. They assert the seven views and their order, the
      triangle and mesh counts of two boxes, the bounding box of an offset object, the five
      coefficients, and the throw on an empty object.
- [ ] **T15.2 — The spin and the camera**: write `spin.test.js` first. Assert the four cases of §6,
      the 12 s period, and normalization. Write `camera.test.js` with a fake canvas and a stubbed
      `window` (`innerWidth`, `innerHeight`): `viewBasis` for `left`, `front`, and `top`, the throw on
      an unknown view, and `placeCamera("bottom")` with a camera `y` below the frame target. The last
      assertion fails if `flat.maxPolarAngle` is `Math.PI / 2`.
- [ ] **T15.3 — The asset contract**: write `contract.test.js` first. Cover a missing default, a
      default that is not a function, a return that is not an `Object3D`, a group with no mesh, and
      an empty object with a non-finite size.
- [ ] **T15.4 — The catalogue and the prelude**: write `prelude.test.ts` and `catalogue.test.ts`
      first. `withThreeImport` returns a source that already imports `three` unchanged, prepends on a
      source without it, and prepends on a source that only mentions `three` in a comment. The
      catalogue lists `fixtures/cube.ts`, `fixtures/no-import.ts`, and `fixtures/broken.ts`; it marks
      the first two `valid` and the third `valid: false` with its `Unexpected` message; it returns an
      empty list for an empty root; it finds a fake tree under `.tmp/` with
      `blueprints/vehicules/<subject>/generated/a.ts`; and it sorts by path.
- [ ] **T15.5 — The server**: write `server.test.ts` first. Start `createServer` on port `0` with
      `fixtures/cube.ts`. Assert the redirect, the page, the three module, the transpiled asset
      (`text/javascript`, no `interface`, no `: THREE.`, and `export default`), `GET /api/assets`
      (`application/json`, the three fixtures, sorted), the prelude on `/asset/…/no-import.ts`,
      exactly one `three` import on `/asset/…/cube.ts`, the `403` on a `.js` asset, the `403` on
      `node_modules`, and the `404` on a missing file. Close the server in `afterAll`, so a failing
      test never leaves a port open.
- [ ] **T15.6 — The page**: write `index.html`, `stage.js`, `camera.js`, and `main.js`. Keep the
      comments of the Three.js viewer where the code is copied, and rewrite them where the reason is
      gone: no calque, no knot, no capture mode. The picker is composed with the same CSS variables as
      the buttons, and it does not introduce a new size, color, or radius.
- [ ] **T15.7 — The gates**: `bun run format`; `bun test tools/scene-viewer`; `bun test` at the root.
      Then run the manual check of the acceptance criteria, and record the exact output in
      `## Implementation Notes`.

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
  whose first line is `import * as THREE from "three";`.
- **AC7 — The failures.** A missing file, a module without a default export, a `build()` that
  returns `{}`, and the `broken.ts` syntax error each show the error box with a named reason, and no
  model. `broken.ts` shows the `Bun.Transpiler` message.
- **AC8 — The catalogue.** `curl -s http://127.0.0.1:5181/api/assets` returns
  `application/json`, lists the three fixtures, and marks `broken.ts` `valid: false` with an `error`.
  The picker shows the same list, marks `broken.ts` `(invalid)`, and a change of selection reloads the
  page on the chosen asset.
- **AC9 — A real candidate.** With the server running, the picker lists
  `blueprints/vehicules/red-sportster/generated/qwen3D-01.ts`, the page draws it (its missing `three`
  import comes from the prelude), and the HUD shows a non-zero triangle count. That file is
  git-ignored; it is evidence, not a fixture.
- **AC10 — The gates.** `bun test` at the root is green, and `bun run format` reports no change.
- **AC11 — The manual QA.** The art director opens the page, compares the style with the Three.js
  viewer, and judges the spin. This ticket never takes a screenshot itself.
