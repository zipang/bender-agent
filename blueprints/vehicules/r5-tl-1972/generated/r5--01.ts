import * as THREE from "three";

/**
 * Build a 1972 Renault 5 TL: orange, very low-poly voxel car,
 * three doors total (front left, front right, rear left), no rear door.
 *
 * Dimensions in metres:
 * L = 3.521
 * h = 1.4
 * l = 1.525
 * +Y up, +Z front, origin at the centre of the base.
 */
export default function build(): THREE.Object3D {
    const car = new THREE.Group();

    const orange = new THREE.MeshStandardMaterial({
        color: 0xf26a21,
        roughness: 0.72,
        metalness: 0.08
    });

    const darkOrange = new THREE.MeshStandardMaterial({
        color: 0xc94d12,
        roughness: 0.76,
        metalness: 0.08
    });

    const black = new THREE.MeshStandardMaterial({
        color: 0x17191c,
        roughness: 0.9
    });

    const glass = new THREE.MeshStandardMaterial({
        color: 0x203c47,
        roughness: 0.28,
        metalness: 0.15
    });

    const chrome = new THREE.MeshStandardMaterial({
        color: 0xd9e4e7,
        roughness: 0.25,
        metalness: 0.85
    });

    const tire = new THREE.MeshStandardMaterial({
        color: 0x17191b,
        roughness: 0.95
    });

    const hub = new THREE.MeshStandardMaterial({
        color: 0x9ea8ad,
        roughness: 0.55,
        metalness: 0.65
    });

    function box(name, size, position, material, parent = car) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            material
        );
        mesh.name = name;
        mesh.position.copy(position);
        parent.add(mesh);
        return mesh;
    }

    // Main body shell, preserving the 1972 Renault 5 TL proportions.
    // Three doors total: both front doors and one rear door on the left.
    const L = 3.521;
    const H = 1.4;
    const L2 = 1.525;

    // Lower body plinth.
    box(
        "Orange lower body plinth",
        new THREE.Vector3(L, 0.28, L2),
        new THREE.Vector3(0, 0.18, 0),
        orange
    );

    // Main shell.
    box(
        "Orange main body shell",
        new THREE.Vector3(L, 0.78, L2),
        new THREE.Vector3(0, 0.69, 0),
        orange
    );

    // Roof, slightly narrower and lower.
    box(
        "Orange low-poly roof",
        new THREE.Vector3(L * 0.78, 0.25, L2 * 0.72),
        new THREE.Vector3(0, 1.08, 0.03),
        orange
    );

    // Front hood and rear hatch.
    box(
        "Orange front hood",
        new THREE.Vector3(L * 0.29, 0.34, L2 * 0.34),
        new THREE.Vector3(0, 0.82, 0.62),
        orange
    );

    box(
        "Orange rear hatch",
        new THREE.Vector3(L * 0.27, 0.34, L2 * 0.34),
        new THREE.Vector3(0, 0.82, -0.62),
        orange
    );

    // Front grille and lower bumper.
    box(
        "Black front grille",
        new THREE.Vector3(0.62, 0.19, 0.055),
        new THREE.Vector3(0, 0.66, L2 + 0.025),
        black
    );

    box(
        "Chrome front bumper",
        new THREE.Vector3(0.82, 0.11, 0.08),
        new THREE.Vector3(0, 0.46, L2 + 0.06),
        chrome
    );

    // Rear bumper and license plate.
    box(
        "Chrome rear bumper",
        new THREE.Vector3(0.82, 0.11, 0.08),
        new THREE.Vector3(0, 0.46, -L2 - 0.06),
        chrome
    );

    box(
        "White rear license plate",
        new THREE.Vector3(0.28, 0.12, 0.025),
        new THREE.Vector3(0, 0.5, -L2 - 0.105),
        new THREE.MeshStandardMaterial({ color: 0xe9e4d5, roughness: 0.9 })
    );

    // Side windows and three distinct doors.
    // Front right door.
    box(
        "Front-right side window",
        new THREE.Vector3(0.69, 0.36, 0.045),
        new THREE.Vector3(0.78, 0.89, 0.18),
        glass
    );
    box(
        "Front-right door panel",
        new THREE.Vector3(0.055, 0.58, 0.61),
        new THREE.Vector3(0.86, 0.75, 0.18),
        orange
    );

    // Front left door.
    box(
        "Front-left side window",
        new THREE.Vector3(0.69, 0.36, 0.045),
        new THREE.Vector3(-0.78, 0.89, 0.18),
        glass
    );
    box(
        "Front-left door panel",
        new THREE.Vector3(0.055, 0.58, 0.61),
        new THREE.Vector3(-0.86, 0.75, 0.18),
        orange
    );

    // Rear left door.
    box(
        "Rear-left side window",
        new THREE.Vector3(0.65, 0.34, 0.045),
        new THREE.Vector3(-0.79, 0.91, -0.2),
        glass
    );
    box(
        "Rear-left door panel",
        new THREE.Vector3(0.055, 0.57, 0.6),
        new THREE.Vector3(-0.86, 0.76, -0.2),
        orange
    );

    // Door hinges and handles.
    const hingeMaterial = new THREE.MeshStandardMaterial({
        color: 0x9da8ad,
        roughness: 0.45,
        metalness: 0.7
    });

    function addHandle(name, x, y, z, parent) {
        box(
            name,
            new THREE.Vector3(0.13, 0.035, 0.055),
            new THREE.Vector3(x, y, z),
            hingeMaterial,
            parent
        );
    }

    addHandle("Front-right door handle", 1.0, 0.77, 0.52);
    addHandle("Front-left door handle", -1.0, 0.77, 0.52);
    addHandle("Rear-left door handle", -1.0, 0.78, -0.52);

    for (const x of [-0.78, 0.78]) {
        box(
            "Door hinge",
            new THREE.Vector3(0.055, 0.32, 0.055),
            new THREE.Vector3(x, 0.91, 0.49),
            hingeMaterial
        );
    }

    // Windshield and rear window.
    box(
        "Front windshield",
        new THREE.Vector3(1.12, 0.38, 0.045),
        new THREE.Vector3(0, 0.95, 0.64),
        glass
    );

    box(
        "Rear window",
        new THREE.Vector3(1.05, 0.35, 0.045),
        new THREE.Vector3(0, 0.94, -0.64),
        glass
    );

    // A-frame front pillars.
    const frontPillarGeometry = new THREE.BoxGeometry(0.13, 0.42, 0.13);
    const frontPillarLeft = box(
        "Front-left A pillar",
        frontPillarGeometry,
        new THREE.Vector3(-0.56, 0.98, 0.64),
        orange
    );
    const frontPillarRight = box(
        "Front-right A pillar",
        frontPillarGeometry,
        new THREE.Vector3(0.56, 0.98, 0.64),
        orange
    );

    // B-pillar between front doors.
    box(
        "B-pillar",
        new THREE.Vector3(0.13, 0.42, 0.13),
        new THREE.Vector3(0, 0.98, 0.64),
        orange
    );

    // Rear pillars.
    const rearPillarLeft = box(
        "Rear-left B pillar",
        new THREE.Vector3(0.13, 0.38, 0.13),
        new THREE.Vector3(-0.55, 0.98, -0.64),
        orange
    );
    const rearPillarRight = box(
        "Rear-right B pillar",
        new THREE.Vector3(0.13, 0.38, 0.13),
        new THREE.Vector3(0.55, 0.98, -0.64),
        orange
    );

    // Front lamps.
    const lampMaterial = new THREE.MeshStandardMaterial({
        color: 0xffb13b,
        emissive: 0xff6a00,
        emissiveIntensity: 0.45,
        roughness: 0.3
    });

    box(
        "Left front lamp",
        new THREE.Vector3(0.22, 0.14, 0.06),
        new THREE.Vector3(-0.43, 0.82, L2 + 0.045),
        lampMaterial
    );

    box(
        "Right front lamp",
        new THREE.Vector3(0.22, 0.14, 0.06),
        new THREE.Vector3(0.43, 0.82, L2 + 0.045),
        lampMaterial
    );

    // Rear lamps.
    const rearLampMaterial = new THREE.MeshStandardMaterial({
        color: 0x8f120b,
        emissive: 0x4b0200,
        emissiveIntensity: 0.3,
        roughness: 0.35
    });

    box(
        "Left rear lamp",
        new THREE.Vector3(0.22, 0.14, 0.06),
        new THREE.Vector3(-0.43, 0.82, -L2 - 0.045),
        rearLampMaterial
    );

    box(
        "Right rear lamp",
        new THREE.Vector3(0.22, 0.14, 0.06),
        new THREE.Vector3(0.43, 0.82, -L2 - 0.045),
        rearLampMaterial
    );

    // Wheels and voxel-style hubs.
    function addWheel(name, x, z, direction) {
        const wheel = new THREE.Group();
        wheel.name = name;
        wheel.position.set(x, 0.39, z);
        wheel.rotation.y = direction;
        car.add(wheel);

        const radius = 0.38;
        const width = 0.22;

        const tireMesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, radius * 2, width),
            tire
        );
        tireMesh.name = "Voxel tire";
        wheel.add(tireMesh);

        const hubMesh = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.72, radius * 1.72, width * 0.72),
            hub
        );
        hubMesh.name = "Voxel wheel hub";
        wheel.add(hubMesh);

        const capMesh = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.42, 0.16, width * 0.42),
            black
        );
        capMesh.name = "Hub cap";
        capMesh.position.y = radius * 0.83;
        wheel.add(capMesh);
    }

    addWheel("Front-left wheel", -1.08, 0.72, Math.PI / 2);
    addWheel("Front-right wheel", 1.08, 0.72, -Math.PI / 2);
    addWheel("Rear-left wheel", -1.08, -0.72, Math.PI / 2);
    addWheel("Rear-right wheel", 1.08, -0.72, -Math.PI / 2);

    // Front and rear bumpers.
    box(
        "Front grille surround",
        new THREE.Vector3(0.76, 0.3, 0.07),
        new THREE.Vector3(0, 0.66, L2 + 0.055),
        black
    );

    box(
        "Rear grille surround",
        new THREE.Vector3(0.76, 0.3, 0.07),
        new THREE.Vector3(0, 0.66, -L2 - 0.055),
        black
    );

    // Small front and rear details.
    box(
        "Front center emblem",
        new THREE.Vector3(0.12, 0.08, 0.025),
        new THREE.Vector3(0, 0.66, L2 + 0.095),
        chrome
    );

    box(
        "Rear center emblem",
        new THREE.Vector3(0.12, 0.08, 0.025),
        new THREE.Vector3(0, 0.66, -L2 - 0.095),
        chrome
    );

    return car;
}