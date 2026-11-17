
/**
 * Build a low-poly voxel-style red sportster car
 */
export const build = () => {
    // Main car body with low poly voxel geometry
    const bodyGeometry = new THREE.BoxGeometry(3, 1, 1.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.9 });
    const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);

    // Voxel-style details with angled corners
    const voxelDetails: THREE.Mesh[] = [];

    // Main body segments
    voxelDetails[0] = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), bodyMaterial);
    voxelDetails[1] = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), bodyMaterial);
    voxelDetails[2] = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.5), bodyMaterial);

    // Add angular corners for voxel style
    const corner1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.15), bodyMaterial);
    const corner2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.15), bodyMaterial);
    const corner3 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.15), bodyMaterial);
    const corner4 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.15), bodyMaterial);

    corner1.position.set(0.5, 0.25, -0.75);
    corner2.position.set(0.25, 0.25, 0.75);
    corner3.position.set(0.25, 0.25, -0.75);
    corner4.position.set(0.5, 0.25, 0.75);

    // Add a red stripe for sportster style
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.8 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), stripeMaterial);
    stripe.position.set(0, 0.8, 0);
    carBody.add(stripe);

    // Add wheels (low poly style)
    const wheelGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 4);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const wheels = [
        new THREE.Mesh(wheelGeometry, wheelMaterial),
        new THREE.Mesh(wheelGeometry, wheelMaterial),
        new THREE.Mesh(wheelGeometry, wheelMaterial),
        new THREE.Mesh(wheelGeometry, wheelMaterial)
    ];

    wheels.forEach((wheel, index) => {
        wheel.position.set(
            index === 0 ? 1.5 : -1.5,
            0.1,
            index === 0 ? 0 : 0.75
        );
        carBody.add(wheel);
    });

    // Add a roof for sportster style
    const roofGeometry = new THREE.BoxGeometry(2.8, 0.3, 1.8);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.7 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, 1.25, 0);
    carBody.add(roof);

    // Add headlights
    const headlightGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.05);
    const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const headlights = [
        new THREE.Mesh(headlightGeometry, headlightMaterial),
        new THREE.Mesh(headlightGeometry, headlightMaterial)
    ];

    headlights.forEach((headlight, index) => {
        headlight.position.set(1.25, 0.5, index === 0 ? 0.75 : -0.75);
        carBody.add(headlight);
    });

    // Add rear lights
    const rearLightGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.05);
    const rearLightMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const rearLights = [
        new THREE.Mesh(rearLightGeometry, rearLightMaterial),
        new THREE.Mesh(rearLightGeometry, rearLightMaterial)
    ];

    rearLights.forEach((rearLight, index) => {
        rearLight.position.set(-1.25, 0.5, index === 0 ? 0.75 : -0.75);
        carBody.add(rearLight);
    });

    // Add a spoiler
    const spoilerGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.1);
    const spoilerMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const spoiler = new THREE.Mesh(spoilerGeometry, spoilerMaterial);
    spoiler.position.set(0, 1.4, 0);
    carBody.add(spoiler);

    // Add a rear bumper
    const bumperGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.1);
    const bumperMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const bumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
    bumper.position.set(0, 1.4, 0);
    carBody.add(bumper);

    // Add a front grille
    const grilleGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.1);
    const grilleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
    grille.position.set(0, 1.4, 0);
    carBody.add(grille);

    return carBody;
};

export default build;
