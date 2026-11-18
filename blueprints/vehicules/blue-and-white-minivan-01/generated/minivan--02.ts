import * as THREE from "three";

import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f7ff);
scene.fog = new THREE.Fog(0xf4f7ff, 12, 24);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9bb5, 2.4);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(5, 8, 6);
scene.add(key);

const fill = new THREE.DirectionalLight(0xb9d8ff, 1.2);
fill.position.set(-5, 4, -4);
scene.add(fill);

const van = new THREE.Group();
van.rotation.y = -Math.PI / 2;
scene.add(van);

const body = new THREE.Group();
van.add(body);

const lightBlue = new THREE.Color(0x70c8e8);
const paleBlue = new THREE.Color(0x9bd8ee);
const white = new THREE.Color(0xf5f7fb);
const darkBlue = new THREE.Color(0x247aa6);
const black = new THREE.Color(0x171b21);
const glass = new THREE.MeshPhysicalMaterial({
 color: 0x183342,
 roughness: 0.18,
 metalness: 0.05,
 transmission: 0.12,
 transparent: true,
 opacity: 0.86
});
const tire = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.9 });
const red = new THREE.MeshStandardMaterial({ color: 0xd93d35, roughness: 0.45 });
const orange = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.4 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xdce6ed, metalness: 0.9, roughness: 0.18 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x20262d, roughness: 0.86 });
const redPaint = new THREE.MeshStandardMaterial({ color: 0xc93732, roughness: 0.42 });
const teal = new THREE.MeshStandardMaterial({ color: 0x168b91, roughness: 0.35 });
const silver = new THREE.MeshStandardMaterial({ color: 0xaebdc5, metalness: 0.5, roughness: 0.35 });

function box(w, h, d, material, x=0, y=0, z=0, parent=body) {
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
 mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cyl(radius, height, material, x=0,y=0,z=0, parent=body, radial=16) {
 const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,radial), material);
 mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function rounded? no, use box and cylinders.

// Main body: lower white body, light blue upper, blue belt line.
box(5.3, 0.78, 1.9, white, 0, 0.55, 0);
box(5.12, 1.38, 1.82, lightBlue, 0, 1.47, 0);
box(5.38, 0.18, 1.98, darkBlue, 0, 0.95, 0);
box(5.42, 0.12, 2.02, white, 0, 0.32, 0);

// Roof and pillars
box(5.12, 0.16, 1.78, lightBlue, 0, 2.19, 0);
box(0.12, 1.12, 1.82, lightBlue, -2.5, 1.61, 0);
box(0.12, 1.12, 1.82, lightBlue, 2.5, 1.61, 0);
box(5.12, 1.12, 0.12, lightBlue, 0, 1.61, -0.89);
box(5.12, 1.12, 0.12, lightBlue, 0, 1.61, 0.89);

// Windshield and side windows
box(3.95, 0.82, 0.08, glass, 0, 1.72, -0.93);
box(0.08, 0.82, 1.55, glass, -2.58, 1.72, 0);
box(0.08, 0.82, 1.55, glass, 2.58, 1.72, 0);
box(0.08, 0.82, 1.55, glass, 2.58, 1.72, 0);

// Rear doors and windows
box(0.12, 1.18, 1.72, lightBlue, -1.25, 1.61, 0);
box(0.12, 1.18, 1.72, lightBlue, 1.25, 1.61, 0);
box(0.07, 0.72, 1.18, glass, -1.25, 1.72, 0);
box(0.07, 0.72, 1.18, glass, 1.25, 1.72, 0);
box(2.58, 0.16, 1.72, lightBlue, 0, 2.25, 0);

// Roof rack
const rack = new THREE.Group();
body.add(rack);
for (const z of [-0.55, 0.55]) {
 box(4.65, 0.09, 0.09, darkBlue, 0, 2.34, z);
 for (const x of [-2.05, 2.05]) {
  box(0.18, 0.16, 0.18, darkBlue, x, 2.43, z);
 }
}
box(4.65, 0.12, 0.12, darkBlue, 0, 2.34, 0.55);

// surfboard on rack, along Z
const board = new THREE.Group();
board.position.set(0, 2.62, 0);
body.add(board);

const deck = box(0.68, 0.10, 3.05, redPaint, 0, 0, 0, board);
box(0.28, 0.11, 2.62, white, 0, 0.015, 0, board);
box(0.30, 0.12, 0.42, red, 0, 0.025, 0.35, board);
box(0.30, 0.12, 0.42, red, 0, 0.025, -0.35, board);

// single fin
const fin = new THREE.Group();
fin.position.set(0, 0.09, 1.15);
fin.rotation.x = -0.25;
body.add(fin);
const finMesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.58, 3), redPaint);
finMesh.rotation.z = Math.PI / 2;
fin.add(finMesh);
box(0.28, 0.05, 0.14, redPaint, 0, 0.02, 0, fin);

// front hood and grille
box(2.1, 0.48, 1.65, lightBlue, 0, 1.08, 0.12);
box(1.3, 0.22, 0.1, darkBlue, 0, 1.16, -0.72);
for (let i=0; i<5; i++) {
 box(0.055, 0.18, 0.025, black, -0.48+i*0.24, 1.16, -0.785);
}

