// The stage: renderer, environment, lights, ground, HUD, and the animation loop.
//
// This is everything that is not the subject: a subject changes its volume and its materials, and a
// viewer changes its lights and its frame. Keeping the two apart is what lets one page serve every
// scene in the repository.
//
// In capture mode (`?shot=1`) there is no ground, no grid and no HUD: a blueprint sheet is a white
// field, and a ground plane is a large light shape that reads as subject in a silhouette mask.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * @param {object} options
 * @param {ReturnType<import("./frame.js").frameFrom>} options.frame
 * @param {ReturnType<import("./camera.js").createCameraRig>} options.rig
 * @param {boolean} options.shot                    capture mode: white field, no HUD
 * @param {() => Record<string, any>} options.report  the model's own measurement, for the HUD
 * @param {{ current: any }} options.rigRef         the rig, filled after the canvas exists
 */
export function createStage({ frame, shot, report, rigRef }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const background = () => new THREE.Color(shot ? 0xffffff : 0xeef0f2);
  scene.background = background();

  // RoomEnvironment is a procedural studio box: PBR materials get reflections without an HDR file,
  // so a scene stays a self-contained directory.
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
    new THREE.MeshStandardMaterial({ color: 0xdfe2e6, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "Ground";
  ground.visible = !shot;
  scene.add(ground);

  const grid = new THREE.GridHelper(frame.gridSize, 24, 0xb0b6bd, 0xcdd2d7);
  grid.position.y = 0.001;
  grid.visible = !shot;
  scene.add(grid);

  // ------------------------------------------------------------------ hud

  const hud = {
    title: document.querySelector("#hud h1"),
    view: document.getElementById("hud-view"),
    tris: document.getElementById("hud-tris"),
    meshes: document.getElementById("hud-meshes"),
    draws: document.getElementById("hud-draws"),
    size: document.getElementById("hud-size"),
    zoom: document.getElementById("hud-zoom"),
  };

  function updateHud(name) {
    const stats = report();
    if (hud.view) hud.view.textContent = name;
    if (hud.tris) hud.tris.textContent = stats.triangles.toLocaleString("en-US");
    if (hud.meshes) hud.meshes.textContent = String(stats.meshes);
    if (hud.draws) hud.draws.textContent = String(renderer.info.render.calls);
    if (hud.size) hud.size.textContent = stats.size.map((v) => v.toFixed(2)).join(" × ");
    // The zoom is a fact about the orthographic camera only: a perspective view has no zoom factor,
    // so it reads a dash rather than a number that would be about a different projection.
    const rig = rigRef?.current;
    if (hud.zoom) {
      hud.zoom.textContent = rig && !rig.state.perspective ? `${rig.zoomPercent()} %` : "—";
    }
  }

  // ------------------------------------------------------------------ loop

  let frames = 0;
  let waiters = [];
  let onSecondFrame = null;

  renderer.setAnimationLoop(() => {
    const rig = rigRef?.current;
    if (!rig) return;
    // Both instances are damped, so the ACTIVE one is updated every frame. Updating only the
    // perspective one left the flat view's inertia frozen mid-gesture.
    rig.activeControls.update();
    renderer.render(scene, rig.activeCamera);
    frames += 1;
    if (frames === 2) onSecondFrame?.();
    if (waiters.length > 0) {
      // One extra frame so the resolved caller sees the frame that was just drawn.
      const pending = waiters;
      waiters = [];
      requestAnimationFrame(() => pending.forEach((resolve) => resolve({ calls: renderer.info.render.calls })));
    }
  });

  // Resolves once a frame that includes the new camera position has been drawn.
  function nextFrame() {
    return new Promise((resolve) => waiters.push(resolve));
  }

  window.addEventListener("resize", () => {
    rigRef?.current?.resize();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ------------------------------------------------------------------ control surface

  let root = null;
  let savedVisibility = null;

  function setRoot(object) {
    root = object;
    scene.add(object);
  }

  function meshesMatching(name) {
    const out = [];
    root?.traverse((object) => {
      if (!object.isMesh) return;
      if (name && object.name !== name) return;
      out.push(object);
    });
    return out;
  }

  function restoreVisibility() {
    if (!savedVisibility) return;
    for (const [object, visible] of savedVisibility) object.visible = visible;
    savedVisibility = null;
  }

  function ctlWireframe(options = {}) {
    const enabled = options.enabled !== false;
    for (const mesh of meshesMatching(options.name ?? null)) {
      for (const material of [].concat(mesh.material)) {
        if (material && "wireframe" in material) material.wireframe = enabled;
      }
    }
    return nextFrame();
  }

  function ctlIsolate(options = {}) {
    const name = options.name ?? null;
    restoreVisibility();
    if (name === null) return nextFrame();
    const node = root?.getObjectByName(name);
    if (!node) throw new Error(`no node named "${name}" in the model`);
    // The map holds every node of the model, so one restore puts it back exactly as it was.
    savedVisibility = new Map();
    root.traverse((object) => savedVisibility.set(object, object.visible));
    root.traverse((object) => { object.visible = false; });
    node.traverse((object) => { object.visible = true; });
    for (let parent = node.parent; parent; parent = parent.parent) parent.visible = true;
    return nextFrame();
  }

  function ctlVisible(options = {}) {
    const name = options.name;
    if (!name) throw new Error("visible() needs a name");
    const node = root?.getObjectByName(name);
    if (!node) throw new Error(`no node named "${name}" in the model`);
    node.visible = options.visible !== false;
    return nextFrame();
  }

  function ctlBackground(options = {}) {
    const color = options.color ?? null;
    if (color === null || color === "transparent") {
      scene.background = null;
      renderer.setClearAlpha(0);
    } else {
      scene.background = new THREE.Color(color);
      renderer.setClearAlpha(1);
    }
    return nextFrame();
  }

  function ctlGrid(options = {}) {
    grid.visible = options.enabled !== false;
    return nextFrame();
  }

  function ctlGround(options = {}) {
    ground.visible = options.enabled !== false;
    return nextFrame();
  }

  function ctlShadows(options = {}) {
    const enabled = options.enabled !== false;
    renderer.shadowMap.enabled = enabled;
    key.castShadow = enabled;
    ground.receiveShadow = enabled;
    renderer.shadowMap.needsUpdate = true;
    return nextFrame();
  }

  function ctlExposure(options = {}) {
    if (typeof options.value === "number") renderer.toneMappingExposure = options.value;
    return nextFrame();
  }

  function nodeList() {
    const out = [];
    root?.traverse((object) => {
      if (!object.name) return;
      out.push({
        name: object.name,
        type: object.type,
        visible: object.visible,
        triangles: object.isMesh && object.geometry?.index
          ? object.geometry.index.count / 3
          : object.isMesh ? (object.geometry?.attributes?.position?.count ?? 0) / 3 : 0,
      });
    });
    return out;
  }

  function resetStage() {
    restoreVisibility();
    ctlWireframe({ enabled: false });
    scene.background = background();
    renderer.setClearAlpha(1);
    grid.visible = !shot;
    ground.visible = !shot;
    renderer.toneMappingExposure = 1.05;
  }

  return {
    renderer,
    scene,
    hud,
    updateHud,
    nextFrame,
    setRoot,
    readyOnSecondFrame(fn) { onSecondFrame = fn; },
    ctl: {
      wireframe: ctlWireframe,
      isolate: ctlIsolate,
      visible: ctlVisible,
      background: ctlBackground,
      grid: ctlGrid,
      ground: ctlGround,
      shadows: ctlShadows,
      exposure: ctlExposure,
      nodes: nodeList,
      reset: resetStage,
    },
    get root() {
      return root;
    },
  };
}
