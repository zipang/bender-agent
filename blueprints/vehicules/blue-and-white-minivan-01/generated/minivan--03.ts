import * as THREE from "three";

export default function build() {
    const root = new THREE.Group();

    const body = new THREE.Group();
    root.add(body);

    const lightBlue = new THREE.MeshStandardMaterial({ color: 0x58b9dc, roughness: 0.72, metalness: 0.05 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.7 });
    const darkBlue = new THREE.MeshStandardMaterial({ color: 0x177aa6, roughness: 0.65 });
    const black = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.85 });
    const red = new THREE.MeshStandardMaterial({ color: 0xf03b32, roughness: 0.65 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xffb32d, roughness: 0.45 });
    const smoked = new THREE.MeshStandardMaterial({ color: 0x183643, roughness: 0.2, metalness: 0.25 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd9e6f1, roughness: 0.18, metalness: 0.85 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.95 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xf16a28, roughness: 0.75 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x173b4a, roughness: 0.18, metalness: 0.2 });

    function addBox(parent, size, pos, material, bevel = false) {
        const mesh = new THREE.Mesh(
            bevel ? new THREE.BoxGeometry(size.x, size.y, size.z) : new THREE.BoxGeometry(size.x, size.y, size.z),
            material
        );
        mesh.position.copy(pos);
        parent.add(mesh);
        return mesh;
    }

    function addCylinder(parent, radius, length, pos, material, rotation = new THREE.Euler()) {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 20),
            material
        );
        mesh.position.copy(pos);
        mesh.rotation.copy(rotation);
        parent.add(mesh);
        return mesh;
    }

    function addSphere(parent, radius, pos, material) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), material);
        mesh.position.copy(pos);
        parent.add(mesh);
        return mesh;
    }

    // Main two-tone low-poly body: white lower chassis and light-blue upper body.
    addBox(body, new THREE.Vector3(5.35, 1.05, 1.85), new THREE.Vector3(0, 0.72, 0), white);
    addBox(body, new THREE.Vector3(5.35, 1.18, 1.85), new THREE.Vector3(0, 1.78, 0), lightBlue);

    // Blue belt line separating the two body halves.
    addBox(body, new THREE.Vector3(5.4, 0.12, 1.88), new THREE.Vector3(0, 1.34, 0), darkBlue);

    // Rounded front and rear endcaps, built from stacked low-poly blocks.
    addBox(body, new THREE.Vector3(0.38, 1.18, 1.88), new THREE.Vector3(-2.53, 1.78, 0), lightBlue);
    addBox(body, new THREE.Vector3(0.38, 1.18, 1.88), new THREE.Vector3(2.53, 1.78, 0), lightBlue);
    addBox(body, new THREE.Vector3(0.38, 1.05, 1.88), new THREE.Vector3(-2.53, 0.72, 0), white);
    addBox(body, new THREE.Vector3(0.38, 1.05, 1.88), new THREE.Vector3(2.53, 0.72, 0), white);

    // Side pillars and lower side shell.
    for (const side of [-1, 1]) {
        addBox(body, new THREE.Vector3(0.18, 1.18, 1.88), new THREE.Vector3(side * 2.62, 1.78, 0), lightBlue);
        addBox(body, new THREE.Vector3(0.18, 1.05, 1.88), new THREE.Vector3(side * 2.62, 0.72, 0), white);
        addBox(body, new THREE.Vector3(0.18, 0.12, 1.88), new THREE.Vector3(side * 2.62, 1.34, 0), darkBlue);
    }

    // Windshield.
    addBox(body, new THREE.Vector3(0.12, 0.78, 1.48), new THREE.Vector3(-2.57, 2.13, 0), smoked);

    // Side windows.
    for (const side of [-1, 1]) {
        addBox(body, new THREE.Vector3(0.12, 0.78, 1.48), new THREE.Vector3(side * 2.57, 2.13, 0), smoked);
        addBox(body, new THREE.Vector3(0.12, 0.78, 1.48), new THREE.Vector3(side * 0.34, 2.13, 0), smoked);
        addBox(body, new THREE.Vector3(0.12, 0.78, 1.48), new THREE.Vector3(side * 1.72, 2.13, 0), smoked);

        // Side window frames.
        addBox(body, new THREE.Vector3(0.18, 0.88, 1.58), new THREE.Vector3(side * 2.57, 2.13, 0), lightBlue);
        addBox(body, new THREE.Vector3(0.18, 0.88, 1.58), new THREE.Vector3(side * 0.34, 2.13, 0), lightBlue);
        addBox(body, new THREE.Vector3(0.18, 0.88, 1.58), new THREE.Vector3(side * 1.72, 2.13, 0), lightBlue);
    }

    // Front grille and headlights.
    addBox(body, new THREE.Vector3(0.28, 0.42, 1.22), new THREE.Vector3(-2.62, 1.35, 0), black);
    addBox(body, new THREE.Vector3(0.28, 0.42, 1.22), new THREE.Vector3(2.62, 1.35, 0), black);

    for (const side of [-1, 1]) {
        addCylinder(
            body,
            0.27,
            0.13,
            new THREE.Vector3(side * 2.61, 1.72, 0.77),
            black,
            new THREE.Euler(Math.PI / 2, 0, 0)
        );
        addCylinder(
            body,
            0.215,
            0.15,
            new THREE.Vector3(side * 2.61, 1.72, 0.85),
            chrome,
            new THREE.Euler(Math.PI / 2, 0, 0)
        );
        addCylinder(
            body,
            0.15,
            0.18,
            new THREE.Vector3(side * 2.61, 1.72, 0.91),
            new THREE.MeshStandardMaterial({ color: 0xfff3c7, emissive: 0x6b4a12, emissiveIntensity: 0.4, roughness: 0.25 }),
            new THREE.Euler(Math.PI / 2, 0, 0)
        );
    }

    // Chrome trim strip between headlights.
    addBox(body, new THREE.Vector3(0.62, 0.08, 0.16), new THREE.Vector3(0, 1.72, 0.91), chrome);

    // Front badge: three teal hexagons.
    for (let i = 0; i < 3; i++) {
        const badge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.13, 0.13, 0.07, 6),
            new THREE.MeshStandardMaterial({ color: 0x15a9b8, roughness: 0.38, metalness: 0.25 })
        );
        badge.rotation.x = Math.PI / 2;
        badge.position.set(-0.35 + i * 0.35, 1.72, 0.96);
        body.add(badge);
    }

    // Amber indicators under headlights.
    for (const side of [-1, 1]) {
        addBox(body, new THREE.Vector3(0.25, 0.14, 0.16), new THREE.Vector3(side * 2.6, 1.18, 0.66), amber);
        addBox(body, new THREE.Vector3(0.31, 0.055, 0.18), new THREE.Vector3(side * 2.6, 1.1, 0.67), black);
    }

    // Black front bumper and license plate.
    addBox(body, new THREE.Vector3(0.52, 0.24, 1.55), new THREE.Vector3(0, 0.96, 0.77), black);
    addBox(body, new THREE.Vector3(0.48, 0.24, 0.12), new THREE.Vector3(0, 0.96, 1.08), black);
    addBox(body, new THREE.Vector3(0.42, 0.16, 0.04), new THREE.Vector3(0, 0.96, 1.155), white);
    addBox(body, new THREE.Vector3(0.12, 0.08, 0.025), new THREE.Vector3(0, 0.96, 1.18), black);
    addBox(body, new THREE.Vector3(0.19, 0.025, 0.025), new THREE.Vector3(-0.06, 0.96, 1.18), black);
    addBox(body, new THREE.Vector3(0.19, 0.025, 0.025), new THREE.Vector3(0.06, 0.96, 1.18), black);

    // Rear.
    addBox(body, new THREE.Vector3(0.28, 0.42, 1.22), new THREE.Vector3(2.62, 1.35, 0), black);
    addBox(body, new THREE.Vector3(0.28, 0.42, 1.22), new THREE.Vector3(-2.62, 1.35, 0), black);
    addBox(body, new THREE.Vector3(0.18, 0.55, 1.25), new THREE.Vector3(2.64, 1.72, 0), smoked);
    addBox(body, new THREE.Vector3(0.2, 0.18, 0.5), new THREE.Vector3(2.63, 1.35, 0.58), red);

    // Side mirrors.
    for (const side of [-1, 1]) {
        addBox(body, new THREE.Vector3(0.12, 0.3, 0.1), new THREE.Vector3(side * 2.72, 1.85, 0.95), black);
        addBox(body, new THREE.Vector3(0.12, 0.3, 0.1), new THREE.Vector3(side * 2.72, 1.85, -0.95), black);
    }

    // Door handle recess on front right side.
    addBox(body, new THREE.Vector3(0.18, 0.28, 0.045), new THREE.Vector3(1.72, 1.62, 0.95), black);
    addBox(body, new THREE.Vector3(0.1, 0.18, 0.055), new THREE.Vector3(1.72, 1.62, 0.98), chrome);

    // Roof rack.
    const rack = new THREE.Group();
    body.add(rack);

    for (const z of [-0.67, 0.67]) {
        addBox(rack, new THREE.Vector3(4.35, 0.09, 0.09), new THREE.Vector3(0, 2.58, z), chrome);
        addBox(rack, new THREE.Vector3(0.1, 0.3, 0.1), new THREE.Vector3(0, 2.72, z), black);
    }
    for (const x of [-2.12, 2.12]) {
        addBox(rack, new THREE.Vector3(0.09, 0.09, 1.42), new THREE.Vector3(x, 2.58, 0), chrome);
    }

    // Blue surfboard with red and white stripe.
    const surfboard = new THREE.Group();
    surfboard.position.set(0, 2.78, 0);
    surfboard.rotation.y = -0.08;
    body.add(surfboard);

    addBox(surfboard, new THREE.Vector3(3.25, 0.11, 0.48), new THREE.Vector3(0, 0, 0), darkBlue);
    addBox(surfboard, new THREE.Vector3(2.55, 0.12, 0.49), new THREE.Vector3(0, 0.015, 0), lightBlue);
    addBox(surfboard, new THREE.Vector3(1.35, 0.13, 0.5), new THREE.Vector3(0, 0.025, 0), red);
    addBox(surfboard, new THREE.Vector3(0.55, 0.135, 0.51), new THREE.Vector3(0, 0.035, 0), white);

    // Single grey fin.
    const fin = addBox(
        surfboard,
        new THREE.Vector3(0.2, 0.62, 0.18),
        new THREE.Vector3(0.83, 0.34, 0),
        new THREE.MeshStandardMaterial({ color: 0xaeb7ba, roughness: 0.65, metalness: 0.15 })
    );
    fin.rotation.z = -0.12;

    // Wheels.
    const wheelPositions = [
        new THREE.Vector3(-1.85, 0.67, 1.03),
        new THREE.Vector3(1.85, 0.67, 1.03),
        new THREE.Vector3(-1.85, 0.67, -1.03),
        new THREE.Vector3(1.85, 0.67, -1.03)
    ];

    for (const pos of wheelPositions) {
        const wheel = new THREE.Group();
        wheel.position.copy(pos);
        body.add(wheel);

        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.66, 0.66, 0.34, 24),
            rubber
        );
        tire.rotation.z = Math.PI / 2;
        wheel.add(tire);

        const tireRing = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.55, 0.36, 24),
            orange
        );
        tireRing.rotation.z = Math.PI / 2;
        wheel.add(tireRing);

        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34, 0.34, 0.38, 24),
            darkBlue
        );
        rim.rotation.z = Math.PI / 2;
        wheel.add(rim);

        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.14, 0.42, 16),
            chrome
        );
        hub.rotation.z = Math.PI / 2;
        wheel.add(hub);

        const hubCap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.055, 0.45, 12),
            white
        );
        hubCap.rotation.z = Math.PI / 2;
        wheel.add(hubCap);
    }

    // Low-poly side windows reflect light with a subtle cyan tint.
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x244c5d,
        roughness: 0.18,
        metalness: 0.28
    });

    // Additional trim and small details.
    addBox(body, new THREE.Vector3(5.38, 0.1, 1.9), new THREE.Vector3(0, 0.28, 0), darkBlue);
    addBox(body, new THREE.Vector3(5.38, 0.1, 1.9), new THREE.Vector3(0, 1.34, 0), darkBlue);

    // Front and rear lower accent strips.
    addBox(body, new THREE.Vector3(0.45, 0.1, 1.88), new THREE.Vector3(-2.62, 0.3, 0), darkBlue);
    addBox(body, new THREE.Vector3(0.45, 0.1, 1.88), new THREE.Vector3(2.62, 0.3, 0), darkBlue);

    // Small roof rails and surfboard hardware.
    addBox(surfboard, new THREE.Vector3(0.08, 0.08, 0.6), new THREE.Vector3(-1.08, 0.1, 0), chrome);
    addBox(surfboard, new THREE.Vector3(0.08, 0.08, 0.6), new THREE.Vector3(1.08, 0.1, 0), chrome);

    // Small side vents.
    for (const side of [-1, 1]) {
        addBox(body, new THREE.Vector3(0.1, 0.2, 0.04), new THREE.Vector3(side * 0.34, 1.48, 0.96), darkBlue);
    }

    // Small front grille details.
    for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            addBox(body, new THREE.Vector3(0.18, 0.045, 0.025), new THREE.Vector3(side * 2.62, 1.2 + i * 0.1, 0.93), black);
        }
    }

    return root;
}