// headlights with machined ring
const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff8cf, emissive: 0xffe7a0, emissiveIntensity: 0.45, roughness: 0.2 });
for (const x of [-1.78, 1.78]) {
 const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 24), silver);
 housing.rotation.x = Math.PI / 2; housing.position.set(x, 1.18, -0.75); body.add(housing);
 const glassLens = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.17, 24), headlightMat);
 glassLens.rotation.x = Math.PI / 2; glassLens.position.set(x, 1.18, -0.84); body.add(glassLens);
 const ring = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.045, 8, 24), chrome);
 ring.rotation.y = Math.PI / 2; ring.position.set(x, 1.18, -0.86); body.add(ring);
}

// chrome trim between headlights
box(3.92, 0.09, 0.12, chrome, 0, 1.02, -0.82);

// amber indicators under headlights
for (const x of [-1.78, 1.78]) {
 const indicator = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.12, 16), orange);
 indicator.rotation.x = Math.PI / 2; indicator.position.set(x, 0.84, -0.82); body.add(indicator);
}

// front badge three teal hex shapes
for (let i=0; i<3; i++) {
 const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6), teal);
 badge.rotation.x = Math.PI / 2; badge.position.set(-0.24+i*0.24, 1.18, -0.91); body.add(badge);
}

// black bumper and plate
box(3.95, 0.25, 0.16, black, 0, 0.77, -0.96);
box(0.86, 0.29, 0.08, black, 0, 0.79, -1.055);
const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.22), new THREE.MeshBasicMaterial({ color: 0x343a40 }));
plate.position.set(0, 0.79, -1.105);
plate.rotation.y = Math.PI;
body.add(plate);
// fake R8TN using small silver boxes
const plateText = ["R","8","T","N"];
plateText.forEach((char, i) => {
 const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.13,0.045), silver);
 glyph.position.set((i-1.5)*0.15, 0.79, -1.12);
 body.add(glyph);
});

// wheels
const wheel = (x, z, outward) => {
 const group = new THREE.Group();
 group.position.set(x, 0.63, z);
 body.add(group);

 const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 24), tire);
 tireMesh.rotation.x = Math.PI / 2; tireMesh.castShadow=true; group.add(tireMesh);

 const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.355, 24), redPaint);
 rim.rotation.x = Math.PI / 2; group.add(rim);

 const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.38, 20), darkBlue);
 hub.rotation.x = Math.PI / 2; group.add(hub);

 const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.4, 16), silver);
 hubCap.rotation.x = Math.PI / 2; group.add(hubCap);

 const boltMat = new THREE.MeshStandardMaterial({color:0xc8d3d9, metalness:.8});
 for(let i=0;i<6;i++){
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.42,6), boltMat);
  bolt.rotation.x=Math.PI/2; bolt.rotation.z=(i*Math.PI/3); group.add(bolt);
 }

 const fender = box(0.9,0.18,0.55,lightBlue, x, 1.12, z);
 fender.scale.z = 0.75;
};
wheel(-2.65, -0.92, -1);
wheel(2.65, -0.92, -1);
wheel(-2.65, 0.92, 1);
wheel(2.65, 0.92, 1);

// side mirrors
for (const side of [-1, 1]) {
 const mirror = box(0.38, 0.32, 0.18, darkBlue, side*2.78, 1.35, 0.68);
 mirror.rotation.z = side*0.15;
 box(0.08,0.25,0.08, rubber, side*2.96,1.25,0.68);
}

// door handle recess on front right
box(0.04,0.16,0.38, black, 2.61, 1.35, 0.18);
box(0.08,0.08,0.28, black, 2.66,1.35,0.18);

// roof antenna
cyl(0.035, 0.35, silver, 0, 2.43, 0.55);
const antennaTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 3), redPaint);
antennaTip.rotation.z = -Math.PI / 2;
antennaTip.position.set(0, 2.66, 0.55);
body.add(antennaTip);

// subtle panel seams and roof details
box(5.18, 0.025, 0.035, darkBlue, 0, 2.275, 0.84);
box(5.18, 0.025, 0.035, darkBlue, 0, 2.275, -0.84);
box(0.035, 1.12, 1.7, darkBlue, 2.56, 1.61, 0);

// contact info / side decal perhaps a small dark panel
box(0.75, 0.22, 0.025, darkBlue, -1.85, 0.56, 0.98);
box(0.35, 0.06, 0.03, silver, -2.02, 0.57, 1.005);
box(0.18, 0.05, 0.03, silver, -1.73, 0.57, 1.005);

// Ground / shadow
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow=true; scene.add(ground);

const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: 0x8ca0b0, transparent: true, opacity: 0.18, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.005, 0); scene.add(shadow);

function resize() {
 camera.aspect = innerWidth / innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth, innerHeight);
 renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
}
addEventListener("resize", resize);

// top view camera
camera.position.set(0, 8.5, 0.01);
camera.lookAt(0,0,0);
renderer.render(scene, camera);

// right view
camera.position.set(8.5, 5.2, 7.5);
camera.lookAt(0,1,0);
renderer.render(scene, camera);

// back view
camera.position.set(0, 3.2, -8.5);
camera.lookAt(0,1,0);
renderer.render(scene, camera);