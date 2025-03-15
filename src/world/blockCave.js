import * as THREE from 'three';

/**
 * Creates a block-based cave and spawns it in the scene
 * @param {THREE.Scene} scene - The scene to add the cave to
 * @param {THREE.Vector3} position - Base position for the cave
 * @param {boolean} hasEntrance - Whether the cave should have an entrance (default: true)
 */
export function spawnBlockCave(scene, position, hasEntrance = true) {




    // Keep our forced position at 300,0,300
    const forcedPosition = new THREE.Vector3(300, 0, 300);

    // Create the cave with the forced position
    return createBlockCave(scene, forcedPosition, hasEntrance);
}

/**
 * Creates a block-based cave system
 * @param {THREE.Scene} scene - The scene to add the cave to
 * @param {THREE.Vector3} position - Position for the cave
 * @param {boolean} hasEntrance - Whether the cave should have an entrance
 */
export function createBlockCave(scene, position, hasEntrance = true) {


    // Force coordinates to ensure they stick
    const x = 1000; // Force X=300
    const y = 0;   // Force Y=0
    const z = 1000; // Force Z=300

    // Block size
    const BLOCK_SIZE = 10;


    // Create materials for the blocks
    const materials = [
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }), // Stone
        new THREE.MeshStandardMaterial({ color: 0x3D2817, roughness: 0.9 }), // Dirt
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }),  // Dark stone
        new THREE.MeshStandardMaterial({ color: 0x996633, roughness: 0.9 }),  // Entrance marker (wood)
    ];

    // Create base geometry for blocks
    const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    let blockCount = 0;

    // Create block function - using forced position values
    function createBlock(localX, localY, localZ, materialIndex = 0) {
        // Calculate world position using our forced values
        const worldX = x + (localX * BLOCK_SIZE);
        const worldY = y + (localY * BLOCK_SIZE);
        const worldZ = z + (localZ * BLOCK_SIZE);

        // Create the block
        const block = new THREE.Mesh(blockGeometry, materials[materialIndex]);

        // Set the position components directly
        block.position.x = worldX;
        block.position.y = worldY;
        block.position.z = worldZ;

        scene.add(block);
        blockCount++;

        return block;
    }

    // Create a medium-sized cave with proper interior and entrance
    function createMediumCave() {


        // Increased dimensions - larger than before but still manageable
        const xRange = { min: -8, max: 8 };  // 17 blocks wide
        const yRange = { min: -3, max: 3 };  // 7 blocks tall
        const zRange = { min: -8, max: 8 };  // 17 blocks deep

        // Define entrance position and direction
        // We'll create an entrance on the +X side
        const entranceX = xRange.max; // The X face where the entrance is located
        const entranceZ = 0; // Center of the X face
        const entranceYBottom = -1; // Bottom of entrance
        const entranceYTop = 1; // Top of entrance
        const entranceWidth = 2; // How wide the entrance is (in Z direction)
        const entranceTunnelLength = 4; // How far the entrance tunnel extends inward

        // Make corridors wider to create more space
        const corridorRadius = 2;

        // Larger central chamber for exploration
        const chamberRadius = 3;
        const chamberCenter = new THREE.Vector3(0, 0, 0);

        // More varied tunnels to create interesting pathways
        const tunnels = [
            // Main tunnels
            { start: new THREE.Vector3(-7, 0, 0), end: new THREE.Vector3(-7, 0, 7), radius: 1.5 },
            { start: new THREE.Vector3(7, 0, 0), end: new THREE.Vector3(7, 0, -7), radius: 1.5 },
            { start: new THREE.Vector3(0, 0, 7), end: new THREE.Vector3(6, 1, 7), radius: 1.5 },

            // Additional tunnels for exploration
            { start: new THREE.Vector3(0, 0, -6), end: new THREE.Vector3(-5, -1, -6), radius: 1.2 },
            { start: new THREE.Vector3(-4, 1, 0), end: new THREE.Vector3(-4, 2, 4), radius: 1.2 },

            // Small hidden passage
            { start: new THREE.Vector3(3, -2, 3), end: new THREE.Vector3(6, -2, 6), radius: 1 }
        ];

        // Add entrance tunnel if needed
        if (hasEntrance) {
            // Create a tunnel from the edge to the main chamber
            tunnels.push({
                start: new THREE.Vector3(entranceX, 0, entranceZ),
                end: new THREE.Vector3(entranceX - entranceTunnelLength, 0, entranceZ),
                radius: 1.5
            });
        }

        // Add a second chamber
        const secondChamberCenter = new THREE.Vector3(-5, 0, 5);
        const secondChamberRadius = 2.5;

        // Determine if a block should be created at a given position
        function shouldCreateBlock(x, y, z) {
            // Point in cave coordinates
            const point = new THREE.Vector3(x, y, z);

            // If we're at the entrance location and have an entrance flag set,
            // don't create blocks to form the opening
            if (hasEntrance && x === entranceX &&
                y >= entranceYBottom && y <= entranceYTop &&
                Math.abs(z - entranceZ) <= entranceWidth) {
                return false;
            }

            // Check if we're at the edge of our volume - always create blocks there
            // EXCEPT at the entrance location
            if (x === xRange.min || (x === xRange.max && !(hasEntrance &&
                y >= entranceYBottom && y <= entranceYTop &&
                Math.abs(z - entranceZ) <= entranceWidth)) ||
                y === yRange.min || y === yRange.max ||
                z === zRange.min || z === zRange.max) {
                return true;
            }

            // Check if point is inside the main corridor
            if (Math.abs(y) < corridorRadius && Math.abs(x) < (xRange.max - 1)) {
                return false;
            }

            // Check if point is inside the main chamber
            const distanceToCenter = point.distanceTo(chamberCenter);
            if (distanceToCenter < chamberRadius) {
                return false;
            }

            // Check if point is inside the second chamber
            const distanceToSecondCenter = point.distanceTo(secondChamberCenter);
            if (distanceToSecondCenter < secondChamberRadius) {
                return false;
            }

            // Check if point is inside any tunnel
            for (const tunnel of tunnels) {
                // Calculate closest point on line segment (tunnel)
                const line = new THREE.Line3(tunnel.start, tunnel.end);
                const closestPoint = new THREE.Vector3();
                line.closestPointToPoint(point, true, closestPoint);

                // If within tunnel radius, don't create block
                if (point.distanceTo(closestPoint) < tunnel.radius) {
                    return false;
                }
            }

            // If not in any empty space, create the block
            return true;
        }

        // Function to choose material based on position
        function getMaterial(x, y, z) {
            // Entrance frame gets special material
            if (hasEntrance && x === entranceX &&
                ((y === entranceYBottom - 1 || y === entranceYTop + 1) && Math.abs(z - entranceZ) <= entranceWidth) ||
                ((Math.abs(z - entranceZ) === entranceWidth + 1) && y >= entranceYBottom && y <= entranceYTop)) {
                return 3; // Entrance marker material
            }

            // Floor is dirt
            if (y === yRange.min) return 1;

            // Ceiling has some dark stone
            if (y === yRange.max && Math.random() > 0.7) return 2;

            // Some random variation in walls
            if (Math.random() > 0.8) return 2;

            // Create some rock formations
            if (Math.random() > 0.95 && y > yRange.min) {
                // Stalactites/stalagmites
                if ((y === yRange.max - 1) || (y === yRange.min + 1)) {
                    return 2;
                }
            }

            // Default stone
            return 0;
        }

        // Generate the cave blocks

        for (let localX = xRange.min; localX <= xRange.max; localX++) {
            for (let localY = yRange.min; localY <= yRange.max; localY++) {
                for (let localZ = zRange.min; localZ <= zRange.max; localZ++) {
                    if (shouldCreateBlock(localX, localY, localZ)) {
                        createBlock(localX, localY, localZ, getMaterial(localX, localY, localZ));
                    }
                }
            }
        }

        // Add entrance torches if we have an entrance
        if (hasEntrance) {
            // Create torch lights on either side of the entrance
            const torchPositions = [
                { x: entranceX, y: entranceYTop, z: entranceZ + entranceWidth + 0.5 },
                { x: entranceX, y: entranceYTop, z: entranceZ - entranceWidth - 0.5 }
            ];

            torchPositions.forEach(pos => {
                // Torch light
                const torchLight = new THREE.PointLight(0xff9933, 1, 30);
                torchLight.position.set(
                    x + pos.x * BLOCK_SIZE,
                    y + pos.y * BLOCK_SIZE,
                    z + pos.z * BLOCK_SIZE
                );
                scene.add(torchLight);

                // Torch visual (small cylinder)
                const torchGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
                const torchMaterial = new THREE.MeshBasicMaterial({ color: 0x663300 });
                const torch = new THREE.Mesh(torchGeometry, torchMaterial);
                torch.position.set(
                    x + pos.x * BLOCK_SIZE,
                    y + pos.y * BLOCK_SIZE - 1.5, // Slightly lower
                    z + pos.z * BLOCK_SIZE
                );
                torch.rotation.x = Math.PI / 2; // Horizontal torch
                scene.add(torch);

                // Flame visual (small sphere)
                const flameGeometry = new THREE.SphereGeometry(1, 8, 8);
                const flameMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff6600,
                    transparent: true,
                    opacity: 0.8
                });
                const flame = new THREE.Mesh(flameGeometry, flameMaterial);
                flame.position.set(
                    x + pos.x * BLOCK_SIZE,
                    y + pos.y * BLOCK_SIZE,
                    z + pos.z * BLOCK_SIZE
                );
                scene.add(flame);
            });
        }


    }

    // Create the cave
    createMediumCave();

    // Add a visible marker at our cave position
    const positionMarker = new THREE.Mesh(
        new THREE.SphereGeometry(5, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    positionMarker.position.set(x, y, z);
    scene.add(positionMarker);

    // Add improved lighting to make the cave more visible
    // Main light in the center
    const mainLight = new THREE.PointLight(0xffffcc, 1, 120);
    mainLight.position.set(x, y + 5, z);
    scene.add(mainLight);

    // Add some additional lights throughout the cave
    const lightPositions = [
        { x: x - 50, y: y + 5, z: z + 50, color: 0xffccaa, intensity: 0.8, distance: 80 },
        { x: x + 50, y: y + 5, z: z - 50, color: 0xaaccff, intensity: 0.8, distance: 80 },
        { x: x - 60, y: y + 5, z: z - 20, color: 0xccffaa, intensity: 0.7, distance: 70 }
    ];

    lightPositions.forEach(pos => {
        const light = new THREE.PointLight(pos.color, pos.intensity, pos.distance);
        light.position.set(pos.x, pos.y, pos.z);
        scene.add(light);
    });

    // Add a subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x333333, 0.6);
    scene.add(ambientLight);


    return scene;
}

// Export a debug function to help test
export function debugCavePosition(scene, position) {



    // Add a visible marker at the specified position
    const debugMarker = new THREE.Mesh(
        new THREE.SphereGeometry(10, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    debugMarker.position.copy(position);
    scene.add(debugMarker);


    return debugMarker;
} 