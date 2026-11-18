import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9f3f7);
scene.fog = new THREE.Fog(0xe9f3f7, 12, 28);

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(8, 5, 10);
camera.lookAt(0, 1.4, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const materials = {
  lightBlue: new THREE.MeshStandardMaterial({
    color: 0x8bd9ee,
    roughness: 0.68,
    metalness: 0.03
  }),
  white: new THREE.MeshStandardMaterial({
    color: 0xf5f7f4,
    roughness: 0.62,
    metalness: 0.02
  }),
  blue: new THREE.MeshStandardMaterial({
    color: 0x1978ad,
    roughness: 0.55,
    metalness: 0.12
  }),
  red: new THREE.MeshStandardMaterial({
    color: 0xe84b42,
    roughness: 0.58,
    metalness: 0.04
  }),
  black: new THREE.MeshStandardMaterial({
    color: 0x172028,
    roughness: 0.8,
    metalness: 0.05
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x163549,
    roughness: 0.16,
    metalness: 0.45,
    emissive: 0x081722,
    emissiveIntensity: 0.28
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: 0xdce8eb,
    roughness: 0.18,
    metalness: 0.9
  }),
  redRubber: new THREE.MeshStandardMaterial({
    color: 0xa92825,
    roughness: 0.72
  }),
  orange: new THREE.MeshStandardMaterial({
    color: 0xf3a22e,
    emissive: 0x5b2600,
    emissiveIntensity: 0.18,
    roughness: 0.4
  }),
  fin: new THREE.MeshStandardMaterial({
    color: 0x6d7780,
    roughness: 0.7,
    metalness: 0.15
  })
};

function addBox(parent, size, position, material, bevel = 0.04) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    material
  );
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent,
  radius,
  height,
  position,
  material,
  axis = "y",
  radialSegments = 20
) {
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    radialSegments
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, radius, position, material, widthSegments = 20) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, widthSegments, 14),
    material
  );
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBoxBetween(
  parent,
  start,
  end,
  thickness,
  material,
  radialSegments = 12
) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      thickness,
      thickness,
      length,
      radialSegments
    ),
    material
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const van = new THREE.Group();
scene.add(van);

const body = new THREE.Group();
van.add(body);

// Dimensions in metres.
const L = 5.3;
const H = 2.0;
const W = 1.9;

// Main lower white body and upper light-blue body.
addBox(
  body,
  new THREE.Vector3(L, H * 0.5, W),
  new THREE.Vector3(0, H * 0.25, 0),
  materials.white,
  0.06
);
addBox(
  body,
  new THREE.Vector3(L, H * 0.5, W),
  new THREE.Vector3(0, H * 0.75, 0),
  materials.lightBlue,
  0.06
);

// Blue belt line around the body.
const belt = addBox(
  body,
  new THREE.Vector3(L + 0.04, 0.12, W + 0.035),
  new THREE.Vector3(0, H * 0.5, 0),
  materials.blue,
  0.025
);

// Roof.
addBox(
  body,
  new THREE.Vector3(L * 0.78, 0.16, W * 0.86),
  new THREE.Vector3(0, H + 0.08, 0),
  materials.lightBlue,
  0.045
);

// Front and rear face panels.
addBox(
  body,
  new THREE.Vector3(0.12, H * 0.5, W * 0.9),
  new THREE.Vector3(L / 2, H * 0.5, 0),
  materials.white,
  0.025
);
addBox(
  body,
  new THREE.Vector3(0.12, H * 0.5, W * 0.9),
  new THREE.Vector3(-L / 2, H * 0.5, 0),
  materials.white,
  0.025
);

// Front windshield and side windows.
const windshield = addBox(
  body,
  new THREE.Vector3(0.07, 0.78, W * 0.73),
  new THREE.Vector3(L / 2 - 0.025, H * 0.79, 0),
  materials.glass,
  0.025
);

