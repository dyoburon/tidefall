import * as THREE from 'three';

/**
 * Creates a Pirate Tavern/Inn structure using simple geometry
 * @param {Object} params - Parameters for customizing the tavern
 * @param {THREE.Object3D} params.parent - Parent object to attach the tavern to
 * @param {Function} params.random - Random number generator function
 * @param {THREE.Vector3} params.position - Position offset for the tavern
 * @param {Number} params.rotation - Rotation of the tavern (in radians)
 * @param {Number} params.scale - Overall scale factor for the tavern
 * @returns {THREE.Object3D} - The created tavern object
 */
export function createPirateTavern(params) {
    const {
        parent,
        random = Math.random,
        position = new THREE.Vector3(0, 0, 0),
        rotation = 0,
        scale = 1.0
    } = params;



    // Create container for the tavern
    const tavern = new THREE.Group();
    tavern.position.copy(position);
    tavern.rotation.y = rotation;
    parent.add(tavern);

    // Basic materials - using MeshBasicMaterial for performance
    const woodMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const darkWoodMaterial = new THREE.MeshBasicMaterial({ color: 0x5D3A1F });
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xD2B48C });
    const roofMaterial = new THREE.MeshBasicMaterial({ color: 0x8B0000 });
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xADD8E6 });
    const signMaterial = new THREE.MeshBasicMaterial({ color: 0xDEB887 });
    const signTextMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x7B5F41 });

    // 1. Create the main building structure
    const buildingWidth = 20 * scale;
    const buildingLength = 25 * scale;
    const buildingHeight = 10 * scale;

    const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingLength);
    const building = new THREE.Mesh(buildingGeometry, wallMaterial);
    building.position.y = buildingHeight / 2;
    tavern.add(building);

    // 2. Create the sloped roof
    const roofBaseY = buildingHeight;
    const roofHeight = 7 * scale;

    // Create roof using simple shape
    const roofGeometry = new THREE.BufferGeometry();

    // Define the roof vertices
    const vertices = new Float32Array([
        // Front triangle
        -buildingWidth / 2, roofBaseY, -buildingLength / 2,
        buildingWidth / 2, roofBaseY, -buildingLength / 2,
        0, roofBaseY + roofHeight, -buildingLength / 2,

        // Back triangle
        -buildingWidth / 2, roofBaseY, buildingLength / 2,
        buildingWidth / 2, roofBaseY, buildingLength / 2,
        0, roofBaseY + roofHeight, buildingLength / 2,

        // Left side
        -buildingWidth / 2, roofBaseY, -buildingLength / 2,
        -buildingWidth / 2, roofBaseY, buildingLength / 2,
        0, roofBaseY + roofHeight, -buildingLength / 2,
        0, roofBaseY + roofHeight, buildingLength / 2,

        // Right side
        buildingWidth / 2, roofBaseY, -buildingLength / 2,
        buildingWidth / 2, roofBaseY, buildingLength / 2,
        0, roofBaseY + roofHeight, -buildingLength / 2,
        0, roofBaseY + roofHeight, buildingLength / 2
    ]);

    // Define indices to form triangles
    const indices = [
        // Front triangle
        0, 1, 2,

        // Back triangle
        3, 5, 4,

        // Left side
        6, 8, 7,
        7, 8, 9,

        // Right side
        10, 11, 12,
        11, 13, 12
    ];

    roofGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    roofGeometry.setIndex(indices);
    roofGeometry.computeVertexNormals();

    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    tavern.add(roof);

    // 3. Create the entrance with doors
    const doorWidth = 5 * scale;
    const doorHeight = 7 * scale;
    const doorDepth = 0.5 * scale;

    // Door frame
    const doorFrameGeometry = new THREE.BoxGeometry(doorWidth + 1 * scale, doorHeight + 0.5 * scale, 1 * scale);
    const doorFrame = new THREE.Mesh(doorFrameGeometry, darkWoodMaterial);
    doorFrame.position.set(0, doorHeight / 2, buildingLength / 2 + 0.1);
    tavern.add(doorFrame);

    // Doors (double doors)
    for (let i = -1; i <= 1; i += 2) {
        const doorGeometry = new THREE.BoxGeometry(doorWidth / 2 - 0.2 * scale, doorHeight - 0.2 * scale, doorDepth);
        const door = new THREE.Mesh(doorGeometry, darkWoodMaterial);
        door.position.set(i * doorWidth / 4, (doorHeight - 0.2 * scale) / 2, buildingLength / 2 + 0.5);
        // Slightly open one of the doors
        if (i > 0) {
            door.rotation.y = Math.PI * 0.15;
        }
        tavern.add(door);
    }

    // 4. Add windows
    const windowSize = 3 * scale;
    const numWindows = 3;

    // Front windows on second floor
    for (let i = -1; i <= 1; i++) {
        if (i === 0) continue; // Skip middle for door

        const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set(i * 6 * scale, buildingHeight - 2 * scale, buildingLength / 2 + 0.1);
        tavern.add(window);

        // Simple window frame
        const frameGeometry = new THREE.BoxGeometry(windowSize + 0.5 * scale, windowSize + 0.5 * scale, 0.2 * scale);
        const frame = new THREE.Mesh(frameGeometry, darkWoodMaterial);
        frame.position.copy(window.position);
        frame.position.z -= 0.1;
        tavern.add(frame);
    }

    // Side windows
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < numWindows; i++) {
            const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
            const window = new THREE.Mesh(windowGeometry, windowMaterial);

            // Position along the side of the building
            window.position.set(
                side * (buildingWidth / 2 + 0.1),
                buildingHeight - 2 * scale,
                (i - 1) * 7 * scale
            );
            window.rotation.y = side * Math.PI / 2;
            tavern.add(window);

            // Simple window frame
            const frameGeometry = new THREE.BoxGeometry(windowSize + 0.5 * scale, windowSize + 0.5 * scale, 0.2 * scale);
            const frame = new THREE.Mesh(frameGeometry, darkWoodMaterial);
            frame.position.copy(window.position);
            frame.position.x -= side * 0.1;
            frame.rotation.y = side * Math.PI / 2;
            tavern.add(frame);
        }
    }

    // 5. Create the tavern sign
    const signPostGeometry = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 12 * scale, 8);
    const signPost = new THREE.Mesh(signPostGeometry, darkWoodMaterial);
    signPost.position.set(8 * scale, 6 * scale, buildingLength / 2 + 5 * scale);
    tavern.add(signPost);

    // Sign board
    const signGeometry = new THREE.BoxGeometry(7 * scale, 5 * scale, 0.5 * scale);
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(8 * scale, 11 * scale, buildingLength / 2 + 5 * scale);
    tavern.add(sign);

    // Simple text on sign ("INN")
    const textGeometry = new THREE.BoxGeometry(4 * scale, 1 * scale, 0.1 * scale);
    const text = new THREE.Mesh(textGeometry, signTextMaterial);
    text.position.set(8 * scale, 11 * scale, buildingLength / 2 + 5.3 * scale);
    tavern.add(text);

    // 6. Create outdoor seating area
    // Ground platform
    const deckGeometry = new THREE.BoxGeometry(buildingWidth + 8 * scale, 0.5 * scale, 10 * scale);
    const deck = new THREE.Mesh(deckGeometry, groundMaterial);
    deck.position.set(0, 0.25 * scale, buildingLength / 2 + 5 * scale);
    tavern.add(deck);

    // Tables
    for (let i = -1; i <= 1; i += 2) {
        // Table base
        const tableBaseGeometry = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 3 * scale, 8);
        const tableBase = new THREE.Mesh(tableBaseGeometry, darkWoodMaterial);
        tableBase.position.set(i * 6 * scale, 1.5 * scale, buildingLength / 2 + 5 * scale);
        tavern.add(tableBase);

        // Table top
        const tableTopGeometry = new THREE.CylinderGeometry(2 * scale, 2 * scale, 0.5 * scale, 8);
        const tableTop = new THREE.Mesh(tableTopGeometry, woodMaterial);
        tableTop.position.set(i * 6 * scale, 3 * scale, buildingLength / 2 + 5 * scale);
        tavern.add(tableTop);

        // Stools
        for (let j = 0; j < 3; j++) {
            const angle = j * Math.PI * 2 / 3;
            const stoolBaseGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 1.8 * scale, 6);
            const stoolBase = new THREE.Mesh(stoolBaseGeometry, darkWoodMaterial);

            stoolBase.position.set(
                i * 6 * scale + Math.cos(angle) * 3 * scale,
                0.9 * scale,
                buildingLength / 2 + 5 * scale + Math.sin(angle) * 3 * scale
            );
            tavern.add(stoolBase);

            const stoolTopGeometry = new THREE.CylinderGeometry(1 * scale, 1 * scale, 0.3 * scale, 6);
            const stoolTop = new THREE.Mesh(stoolTopGeometry, woodMaterial);
            stoolTop.position.copy(stoolBase.position);
            stoolTop.position.y = 1.8 * scale;
            tavern.add(stoolTop);
        }
    }

    // 7. Add some barrels
    for (let i = 0; i < 4; i++) {
        const barrelHeight = (1.5 + random() * 0.5) * scale;
        const barrelRadius = 1 * scale;

        const barrelGeometry = new THREE.CylinderGeometry(barrelRadius, barrelRadius, barrelHeight, 8);
        const barrel = new THREE.Mesh(barrelGeometry, woodMaterial);

        // Place barrels along the side of the tavern
        const side = i < 2 ? -1 : 1;
        barrel.position.set(
            side * (buildingWidth / 2 + 2 * scale),
            barrelHeight / 2,
            ((i % 2) - 0.5) * 5 * scale + buildingLength / 4
        );

        // Randomly rotate some barrels to be horizontal
        if (random() > 0.5) {
            barrel.rotation.z = Math.PI / 2;
            barrel.position.y = barrelRadius;
        }

        tavern.add(barrel);
    }

    // 8. Add some basic detail to the roof ridge
    const ridgeGeometry = new THREE.BoxGeometry(buildingWidth + 1 * scale, 1 * scale, 1 * scale);
    const ridge = new THREE.Mesh(ridgeGeometry, darkWoodMaterial);
    ridge.position.set(0, roofBaseY + roofHeight, 0);
    tavern.add(ridge);



    return tavern;
} 