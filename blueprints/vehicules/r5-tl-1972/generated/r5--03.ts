import * as THREE from "three";

function roundedBoxGeometry(width: number, height: number, depth: number, segments: number = 1) {
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
  return geometry;
}

function bevelBoxGeometry(width: number, height: number, depth: number, bevel = 0.04, segments: number = 2) {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const vertices = [];

  // 12 vertices for a beveled rectangular prism
  vertices.push(
    -x + bevel, -y + bevel, -z + bevel,
     x - bevel, -y + bevel, -z + bevel,
     x - bevel,  y - bevel, -z + bevel,
    -x + bevel,  y - bevel, -z + bevel,
    -x + bevel, -y + bevel,  z - bevel,
     x - bevel, -y + bevel,  z - bevel,
     x - bevel,  y - bevel,  z - bevel,
    -x + bevel,  y - bevel,  z - bevel,
    -x + bevel,  y - bevel, -z + bevel,
     x - bevel,  y - bevel, -z + bevel,
     x - bevel,  y - bevel,  z - bevel,
    -x + bevel,  y - bevel,  z - bevel
  );

  const indices = [
    0,1,2, 0,2,3,
    4,5,6, 4,6,7,
    0,4,5, 0,5,1,
    1,5,6, 1,6,2,
    2,6,7, 2,7,3,
    3,7,4, 3,4,0
  ];

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function box(w: number, h: number, d: number, material, x = 0, y = 0, z = 0, bevel = 0.04) {
  const geometry = bevel > 0 ? bevelBoxGeometry(w, h, d, bevel, 2) : roundedBoxGeometry(w, h, d, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(radius: number, length: number, material, x: number, y: number, z: number, radialSegments: number = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function addWheel(x: number, z: number, radius: number) {
  const wheel = box(radius * 1.12, radius * 1.12, radius * 1.12, carBodyMaterial, x, radius, z, 0.045);
  wheel.rotation.y = Math.PI / 2;
  const hub = box(radius * 0.48, radius * 0.48, radius * 0.48, darkMetalMaterial, x, radius, z, 0.025);
  hub.rotation.y = Math.PI / 2;
  const rim = box(radius * 0.68, radius * 0.68, radius * 0.22, wheelRimMaterial, x, radius, z, 0.025);
  rim.rotation.y = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const spoke = box(radius * 0.105, radius * 0.105, radius * 0.24, darkMetalMaterial, x, radius, z, 0.025);
    spoke.rotation.y = (i * Math.PI) / 5;
  }
  return wheel;
}

function addWindow(x: number, y: number, z: number, w: number, h: number, d: number, material) {
  const glass = box(w, h, d, material, x, y, z, 0.025);
  glass.rotation.x = -0.08;
  return glass;
}

function addDoor(side: number, x: number, z: number, w: number, y: number, h: number, d: number) {
  const door = box(w, h, d, carBodyMaterial, x, y, z, 0.055);
  door.rotation.y = side * 0.12;
  const handle = box(0.075, 0.075, 0.18, darkMetalMaterial, x + side * w * 0.28, y, z + 0.02, 0.015);
  return door;
}

function addBumper(side: number, y: number, z: number) {
  const bumper = box(3.18, 0.16, 0.09, chromeMaterial, 0, y, z, 0.025);
  bumper.rotation.y = side * 0.04;
  const cap = box(0.2, 0.2, 0.12, darkMetalMaterial, side * 1.59, y, z + 0.04, 0.025);
  return bumper;
}

function addHeadlight(side: number) {
  const headlight = box(0.43, 0.25, 0.12, whiteGlassMaterial, side * 1.51, 0.55, 0.79, 0.025);
  headlight.rotation.x = -0.12;
  const reflector = box(0.35, 0.18, 0.055, chromeMaterial, side * 1.51, 0.55, 0.855, 0.015);
  reflector.rotation.x = -0.12;
}

function addTailLight(side: number) {
  const tail = box(0.34, 0.24, 0.12, redGlassMaterial, side * 1.48, 0.62, -0.79, 0.025);
  tail.rotation.x = 0.12;
}

function addLicensePlate() {
  const plate = box(0.48, 0.19, 0.035, plateMaterial, 0, 0.62, -0.865, 0.015);
  plate.rotation.x = 0.12;
}

function addWindshield() {
  const windshield = box(1.45, 0.75, 0.11, glassMaterial, 0, 1.18, 0.79, 0.035);
  windshield.rotation.x = -0.16;
  addWindow(0, 1.18, 0.79, 1.25, 0.56, 0.065, glassMaterial);
}

function addSideWindow(side: number) {
  const window = box(0.98, 0.53, 0.075, glassMaterial, side * 0.74, 1.23, 0.02, 0.025);
  window.rotation.x = -0.08;
  addWindow(side * 0.74, 1.23, 0.02, 0.92, 0.47, 0.045, glassMaterial);
}

function addInterior() {
  const interior = box(1.08, 0.52, 0.64, interiorMaterial, 0, 1.14, 0.43, 0.025);
  interior.rotation.x = -0.12;
  const seat = box(0.9, 0.28, 0.58, seatMaterial, 0, 0.92, 0.48, 0.025);
  seat.rotation.x = -0.12;
  const dash = box(1.25, 0.12, 0.25, dashMaterial, 0, 0.72, 0.7, 0.025);
  dash.rotation.x = -0.1;
  const steering = box(0.12, 0.08, 0.18, darkMetalMaterial, 0.38, 0.86, 0.55, 0.02);
  steering.rotation.x = -0.18;
  const wiper = box(0.025, 0.025, 0.34, darkMetalMaterial, 0, 1.16, 0.83, 0.01);
  wiper.rotation.x = 0.25;
}

function addSideMirror(side: number) {
  const mirror = box(0.18, 0.22, 0.12, darkMetalMaterial, side * 1.18, 1.25, 0.48, 0.025);
  mirror.rotation.z = side * -0.12;
  const mirrorLens = box(0.12, 0.15, 0.035, glassMaterial, side * 1.18, 1.25, 0.55, 0.02);
  mirrorLens.rotation.z = side * -0.12;
}

function addBumpers() {
  addBumper(-1, 0.38, 1.0);
  addBumper(1, 0.38, 1.0);
  addBumper(-1, 0.38, -1.0);
  addBumper(1, 0.38, -1.0);
}

function addLights() {
  addHeadlight(-1);
  addHeadlight(1);
  addTailLight(-1);
  addTailLight(1);
  addLicensePlate();
}

function addExhaust() {
  const exhaust = cylinder(0.075, 0.48, darkMetalMaterial, -1.35, 0.43, -1.15, 12);
  exhaust.rotation.z = 0.15;
  const muffler = cylinder(0.12, 0.38, darkMetalMaterial, -1.35, 0.43, -1.15, 12);
  muffler.rotation.z = 0.15;
}

function addFrontBumper() {
  const lower = box(3.25, 0.18, 0.16, chromeMaterial, 0, 0.25, 1.0, 0.025);
  lower.rotation.y = 0.04;
  const upper = box(3.0, 0.12, 0.1, chromeMaterial, 0, 0.47, 0.98, 0.02);
  upper.rotation.y = 0.04;
}

function addRearBumper() {
  const rear = box(3.18, 0.15, 0.12, chromeMaterial, 0, 0.34, -1.0, 0.025);
  rear.rotation.y = -0.04;
}

function addSideDetails() {
  addSideWindow(-1);
  addSideWindow(1);
  addDoor(-1, -0.78, 0.02, 0.95, 0.99, 0.66, 0.18);
  addDoor(1, 0.78, 0.02, 0.95, 0.99, 0.66, 0.18);
  addBumpers();
  addHeadlight(-1);
  addHeadlight(1);
  addTailLight(-1);
  addTailLight(1);
  addLicensePlate();
  addInterior();
  addSideMirror(-1);
  addSideMirror(1);
  addExhaust();
  addFrontBumper();
  addRearBumper();
}

function addBody() {
  const body = box(3.52, 1.4, 1.52, carBodyMaterial, 0, 0.7, 0, 0.08);
  body.rotation.y = -0.015;
  const hood = box(1.05, 0.38, 1.18, carBodyMaterial, 1.15, 1.03, 0.02, 0.06);
  hood.rotation.z = -0.08;
  const trunk = box(0.95, 0.42, 1.18, carBodyMaterial, -1.15, 1.02, 0.02, 0.06);
  trunk.rotation.z = 0.08;
  const roof = box(1.65, 0.24, 1.03, carBodyMaterial, 0, 1.62, 0.02, 0.055);
  roof.rotation.x = -0.04;
  const windshieldFrame = box(1.55, 0.09, 0.08, carBodyMaterial, 0, 1.61, 0.76, 0.025);
  windshieldFrame.rotation.x = -0.16;
  const rearWindowFrame = box(1.45, 0.09, 0.08, carBodyMaterial, 0, 1.62, -0.76, 0.025);
  rearWindowFrame.rotation.x = 0.16;
  return body;
}

function addWheels() {
  addWheel(-1.62, 0.78, 0.43);
  addWheel(1.62, 0.78, 0.43);
  addWheel(-1.62, -0.78, 0.43);
  addWheel(1.62, -0.78, 0.43);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdde5e7);
scene.fog = new THREE.Fog(0xdde5e7, 12, 28);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(5.5, 3.2, 6.8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const car = new THREE.Group();
scene.add(car);

const carBodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xe86b24,
  roughness: 0.48,
  metalness: 0.18
});

const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0x78949a,
  roughness: 0.2,
  metalness: 0.25
});

