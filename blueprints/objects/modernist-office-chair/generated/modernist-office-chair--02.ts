import * as THREE from "three";

/**
 * Build a low-poly modernist office chair.
 * Dimensions: seat depth 0.66 m, seat height 0.42 m, total height 0.88 m.
 * Coordinates: Y is up, Z is front, origin at the floor under the rear.
 */
export default function buildChair() {
    const chair = new THREE.Group();

    const walnut = new THREE.MeshStandardMaterial({
        color: 0x4b2618,
        roughness: 0.48,
        metalness: 0.03
    });

    const leather = new THREE.MeshStandardMaterial({
        color: 0xc9892e,
        roughness: 0.72,
        metalness: 0.01
    });

    const brass = new THREE.MeshStandardMaterial({
        color: 0xb58a35,
        roughness: 0.3,
        metalness: 0.72
    });

    const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x171717,
        roughness: 0.75
    });

    // Rear casters and central pedestal.
    const rearCaster = new THREE.Group();
    rearCaster.position.set(0, 0.08, -0.32);
    chair.add(rearCaster);

    const swivel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.15, 0.16, 8),
        walnut
    );
    swivel.position.y = 0.12;
    rearCaster.add(swivel);

    const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.32, 8),
        walnut
    );
    column.position.y = 0.31;
    rearCaster.add(column);

    for (const x of [-0.105, 0.105]) {
        for (const z of [-0.255, 0.255]) {
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.055, 0.055, 0.035, 16),
                wheelMaterial
            );
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.045, z);
            rearCaster.add(wheel);

            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.025, 0.11, 8),
                brass
            );
            stem.position.set(x, 0.095, z);
            rearCaster.add(stem);
        }
    }

    // Five-star base.
    const base = new THREE.Group();
    base.position.y = 0.29;
    chair.add(base);

    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12),
        walnut
    );
    base.add(hub);

    for (let i = 0; i < 5; i++) {
        const arm = new THREE.Group();
        arm.rotation.y = (i / 5) * Math.PI * 2;
        base.add(arm);

        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.085, 0.085, 0.48),
            walnut
        );
        leg.position.set(0, -0.13, 0.22);
        arm.add(leg);

        const caster = new THREE.Mesh(
            new THREE.CylinderGeometry(0.065, 0.065, 0.045, 16),
            wheelMaterial
        );
        caster.rotation.x = Math.PI / 2;
        caster.position.set(0, -0.27, 0.46);
        arm.add(caster);
    }

    // Seat support and frame.
    const seatGroup = new THREE.Group();
    seatGroup.position.set(0, 0.57, 0.12);
    chair.add(seatGroup);

    const seatBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.07, 0.62),
        walnut
    );
    seatBase.position.y = -0.12;
    seatGroup.add(seatBase);

    const seatFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.08, 0.66),
        walnut
    );
    seatFrame.position.y = 0.01;
    seatGroup.add(seatFrame);

    // Seat cushion.
    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.10, 0.52),
        leather
    );
    seat.position.y = 0.08;
    seatGroup.add(seat);

    // Backrest support.
    const backSupport = new THREE.Group();
    backSupport.position.set(0, 0.61, -0.18);
    chair.add(backSupport);

    const backPost = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.72, 0.10),
        walnut
    );
    backPost.position.set(0, 0.36, 0);
    backSupport.add(backPost);

    const backTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.10, 0.12),
        walnut
    );
    backTop.position.set(0, 0.71, 0);
    backSupport.add(backTop);

    // Backrest cushion.
    const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.48, 0.09),
        leather
    );
    back.position.set(0, 0.77, 0.025);
    back.rotation.x = -0.08;
    backSupport.add(back);

    // Arm supports.
    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    chair.add(leftArm, rightArm);

    for (const side of [-1, 1]) {
        const armPost = new THREE.Mesh(
            new THREE.BoxGeometry(0.075, 0.39, 0.075),
            walnut
        );
        armPost.position.set(side * 0.29, 0.79, 0.12);
        chair.add(armPost);

        const armTop = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.09, 0.11),
            walnut
        );
        armTop.position.set(side * 0.29, 0.97, 0.12);
        chair.add(armTop);

        const armPad = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.10, 0.13),
            leather
        );
        armPad.position.set(side * 0.29, 1.015, 0.12);
        chair.add(armPad);

        const armBracket = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.10, 0.16),
            brass
        );
        armBracket.position.set(side * 0.29, 0.87, 0.12);
        chair.add(armBracket);
    }

    // Brass hardware.
    const centralBrass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12),
        brass
    );
    centralBrass.rotation.x = Math.PI / 2;
    centralBrass.position.set(0, 0.64, 0.12);
    chair.add(centralBrass);

    return chair;
}