import * as THREE from "three";

// -------------------------------------------------------------------------
// 1972 Renault 5 TL — voxel style
// -------------------------------------------------------------------------

function build() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(
    38,
    innerWidth / innerHeight,
    0.1,
    100
  );
  camera.position.set(7, 4, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.HemisphereLight(0xf3fbff, 0x555045, 2.1));

  const keyLight = new THREE.DirectionalLight(0xfff4dc, 3.0);
  keyLight.position.set(4, 8, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -6;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.bias = -0.00025;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xa9d5ff, 1.1);
  fillLight.position.set(-5, 3, -4);
  scene.add(fillLight);

  // Voxel helpers
  const voxel = (w, h, d, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const roundedBox = (w, h, d, radius, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Dimensions in metres:
  // L = 3.521, H = 1.40, wheelbase-ish = 1.525
  const L = 3.521;
  const H = 1.40;
  const W = 1.525;
  const bodyY = 0.72;
  const groundY = 0;

  const materials = {
    orange: new THREE.MeshStandardMaterial({
      color: 0xe86622,
      roughness: 0.62,
      metalness: 0.08
    }),
    orangeDark: new THREE.MeshStandardMaterial({
      color: 0xb94717,
      roughness: 0.68,
      metalness: 0.08
    }),
    cream: new THREE.MeshStandardMaterial({
      color: 0xe8dcc0,
      roughness: 0.75,
      metalness: 0.02
    }),
    black: new THREE.MeshStandardMaterial({
      color: 0x171b1d,
      roughness: 0.82,
      metalness: 0.08
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x36515c,
      roughness: 0.24,
      metalness: 0.35
    }),
    tire: new THREE.MeshStandardMaterial({
      color: 0x151819,
      roughness: 0.92,
      metalness: 0.02
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x9ca6a9,
      roughness: 0.42,
      metalness: 0.65
    }),
    wheel: new THREE.MeshStandardMaterial({
      color: 0xb7b9b5,
      roughness: 0.5,
      metalness: 0.6
    })
  };

  const car = new THREE.Group();
  car.rotation.y = -0.08; // camera-facing three-quarter view
  scene.add(car);

  // -------------------------------------------------------------------------
  // Chassis and underbody
  // -------------------------------------------------------------------------

  car.add(
    voxel(
      3.18,
      0.18,
      1.25,
      materials.black,
      0,
      0.43,
      0
    )
  );

  car.add(
    voxel(
      3.42,
      0.16,
      1.37,
      materials.cream,
      0,
      0.30,
      0
    )
  );

  // -------------------------------------------------------------------------
  // Orange body: hood, roof, rear hatch, lower shell
  // -------------------------------------------------------------------------

  // Hood
  car.add(
    voxel(
      1.38,
      0.30,
      0.86,
      materials.orange,
      1.12,
      0.98,
      0
    )
  );

  // Main roof / upper body
  car.add(
    voxel(
      1.42,
      0.32,
      1.18,
      materials.orange,
      -0.98,
      1.20,
      0
    )
  );

  // Rear body
  car.add(
    voxel(
      0.88,
      0.34,
      1.25,
      materials.orange,
      -1.78,
      1.18,
      0
    )
  );

  // Lower side shell
  car.add(
    voxel(
      2.82,
      0.28,
      0.58,
      materials.orange,
      -0.06,
      0.78,
      0.72
    )
  );

  car.add(
    voxel(
      2.82,
      0.28,
      0.58,
      materials.orange,
      -0.06,
      0.78,
      -0.72
    )
  );

  // Orange roof and body edge
  car.add(
    voxel(
      1.46,
      0.18,
      1.24,
      materials.orange,
      -0.98,
      1.39,
      0
    )
  );

  car.add(
    voxel(
      0.92,
      0.18,
      1.24,
      materials.orange,
      -1.80,
      1.39,
      0
    )
  );

  // -------------------------------------------------------------------------
  // Windows: front windshield, rear glass, two side windows
  // Only three doors: one per side, no rear door.
  // -------------------------------------------------------------------------

  // Front windshield
  car.add(
    voxel(
      0.88,
      0.34,
      0.045,
      materials.glass,
      0.92,
      1.12,
      0.43
    )
  );

  // Rear side glass
  car.add(
    voxel(
      0.66,
      0.34,
      0.045,
      materials.glass,
      -1.77,
      1.18,
      0.64
    )
  );

  car.add(
    voxel(
      0.66,
      0.34,
      0.045,
      materials.glass,
      -1.77,
      1.18,
      -0.64
    )
  );

  // Left side window
  car.add(
    voxel(
      0.94,
      0.35,
      0.045,
      materials.glass,
      -0.96,
      1.18,
      0.64
    )
  );

  // Right side window
  car.add(
    voxel(
      0.94,
      0.35,
      0.045,
      materials.glass,
      -0.96,
      1.18,
      -0.64
    )
  );

  // Window frames and pillars
  car.add(
    voxel(
      0.94,
      0.045,
      0.06,
      materials.orangeDark,
      -0.96,
      1.39,
      0.66
    )
  );

  car.add(
    voxel(
      0.94,
      0.045,
      0.06,
      materials.orangeDark,
      -0.96,
      1.39,
      -0.66
    )
  );

  car.add(
    voxel(
      0.05,
      0.38,
      0.06,
      materials.orangeDark,
      -0.51,
      1.18,
      0.67
    )
  );

  car.add(
    voxel(
      0.05,
      0.38,
      0.06,
      materials.orangeDark,
      -1.41,
      1.18,
      0.67
    )
  );

  // Rear hatch frame
  car.add(
    voxel(
      0.05,
      0.37,
      1.08,
      materials.orangeDark,
      -2.22,
      1.18,
      0
    )
  );

  // -------------------------------------------------------------------------
  // Wheels and fenders
  // -------------------------------------------------------------------------

  const wheelZ = 0.79;
  const wheelY = 0.43;
  const tireRadius = 0.34;
  const tireWidth = 0.25;

  function makeWheel(x, z, front = false) {
    const group = new THREE.Group();
    group.position.set(x, wheelY, z);

    // Tire: voxelized cylinder-like tire with a dark outer rim
    const tire = voxel(
      0.32,
      tireWidth,
      0.32,
      materials.tire,
      0,
      0,
      0
    );
    group.add(tire);

    // Hub
    const hub = voxel(
      0.22,
      0.055,
      0.22,
      materials.metal,
      0,
      0,
      0
    );
    group.add(hub);

    // Five-spoke radial design
    for (let i = 0; i < 5; i++) {
      const spoke = voxel(
        0.045,
        0.055,
        0.25,
        materials.metal,
        Math.cos((i * Math.PI * 2) / 5) * 0.08,
        0,
        0
      );
      spoke.rotation.y = (i * Math.PI * 2) / 5;
      group.add(spoke);
    }

    // Front/rear hub cap
    const cap = voxel(
      0.08,
      0.065,
      0.08,
      materials.orangeDark,
      0,
      0,
      0
    );
    cap.rotation.y = Math.PI / 4;
    group.add(cap);

    car.add(group);
  }

  makeWheel(-1.42, 0.78, true);
  makeWheel(1.42, 0.78, true);
  makeWheel(-1.42, -0.78, false);
  makeWheel(1.42, -0.78, false);

  // -------------------------------------------------------------------------
  // Bumpers, lights, mirrors, wipers
  // -------------------------------------------------------------------------

  // Front and rear bumpers
  car.add(
    voxel(
      0.09,
      0.10,
      1.68,
      materials.metal,
      1.78,
      0.58,
      0
    )
  );

  car.add(
    voxel(
      0.09,
      0.10,
      1.68,
      materials.metal,
      -1.78,
      0.58,
      0
    )
  );

  // Front headlights
  car.add(
    voxel(
      0.13,
      0.16,
      0.24,
      materials.cream,
      1.94,
      0.96,
      0.46
    )
  );

  car.add(
    voxel(
      0.13,
      0.16,
      0.24,
      materials.cream,
      1.94,
      0.96,
      -0.46
    )
  );

  // Rear lights
  car.add(
    voxel(
      0.12,
      0.18,
      0.24,
      materials.red,
      -1.96,
      0.95,
      0.56
    )
  );

  car.add(
    voxel(
      0.12,
      0.18,
      0.24,
      materials.red,
      -1.96,
      0.95,
      -0.56
    )
  );

  // Mirrors
  car.add(
    voxel(
      0.12,
      0.05,
      0.22,
      materials.orange,
      -1.78,
      1.35,
      0.92
    )
  );

  car.add(
    voxel(
      0.12,
      0.05,
      0.22,
      materials.orange,
      -1.78,
      1.35,
      -0.92
    )
  );

  car.add(
    voxel(
      0.03,
      0.20,
      0.12,
      materials.orangeDark,
      -2.02,
      1.23,
      0.92
    )
  );

  car.add(
    voxel(
      0.03,
      0.20,
      0.12,
      materials.orangeDark,
      -2.02,
      1.23,
      -0.92
    )
  );

  // Windshield wipers
  const wiper1 = voxel(
    0.025,
    0.025,
    0.52,
    materials.black,
    1.02,
    1.13,
    0.47
  );
  wiper1.rotation.z = -0.38;
  car.add(wiper1);

  const wiper2 = voxel(
    0.025,
    0.025,
    0.46,
    materials.black,
    -1.82,
    1.14,
    0.66
  );
  wiper2.rotation.z = 0.42;
  car.add(wiper2);

  // -------------------------------------------------------------------------
  // Roof rails / antenna and small details
  // -------------------------------------------------------------------------

  // Roof rails
  car.add(
    voxel(
      0.055,
      0.055,
      1.22,
      materials.metal,
      -1.23,
      1.50,
      0
    )
  );

  car.add(
    voxel(
      0.055,
      0.055,
      1.22,
      materials.metal,
      -0.73,
      1.50,
      0
    )
  );

  // Short antenna
  car.add(
    voxel(
      0.025,
      0.34,
      0.025,
      materials.orangeDark,
      -1.17,
      1.65,
      0.22
    )
  );

  // Small badge on rear hatch
  car.add(
    voxel(
      0.27,
      0.08,
      0.035,
      materials.cream,
      -1.82,
      1.18,
      0.63
    )
  );

  // -------------------------------------------------------------------------
  // Ground and contact shadows
  // -------------------------------------------------------------------------

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({
      color: 0xe9e6df,
      roughness: 1,
      metalness: 0
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.015;
  ground.receiveShadow = true;
  scene.add(ground);

  // -------------------------------------------------------------------------
  // Resize and render loop
  // -------------------------------------------------------------------------

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  });

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();

  return car;
}