const sideWindowGeometry = new THREE.Vector3(
  W * 0.73,
  0.78,
  0.07
);
addBox(
  body,
  sideWindowGeometry,
  new THREE.Vector3(L * 0.23, H * 0.79, W / 2 + 0.025),
  materials.glass,
  0.025
);
addBox(
  body,
  sideWindowGeometry,
  new THREE.Vector3(-L * 0.23, H * 0.79, W / 2 + 0.025),
  materials.glass,
  0.025
);
addBox(
  body,
  sideWindowGeometry,
  new THREE.Vector3(0, H * 0.79, W / 2 + 0.025),
  materials.glass,
  0.025
);

// Rear window.
addBox(
  body,
  new THREE.Vector3(0.07, 0.78, W * 0.72),
  new THREE.Vector3(-L / 2 + 0.025, H * 0.79, 0),
  materials.glass,
  0.025
);

// Front grille.
addBox(
  body,
  new THREE.Vector3(0.09, 0.34, 0.52),
  new THREE.Vector3(L / 2 + 0.025, H * 0.34, 0),
  materials.black,
  0.02
);

// Headlights and machined rings.
const headlightPositions = [
  new THREE.Vector3(L / 2 + 0.03, H * 0.87, W * 0.34),
  new THREE.Vector3(L / 2 + 0.03, H * 0.87, -W * 0.34)
];

headlightPositions.forEach((position) => {
  addSphere(
    body,
    0.235,
    position,
    materials.white,
    28
  );
  addSphere(
    body,
    0.19,
    position,
    materials.chrome,
    28
  );
  addSphere(
    body,
    0.155,
    position,
    materials.white,
    28
  );
});

// Chrome trim between headlights.
addBox(
  body,
  new THREE.Vector3(0.14, 0.12, 0.62),
  new THREE.Vector3(L / 2 + 0.035, H * 0.87, 0),
  materials.chrome,
  0.015
);

// Amber indicators.
[-1, 1].forEach((side) => {
  addBox(
    body,
    new THREE.Vector3(0.17, 0.16, 0.12),
    new THREE.Vector3(L / 2 + 0.04, H * 0.4, side * W * 0.48),
    materials.orange,
    0.025
  );
});

// Front badge: three teal hexagons.
const badgeGroup = new THREE.Group();
badgeGroup.position.set(L / 2 + 0.055, H * 0.55, 0);
badgeGroup.rotation.y = Math.PI;
van.add(badgeGroup);

for (let i = 0; i < 3; i++) {
  const hex = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.115,
      0.115,
      0.035,
      6
    ),
    new THREE.MeshStandardMaterial({
      color: 0x2aa6b5,
      roughness: 0.4,
      metalness: 0.25
    })
  );
  hex.position.x = (i - 1) * 0.13;
  hex.castShadow = true;
  badgeGroup.add(hex);
}

// Rear lights.
[-1, 1].forEach((side) => {
  addBox(
    body,
    new THREE.Vector3(0.08, 0.28, 0.18),
    new THREE.Vector3(-L / 2 - 0.025, H * 0.48, side * W * 0.43),
    materials.red,
    0.02
  );
});

// Rear plate.
addBox(
  body,
  new THREE.Vector3(0.08, 0.28, 0.34),
  new THREE.Vector3(-L / 2 - 0.025, H * 0.38, 0),
  materials.black,
  0.018
);

// Black front plate with R8TN.
const plate = addBox(
  body,
  new THREE.Vector3(0.08, 0.28, 0.42),
  new THREE.Vector3(L / 2 + 0.03, H * 0.38, 0),
  materials.black,
  0.018
);

const plateText = new THREE.Mesh(
  new THREE.PlaneGeometry(0.31, 0.16),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  })
);
plateText.position.set(L / 2 + 0.076, H * 0.38, 0);
plateText.rotation.y = Math.PI;
van.add(plateText);

// Wheels.
const wheelPositions = [
  new THREE.Vector3(L / 2, 0.58, W / 2 + 0.08),
  new THREE.Vector3(L / 2, 0.58, -W / 2 - 0.08),
  new THREE.Vector3(-L / 2 - 0.02, 0.58, W / 2 + 0.08),
  new THREE.Vector3(-L / 2 - 0.02, 0.58, -W / 2 - 0.08)
];

