// The scene viewer page: one page, one asset.
//
// The model delivers one module and nothing else. This file answers the question a candidate raises
// -- which asset, which frame, which view -- and wires the parts together. It knows no subject, no
// candidate name, no view geometry and no coefficient: the table is `views.js`, the frame is
// `frame.js`, the stage is `stage.js`.
//
// The asset is resolved in one order: a `?asset=` query names it, otherwise the catalogue's first
// valid entry is used, otherwise the error box says where a candidate belongs. A picker navigates
// instead of swapping the module in place, because a navigation resets the camera, the spin and the
// error box, and a swap would keep all three from the previous asset.

import { VIEWS, DEFAULT_VIEW } from "./views.js";
import { frameFrom } from "./frame.js";
import { measureObject } from "./measure.js";
import { createCameraRig } from "./camera.js";
import { createStage } from "./stage.js";
import {
	checkAsset,
	checkRoot,
	describe as describeProblems
} from "./contract.js";

const params = new URLSearchParams(location.search);
const errorBox = document.getElementById("error");

/** Show a failure in the page, so the reason survives a screenshot. */
function fail(error) {
	const message = String(error?.message ?? error);
	window.__error = message;
	if (!errorBox) return;
	errorBox.textContent = `asset did not load\n\n${message}`;
	errorBox.hidden = false;
}

/** The catalogue, or an empty list when the request fails. */
async function fetchCatalogue() {
	const response = await fetch("/api/assets", { cache: "no-store" });
	if (!response.ok)
		throw new Error(`the catalogue answered ${response.status}`);
	const body = await response.json();
	return Array.isArray(body?.assets) ? body.assets : [];
}

/**
 * The URL of an asset: one segment per path part, so a name with a space or a
 * `#` survives.
 */
