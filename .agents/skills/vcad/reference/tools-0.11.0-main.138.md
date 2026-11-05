# vcad MCP tool index — generated reference

Captured from `tools/list` on server version **0.11.0-main.138+2df8f6d** on 2026-11-05.
Stars mark required arguments. Full JSON schemas stay on the server: this index is for lookup.

Do not edit by hand.

---

### `add_coil`

Add a spiral copper coil (Archimedean) to the PCB — the primitive for PCB-motor stators and planar inductors. Generates the trace geometry on a layer,

**args:** document_id, document, center*, turns*, inner_radius*, outer_radius*, trace_width*, clearance, net*, layer, direction, start_angle_deg, segments_per_turn, inner_via, via_to_layer, inner_lead_out, layers

### `add_coil_array`

Lay a ring of `count` spiral coils evenly around `center` at `pitch_radius` — the placement primitive for a PCB-motor stator. Net per coil comes from 

**args:** document_id, document, count*, center*, pitch_radius*, start_angle_deg, turns*, inner_radius*, outer_radius*, trace_width*, layer, clearance, net_sequence, net, chirality, segments_per_turn, inner_via, via_to_layer

### `add_constraint`

Add solver-enforced geometric constraints to the document and solve immediately — KiCad-v11-class constraints generalized to the whole design: PCB foo

**args:** document_id*, constraints*

### `add_motor_winding`

One-shot motor winding realizer: plans a balanced slots/poles/phases winding, drops a spiral coil per tooth with correct phase + polarity, series-conn

**args:** document_id*, document, slots*, poles*, phases, turns_per_coil, connection, center*, pitch_radius*, inner_radius*, outer_radius*, trace_width*, copper_layer, return_layer, phase_nets, neutral_net, clearance, segments_per_turn

### `add_net_tie`

Declare an intentional junction between >= 2 nets (a net-tie) so DRC treats them as one node where they meet — required for wye/star motor neutrals, s

**args:** document_id*, document, nets*, position, radius

### `add_trace`

Lay an explicit copper trace: a polyline of segments on a layer, assigned to a net. The general-purpose routing primitive — use it for coil interconne

**args:** document_id*, document, points*, layer, net*, width

### `add_via`

Drop a via at a point connecting two layers on a net (defaults FCu→BCu, diameter/drill from design rules). Pairs with add_trace for multi-layer routin

**args:** document_id*, document, position*, net*, start_layer, end_layer, diameter, drill

### `add_via_array`

Place many vias at once — a grid over a rectangular `region` (thermal vias under FETs, GND-plane stitching) or an explicit `points` list. Grid vias ar

**args:** document_id*, document, net*, region, points, pitch, start_layer, end_layer, diameter, drill, clip_to_board

### `add_zone`

Add a copper pour (ground/power plane) on a net+layer — fills are not traces. `fill_board:true` pours the whole outline (cutouts become voids); or giv

**args:** document_id*, document, net*, layer, fill_board, outline, clearance, thermal_relief, thermal_gap, thermal_spoke_width, fill_type, min_area, priority, allow_overlap

### `analyze_antenna`

