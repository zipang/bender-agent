# The Blender workflow

Status: **not the active workflow of this project.** The R5 and the minivan are built in Three.js.
This document describes what the Blender workflow is, how its server is set up, and what it is
good at, so the knowledge survives without being mixed into the workflow that runs today.

## 1. What Blender is, here

Blender is a polygon modeller, and the server is `mcp-for-blender`. It drives a **running** Blender
instance: the tools do not start one, and a call fails when the add-on is not listening.

| Property | Value |
| :--- | :--- |
| Server | `{env:HOME}/.local/bin/uvx mcp-for-blender` |
| Transport | a socket to the add-on, `localhost:9876` by default |
| Coordinate system | Z up, front along `-Y` |
| Units | 1 unit = 1 metre for a game asset |
| Export | glTF 2.0 `.glb`, with `export_yup=True` |

The MCP server reports `connected` even when Blender is closed, because the MCP process is up.
The tools then answer:

```text
Could not connect to Blender. Make sure the Blender addon is running.
```

The fix is in Blender, not in the config: **3D Viewport > `N` > MCP for Blender > Start MCP Server**.

## 2. Setup, once per machine

1. Install the `uv` launcher. The Astral installer puts `uvx` in `~/.local/bin`.
2. Install the add-on:

```bash
uvx mcp-for-blender install-addon
```

   It copies `blender_mcp.py` to `~/.config/blender/<version>/scripts/addons/`.

3. In Blender: **Edit > Preferences > Add-ons**, search **Interface: MCP for Blender**, enable it.
4. Open the sidebar, select the **MCP for Blender** tab, click **Start MCP Server**.

Check the connection from the shell:

```bash
opencode mcp list
```

## 3. What this workflow is good at

| Task | Why Blender |
| :--- | :--- |
| Organic and blended forms | subdivision, sculpting, retopology |
| A finished look | PBR materials, HDRI lighting, cameras, render passes |
| Rigging and animation | armatures, skin weights, keyframes, and a glTF clip |
| Asset libraries | `search_assets` and `import_asset`: Poly Haven, Poly Pizza, Sketchfab |
| Cleanup of imported geometry | merge by distance, normals, decimation, UV unwrap |

It is a poor tool for a shape that must be exact against a drawing. A measured silhouette is better
built from numbers, and that is the reason the Three.js workflow exists. See
[`../threejs/README.md`](../threejs/README.md).

## 4. The tools

This workflow has no repository tool of its own today. Everything runs through the MCP server, and
the skill in `.agents/skills/blender-mcp/SKILL.md` holds the tool catalog and the Python patterns.

When a Blender-generated asset joins a Three.js scene, the rules are in [`AGENTS.md`](./AGENTS.md).

## 5. Where the documentation lives

| Question | Document |
| :--- | :--- |
| What are the Blender tools, and how are they called? | `.agents/skills/blender-mcp/SKILL.md` |
| What are the rules for an agent that drives Blender? | [`AGENTS.md`](./AGENTS.md) |
| What method does the project follow today? | [`../threejs/README.md`](../threejs/README.md) |
| What does the fidelity ladder require in general? | [`../../research/progressive-volume-modeling.md`](../../research/progressive-volume-modeling.md) |