const darkMetalMaterial = new THREE.MeshStandardMaterial({
  color: 0x20282b,
  roughness: 0.52,
  metalness: 0.65
});

const wheelRimMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a9294,
  roughness: 0.4,
  metalness: 0.75
});

const chromeMaterial = new THREE.MeshStandardMaterial({
  color: 0xd7e0e2,
  roughness: 0.2,
  metalness: 0.9
});

const whiteGlassMaterial = new THREE.MeshStandardMaterial({
  color: 0xf5f3d9,
  roughness: 0.25,
  emissive: 0x332000,
  emissiveIntensity: 0.12
});

const redGlassMaterial = new THREE.MeshStandardMaterial({
  color: 0x9e1818,
  roughness: 0.32,
  emissive: 0x3d0000,
  emissiveIntensity: 0.18
});

const plateMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5,
  metalness: 0.1
});

const interiorMaterial = new THREE.MeshStandardMaterial({
  color: 0x263238,
  roughness: 0.85
});

const seatMaterial = new THREE.MeshStandardMaterial({
  color: 0x334249,
  roughness: 0.95
});

const dashMaterial = new THREE.MeshStandardMaterial({
  color: 0x182126,
  roughness: 0.75
});

addBody();
addWheels();
addSideDetails();
addLights();

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({
  color: 0xcbd5d7,
  roughness: 0.95
}));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

const lights = new THREE.HemisphereLight(0xf4fbff, 0x657074, 2.1);
scene.add(lights);

const keyLight = new THREE.DirectionalLight(0xfff4df, 3.2);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 20;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xbadfff, 1.8);
rimLight.position.set(-5, 3, -4);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0xffb66f, 25, 12, 2);
fillLight.position.set(3, 2, 5);
scene.add(fillLight);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  car.rotation.y = -0.15;
  renderer.render(scene, camera);
}

animate();

export default car;