function assetUrl(path) {
	return `/asset/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** The file base name, without `.ts`. */
function slugOf(path) {
	return path.split("/").pop().replace(/\.ts$/, "");
}

async function boot() {
	// The cursor contract is a body class, not an inline style: the stylesheet owns it.
	document.body.classList.add("pan-ready");

	let assets = [];
	let catalogueError = null;
	try {
		assets = await fetchCatalogue();
	} catch (error) {
		catalogueError = error;
	}

	const requested = params.get("asset");
	const path = requested ?? assets.find((entry) => entry.valid)?.path;
	if (!path) {
		if (catalogueError) throw catalogueError;
		throw new Error(
			"no asset found. Put a .ts module under blueprints/<category>/<subject>/generated/."
		);
	}

	// The module is imported from the server, which prepends the `three` import when the file has
	// none. The import is the only step that executes candidate code, and a syntax error rejects it
	// with the transpiler's own message.
	let module_;
	try {
		module_ = await import(assetUrl(path));
	} catch (error) {
		throw new Error(`${path}: ${error?.message ?? error}`);
	}

	const { build, problems: moduleProblems } = checkAsset(module_, path);
	if (!build) throw new Error(describeProblems(moduleProblems));

	// `build()` is called exactly once: two calls are two objects, and the page must draw one.
	const root = build();
	const rootProblems = checkRoot(root);
	if (rootProblems.length > 0)
		throw new Error(describeProblems(rootProblems));

	const measured = measureObject(root);
	const frame = frameFrom(measured);

	// The title and the HUD heading are the asset's, not the viewer's.
	const slug = slugOf(path);
	document.title = slug;
	const heading = document.querySelector("#hud h1");
	if (heading) heading.textContent = slug;

	// The rig needs the canvas, and the stage needs the rig for its loop. One explicit indirection is
	// cheaper than either a circular constructor or a detached canvas.
	const rigRef = { current: null };
	const stage = createStage({ frame, report: () => measured, rigRef });
	stage.setRoot(root);

	let currentView = DEFAULT_VIEW;
	let spinning = false;

	const rig = createCameraRig({
		views: VIEWS,
		frame,
		element: stage.renderer.domElement,
		onManual: () => {
			if (currentView === "custom") return;
			currentView = "custom";
			syncBar();
			stage.updateHud(currentView);
		}
	});
	rigRef.current = rig;
	// The loop follows the active controls' `change` event: a gesture, or an inertia tail, wakes it
	// and keeps it awake until the camera stops.
	stage.bindRig(rig);

	// The wheel and the pan on a flat view change the zoom, and the zoom row must follow them as they
	// happen. Only the flat instance is wired: a free view reads a dash whatever the pointer does.
	rig.flat.addEventListener("change", () => {
		stage.updateHud(currentView);
	});

	// ------------------------------------------------------------------ the view bar

	const bar = document.getElementById("views");
	const picker = document.createElement("select");
	const viewButtons = [];
	let spinButton = null;

	if (bar) {
		picker.name = "asset";
		// `name` names a form field. It does not label the control, so the label is written out.
		picker.setAttribute("aria-label", "asset");
		picker.title = "the candidate this page draws";

		const entries = assets.some((entry) => entry.path === path)
			? assets
			: // A catalogue that failed to load still leaves the named asset open and shown, rather
				// than an empty picker beside a model. The shape stays `CatalogueEntry`, so
				// `window.__assets()` never returns a short object.
				[
					{
						path,
						slug: slugOf(path),
						subject: "—",
						category: "—",
						bytes: 0,
						modified: 0,
						valid: true,
						error: null
					}
				];
		for (const entry of entries) {
			const option = document.createElement("option");
			option.value = entry.path;
			option.textContent = `${entry.slug} — ${entry.subject}${entry.valid ? "" : " (invalid)"}`;
			if (!entry.valid)
				option.title = entry.error ?? "this module does not parse";
			if (entry.path === path) option.selected = true;
			picker.append(option);
		}
		// A navigation, not a swap: `location.assign` resets the camera, the spin and the error box,
		// which a module swap inside the page would keep from the previous asset.
		picker.addEventListener("change", () => {
			location.assign(`/?asset=${encodeURIComponent(picker.value)}`);
		});
		bar.append(picker);

		for (const name of Object.keys(VIEWS)) {
			const button = document.createElement("button");
			button.type = "button";
			button.textContent = name;
			button.dataset.view = name;
			button.setAttribute("aria-pressed", "false");
			button.addEventListener("click", () => setView(name));
			bar.append(button);
			viewButtons.push(button);
		}

		const separator = document.createElement("span");
		separator.className = "sep";
		bar.append(separator);

		spinButton = document.createElement("button");
		spinButton.type = "button";
		spinButton.textContent = "spin";
		spinButton.title = "rotate the camera continuously around the object";
		spinButton.setAttribute("aria-pressed", "false");
		spinButton.addEventListener("click", () => setSpin(!spinning));
		bar.append(spinButton);
	}

	// ------------------------------------------------------------------ the state

	function syncBar() {
		for (const button of viewButtons) {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.view === currentView)
			);
		}
		if (spinButton)
			spinButton.setAttribute("aria-pressed", String(spinning));
	}

	/**
	 * Place a named view. A press on a view button also stops the spin, and the
	 * named view is placed after the stop, so the page shows the frame that was
	 * asked for.
	 */
	function setView(name) {
		if (spinning) setSpin(false);
		currentView = name in VIEWS ? name : DEFAULT_VIEW;
		rig.placeCamera(currentView);
		syncBar();
		stage.updateHud(currentView);
		return stage.nextFrame();
	}

	/**
	 * Start or stop the spin. A spin on a flat view switches the rig to the
	 * free view first; the spin turns an azimuth, and an orthographic camera
	 * has none. A stop leaves the camera where it was, and the view name stays
	 * `custom`: the page is no longer showing a named preset.
	 */
	function setSpin(on) {
		const next = Boolean(on);
		if (next === spinning) {
			syncBar();
			return;
		}
		spinning = next;
		if (spinning) {
			stage.setSpinning(true);
			currentView = "custom";
		} else {
			stage.setSpinning(false);
		}
		syncBar();
		stage.updateHud(currentView);
	}

	// ------------------------------------------------------------------ the pointer

	const canvas = stage.renderer.domElement;

	// The press is claimed in the CAPTURE phase, so the spin is stopped and `OrbitControls` is
	// re-enabled before the library handles the same gesture. A bubble-phase claim would run after
	// it, and the first drag of a fresh stop would be lost.
	canvas.addEventListener(
		"pointerdown",
		(event) => {
			if (spinning) setSpin(false);
			if (event.button === 0) document.body.classList.add("pan-dragging");
		},
		{ capture: true }
	);

	const endPanDrag = () => document.body.classList.remove("pan-dragging");
	canvas.addEventListener("pointerup", endPanDrag);
	canvas.addEventListener("pointercancel", endPanDrag);
	window.addEventListener("blur", endPanDrag);

	// ------------------------------------------------------------------ script API

	window.__assets = () => assets;
	window.__setView = setView;
	window.__spin = setSpin;
	window.__stats = () => ({
		view: currentView,
		spin: spinning,
		frames: stage.frames(),
		triangles: measured.triangles,
		meshes: measured.meshes,
		size: measured.size,
		draws: stage.renderer.info.render.calls
	});

	// ------------------------------------------------------------------ start

	stage.readyOnSecondFrame(() => {
		stage.updateHud(currentView);
		window.__ready = true;
	});

	rig.placeCamera(currentView);
	syncBar();
	stage.updateHud(currentView);
}

try {
	await boot();
} catch (error) {
	fail(error);
}
