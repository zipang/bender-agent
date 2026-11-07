# The vcad workflow

Status: **not used by this project.** The R5 and the minivan are built in Three.js. This document
describes what vcad is, what it was used for, and why the project left it, so the server stays
configured and the tool stays readable instead of becoming a mystery in `opencode.jsonc`.

## 1. What vcad is

vcad is a parametric CAD server with a real BRep kernel, exposed over MCP as `@vcad/mcp`. It runs
locally with Bun and needs no third application.

| Property | Value |
| :--- | :--- |
| Server | `{env:HOME}/.bun/bin/bunx @vcad/mcp` |
| Coordinate system | Z up, X right, Y forward |
| Units | millimetres for fabrication, metres for a game asset. Set the unit before the first primitive |
| Kernel | BRep and CSG: exact booleans, fillets, chamfers, shells, lofts, sweeps, patterns |
| Export | STL, GLB, STEP |
| Durability | sessions are stored on disk; a server restart still kills a live `document_id` |

## 2. What vcad was used for here

The first attempt at the R5 used vcad to build the body as a set of masses and booleans. It
produced geometry, and the geometry was wrong in ways that were hard to see:

| Symptom | Cause |
| :--- | :--- |
| Moiré on the flank | booleans produced near-coplanar faces |
| A listed primitive rejected by the engine | `wedge` was in the type catalog and not in the engine |
| Duplicated geometry | a stale part id silently duplicated instead of failing |
| A lost transform | a second `translate` replaced the first instead of wrapping it |

None of these is fatal alone. Together they make every pass slower than the one before, because the
model accumulates damage that no render shows until it is late.

## 3. Why the project left it

The rule is that the tool must match the deliverable. The deliverable here is a stylized game asset
judged by its silhouette, and a BRep kernel is built for tolerances and machining.

So the effort went to the wrong risk. vcad is exact, and exactness is what a part that must fit
needs. A figurine needs a faithful outline and a clean topology, and it is judged on a picture.

The replacement is a Three.js scene built from three traced silhouettes. It closes the loop in
under a second and writes a `.glb` with no kernel in the way. See
[`../threejs/README.md`](../threejs/README.md).

vcad stays installed for the case it is good at: a part that must fit another part, a mechanical
assembly, or a fabrication export.

## 4. The tools

| File | Role |
| :--- | :--- |
| `tools/export.ts` | Export one session: a `.glb`, plus one WebP per named view |

`export.ts` exists for one reason. The MCP host turns a `render_view` picture into an attachment and
strips the payload from the tool result, so the agent sees the image and cannot write it. This
script speaks JSON-RPC to the server over stdio and keeps the bytes.

```bash
bun run workflows/vcad/tools/export.ts \
  --document doc_4_1brZqzecRqL8VIur \
  --out blueprints/vehicules/<subject>/model/<asset>-S1 \
  --views iso,front,left,back,right,top
```

It writes `<out>.glb` and one `<out>-<view>.webp` per view. The view list comes from the Three.js
view table, `workflows/threejs/viewer/views.json`, which records the angles in both frames. One
table, two readers: a rename cannot leave one tool behind.

## 5. Where the documentation lives

| Question | Document |
| :--- | :--- |
| What are the vcad tools, and how are they called? | this file |
| What are the rules for an agent that uses vcad? | [`AGENTS.md`](./AGENTS.md) |
| What method does the project follow today? | [`../threejs/README.md`](../threejs/README.md) |
| Why was the method changed? | [`../../research/threejs-modelling-loop.md`](../../research/threejs-modelling-loop.md) |
| What does the fidelity ladder require in general? | [`../../research/progressive-volume-modeling.md`](../../research/progressive-volume-modeling.md) |
