import * as THREE from "three";

/**
 * Build a low-poly wooden swivel desk chair.
 * Dimensions: length 0.62 m, width 0.66 m, height 0.88 m.
 * Origin is the centre of the base. +Y up, +Z front.
 */
export default function buildChair(): THREE.Group {
    const chair = new THREE.Group();

    const walnut = new THREE.MeshStandardMaterial({
        color: 0x4a2416,
        roughness: 0.58,
        metalness: 0.05
    });

    const leather = new THREE.MeshStandardMaterial({
        color: 0xb88a26,
        roughness: 0.64,
        metalness: 0.02
    });

    const leatherDark = new THREE.MeshStandardMaterial({
        color: 0x76501c,
        roughness: 0.68
    });

    const iron = new THREE.MeshStandardMaterial({
        color: 0x25282a,
        roughness: 0.42,
        metalness: 0.72
    });

    const rubber = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.92
    });

    function box(size: [number, number, number], position: [number, number, number], material, bevel = 0) {
        const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        chair.add(mesh);
        return mesh;
    }

    function cylinder(radius: number, height: number, position: [number, number, number], material, radialSegments = 8) {
        const geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        chair.add(mesh);
        return mesh;
    }

    function sphere(radius: number, position: [number, number, number], material, segments = 8) {
        const geometry = new THREE.SphereGeometry(radius, segments, segments);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.castShadow = true;
        chair.add(mesh);
        return mesh;
    }

    // Base / mechanism
    box([0.52, 0.12, 0.48], [0, 0.12, 0], walnut);
    box([0.42, 0.16, 0.37], [0, 0.25, 0], walnut);
    cylinder(0.13, 0.16, [0, 0.39, 0], iron, 10);
    cylinder(0.17, 0.09, [0, 0.49, 0], walnut, 10);

    // Five-star cast-iron base
    const baseY = 0.16;
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + Math.PI / 10;
        const x = Math.cos(angle) * 0.33;
        const z = Math.sin(angle) * 0.33;

        const arm = box([0.52, 0.075, 0.10], [x * 0.55, baseY, z * 0.55], iron, 0.025);
        arm.rotation.y = -angle;

        const wheel = cylinder(0.075, 0.105, [x, baseY - 0.08, z], rubber, 10);
        wheel.rotation.z = Math.PI / 2;
    }

    // Pedestal and tilt mechanism
    cylinder(0.13, 0.23, [0, 0.48, 0], iron, 10);
    cylinder(0.095, 0.12, [0, 0.65, 0], walnut, 10);
    sphere(0.105, [0, 0.72, 0], iron);

    // Upholstery
    box([0.62, 0.10, 0.56], [0, 0.76, 0.08], leather, 0.025);
    box([0.58, 0.10, 0.52], [0, 1.22, -0.08], leather, 0.025);

    // Seat cushion and back cushion
    box([0.56, 0.075, 0.50], [0, 0.815, 0.08], leatherDark, 0.018);
    box([0.55, 0.075, 0.47], [0, 1.275, -0.08], leatherDark, 0.018);

    // Seat frame
    box([0.68, 0.12, 0.64], [0, 0.72, 0.02], walnut);
    box([0.62, 0.12, 0.58], [0, 1.28, -0.02], walnut);

    // Backrest frame: vertical posts
    box([0.11, 0.72, 0.12], [-0.28, 1.02, -0.27], walnut);
    box([0.11, 0.72, 0.12], [0.28, 1.02, -0.27], walnut);

    // Backrest frame: top and lower rails
    box([0.72, 0.12, 0.13], [0, 1.40, -0.27], walnut);
    box([0.72, 0.10, 0.13], [0, 0.74, -0.27], walnut);

    // Side frame posts and arm supports
    box([0.12, 0.72, 0.12], [-0.34, 1.04, 0.25], walnut);
    box([0.12, 0.72, 0.12], [0.34, 1.04, 0.25], walnut);
    box([0.12, 0.48, 0.12], [-0.34, 0.96, 0.25], walnut);
    box([0.12, 0.48, 0.12], [0.34, 0.96, 0.25], walnut);

    // Armrests
    box([0.78, 0.12, 0.13], [0, 1.12, 0.31], walnut, 0.025);
    box([0.78, 0.10, 0.12], [0, 0.93, 0.31], walnut);

    // Leather trim and corner rivets
    const trimMaterial = leatherDark;

    // Seat trim around perimeter
    box([0.61, 0.018, 0.025], [0, 0.845, 0.35], trimMaterial);
    box([0.61, 0.018, 0.025], [0, 0.845, -0.20], trimMaterial);
    box([0.025, 0.018, 0.52], [-0.30, 0.845, 0.075], trimMaterial);
    box([0.025, 0.018, 0.52], [0.30, 0.845, 0.075], trimMaterial);

    // Backrest trim
    box([0.61, 0.018, 0.025], [0, 1.305, -0.20], trimMaterial);
    box([0.61, 0.018, 0.025], [0, 0.995, -0.20], trimMaterial);
    box([0.025, 0.31, 0.025], [-0.295, 1.15, -0.20], trimMaterial);
    box([0.025, 0.31, 0.025], [0.295, 1.15, -0.20], trimMaterial);

    // Rivets
    const rivetGeometry = new THREE.SphereGeometry(0.025, 6, 4);
    const rivetPositions = [
        [-0.25, 0.88, 0.36], [0.25, 0.88, 0.36],
        [-0.25, 0.88, -0.19], [0.25, 0.88, -0.19],
        [-0.25, 1.34, -0.20], [0.25, 1.34, -0.20],
        [-0.25, 1.03, -0.20], [0.25, 1.03, -0.20]
    ];

    for (const position of rivetPositions) {
        const rivet = new THREE.Mesh(rivetGeometry, iron);
        rivet.position.set(...position);
        chair.add(rivet);
    }

    // Wooden armrest support details
    box([0.13, 0.10, 0.20], [-0.28, 1.01, 0.22], walnut);
    box([0.13, 0.10, 0.20], [0.28, 1.01, 0.22], walnut);

    // Small front decorative feet / stabilizers
    for (const x of [-0.23, 0.23]) {
        box([0.08, 0.10, 0.18], [x, 0.08, 0.34], walnut);
    }

    chair.rotation.y = -0.08;
    chair.position.y = 0.04;

    return chair;
}