wheelPositions.forEach((position, index) => {
  const wheel = new THREE.Group();
  wheel.position.copy(position);
  van.add(wheel);

  addCylinder(
    wheel,
    0.57,
    0.32,
    new THREE.Vector3(0, 0, 0),
    materials.black,
    "z",
    32
  );

  addCylinder(
    wheel,
    0.44,
    0.335,
    new THREE.Vector3(0, 0, 0.005),
    materials.redRubber,
    "z",
    32
  );

  addCylinder(
    wheel,
    0.23,
    0.36,
    new THREE.Vector3(0, 0, 0.01),
    materials.blue,
    "z",
    28
  );

  addCylinder(
    wheel,
    0.11,
    0.38,
    new THREE.Vector3(0, 0, 0.015),
    materials.chrome,
    "z",
    24
  );

  const hubCap = addCylinder(
    wheel,
    0.055,
    0.4,
    new THREE.Vector3(0, 0, 0.02),
    materials.white,
    "z",
    18
  );
  hubCap.rotation.z = Math.PI / 2;
});

// Side mirrors.
[-1, 1].forEach((side) => {
  const mirror = new THREE.Group();
  mirror.position.set(
    L * 0.18,
    H * 0.73,
    side * W * 0.5
  );
  van.add(mirror);

  addBox(
    mirror,
    new THREE.Vector3(0.26, 0.12, 0.08),
    new THREE.Vector3(0, 0, 0),
    materials.black,
    0.025
  );

  addBox(
    mirror,
    new THREE.Vector3(0.08, 0.19, 0.08),
    new THREE.Vector3(0, -0.12, 0),
    materials.black,
    0.02
  );
});

// Door handle recess on front right side.
const doorHandle = addBox(
  body,
  new THREE.Vector3(0.19, 0.055, 0.045),
  new THREE.Vector3(L * 0.25, H * 0.62, W / 2 + 0.055),
  materials.black,
  0.018
);
doorHandle.rotation.z = -0.12;

// Roof rack.
const rack = new THREE.Group();
van.add(rack);

[-1, 1].forEach((side) => {
  addBox(
    rack,
    new THREE.Vector3(L * 0.75, 0.075, 0.075),
    new THREE.Vector3(0, H + 0.2, side * W * 0.36),
    materials.blue,
    0.025
  );

  for (const x of [-L * 0.3, L * 0.3]) {
    addBox(
      rack,
      new THREE.Vector3(0.08, 0.2, 0.08),
      new THREE.Vector3(x, H + 0.1, side * W * 0.36),
      materials.blue,
      0.025
    );
  }
});

addBox(
  rack,
  new THREE.Vector3(L * 0.63, 0.065, 0.065),
  new THREE.Vector3(0, H + 0.245, 0),
  materials.blue,
  0.025
);

// Surfboard: blue body, red and white stripe.
const surfboard = new THREE.Group();
surfboard.position.set(0, H + 0.39, 0);
surfboard.rotation.y = -0.12;
van.add(surfboard);

const board = addBox(
  surfboard,
  new THREE.Vector3(1.65, 0.11, 0.38),
  new THREE.Vector3(0, 0, 0),
  materials.blue,
  0.035
);
board.rotation.x = -0.08;

addBox(
  surfboard,
  new THREE.Vector3(0.82, 0.025, 0.39),
  new THREE.Vector3(0.02, 0.012, 0),
  materials.red,
  0.008
);

addBox(
  surfboard,
  new THREE.Vector3(0.43, 0.028, 0.4),
  new THREE.Vector3(-0.18, 0.025, 0),
  materials.white,
  0.008
);

// Single grey fin.
const fin = addBox(
  surfboard,
  new THREE.Vector3(0.11, 0.48, 0.1),
  new THREE.Vector3(0.54, 0.12, 0),
  materials.fin,
  0.025
);
fin.rotation.x = -0.2;

