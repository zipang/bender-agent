import * as THREE from "three";

/**
 * Build a red, very low-poly sportster car.
 * One exported object. Two separate build() calls produce equivalent meshes.
 */
export default function build(): THREE.Object3D {
    const car = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xff2818,
        roughness: 0.48,
        metalness: 0.12
    });

    const darkMaterial = new THREE.MeshStandardMaterial({
        color: 0x15171b,
        roughness: 0.72,
        metalness: 0.18
    });

    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x071422,
        roughness: 0.2,
        metalness: 0.45
    });

    const tireMaterial = new THREE.MeshStandardMaterial({
        color: 0x090909,
        roughness: 0.95,
        metalness: 0
    });

    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0xb9c4cc,
        roughness: 0.35,
        metalness: 0.65
    });

    const lampMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3311,
        emissive: 0xff1600,
        emissiveIntensity: 0.7,
        roughness: 0.35
    });

    const noseGeometry = new THREE.BoxGeometry(1.72, 0.54, 0.72);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(0, 0.39, 0.67);
    nose.rotation.y = -0.08;
    car.add(nose);

    const hoodGeometry = new THREE.BoxGeometry(1.25, 0.28, 0.48);
    const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hood.position.set(0, 0.69, 0.26);
    hood.rotation.x = 0.12;
    car.add(hood);

    const roofGeometry = new THREE.BoxGeometry(1.16, 0.22, 0.72);
    const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
    roof.position.set(0, 0.98, -0.1);
    car.add(roof);

    const rearGeometry = new THREE.BoxGeometry(1.35, 0.38, 0.62);
    const rear = new THREE.Mesh(rearGeometry, bodyMaterial);
    rear.position.set(0, 0.69, -0.66);
    car.add(rear);

    const windshieldGeometry = new THREE.BoxGeometry(0.88, 0.42, 0.08);
    const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
    windshield.position.set(0, 1.12, 0.05);
    windshield.rotation.x = -0.34;
    car.add(windshield);

    const sideWindowGeometry = new THREE.BoxGeometry(0.08, 0.34, 0.56);
    const sideWindow = new THREE.Mesh(sideWindowGeometry, glassMaterial);
    sideWindow.position.set(-0.585, 1.05, -0.12);
    sideWindow.rotation.z = 0.18;
    car.add(sideWindow);

    const sideWindow2 = sideWindow.clone();
    sideWindow2.position.x = 0.585;
    car.add(sideWindow2);

    const seatGeometry = new THREE.BoxGeometry(0.72, 0.18, 0.55);
    const seat = new THREE.Mesh(seatGeometry, darkMaterial);
    seat.position.set(0, 0.77, -0.3);
    seat.rotation.x = -0.12;
    car.add(seat);

    const dashboardGeometry = new THREE.BoxGeometry(0.82, 0.12, 0.42);
    const dashboard = new THREE.Mesh(dashboardGeometry, darkMaterial);
    dashboard.position.set(0, 0.68, 0.18);
    dashboard.rotation.x = 0.16;
    car.add(dashboard);

    const steeringGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.38);
    const steering = new THREE.Mesh(steeringGeometry, darkMaterial);
    steering.position.set(0, 0.78, 0.4);
    steering.rotation.x = 0.18;
    car.add(steering);

    const frontWheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 8);
    const rearWheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 8);

    const wheelPositions = [
        { x: -0.78, z: 0.69, rotation: 0.18 },
        { x: 0.78, z: 0.69, rotation: -0.18 },
        { x: -0.82, z: -0.69, rotation: 0.18 },
        { x: 0.82, z: -0.69, rotation: -0.18 }
    ];

    for (const wheel of wheelPositions) {
        const tire = new THREE.Mesh(frontWheelGeometry, tireMaterial);
        tire.position.set(wheel.x, 0.34, wheel.z);
        tire.rotation.z = wheel.rotation;
        car.add(tire);

        const rim = new THREE.Mesh(frontWheelGeometry, rimMaterial);
        rim.position.set(wheel.x, 0.34, wheel.z + 0.115);
        rim.rotation.z = wheel.rotation;
        car.add(rim);

        const hubGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.14, 8);
        const hub = new THREE.Mesh(hubGeometry, darkMaterial);
        hub.position.set(wheel.x, 0.34, wheel.z + 0.225);
        hub.rotation.z = wheel.rotation;
        car.add(hub);
    }

    const frontBumperGeometry = new THREE.BoxGeometry(1.65, 0.12, 0.12);
    const rearBumperGeometry = new THREE.BoxGeometry(1.5, 0.12, 0.12);

    const frontBumper = new THREE.Mesh(frontBumperGeometry, darkMaterial);
    frontBumper.position.set(0, 0.28, 1.02);
    car.add(frontBumper);

    const rearBumper = new THREE.Mesh(rearBumperGeometry, darkMaterial);
    rearBumper.position.set(0, 0.28, -1.0);
    car.add(rearBumper);

    const frontLampGeometry = new THREE.BoxGeometry(0.42, 0.16, 0.08);
    const rearLampGeometry = new THREE.BoxGeometry(0.62, 0.18, 0.08);

    const leftFrontLamp = new THREE.Mesh(frontLampGeometry, lampMaterial);
    leftFrontLamp.position.set(-0.49, 0.53, 1.01);
    car.add(leftFrontLamp);

    const rightFrontLamp = leftFrontLamp.clone();
    rightFrontLamp.position.x = 0.49;
    car.add(rightFrontLamp);

    const leftRearLamp = new THREE.Mesh(rearLampGeometry, lampMaterial);
    leftRearLamp.position.set(-0.35, 0.7, -1.0);
    car.add(leftRearLamp);

    const rightRearLamp = leftRearLamp.clone();
    rightRearLamp.position.x = 0.35;
    car.add(rightRearLamp);

    const grilleGeometry = new THREE.BoxGeometry(0.28, 0.08, 0.05);
    const grille = new THREE.Mesh(grilleGeometry, darkMaterial);
    grille.position.set(0, 0.3, 1.08);
    car.add(grille);

    const sideSkirtGeometry = new THREE.BoxGeometry(0.16, 0.2, 1.22);
    const sideSkirt = new THREE.Mesh(sideSkirtGeometry, bodyMaterial);
    sideSkirt.position.set(-0.68, 0.32, -0.02);
    sideSkirt.rotation.y = 0.1;
    car.add(sideSkirt);

    const otherSideSkirt = sideSkirt.clone();
    otherSideSkirt.position.x = 0.68;
    car.add(otherSideSkirt);

    car.name = "red-sportster";
    return car;
}