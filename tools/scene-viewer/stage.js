// The stage: renderer, environment, lights, ground, HUD, and the animation loop.
//
// This is everything that is not the asset. An asset changes its volume and its materials; a viewer
// changes its lights and its frame. Keeping the two apart is what lets one page serve every
// candidate, and it is why no model ever writes a camera or a ground again.
//
// The page draws on demand. `setAnimationLoop` is the only clock, and it runs only while there is a
// reason: a pending change, a caller waiting for a frame, or the spin. It stops -- not skips -- when
// none is left, so an idle page costs nothing.
//
// There is no capture mode here. The scene viewer is a review page, not a blueprint renderer: it
// always draws the ground, the grid and the HUD.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * @param {object} options
 * @param {ReturnType<import("./frame.js").frameFrom>} options.frame The frame
 *   of the asset
 * @param {() => { triangles: number; meshes: number; size: number[] }} options.report
 *   The measured asset, for the HUD
 * @param {{ current: any }} options.rigRef The rig, filled after the canvas
 *   exists
 */
export function createStage({ frame, report, rigRef }) {
	const renderer = new THREE.WebGLRenderer({
		antialias: true,
		preserveDrawingBuffer: true
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	document.body.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0xeef0f2);

	// `RoomEnvironment` is a procedural studio box: PBR materials get reflections without an HDR
	// file, so a candidate stays a self-contained module.
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environmentIntensity = 0.55;

	// ------------------------------------------------------------------ lights

	const key = new THREE.DirectionalLight(0xffffff, 2.6);
	key.position.set(4.2, 6.4, 5.0);
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	key.shadow.camera.near = 1;
	key.shadow.camera.far = 20;
	key.shadow.camera.left = -frame.shadowHalf;
	key.shadow.camera.right = frame.shadowHalf;
	key.shadow.camera.top = frame.shadowHalf;
	key.shadow.camera.bottom = -frame.shadowHalf;
	key.shadow.bias = -0.0004;
	key.shadow.normalBias = 0.015;
	scene.add(key);

	const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
	fill.position.set(-5.0, 3.2, -4.0);
	scene.add(fill);

	const rim = new THREE.DirectionalLight(0xffffff, 0.5);
	rim.position.set(0, 2.0, -6.0);
	scene.add(rim);

	scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bcc0, 0.35));

	// ------------------------------------------------------------------ ground

	const ground = new THREE.Mesh(
		new THREE.CircleGeometry(frame.groundRadius, 48),
		new THREE.MeshStandardMaterial({
			color: 0xdfe2e6,
			roughness: 0.95,
			metalness: 0
		})
	);
	ground.rotation.x = -Math.PI / 2;
	ground.receiveShadow = true;
	ground.name = "Ground";
	scene.add(ground);

	const grid = new THREE.GridHelper(frame.gridSize, 24, 0xb0b6bd, 0xcdd2d7);
	grid.position.y = 0.001;
	scene.add(grid);

	// ------------------------------------------------------------------ hud

	const hud = {
		title: document.querySelector("#hud h1"),
		view: document.getElementById("hud-view"),
		tris: document.getElementById("hud-tris"),
		meshes: document.getElementById("hud-meshes"),
		draws: document.getElementById("hud-draws"),
		size: document.getElementById("hud-size"),
		zoom: document.getElementById("hud-zoom")
	};

	function updateHud(name) {
		const stats = report();
		if (hud.view) hud.view.textContent = name;
		if (hud.tris)
			hud.tris.textContent = stats.triangles.toLocaleString("en-US");
		if (hud.meshes) hud.meshes.textContent = String(stats.meshes);
		if (hud.draws)
			hud.draws.textContent = String(renderer.info.render.calls);
		if (hud.size)
			hud.size.textContent = stats.size
				.map((value) => value.toFixed(2))
				.join(" × ");
		// The zoom is a fact about the orthographic camera only: a perspective view has no zoom
		// factor, so it reads a dash rather than a number about a different projection.
		const rig = rigRef?.current;
		if (hud.zoom) {
			hud.zoom.textContent =
				rig && !rig.state.perspective ? `${rig.zoomPercent()} %` : "—";
		}
	}

	// ------------------------------------------------------------------ loop

	// Three reasons to draw: a pending change (`dirty`), a caller waiting for a frame (`waiters`),
	// and the spin. Two counters tell "stopped" from "skipped": `rendered` counts `renderer.render`
	// calls, `ticks` counts animation-loop callbacks. `rendered` frozen alone would pass with a
	// spinning loop; `ticks` frozen too is the proof that the loop stopped.
	let rendered = 0;
	let ticks = 0;
	let dirty = true; // a reason to draw exists until the first frame clears it
	let waiters = [];
	let onSecondFrame = null;
	let running = false;
	let spinning = false;
	// The previous animation-loop timestamp, in milliseconds. The first spin tick carries no
	// interval, so it turns by `dt = 0` and the camera does not jump on the frame the spin starts.
	let lastTime = null;

	function hasReason() {
		return dirty || waiters.length > 0 || rendered < 2 || spinning;
	}

	// `dirty` and the re-arm are one step, so a stopped loop always comes back.
	function requestFrame() {
		dirty = true;
		if (!running) {
			running = true;
			renderer.setAnimationLoop(tick);
		}
	}

	function tick(time) {
		ticks += 1;
		// Consume the pending reason BEFORE the camera moves. An inertia tail fires `change`, which
		// sets `dirty` again and keeps the loop awake for the next frame; clearing after the update
		// would eat that signal and stop one frame too early.
		dirty = false;
		const rig = rigRef?.current;
		if (rig) {
			if (spinning) {
				// While the spin runs, the controls are disabled: the state is the only source of the
				// azimuth, and `OrbitControls.update()` would read the camera it last saw and undo the
				// step.
				const dt = lastTime === null ? 0 : time - lastTime;
				lastTime = time;
				rig.spinStep(dt);
			} else {
				lastTime = null;
				// Both instances are damped, so the ACTIVE one is updated every frame.
				rig.activeControls.update();
			}
			renderer.render(scene, rig.activeCamera);
			rendered += 1;
			if (rendered === 2) onSecondFrame?.();
		}
		if (waiters.length > 0) {
			// One extra frame so the resolved caller sees the frame that was just drawn.
			const pending = waiters;
			waiters = [];
			requestAnimationFrame(() =>
				pending.forEach((resolve) =>
					resolve({ calls: renderer.info.render.calls })
				)
			);
		}
		if (!hasReason()) {
			// Stop, do not skip: `setAnimationLoop(null)` cancels the loop, so `requestAnimationFrame`
			// is not left spinning behind an early return.
			running = false;
			renderer.setAnimationLoop(null);
		}
	}

	// The documented `change` event of the ACTIVE controls is the signal that the camera moved, and it
	// fires again on every frame while `enableDamping` decays the inertia. The rig re-targets the
	// listener when the flat/perspective swap happens, so only the active instance drives frames.
	let unbindControls = null;
	function bindRig(rig) {
		unbindControls?.();
		unbindControls = rig?.onChange ? rig.onChange(requestFrame) : null;
	}

	// The first frame: arm the loop. It runs until the start-up frames are drawn and nothing is dirty.
	requestFrame();

	// Resolves once a frame that includes the new camera position has been drawn.
	function nextFrame() {
		requestFrame();
		return new Promise((resolve) => waiters.push(resolve));
	}

	window.addEventListener("resize", () => {
		rigRef?.current?.resize();
		renderer.setSize(window.innerWidth, window.innerHeight);
		requestFrame();
	});

	// ------------------------------------------------------------------ control surface

	let root = null;

	function setRoot(object) {
		root = object;
		scene.add(object);
		requestFrame();
	}

	/**
	 * Start or stop the spin. `rig.spinStart()` takes the camera off the
	 * controls; `spinStop()` gives it back where it stopped. Either way the
	 * loop must wake: a stopped loop cannot see the flag.
	 */
	function setSpinning(on) {
		spinning = Boolean(on);
		if (spinning) rigRef?.current?.spinStart();
		else rigRef?.current?.spinStop();
		requestFrame();
	}

	return {
		renderer,
		scene,
		hud,
		updateHud,
		nextFrame,
		frames: () => ({ rendered, ticks }),
		bindRig,
		setRoot,
		setSpinning,
		readyOnSecondFrame(fn) {
			onSecondFrame = fn;
		},
		get root() {
			return root;
		}
	};
}
