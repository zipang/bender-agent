import * as THREE from "three";

/**
 * Build a low-poly modernist office chair: walnut frame, yellow leather,
 * five-star base and casters. Origin is the floor contact.
 */
export default function build() {
    const chair = new THREE.Group();

    const leather = new THREE.MeshStandardMaterial({
        color: 0xd8a92f,
        roughness: 0.68,
        metalness: 0.02
    });

    const leatherDark = new THREE.MeshStandardMaterial({
        color: 0xa87818,
        roughness: 0.78
    });

    const walnut = new THREE.MeshStandardMaterial({
        color: 0x4b2414,
        roughness: 0.55,
        metalness: 0.02
    });

    const brass = new THREE.MeshStandardMaterial({
        color: 0xb98b35,
        roughness: 0.34,
        metalness: 0.72
    });

    const rubber = new THREE.MeshStandardMaterial({
        color: 0x171717,
        roughness: 0.92
    });

    function box(parent, size, position, material, bevel = false) {
        const geometry = bevel
            ? new THREE.BoxGeometry(size.x, size.y, size.z)
            : new THREE.BoxGeometry(size.x, size.y, size.z);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        parent.add(mesh);
        return mesh;
    }

    function cylinder(parent, radiusTop, radiusBottom, height, position, material, segments = 8) {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
            material
        );
        mesh.position.copy(position);
        parent.add(mesh);
        return mesh;
    }

    function sphere(parent, radius, position, material, segments = 8) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, segments, Math.max(4, segments / 2)),
            material
        );
        mesh.position.copy(position);
        parent.add(mesh);
        return mesh;
    }

    // Floor contact.
    chair.position.y = 0.05;

    // Central pedestal and swivel column.
    cylinder(chair, 0.12, 0.15, 0.18, new THREE.Vector3(0, 0.2, 0), walnut);
    cylinder(chair, 0.16, 0.16, 0.12, new THREE.Vector3(0, 0.36, 0), brass);

    // Five-star base.
    const base = new THREE.Group();
    base.rotation.y = 0.2;
    chair.add(base);

    cylinder(base, 0.21, 0.18, 0.12, new THREE.Vector3(0, 0.46, 0), walnut);

    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + 0.16;
        const leg = new THREE.Group();
        leg.rotation.y = angle;
        base.add(leg);

        const legMesh = cylinder(
            leg,
            0.045,
            0.055,
            0.68,
            new THREE.Vector3(0, 0.12, 0),
            walnut,
            7
        );

        const caster = sphere(
            leg,
            0.075,
            new THREE.Vector3(0, 0.015, 0.09),
            rubber,
            8
        );
        caster.scale.set(1, 0.7, 1.25);

        legMesh.castShadow = true;
        caster.castShadow = true;
    }

    // Seat support.
    const seatSupport = new THREE.Group();
    seatSupport.position.y = 0.84;
    chair.add(seatSupport);

    for (const x of [-0.31, 0.31]) {
        for (const z of [-0.25, 0.25]) {
            const support = box(
                seatSupport,
                new THREE.Vector3(0.07, 0.2, 0.07),
                new THREE.Vector3(x, 0, z),
                walnut
            );
            support.rotation.z = x > 0 ? -0.16 : 0.16;
        }
    }

    // Seat cushion.
    const seat = box(
        chair,
        new THREE.Vector3(0.94, 0.16, 0.68),
        new THREE.Vector3(0, 0.98, 0),
        leather
    );
    seat.rotation.x = -0.08;

    // Seat edge piping.
    box(
        chair,
        new THREE.Vector3(0.98, 0.025, 0.62),
        new THREE.Vector3(0, 0.905, 0),
        leatherDark
    );

    // Back support.
    const backSupport = new THREE.Group();
    backSupport.position.set(0, 0.99, -0.2);
    backSupport.rotation.x = -0.14;
    chair.add(backSupport);

    box(
        backSupport,
        new THREE.Vector3(0.68, 0.13, 0.12),
        new THREE.Vector3(0, 0, 0),
        walnut
    );

    for (const x of [-0.29, 0.29]) {
        box(
            backSupport,
            new THREE.Vector3(0.07, 0.55, 0.07),
            new THREE.Vector3(x, 0.25, 0.08),
            walnut
        );
    }

    // Back cushion.
    const back = box(
        backSupport,
        new THREE.Vector3(0.75, 0.72, 0.14),
        new THREE.Vector3(0, 0.42, 0),
        leather
    );
    back.rotation.x = -0.08;

    // Back piping.
    box(
        backSupport,
        new THREE.Vector3(0.77, 0.035, 0.17),
        new THREE.Vector3(0, 0.56, 0),
        leatherDark
    );

    // Arm supports.
    for (const x of [-0.47, 0.47]) {
        const armSupport = box(
            chair,
            new THREE.Vector3(0.07, 0.55, 0.07),
            new THREE.Vector3(x, 1.38, 0.12),
            walnut
        );
        armSupport.rotation.z = x > 0 ? -0.13 : 0.13;
    }

    // Armrests.
    for (const x of [-0.47, 0.47]) {
        const arm = box(
            chair,
            new THREE.Vector3(0.22, 0.13, 0.58),
            new THREE.Vector3(x, 1.72, 0.1),
            leather
        );
        arm.rotation.x = -0.09;
    }

    // Armrest frame and decorative brass caps.
    for (const x of [-0.47, 0.47]) {
        box(
            chair,
            new THREE.Vector3(0.055, 0.055, 0.62),
            new THREE.Vector3(x, 1.78, 0.1),
            walnut
        );

        const cap = sphere(
            chair,
            0.035,
            new THREE.Vector3(x, 1.82, 0.37),
            brass,
            7
        );
        cap.scale.y = 0.6;
    }

    // Backrest frame trim.
    box(
        chair,
        new THREE.Vector3(0.78, 0.055, 0.17),
        new THREE.Vector3(0, 1.25, -0.19),
        walnut
    );

    // Small brass plaque on the front of the seat.
    const plaque = box(
        chair,
        new THREE.Vector3(0.16, 0.035, 0.018),
        new THREE.Vector3(0, 1.01, 0.35),
        brass
    );
    plaque.rotation.x = 0.08;

    return chair;
}