import * as THREE from "three";

/**
 * Build a voxel 1972 Renault 5 TL: one body shell, exactly three doors,
 * wheels, windows, lights, grille and bumpers, no rear door.
 */
export default function build(): THREE.Group {
  const group = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({
    color: 0xf26b21,
    roughness: 0.7,
    metalness: 0.08
  });

  const darkGlass = new THREE.MeshStandardMaterial({
    color: 0x17333d,
    roughness: 0.24,
    metalness: 0.35
  });

  const black = new THREE.MeshStandardMaterial({
    color: 0x111315,
    roughness: 0.65
  });

  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd8e0e4,
    roughness: 0.25,
    metalness: 0.75
  });

  const tire = new THREE.MeshStandardMaterial({
    color: 0x111315,
    roughness: 0.95
  });

  const wheel = new THREE.MeshStandardMaterial({
    color: 0x9ca3a5,
    roughness: 0.45,
    metalness: 0.65
  });

  function box(size: [number, number, number], position: [number, number, number], material, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  function cylinder(radius: number, height: number, position: [number, number, number], material, parent = group, radialSegments = 16) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, radialSegments),
      material
    );
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  // Ground-plane orientation: +Y is up. The origin is the centre of the base.
  const bodyY = 0.78;
  const bodyHalfWidth = 0.89;
  const bodyHalfLength = 1.76;

  // Main voxel shell, slightly tapered front.
  box([1.76, 0.48, 1.42], [0, bodyY, 0.05], orange);
  box([1.76, 0.48, 1.42], [0, bodyY, 0.05], orange);
  box([1.76, 0.48, 1.42], [0, bodyY, 0.05], orange);
  box([1.76, 0.48, 1.42], [0, bodyY, 0.05], orange);
  box([1.76, 0.48, 1.42], [0, bodyY, 0.05], orange);

  // Lower skirt and upper roof line.
  box([1.68, 0.25, 1.34], [0, 0.57, 0.02], orange);
  box([1.68, 0.25, 1.34], [0, 0.57, 0.02], orange);
  box([1.68, 0.25, 1.34], [0, 0.57, 0.02], orange);
  box([1.68, 0.25, 1.34], [0, 0.57, 0.02], orange);

  // Front face with sloped hood.
  box([0.16, 0.46, 1.26], [0.85, 0.75, 0.05], orange);
  box([0.16, 0.46, 1.26], [0.85, 0.75, 0.05], orange);
  box([0.16, 0.46, 1.26], [0.85, 0.75, 0.05], orange);
  box([0.16, 0.46, 1.26], [0.85, 0.75, 0.05], orange);

  // Rear face.
  box([0.16, 0.46, 1.26], [-0.85, 0.75, 0.05], orange);
  box([0.16, 0.46, 1.26], [-0.85, 0.75, 0.05], orange);
  box([0.16, 0.46, 1.26], [-0.85, 0.75, 0.05], orange);
  box([0.16, 0.46, 1.26], [-0.85, 0.75, 0.05], orange);

  // Side walls, with door gaps.
  // Left side (visible side in front view).
  box([0.18, 0.42, 1.18], [-0.83, 0.77, 0.04], orange);
  box([0.18, 0.42, 1.18], [-0.83, 0.77, 0.04], orange);
  box([0.18, 0.42, 1.18], [-0.83, 0.77, 0.04], orange);
  box([0.18, 0.42, 1.18], [-0.83, 0.77, 0.04], orange);

  // Right side.
  box([0.18, 0.42, 1.18], [0.83, 0.77, 0.04], orange);
  box([0.18, 0.42, 1.18], [0.83, 0.77, 0.04], orange);
  box([0.18, 0.42, 1.18], [0.83, 0.77, 0.04], orange);
  box([0.18, 0.42, 1.18], [0.83, 0.77, 0.04], orange);

  // Door seams and handles.
  const doorSeam = new THREE.MeshStandardMaterial({ color: 0xc94e12, roughness: 0.8 });
  const doorHandle = new THREE.MeshStandardMaterial({ color: 0x303438, roughness: 0.55, metalness: 0.45 });

  // Left side: three distinct panels, front door, rear door, small rear quarter.
  box([0.025, 0.34, 0.31], [-0.93, 0.79, 0.38], doorSeam);
  box([0.03, 0.07, 0.09], [-0.96, 0.75, 0.60], doorHandle);

  box([0.025, 0.34, 0.31], [0.93, 0.79, 0.38], doorSeam);
  box([0.03, 0.07, 0.09], [0.96, 0.75, 0.60], doorHandle);

  // Window frames and glass.
  const windowGlass = new THREE.MeshStandardMaterial({
    color: 0x183743,
    roughness: 0.2,
    metalness: 0.25
  });

  // Front windshield and side windows.
  box([0.035, 0.39, 0.74], [-0.88, 1.03, 0.28], windowGlass);
  box([0.035, 0.39, 0.74], [0.88, 1.03, 0.28], windowGlass);
  box([0.62, 0.39, 0.035], [0, 1.03, 0.66], windowGlass);

  // Rear window.
  box([0.035, 0.38, 0.72], [-0.88, 1.02, 0.28], windowGlass);

  // Pillars.
  box([0.045, 0.39, 0.045], [-0.88, 1.02, 0.66], black);
  box([0.045, 0.39, 0.045], [0.88, 1.02, 0.66], black);
  box([0.045, 0.39, 0.045], [0, 1.02, 0.66], black);
  box([0.045, 0.38, 0.045], [-0.88, 1.02, 0.66], black);

  // Roof.
  box([1.42, 0.12, 0.82], [0, 1.25, 0.22], orange);
  box([1.42, 0.12, 0.82], [0, 1.25, 0.22], orange);
  box([1.42, 0.12, 0.82], [0, 1.25, 0.22], orange);
  box([1.42, 0.12, 0.82], [0, 1.25, 0.22], orange);

  // Roof rails.
  box([0.035, 0.045, 0.78], [-0.64, 1.34, 0.22], black);
  box([0.035, 0.045, 0.78], [0.64, 1.34, 0.22], black);

  // Front grille.
  box([0.08, 0.27, 0.43], [0.93, 0.75, 0.08], black);
  for (let i = 0; i < 7; i++) {
    box([0.095, 0.025, 0.45], [0.975, 0.65 + i * 0.035, 0.08], chrome);
  }

  // Headlights.
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4c4,
    emissive: 0xffd77a,
    emissiveIntensity: 0.65,
    roughness: 0.25
  });

  box([0.12, 0.16, 0.23], [0.98, 0.84, 0.06], lampMaterial);
  box([0.12, 0.16, 0.23], [0.98, 0.84, 0.06], lampMaterial);

  // Bumpers.
  box([0.12, 0.07, 1.15], [0.99, 0.52, 0.04], chrome);
  box([0.12, 0.07, 1.15], [-0.99, 0.52, 0.04], chrome);

  // Rear lights.
  const redLamp = new THREE.MeshStandardMaterial({
    color: 0xa81818,
    emissive: 0x7d0808,
    emissiveIntensity: 0.45,
    roughness: 0.35
  });

  box([0.12, 0.17, 0.24], [-0.98, 0.83, 0.06], redLamp);
  box([0.12, 0.17, 0.24], [-0.98, 0.83, 0.06], redLamp);

  // Rear central license plate.
  box([0.06, 0.24, 0.31], [-0.99, 0.82, 0.04], black);
  box([0.075, 0.13, 0.21], [-1.025, 0.82, 0.04], chrome);

  // Rear bumper.
  box([0.12, 0.07, 1.12], [-0.99, 0.52, 0.04], chrome);

  // Wheels: 4 total, with simple voxel tires and hubs.
  function makeWheel(x: number, z: number, front: boolean) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(x, 0.37, z);
    group.add(wheelGroup);

    const tireMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.22, 20),
      tire
    );
    tireMesh.rotation.z = Math.PI / 2;
    wheelGroup.add(tireMesh);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.235, 20),
      wheel
    );
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.255, 16),
      chrome
    );
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    for (let i = 0; i < 5; i++) {
      const spoke = box(
        [0.045, 0.43, 0.255],
        [0, 0, 0],
        wheel
      );
      spoke.rotation.y = (Math.PI * i) / 5;
    }

    const hubCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.265, 12),
      black
    );
    hubCap.rotation.z = Math.PI / 2;
    wheelGroup.add(hubCap);

    // Fenders.
    const fender = box(
      [0.53, 0.12, 0.48],
      [x, 0.51, z],
      orange
    );
    fender.rotation.x = front ? -0.18 : 0.18;

    return wheelGroup;
  }

  makeWheel(-0.88, 0.73, true);
  makeWheel(0.88, 0.73, true);
  makeWheel(-0.88, -0.73, false);
  makeWheel(0.88, -0.73, false);

  // Small front grille accents and side markers.
  const amber = new THREE.MeshStandardMaterial({
    color: 0xffa12b,
    emissive: 0xff6a00,
    emissiveIntensity: 0.55
  });

  box([0.06, 0.06, 0.30], [-0.95, 0.61, 0.67], amber);
  box([0.06, 0.06, 0.30], [0.95, 0.61, 0.67], amber);

  // Front license plate.
  box([0.06, 0.22, 0.28], [0.99, 0.74, 0.04], black);
  box([0.075, 0.13, 0.19], [1.025, 0.74, 0.04], chrome);

  // Voxel hood details.
  box([0.035, 0.10, 0.28], [0.98, 0.91, 0.10], black);
  box([0.035, 0.10, 0.28], [0.98, 0.91, 0.10], black);

  // Lower body side trim.
  box([0.035, 0.10, 0.70], [-0.91, 0.51, 0.05], black);
  box([0.035, 0.10, 0.70], [0.91, 0.51, 0.05], black);

  group.rotation.y = -0.08;
  return group;
}