Thin-wire method-of-moments antenna analysis over a frequency band: per-frequency Z_in and S11 sweep rows, minimum-S11 point, in-band resonance (Im Z 

**args:** spec*, parameters, band*, options

### `analyze_structure`

Static structural FEA on a part's real geometry with fail-closed mesh-convergence gating: linear-tet fill of the tessellated interior at 2+ refinement

**args:** document_id*, part*, loads*, supports*, youngs_modulus_mpa, poisson, yield_strength_mpa, resolution, levels, displacement_tol, stress_tol

### `analyze_tolerance_stackup`

Dimensional tolerance stackup analysis over a linear assembly chain: worst-case extremes, RSS statistics (yield, Cp/Cpk), seeded Monte Carlo fit proba

**args:** spec*, parameters, options

### `animate`

Set (or clear) the document's animation timeline: keyframe named parameters, joint states, instance visibility, or a global explode factor, plus decla

**args:** document_id*, timeline, keyframes, fps

### `apply_edits`

Apply an ordered list of edit ops (create/update/delete/set_material) to a session document atomically — all-or-nothing. One call replaces N single-no

**args:** document_id*, ops*, dry_run

### `authorize_spend`

Propose a spend authorization for a QUOTED order. Creates a DB-backed, revocable authorization (status pending_human) and records the proposal on the 

**args:** order_id*, max_amount_minor

### `batch_create_envs`

Create N parallel simulation environments from a single robot assembly. Session-first: pass the `document_id` of the open assembly, or inline `documen

**args:** document_id, document, n_envs*, end_effector_ids*, dt, substeps, max_steps, ground_enabled, ground_height, ground_friction, ground_restitution

### `batch_reset`

Reset all environments in a batch to their initial state. Returns initial observations for all environments.

**args:** batch_id*

### `batch_step`

Step all environments in a batch simultaneously with per-env actions. Returns observations, rewards, and done flags for all environments. action_type 

**args:** batch_id*, action_type*, actions*

### `beam_check`

Closed-form structural check of a PRISMATIC member — the audited answer for thin-walled geometry, where the lattice in analyze_structure cannot put en

**args:** profile*, length_mm*, end_condition*, transverse_force_n, bend_axis, torque_nmm, axial_force_n, youngs_modulus_mpa, poisson, yield_strength_mpa

### `board_from_solid`

Derive a PCB outline polygon (with cutouts, e.g. a center bore) from a solid part in a CAD session by projecting its geometry onto the XY plane. Bridg

**args:** document_id*, part_id, thickness, resolution, simplify_tolerance

### `bom_add_line`

Append one line to a BOM from bom_create. kind 'manufactured': name + process (or a quote_id from quote_manufacturing, which auto-fills process, vendo

**args:** bom_id*, kind*, name, description, qty, unit_price_usd, vendor, notes, process, quote_id, order_id, document_id, artifact, material, spec, example_pn, catalog_id

### `bom_check_stock`

Annotate a BOM with live LCSC/JLCPCB stock and price. Takes a bom_id, BOM CSV text, or inline lines (MPN / LCSC# / passive spec + qty per board). Retu

**args:** bom_id, csv, lines, builds

### `bom_create`

Create a project bill of materials — the deliverable that collects every manufactured part (PCBs, sheet metal, 3D prints; link quote_manufacturing quo

**args:** title, document_id, assembly_notes, lines, from_geometry

### `bom_export`

Render a BOM as markdown (the shareable deliverable: manufactured-parts table with vendors/prices/artifact sources, COTS table with specs and example 

**args:** bom_id*, format

### `branch_from`

Re-open a checkpoint (from checkpoint_document). Omit `into` to BRANCH into a fresh session id — a variant to explore. Pass `into: <document_id>` to R

**args:** checkpoint_id*, into

### `build_receipt`

Build a re-runnable verification Receipt for the session PCB: a content hash, the DRC backend, a canonicalized DRC summary, and per-part provenance — 

**args:** document_id, enclosure_document_id, clearance

### `calc_coil`

Analyze a planar spiral coil: inductance (modified Wheeler), DC resistance, copper length, and L/R time constant. The analyzer for the planar-magnetic

**args:** inner_radius*, outer_radius*, turns*, trace_width*, copper_thickness, resistivity, geometry

### `calc_impedance`

Calculate trace impedance using IPC-2141 formulas. Supports microstrip, stripline, and differential pair configurations. Returns Z0, effective Er, and

**args:** trace_width*, copper_thickness, dielectric_height*, dielectric_er, trace_type, spacing, document_id, net

### `calc_motor`

Evaluate motor performance AS DATA. mode:'pm' (default): torque constant Kt, back-EMF constant Ke, no-load speed, stall torque, and a speed–torque cur

**args:** mode, pole_pairs*, turns_per_phase*, winding_factor, inner_radius_mm, outer_radius_mm, phase_resistance_ohm, supply_voltage_v, airgap_flux_tesla, magnet, phase_current_a, electrical_freq_hz, effective_gap_mm, sheet_conductance_s, end_effect_factor

### `calc_rf`

Frequency-domain (AC) analysis of an RLC resonator: sweeps complex impedance over frequency and reports |Z|, phase, and S11/return-loss vs a reference

**args:** topology, r_ohm*, l_henry*, c_farad*, z0_ohm, f_start_hz, f_stop_hz, points

### `call_loon`

Instantiate a stored loon macro into a new document: positional numeric args in the macro's declared order (see list_loons). Returns the document and 

**args:** name*, args*, material, macro, format

### `check_clearance`

Measure the minimum distance between two groups of parts in a CAD session and assert it stays above `min_mm` — air gaps, press fits, screw-head cleara

**args:** document_id*, group_a, group_b, min_mm, label, allow_contact, joint_state, sweep, include_samples, ignore_pairs, ignore_fixed_joints, ignore_adjacent

### `check_enclosure_fit`

Cross-check a board (board session) against the enclosure it ships in (a CAD session holding the case solid) — the verification axis no EDA tool has, 

**args:** document_id*, enclosure_document_id*, enclosure_part_id, clearance, standoff_height, board_offset, board_rotation_deg, hole_tolerance, derive

### `check_joint_range`

Joint range-of-motion clearance sweep for a jointed assembly. For each revolute joint (or the named `joints`), drives it from 0 toward each declared l

**args:** document_id*, joints, step_deg, threshold_mm3, resolution_mm, scope

### `check_part_stock`

Live stock + price check for electronic parts against public LCSC and JLCPCB listings (no credentials). Accepts an MPN, an LCSC#, or a passive spec li

**args:** query, queries, qty

### `check_self_start`

Will it spin? Starting torque (direct, or Kt·I; induction: the locked-rotor torque from calc_motor) vs a friction estimate (direct, or the built-in be

**args:** available_torque_nm, kt_nm_per_a, current_a, friction_torque_nm, bearings

### `checkpoint_document`

Snapshot a session's current state as a durable, restorable checkpoint. Returns a `checkpoint_id`. Use it at known-good milestones (post-schematic, po

**args:** document_id*, label

### `close_document`

Close a document session and free its memory. Idempotent — closing an unknown id reports `closed: false`.

**args:** document_id*

### `continue_document`

Open the user's vcad.io part as an editing session from a 'Continue in Claude' handoff (a share `token`, or an inline `doc` for accountless handoffs).

**args:** token, doc

### `create`

Add a single feature node to a session document: a primitive (cube/cylinder/sphere/cone), boolean (union/difference/intersection), transform (translat

**args:** document_id*, name, params*, parent_part_id, type*

### `create_cad_loon`

The preferred authoring tool for whole parts and multi-feature models — one call, full vocabulary. Create a CAD document from loon source code. Loon i

**args:** document_id, source*, use_loons, loons, modules, base_dir, files, format

### `create_robot_env`

Create a physics simulation environment from a vcad assembly. Session-first: pass the `document_id` of the assembly already open — the env binds to th

**args:** document_id, document, end_effector_ids*, dt, substeps, max_steps, joint_gains, config, ground_enabled, ground_height, ground_friction, ground_restitution

### `create_schematic`

Create a schematic from components plus connectivity, and open it as a server-side session. Declare connectivity as data with `nets` ({"PHA": ["L1.1",

**args:** title, components*, wires, labels, nets, power_flags, sheets, instances, global_nets

### `critique_route`

Audit one net's routing without changing anything: total length, via/layer-change count, the closest approach to other-net copper, and any clearance/s

**args:** document_id, document, net*

### `define_loon`

Add a reusable parametric macro to the loon library. Provide loon source defining [let <name> [fn [params...] <Solid-expr>]] plus parameter docs with 

**args:** name*, description*, params*, source*

### `delete`

Delete a part from the document.

**args:** document_id*, part_id*

### `delete_constraint`

Delete a design constraint by id or label (or `all: true` to clear the set). Frees degrees of freedom; geometry stays where it is.

**args:** document_id*, id, all

### `delete_net_tie`

Remove a net tie by `index`, or by matching `nets` (set equality, order-insensitive) and/or `position` — the take-back for a bad add_net_tie. Any junc

**args:** document_id*, document, index, nets, position

### `delete_trace`

Remove a single routed trace segment by `index` (0-based, the add order) or by an unambiguous `net`/`layer` match. The take-back for a stray add_trace

**args:** document_id*, document, index, net, layer

### `delete_via`

Remove a single via by `index` (0-based, the add order) or by an unambiguous `net` match. The take-back for a stray add_via. Returns a `changed` diff.

**args:** document_id*, document, index, net

### `delete_zone`

Remove a copper pour from the board — the take-back for a bad add_zone, without rebuilding the session. Target by `index` (0-based, the add order) or 

**args:** document_id*, document, index, net, layer

### `describe_pcb`

Inspect the session PCB as compact, structured data: board size + outline, stackup (layer names + copper weights), net classes / design rules, zones (

**args:** document_id*, document

### `describe_scene`

One-call snapshot of the whole scene (or a subset of parts): each part's world-space bbox, center, translate, rotate, and material as JSON. Use this I

**args:** document_id*, part_ids, limit, joint_state

### `design_material`

Inverse design: search an isotropic scale factor that drives a geometric property (nearest-neighbor distance or radius of gyration) to a target value,

**args:** molecule*, property*, target*, scale_bounds

### `dfm_apply_fix`

Apply an approved DFM fix to the session document. v1 supports `set_param` patches (raise a fillet radius, thicken a wall) — other kinds throw and req

**args:** document_id, document, issue_id*, report

### `dfm_check`

Run Design-for-Manufacturing checks against an open session document. For solid parts pick a mechanical process (cnc_3axis, fdm, sla, injection, sheet

**args:** document_id, document, process*, ruleset, rule_pack_toml

### `dfm_explain`

Return the long-form explanation for a specific DFM issue from the most recent `dfm_check` run on this document.

**args:** document_id, issue_id*, report

### `dfm_suggest_fix`

Return the suggested patch (set_param / wrap_op / replace_op / manual) for a DFM issue. Inspect the patch; only call `dfm_apply_fix` when you're ready

**args:** document_id, issue_id*, report

### `export_cad`

Export a CAD document to a file. Supports STL (3D printing), GLB (visualization), and STEP AP214 (CNC quoting: BRep with true analytic faces, preserve

**args:** document_id, document, ir, filename*, joint_state

### `export_gerber`

Export Gerber RS-274X fabrication files from a PCB design. Generates copper layer files, drill file, pick-and-place CSV, and BOM. Gated on a clean DRC

**args:** document_id, document, output_dir, require_clean_drc

### `export_kicad`

Export the session as a native, editable KiCad 9 file. filename ending in .kicad_pcb writes the board (footprints, pads, nets, traces, vias, zones, la

**args:** document_id, document, filename, output_dir

### `export_video`

Render the timeline to an animated GIF or MP4 through the kernel renderer, with the verification HUD (time, animated values, clearance status) burned 

**args:** document_id*, timeline, keyframes, fps, format, view, azimuth, elevation, width_px, hud, verify

### `fab_prep`

Take a routed board to fab-ready in one call, and return the DRC-delta receipt that says what was actually achieved. Runs the whole pipeline: optional

**args:** document_id, document, calibrate_rules, route_remaining, max_rounds, budget, max_cluster, prune_dangling, accept_rules, dry_run

### `find_alternatives`

Propose spec-compatible substitutes for the part a query resolves to. Each alternative keeps the value, varies the package, and is labelled identical 

**args:** query*

### `fix_drc`

Run DRC and automatically apply the mechanically-safe subset of fixes: stitching vias for UnstitchedPad, dedupe of overlapping same-net via drills (Ho

**args:** document_id*, document, dry_run, reroute_effort, max_fixes

### `flat_pattern_from_solid`

Emit the flat pattern (DXF + bend table) for a part that was modelled as an ordinary solid — extruded sketch, boolean, imported STEP — with no sheet-m

**args:** document_id*, part_id, material, manual_k, shop_profile, volume_tolerance, include_dxf

### `get_changelog`

Query vcad changelog by version, category, feature, or MCP tool. Returns recent changes, new features, breaking changes, and migration guides.

**args:** version, since, category, feature, tool, breaking_only, limit

### `get_copper`

Query the board's routed copper — traces, trace arcs, vias, zones — with optional `layer`/`net`/`bbox`/`kind` filters. Each element comes back with it

**args:** document_id*, document, kind, layer, net, bbox, offset, limit

### `get_document`

Return the full IR Document JSON for an open session. Use after a series of mutations to capture the result, or to feed into `export_cad` / `open_in_b

**args:** document_id*

### `get_footprint`

Introspect ONE footprint's land pattern in BOTH the footprint-local and board frames — origin, courtyard AABB, and every pad (with the explicit rotati

**args:** document_id, document, footprint, pins, ref, at, rotation, side

### `get_order_feed`

App-only: the order-dock feed for a document — orders with fused lifecycle chips, joined quote details, authorization status (+ approve URL while pend

**args:** document_id*

### `get_order_status`

Return the lifecycle row for a Fabricate order (state, fab, totals, event timeline). Read-only.

**args:** order_id*

### `get_pad_positions`

Return every footprint pad's absolute board-frame (x, y), copper layer, and net — the coordinates manual routing (add_trace / add_via / add_via_array)

**args:** document_id*, document, net, ref

### `get_preview_glb`

Return a base64 GLB preview of an open session document. Internal to the inline 3D viewer — agents should use `export_cad` for geometry exports.

**args:** document_id*, instances

### `get_preview_version`

Return a cheap {document_id, version} change token for an open session document (no geometry eval). Internal to the inline 3D viewer's self-refresh po

**args:** document_id*

### `get_sim_replay`

Return the recorded joint trajectory and per-step instance transforms for a physics env. Internal to the inline viewer's replay UI — agents should use

**args:** env_id*

### `get_sim_version`

Return a cheap {env_id, step_count, version} change token for a physics env (no FK eval). Internal to the inline viewer's replay poll — agents should 

**args:** env_id*

### `gym_close`

Close and clean up a simulation environment.

**args:** env_id*

### `gym_observe`

Get the current observation from the simulation without stepping. Returns joint positions, velocities, and end effector poses — both as bare arrays an

**args:** env_id*

### `gym_reset`

Reset the simulation environment to its initial state, re-drawing any configured domain randomization. Optional `seed` re-seeds the randomization stre

**args:** env_id*, seed

### `gym_step`

Step the physics simulation with an action. action_type can be 'torque' (Nm), 'position' (degrees/mm), or 'velocity' (deg/s or mm/s). Returns observat

**args:** env_id*, action_type*, values*

### `homogenize_material`

Homogenize a periodic crystal into bulk material properties — density (kg/m³), cubic elastic constants C11/C12/C44 and VRH isotropic moduli (GPa) — th

**args:** molecule*, force_field, epsilon, sigma, cutoff, bond_k, strain, relax_internal

### `import_altium`

Import an Altium .PcbDoc board into a live session — board outline, footprints with pads + nets, design rules, and any routed traces/vias. Accepts bot

**args:** filename, content_base64, name

### `import_altium_library`

Read an Altium .PcbLib footprint library (binary or ASCII) and return its footprint patterns with pads, shapes, and drills. A library is not a board, 

**args:** filename, content_base64

### `import_eagle`

Import an Eagle .brd board (XML, Eagle 6+) into a live session — board outline, packages placed as footprints with pads, signals as nets, and any hand

**args:** filename, content_base64, name

### `import_kicad`

Import an existing KiCad .kicad_pcb board into a live session — board outline, footprints with pads + nets, design rules, and any routed traces/vias/z

**args:** filename, content_base64, name

### `import_step`

Import geometry from a STEP file (.step or .stp), keeping B-rep: the document gets one lazy `step_import` node per body, so analytic faces survive int

**args:** filename, content_base64, name, material, as_mesh

### `import_urdf`

Import a URDF (Unified Robot Description Format) robot from a server-local file. Builds the full kinematic tree — one part per link, instances FK-plac

**args:** path, content_base64, package_roots, name, floating_base, floating_base_link, spawn_height_mm

### `inspect_cad`

Inspect an open session document to get aggregate geometry properties: volume, surface area, bounding box, center of mass, triangle count, and mass (i

**args:** document_id, document, joint_state

### `inspect_faces`

List a part's B-rep faces: stable face id, surface type, area, bbox, centroid, plus the exact surface parameters — a cylinder's radius/diameter, axis 

**args:** document_id*, part, surface_type, face_id, radius_mm, radius_tolerance_mm, min_area_mm2, summary_only, limit, offset

### `inspect_molecule`

Structural analysis of a molecule: Hill-order formula, per-element counts, mass, center of mass, radius of gyration, bounding box, bond count, periodi

**args:** molecule*

### `inspect_part`

Read a part's current world-space geometry: bounding box, size, center, translate, rotation, material, and the set of named anchors (center/min/max/to

**args:** document_id*, part_id*, joint_state

### `inspect_schematic`

Inspect a schematic session: sheet tree, per-instance reference maps, the flattened netlist (optionally one instance's), power flags, hierarchy issues

**args:** document_id*, instance

### `length_match_traces`

Length-match a group of routed nets (a DDR lane, clock tree, SPI bus): measures each net's copper and grows the shorter ones with clearance-checked tr

**args:** document_id, document, nets*, target_length, tolerance, max_amplitude, spacing, style, check_only

### `list_constraints`

List the document's design constraints with their current measured values and residuals, per-group degrees of freedom, and over/under-constrained stat

**args:** document_id, document

### `list_eval_tasks`

List mecheval benchmark tasks (id, suite, tier, title, prompt, check count). Suites: A authoring, B kernel, C mech/physics, D visual, F fit. Pair with

**args:** suite

### `list_footprints`

List the footprint families the parametric engine resolves, each with a canonical example id to drop into create_schematic's `footprint`. Optional `ki

**args:** kind

### `list_loons`

List the stored loon macro library: names, versions, parameter docs with units and example values. Use before call_loon or create_cad_loon with use_lo

**args:** -

### `list_orders`

List the caller's Fabricate orders, newest first. Optional status filter and limit. Read-only.

**args:** status, limit

### `list_parameters`

List a document's named parameters: raw expression, resolved numeric value, unit, and scrub bounds (min/max). Pair with set_parameters to drive the de

**args:** document_id, document

### `list_tool_packs`

List the optional tool packs and whether each is currently enabled, with its tool count. Packs gate large domain surfaces (ecad, physics, sheet_metal,

**args:** -

### `load_document`

Reopen a save_document save into a fresh session and return its new document_id. Pass the same name you saved under (or the `saved_…` key an anonymous

**args:** name, path

### `load_structure`

Import an atomic structure from XYZ / extended-XYZ text (or accept a MoleculeSystem) and return the molecule plus a summary (formula, atom count, radi

**args:** xyz, molecule

### `md_run`

Run molecular dynamics (velocity-Verlet, optional Berendsen thermostat) for N steps and return the final observation (energies, temperature, max force

**args:** molecule*, config, steps*

### `measure`

Measure geometry in an open session. Pass `part_ids` with two ids to get the minimum distance between those parts (0/negative = contact/overlap) plus 

**args:** document_id*, part_ids*, joint_state, sweep

### `measure_outer_diameter`

Measure a part's true outer diameter: the largest cylinder coaxial with a given axis (omit `axis` to use the part's dominant axis — do not assume Z). 

**args:** document_id*, part, axis

### `minimize_energy`

Relax a structure to a local energy minimum with FIRE. Force field via config (Lennard-Jones default, harmonic bonds, Coulomb, or the ML-potential stu

**args:** molecule*, config, max_iters, force_tol

### `open_document`

Open an editing session for a CAD document. Returns a `document_id` to pass to subsequent tool calls (create, update, place_part, inspect_cad, …). Pas

**args:** initial

### `open_in_browser`

Generate a shareable URL to open a CAD document in vcad.io. Pass a live session's `document_id` (the usual ship path), or an inline IR `document` (JSO

**args:** document_id, document, name

### `optimize_electrodes`

Design electrodes by gradient ascent: optimize named device-spec parameters (e.g. shield ampere-turns, ring spacing) against predicted D-D yield per i

**args:** spec*, parameters, variables*, options

### `parameter_gradient`

Differentiate a document's QoIs with respect to a single named parameter via the differentiable seam: per solid part, returns d(volume)/dθ, d(mass)/dθ

**args:** document_id, document, parameter*, density, probe_step

### `place`

Position a part by anchor: moves the part so that its `from` anchor lands on the `to` anchor. Both anchors can be either a named anchor on this or ano

**args:** document_id*, part_id*, from, to*

### `place_components`

Create the board and place schematic components on it. Mutates the session document (pass document_id). Outline: rectangle (board_width/height), circl

**args:** document_id, document, board_width, board_height, board_shape, outline, board_thickness, strategy, radial_radius, radial_start_angle_deg, edge_margin

### `place_order`

Place a QUOTED order once its authorization has been human-approved: performs one atomic wallet debit and moves the order to PAID (fab submission foll

**args:** order_id*, authorization_id*, idempotency_key, fab_artifact_id

### `place_part`

Insert a stdlib part into the session's document. Takes a `document_id`, a `path` (from `search_parts.id`), and an optional `params` map; missing para

**args:** document_id*, path*, params, position, name

### `polyline_tube`

Create a chain of tubes through a sequence of world-space points. Each consecutive pair of points becomes one tube segment (a separate part — not unio

**args:** document_id*, points*, radius, arc_segments, name

### `predict_physics`

Fast static structural analysis (voxel FEA): max displacement, max von Mises stress, and compliance for a part or box under world-frame loads (N) and 

**args:** document_id, part, domain_box, loads*, supports*, fidelity, resolution, youngs_modulus_mpa, poisson, max_displacement_mm, max_von_mises_mpa

### `predict_print`

Snapshot the design's predicted measurables BEFORE 3D-printing it: kernel-evaluated bbox and mass (at a filament density), plus caller-declared featur

**args:** document_id*, material_density_kg_m3, material_name, measurables

### `quote_manufacturing`

Quote manufacturing a part: measures the design, runs light DFM, and returns margin-inclusive price options per fab (pcb/cnc/3dprint/sheet_metal/cast_

**args:** ir, document_id, process*, quantity*, material, finish, ship_to, layers, board_area_mm2, fab_artifact_id

### `read`

Inspect the current document. Without part_id, lists all parts. With part_id, returns full feature tree and parameters for that part.

**args:** document_id*, part_id

### `record_measurement`

Record as-built measurements (caliper dimensions, scale mass) of a printed part against its predict_print snapshot and emit the receipt-vs-reality del

**args:** document_id, measurements*, printer, material, process, prediction

### `record_simulation`

Step an open physics env N times and return an animated GIF of the run — your eyes on the simulation. Drives the env created via create_robot_env, mut

**args:** env_id*, document_id*, steps*, action_type, action, actions, fps, view, width_px

### `render_molecule`

Render a molecule as an isometric ball-and-stick (or space-filling) SVG with CPK colors and depth sorting — agent eyes on atomic structures.

**args:** molecule*, width_px, representation

### `render_pcb`

Render a flat, top-down, per-layer 2D image of a PCB (copper, silk, drills, outline) — agent eyes for boards. Pick `layers` (e.g. ["F.Cu", "F.SilkS", 

**args:** document_id*, layers, width_px, theme, highlight, net_labels, values, hero

### `render_ratsnest`

Render the board with its unrouted-connection ratsnest (per-net MST airwires) overlaid as dashed lines — judge placement quality and crossing density 

**args:** document_id*, layers, width_px

### `render_sequence`

Compile the document's timeline into an animated GLB (glTF animation channels) — the cheap preview loop for motion. Accepts one-shot `keyframes:[{t, j

**args:** document_id*, timeline, keyframes, fps, verify

### `render_stackup`

Render each copper layer of a multilayer board to its own image (with the board edge for framing), so inner planes are legible instead of buried under

**args:** document_id*, width_px

### `render_view`

Render an open session document to a PNG image so you can SEE the current geometry — silhouettes, holes, creases — not just numbers. Drafting-style li

**args:** document_id, document, view, azimuth, elevation, focus, width_px, section, axes, labels, dims, highlight, highlight_changed, style, joint_state

### `resolve_part`

Resolve a spec query (e.g. '10k 0603 1%') into ONE fully-specified part: E-series-snapped value plus a generated footprint + schematic symbol + 3D bod

**args:** query*

### `route_diff_pair`

Route a declared differential pair (net_p/net_n) coupled and length-matched, using the pair's diff-pair net-class gap and width. Routes straight (best

**args:** document_id, document, net_p*, net_n*

### `route_nets`

Route electrical nets on the PCB with copper traces. Connects pads belonging to the same net. Idempotent: re-running rips up the previously autorouted

**args:** document_id, document, nets, locked_nets, strategy, trace_width, receipt, effort

### `run_drc`

Run Design Rule Check (DRC) on a PCB. Checks clearance, trace width, drill size, annular ring, hole-to-hole, edge clearance, and connectivity — includ

**args:** document_id, document, detail, sample_size

### `run_erc`

Run Electrical Rule Check (ERC) on a schematic. Checks for duplicate references, unconnected pins, and pin type conflicts.

**args:** document_id, document

### `save_document`

Persist a live session under a name so it can be reopened with load_document. On the hosted server the save is durable: a signed-in user's save goes t

**args:** document_id*, name*

### `search_electronic_parts`

Spec-search the generative parts catalog (offline). A query like '10k 0603 1%' parses to value+package+tolerance and returns the best match plus E-ser

**args:** query*, limit

### `search_footprints`

Fuzzy-search footprint families by name/alias (e.g. 'SOIC 8', 'jst', 'qfn') and get ranked matches with a canonical example id — resolve a footprint i

**args:** query*

### `search_mechanical_parts`

Spec-search the curated mechanical COTS catalog (offline) — the mechanical sibling of search_electronic_parts: 608/625/688/600x-series bearings, preci

**args:** query, type, bore_mm, od_mm, id_mm, diameter_mm, width_mm, thickness_mm, thread, length_mm, tolerance_mm, limit

### `search_parts`

Search the stdlib parts library (fasteners, bearings, …). Matches across name, category, synonyms, and catalog part numbers (McMaster / ISO / DIN). Re

**args:** query, category, limit

### `sensitivity`

Which knob actually moves this number, and by how much. Differentiates a document's quantities (volume, mass, centroid, bbox) with respect to its name

**args:** document_id, document, parameters, quantities, part, density, find_trust_radius

### `server_info`

Report the running build's identity: version, git sha (if stamped), tool count, enabled packs, whether the kernel WASM loaded, and whether sessions ar

**args:** -

### `set_board_outline`

Resize or reshape the board outline in place — rectangle (board_width/height), circle/annulus (board_shape), or any polygon (outline) — WITHOUT re-pla

**args:** document_id*, document, board_width, board_height, board_shape, outline, thickness

### `set_design_rules`

Set the board design rules run_drc enforces (clearance, track width, via, edge/hole/annular) and net classes — the way to give a power or high-voltage

**args:** document_id*, document, clearance, track_width, via_diameter, via_drill, diff_pair_gap, diff_pair_width, edge_clearance, hole_to_hole, min_annular_ring, min_drill, classes

### `set_material`

Set a part's material preset. Keys — metals: aluminum, steel, brass, copper, titanium, chrome, gold, silver; plastics: abs-white, abs-black, abs-red, 

**args:** document_id*, material*, part_id*

### `set_parameters`

Batch-update named parameter values on an open session document (e.g. { "r": 12, "h": 8 }). Every name must already be declared; values must be finite

**args:** document_id*, parameters*

### `set_placement`

Place footprints at explicit board-frame coordinates by ref — the floorplan realizer the auto-placer (grid/force_directed/radial) can't express: therm

**args:** document_id*, document, placements*

### `set_stackup`

Set the board stackup copper weight (e.g. copper_oz: 2) and/or per-layer thickness/material, so DC-resistance and impedance estimates reflect the real

**args:** document_id*, document, copper_oz, layers

### `set_tool_packs`

Enable or disable optional tool packs at runtime (see list_tool_packs for names). Pass `enable` and/or `disable` as arrays of pack names, or `set` to 

**args:** enable, disable, set

### `share_session`

Share this session as a live, watchable link (mcp.vcad.io/live/<id>). Sessions are PRIVATE by default — this is the explicit opt-in that makes one vie

**args:** document_id*

### `sheet_metal_bend_table`

Read the kernel's curated bend table — `(material, thickness, radius) → K-factor` rows used to compute bend allowance. Pass `shop_profile` (e.g. "send

**args:** shop_profile

### `sheet_metal_check`

Run sheet-metal manufacturability for a session document against a shop profile (brake length, min R/t, flange height, hole→bend, bend→bend, bend reli

**args:** document_id*, shop_profile

### `sheet_metal_cost`

Estimate the manufacturing cost of a sheet-metal session document: material (mass × $/kg), cut (length × $/m), pierces, bends, amortized setup, plus s

**args:** document_id*, quantity, rates

### `sheet_metal_create`

Create a sheet-metal part: a rectangular or polygon base flange plus an ordered chain of edge flanges, hems, and jogs. Supports `shop_profile` (e.g. "

**args:** width*, depth*, outline, holes, thickness*, material, shop_profile, engravings, bend_relief, flanges, jogs, hems

### `sheet_metal_materials`

List the built-in sheet-metal materials registry (aluminum soft/hard, mild + stainless steel, brass, copper) with min R/t, yield, modulus, density, an

**args:** -

### `sheet_metal_nest`

Pack multiple sheet-metal parts on stock sheets using bottom-left fill decreasing. Each part is either a session `document_id` (footprint inferred fro

**args:** parts*, params

### `sheet_metal_sequence`

Return a feasible press-brake bend sequence for a sheet-metal part — outermost bends first so the remaining flat stays small and earlier bends don't c

**args:** document_id*

### `sheet_metal_suggest_fix`

Translate the structured violations from sheet_metal_check into concrete parameter changes the agent can apply (radius up, flange longer, bends spread

**args:** document_id*, shop_profile, violation_index

### `sheet_metal_unfold`

Return the flat pattern (panel outlines, holes, creases, engravings, area, bbox) for a sheet-metal session document, plus a fab-ready merged single-si

**args:** document_id*, include_dxf

### `simulate_charged_particles`

Charged-particle optics for axisymmetric electrode devices (fusors, magnetically shielded-grid IEC, ring traps): solve the electrostatic field + ring-

**args:** spec*, parameters, options

### `simulate_circuit`

SPICE-style lumped-element circuit simulation (MNA): DC operating point (gmin-stepped Newton, exact at gmin=0), small-signal AC sweep (complex MNA, pe

**args:** devices*, analyses*, ac, transient

### `simulate_em`

Electromagnetic field solve (finite-volume SOR, the differentiable FEMM replacement): axisymmetric magnetostatics (coil inductance, stored energy, axi

**args:** spec*, parameters, options

### `simulate_flow`

Steady laminar CFD on a voxel grid: D3Q19 BGK lattice Boltzmann with half-way bounce-back walls, velocity inlets, pressure outlets, and an optional ad

**args:** spec*, options, include_fields

### `simulate_lattice_gauge`

Lattice gauge theory Monte Carlo (quenched Wilson action, SU(2) or SU(3)): confinement from first principles on a laptop-scale 4D lattice. Returns the

**args:** spec*

### `simulate_neutron_shield`

Monte Carlo neutron shielding run (analog transport, 5-group multigroup library with exact elastic kinematics): spherical layer stack around a point s

**args:** spec*, parameters

### `simulate_photonics`

Forward 2D TM FDTD photonics run (validated Yee grid + CPML, dispersion error ~5e-8 at 40 cells/lambda): rect-composed device, analytically-solved sla

**args:** spec*, options

### `simulate_strike`

Hear a part before it's cut: simulate a mallet strike on a flat free-free bar (glockenspiel/vibraphone bar) and verify its pitch. Modal frequencies fr

**args:** document_id, bar, note, expect_hz, tolerance_cents, strike_position, mallet_contact_ms, duration_s, wav_filename

### `size_coil`

Inverse of calc_coil: solve the turn count for a target inductance in a given annulus (Wheeler L ∝ turns², so it's closed-form). Reports continuous + 

**args:** target_inductance_nh*, inner_radius*, outer_radius*, trace_width*, clearance, copper_thickness, resistivity, geometry, tolerance_pct

### `size_impedance`

Inverse of calc_impedance: solve trace geometry for a TARGET impedance. Given a target Z0 (and diff Z0 for pairs) + stackup, returns the trace width (

**args:** trace_type, target_z0, target_diff_z0, dielectric_height*, dielectric_er, copper_thickness, min_width, max_width, min_spacing, max_spacing, fab_grid_mm, tolerance_pct

### `size_pdn`

Size copper-segment widths across a power-distribution resistor mesh so each load node's IR-drop meets its budget with minimal copper. Solves G·V=I fo

**args:** nodes*, edges*, loads*, targets*, copper_thickness, resistivity, min_width, max_width, fab_grid_mm, tolerance_pct, engine, document_id, net

### `size_trace_for_current`

IPC-2221 conductor ampacity solved for trace width: given current, copper weight, allowed temp rise, and layer (outer/inner), returns the minimum widt

**args:** current_a*, copper_oz, temp_rise_c, layer, fab_grid_mm

### `solid_from_board`

Materialize the session PCB as a solid CAD part — the inverse of board_from_solid. Extrudes the board outline to its thickness through the hole-aware 

**args:** document_id*, document_id_target, include_components, part_name

### `solve_constraints`

Re-solve the document's design constraints against current geometry — run after set_placement, set_board_outline, or sketch edits that may have violat

**args:** document_id*

### `solve_thermal`

Heat-conduction FEA on a voxel grid: harmonic-mean finite volumes + PCG, returning T_max and its location, per-source theta_ja (K/W, junction-to-ambie

**args:** spec*, transient, parameters, options

### `timeline_from_simulation`

Compile a recorded physics rollout (gym_step trajectory) into the document's animation timeline — one joint track per observed joint at the simulation

**args:** env_id*, document_id*, max_keys, camera

### `topology_optimize`

SIMP topology optimization: find the stiffest material layout under given loads and supports using only `volume_fraction` of the design domain — the o

**args:** document_id, part, domain_box, loads*, supports*, volume_fraction, resolution, max_iterations, filter_radius, name, material, hide_source

### `tube`

Create a cylindrical pipe/tube between two world-space points. One call, no trigonometry: pass start and end and radius, and the tube is created with 

**args:** document_id*, start*, end*, radius, arc_segments, name

### `tune_circuit`

Adjoint-driven circuit tuning: gradient descent in log-parameter space (backtracking line search, scale-invariant stop) moves the freeDevices' values 

**args:** devices*, target*, freeDevices*, maxIters

### `undo`

Rewind the most recent mutation on a session — the snapshot taken before the last add_zone / add_trace / add_via / delete_* / route_nets / place_compo

**args:** document_id*

### `unshare_session`

Revoke a session's live link — it goes dead and the session is private again.

**args:** document_id*

### `update`

Update parameters on an existing node — pass only the fields to change. The surgical-edit tool: when geometry is misplaced or mis-sized, prefer this o

**args:** document_id*, node_id*, params*

### `update_schematic`

Edit a schematic session in place: replace the root sheet body, add / replace / remove hierarchical sheet definitions and root sheet instances, set th

**args:** document_id*, root, sheets, remove_sheets, instances, remove_instances, global_nets, power_flags

### `validate_for_fab`

The single 'is this board ready to fabricate?' oracle. Runs the whole readiness gate in one call and returns ONE structured verdict: DRC (fail-closed 

**args:** document_id, document

### `verify_part`

Grade an open session document against a mecheval benchmark task using the official deterministic graders (the exact binaries the leaderboard runs). R

**args:** document_id*, task_id*

### `verify_receipt`

Re-run a prior receipt (from build_receipt) against the session's current document and return the verdict — Holds (unchanged, clean), Stale (changed b

**args:** document_id, receipt*

### `verify_spec`

TDD for CAD: grade an open session document against a caller-supplied spec and return a fail-closed verification receipt (schema vcad.receipt/1). Decl

**args:** document_id*, spec*

### `verify_substitution`

PROVE a part swap on the session PCB: replace `reference` with the part `candidate` resolves to, re-derive its footprint, re-place at the same anchor,

**args:** document_id, reference*, candidate*

### `winding_layout`

Plan a balanced polyphase motor winding (slots + poles → per-coil phase, polarity, winding factor, feasibility) as DATA. Pure — it does NOT take a boa

**args:** slots*, poles*, phases, turns_per_coil, connection, layer, phase_nets, neutral_net