// Subtle voxel texture via canvas.
function makeVoxelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);

  const colors = [
    "rgba(255,255,255,0.10)",
    "rgba(255,255,255,0.05)",
    "rgba(0,0,0,0.04)"
  ];

  for (let y = 0; y < 256; y += 16) {
    for (let x = 0; x < 256; x += 16) {
      const variation = Math.floor(Math.random() * colors.length);
      ctx.fillStyle = colors[variation];
      ctx.fillRect(x, y, 16, 16);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

const voxelTexture = makeVoxelTexture();

[materials.lightBlue, materials.white].forEach((material) => {
  material.map = voxelTexture;
});

// Ground and soft shadow.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({
    color: 0xdde9ec,
    roughness: 0.95
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.015;
ground.receiveShadow = true;
scene.add(ground);

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(2.7, 64),
  new THREE.MeshBasicMaterial({
    color: 0x5b7078,
    transparent: true,
    opacity: 0.12,
    depthWrite: false
  })
);
shadow.rotation.x = -Math.PI / 2;
shadow.scale.set(1.8, 0.75, 1);
shadow.position.set(0, 0.002, 1.1);
scene.add(shadow);

// Lighting.
scene.add(new THREE.HemisphereLight(0xf5fbff, 0x64747c, 2.1));

const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(5, 9, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -7;
keyLight.shadow.camera.right = 7;
keyLight.shadow.camera.top = 7;
keyLight.shadow.camera.bottom = -7;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 25;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xb8e8ff, 1.15);
fillLight.position.set(-7, 4, 2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 1.3);
rimLight.position.set(2, 6, -8);
scene.add(rimLight);

// Small voxel-style road details.
const road = new THREE.Group();
scene.add(road);

for (let i = 0; i < 9; i++) {
  addBox(
    road,
    new THREE.Vector3(0.12, 0.012, 0.7),
    new THREE.Vector3(-4.8 + i * 0.56, 0.002, 3.2),
    materials.white,
    0.005
  );
}

for (let i = 0; i < 5; i++) {
  addBox(
    road,
    new THREE.Vector3(0.12, 0.012, 0.7),
    new THREE.Vector3(-4.8 + i * 0.56, 0.002, -3.2),
    materials.white,
    0.005
  );
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function build() {
  const model = new THREE.Group();
  scene.add(model);

  const car = new THREE.Group();
  model.add(car);

  const body = new THREE.Group();
  car.add(body);

  // Main body.
  addBox(
    body,
    new THREE.Vector3(L, H * 0.5, W),
    new THREE.Vector3(0, H * 0.25, 0),
    materials.white,
    0.06
  );
  addBox(
    body,
    new THREE.Vector3(L, H * 0.5, W),
    new THREE.Vector3(0, H * 0.75, 0),
    materials.lightBlue,
    0.06
  );

  const belt = addBox(
    body,
    new THREE.Vector3(L + 0.04, 0.12, W + 0.035),
    new THREE.Vector3(0, H * 0.5, 0),
    materials.blue,
    0.025
  );

  // Roof.
  addBox(
    body,
    new THREE.Vector3(L * 0.78, 0.16, W * 0.86),
    new THREE.Vector3(0, H + 0.08, 0),
    materials.lightBlue,
    0.045
  );

  // Front/rear face panels.
  addBox(
    body,
    new THREE.Vector3(0.12, H * 0.5, W * 0.9),
    new THREE.Vector3(L / 2, H * 0.5, 0),
    materials.white,
    0.025
  );
  addBox(
    body,
    new THREE.Vector3(0.12, H * 0.5, W * 0.9),
    new THREE.Vector3(-L / 2, H * 0.5, 0),
    materials.white,
    0.025
  );

  // Windshield and side windows.
  addBox(
    body,
    new THREE.Vector3(0.07, 0.78, W * 0.73),
    new THREE.Vector3(L / 2 - 0.025, H * 0.79, 0),
    materials.glass,
    0.025
  );
  addBox(
    body,
    new THREE.Vector3(W * 0.73, 0.78, 0.07),
    new THREE.Vector3(L * 0.23, H * 0.79, W / 2 + 0.025),
    materials.glass,
    0.025
  );
  addBox(
    body,
    new THREE.Vector3(W * 0.73, 0.78, 0.07),
    new THREE.Vector3(-L * 0.23, H * 0.79, W / 2 + 0.025),
    materials.glass,
    0.025
  );
  addBox(
    body,
    new THREE.Vector3(W * 0.73, 0.78, 0.07),
    new THREE.Vector3(0, H * 0.79, W / 2 + 0.025),
    materials.glass,
    0.025
  );
  addBox(
    body,
    new THREE.Vector3(0.07, 0.78, W * 0.72),
    new THREE.Vector3(-L / 2 + 0.025, H * 0.79, 0),
    materials.glass,
    0.025
  );

  // Front grille.
  addBox(
    body,
    new THREE.Vector3(0.09, 0.34, 0.52),
    new THREE.Vector3(L / 2 + 0.025, H * 0.34, 0),
    materials.black,
    0.02
  );

  // Headlights.
  [-1, 1].forEach((side) => {
    const position = new THREE.Vector3(
      L / 2 + 0.03,
      H * 0.87,
      side * W * 0.34
    );

    addSphere(
      body,
      0.235,
      position,
      materials.white,
      28
    );
    addSphere(
      body,
      0.19,
      position,
      materials.chrome,
      28
    );
    addSphere(
      body,
      0.155,
      position,
      materials.white,
      28
    );
  });

  // Chrome trim.
  addBox(
    body,
    new THREE.Vector3(0.14, 0.12, 0.62),
    new THREE.Vector3(L / 2 + 0.035, H * 0.87, 0),
    materials.chrome,
    0.015
  );

  // Amber indicators.
  [-1, 1].forEach((side) => {
    addBox(
      body,
      new THREE.Vector3(0.17, 0.16, 0.12),
      new THREE.Vector3(L / 2 + 0.04, H * 0.4, side * W * 0.48),
      materials.orange,
      0.025
    );
  });

  // Rear lights and plate.
  [-1, 1].forEach((side) => {
    addBox(
      body,
      new THREE.Vector3(0.08, 0.28, 0.18),
      new THREE.Vector3(-L / 2 - 0.025, H * 0.48, side * W * 0.43),
      materials.red,
      0.02
    );
  });

  addBox(
    body,
    new THREE.Vector3(0.08, 0.28, 0.34),
    new THREE.Vector3(-L / 2 - 0.025, H * 0.38, 0),
    materials.black,
    0.018
  );

  const plate = addBox(
    body,
    new THREE.Vector3(0.08, 0.28, 0.42),
    new THREE.Vector3(L / 2 + 0.03, H * 0.38, 0),
    materials.black,
    0.018
  );

  const plateText = new THREE.Mesh(
    new THREE.PlaneGeometry(0.31, 0.16),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide
    })
  );
  plateText.position.set(L / 2 + 0.076, H * 0.38, 0);
  plateText.rotation.y = Math.PI;
  car.add(plateText);

  // Badge.
  const badgeGroup = new THREE.Group();
  badgeGroup.position.set(L / 2 + 0.055, H * 0.55, 0);
  badgeGroup.rotation.y = Math.PI;
  car.add(badgeGroup);

  for (let i = 0; i < 3; i++) {
    const hex = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.035, 6),
      new THREE.MeshStandardMaterial({
        color: 0x2aa6b5,
        roughness: 0.4,
        metalness: 0.25
      })
    );
    hex.position.x = (i - 1) * 0.13;
    hex.castShadow = true;
    badgeGroup.add(hex);
  }

  // Wheels.
  const wheelPositions = [
    new THREE.Vector3(L / 2, 0.58, W / 2 + 0.08),
    new THREE.Vector3(L / 2, 0.58, -W / 2 - 0.08),
    new THREE.Vector3(-L / 2 - 0.02, 0.58, W / 2 + 0.08),
    new THREE.Vector3(-L / 2 - 0.02, 0.58, -W / 2 - 0.08)
  ];

  wheelPositions.forEach((position) => {
    const wheel = new THREE.Group();
    wheel.position.copy(position);
    car.add(wheel);

    addCylinder(
      wheel,
      0.57,
      0.32,
      new THREE.Vector3(0, 0, 0),
      materials.black,
      "z",
      32
    );

    addCylinder(
      wheel,
      0.44,
      0.335,
      new THREE.Vector3(0, 0, 0.005),
      materials.redRubber,
      "z",
      32
    );

    addCylinder(
      wheel,
      0.23,
      0.36,
      new THREE.Vector3(0, 0, 0.01),
      materials.blue,
      "z",
      28
    );

    addCylinder(
      wheel,
      0.11,
      0.38,
      new THREE.Vector3(0, 0, 0.015),
      materials.chrome,
      "z",
      24
    );

    const hubCap = addCylinder(
      wheel,
      0.055,
      0.4,
      new THREE.Vector3(0, 0, 0.02),
      materials.white,
      "z",
      18
    );
    hubCap.rotation.z = Math.PI / 2;
  });

  // Mirrors.
  [-1, 1].forEach((side) => {
    const mirror = new THREE.Group();
    mirror.position.set(
      L * 0.18,
      H * 0.73,
      side * W * 0.5
    );
    car.add(mirror);

    addBox(
      mirror,
      new THREE.Vector3(0.26, 0.12, 0.08),
      new THREE.Vector3(0, 0, 0),
      materials.black,
      0.025
    );

    addBox(
      mirror,
      new THREE.Vector3(0.08, 0.19, 0.08),
      new THREE.Vector3(0, -0.12, 0),
      materials.black,
      0.02
    );
  });

  // Door handle recess.
  const doorHandle = addBox(
    body,
    new THREE.Vector3(0.19, 0.055, 0.045),
    new THREE.Vector3(L * 0.25, H * 0.62, W / 2 + 0.055),
    materials.black,
    0.018
  );
  doorHandle.rotation.z = -0.12;

  // Roof rack.
  const rack = new THREE.Group();
  car.add(rack);

  [-1, 1].forEach((side) => {
    addBox(
      rack,
      new THREE.Vector3(L * 0.75, 0.075, 0.075),
      new THREE.Vector3(0, H + 0.2, side * W * 0.36),
      materials.blue,
      0.025
    );

    for (const x of [-L * 0.3, L * 0.3]) {
      addBox(
        rack,
        new THREE.Vector3(0.08, 0.2, 0.08),
        new THREE.Vector3(x, H + 0.1, side * W * 0.36),
        materials.blue,
        0.025
      );
    }
  });

  addBox(
    rack,
    new THREE.Vector3(L * 0.63, 0.065, 0.065),
    new THREE.Vector3(0, H + 0.245, 0),
    materials.blue,
    0.025
  );

  // Surfboard.
  const surfboard = new THREE.Group();
  surfboard.position.set(0, H + 0.39, 0);
  surfboard.rotation.y = -0.12;
  car.add(surfboard);

  const board = addBox(
    surfboard,
    new THREE.Vector3(1.65, 0.11, 0.38),
    new THREE.Vector3(0, 0, 0),
    materials.blue,
    0.035
  );
  board.rotation.x = -0.08;

  addBox(
    surfboard,
    new THREE.Vector3(0.82, 0.025, 0.39),
    new THREE.Vector3(0.02, 0.012, 0),
    materials.red,
    0.008
  );

  addBox(
    surfboard,
    new THREE.Vector3(0.43, 0.028, 0.4),
    new THREE.Vector3(-0.18, 0.025, 0),
    materials.white,
    0.008
  );

  const fin = addBox(
    surfboard,
    new THREE.Vector3(0.11, 0.48, 0.1),
    new THREE.Vector3(0.54, 0.12, 0),
    materials.fin,
    0.025
  );
  fin.rotation.x = -0.2;

  return model;
}

export default build();