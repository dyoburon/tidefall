import * as THREE from 'three';
import { applyOutline } from '../theme/outlineStyles.js';

// Cache for textures to improve performance
const textureCache = new Map();

// Track active volcanoes for global updates
const activeVolcanoes = [];

/**
 * Creates an active volcano island at the specified position
 * @param {number} x - X coordinate in world space
 * @param {number} z - Z coordinate in world space
 * @param {number} seed - Random seed for consistent generation
 * @param {THREE.Scene} scene - The scene to add the island to
 * @param {Object} options - Additional options for island generation
 * @returns {Object} The created island object with collider
 */
export function createActiveVolcanoIsland(x, z, seed, scene, options = {}) {
    // Use the seed to create deterministic randomness for this island
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Create a unique ID for this island
    const islandId = `volcano_island_${Math.floor(x)}_${Math.floor(z)}`;

    // Island group to hold all parts
    const island = new THREE.Group();
    island.position.set(x, 0, z);
    scene.add(island);

    // Island size parameters
    const baseRadius = options.radius || (80 + random() * 40);
    const volcanoHeight = options.height || (120 + random() * 60);
    const craterRadius = baseRadius * 0.3;
    const craterDepth = volcanoHeight * 0.15;

    // Add island collider
    const collider = {
        center: new THREE.Vector3(x, 0, z),
        radius: baseRadius,
        id: islandId
    };

    // Create base volcanic island shape
    createVolcanoBase(island, baseRadius, volcanoHeight, craterRadius, craterDepth, random);

    // Add lava flows to the volcano
    addLavaFlows(island, baseRadius, volcanoHeight, random);

    // Add lava platforms around the volcano (new feature)
    addLavaPlatforms(island, baseRadius, random);

    // Add steam vents around the volcano
    addSteamVents(island, baseRadius, volcanoHeight, random);

    // Add caldera at the top with lava pool
    addCaldera(island, craterRadius, craterDepth, volcanoHeight, random);

    // Add rock formations and volcanic features
    addVolcanicFormations(island, baseRadius, volcanoHeight, random);

    // Add walkable paths up the volcano
    addWalkablePaths(island, baseRadius, volcanoHeight, random);

    // Setup eruption cycle
    setupEruptionCycle(island, baseRadius, volcanoHeight, random);

    // Create island entry to return
    const islandEntry = {
        mesh: island,
        collider: collider,
        visible: true,
        id: islandId,
        volcanoData: {
            isActive: true,
            lastEruptionTime: Date.now(),
            nextEruptionTime: Date.now() + 60000 + random() * 120000, // 1-3 minutes
            eruptionStrength: 0.2 + random() * 0.8,
            eruptionParticles: null
        }
    };

    // Add to tracking array for updates
    activeVolcanoes.push(islandEntry);

    return islandEntry;
}

/**
 * Create the base volcano shape
 * @param {THREE.Group} island - The island group to add to
 * @param {number} radius - Base radius of the island
 * @param {number} height - Height of the volcano
 * @param {number} craterRadius - Radius of the crater
 * @param {number} craterDepth - Depth of the crater
 * @param {Function} random - Seeded random function
 */
function createVolcanoBase(island, radius, height, craterRadius, craterDepth, random) {
    // Make the base much wider relative to height for a more gradual cone shape
    const baseRadius = radius * 2.5; // Significantly wider base

    // Create the main volcano cone with a wider base
    const coneGeometry = new THREE.ConeGeometry(baseRadius, height, 48); // More segments for smoother cone

    // Create a custom material for the volcano with lava-like striations
    const volcanoTexture = createVolcanicTexture(0x333333, 0xff4400, 0.2, random);

    const coneMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        map: volcanoTexture,
        bumpMap: volcanoTexture,
        bumpScale: 5,
        roughness: 0.9,
        metalness: 0.1
    });

    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.y = height / 2;
    island.add(cone);

    // Apply outline to base
    applyOutline(cone, { scale: 1.02 });

    // Create an extended base plate that's even wider than the cone
    const baseGeometry = new THREE.CylinderGeometry(
        baseRadius * 1.1,  // Top radius slightly larger than cone base
        baseRadius * 1.2,  // Bottom radius larger for shoreline effect
        height * 0.1,      // Thin base
        48                 // More segments for smoother circle
    );

    const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        map: volcanoTexture,
        roughness: 0.8,
        metalness: 0.2
    });

    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = height * 0.05;
    island.add(base);

    // Add underwater base extension for better water transition
    const underwaterBaseGeometry = new THREE.CylinderGeometry(
        baseRadius * 1.3, // Top slightly wider than visible base
        baseRadius * 1.5, // Wider underwater base
        height * 0.15,    // Thicker underwater base
        48
    );

    const underwaterBaseMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.7
    });

    const underwaterBase = new THREE.Mesh(underwaterBaseGeometry, underwaterBaseMaterial);
    underwaterBase.position.y = -height * 0.05; // Position below water level
    island.add(underwaterBase);

    // Add some irregularities to make it look more natural - pass the larger baseRadius
    addTerrainIrregularities(island, cone, baseRadius, height, random);
}

/**
 * Add natural-looking irregularities to the volcano terrain
 * @param {THREE.Group} island - The island group
 * @param {THREE.Mesh} cone - The main volcano cone
 * @param {number} radius - Base radius
 * @param {number} height - Volcano height
 * @param {Function} random - Seeded random function
 */
function addTerrainIrregularities(island, cone, radius, height, random) {
    // Add ridge formations on the volcano sides
    const ridgeCount = 5 + Math.floor(random() * 5);

    for (let i = 0; i < ridgeCount; i++) {
        const angle = random() * Math.PI * 2;
        const ridgeWidth = radius * (0.1 + random() * 0.2);
        const ridgeHeight = height * (0.4 + random() * 0.5);

        // Create an elongated shape for the ridge
        const ridgeGeometry = new THREE.BoxGeometry(
            ridgeWidth,
            ridgeHeight,
            radius * (0.5 + random() * 0.5)
        );

        // Use same material as the volcano but slightly darker
        const ridgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9,
            metalness: 0.2
        });

        const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);

        // Position ridge along the side of the volcano
        const distanceFromCenter = radius * 0.6;
        ridge.position.set(
            Math.cos(angle) * distanceFromCenter,
            ridgeHeight * 0.3,
            Math.sin(angle) * distanceFromCenter
        );

        // Rotate to point away from center
        ridge.lookAt(new THREE.Vector3(
            Math.cos(angle) * radius * 2,
            0,
            Math.sin(angle) * radius * 2
        ));

        // Tilt upward slightly
        ridge.rotation.x -= Math.PI / 4;

        island.add(ridge);
    }

    // Add some boulders and rock formations at the base
    const boulderCount = 15 + Math.floor(random() * 10);

    for (let i = 0; i < boulderCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = radius * (0.7 + random() * 0.4);
        const size = 3 + random() * 7;

        // Create a random boulder shape
        let boulderGeometry;
        const shapeType = Math.floor(random() * 3);

        if (shapeType === 0) {
            boulderGeometry = new THREE.DodecahedronGeometry(size, 0);
        } else if (shapeType === 1) {
            boulderGeometry = new THREE.TetrahedronGeometry(size, 0);
        } else {
            boulderGeometry = new THREE.BoxGeometry(
                size * (0.8 + random() * 0.4),
                size * (0.8 + random() * 0.4),
                size * (0.8 + random() * 0.4)
            );
        }

        const boulderMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.9,
            metalness: 0.1
        });

        const boulder = new THREE.Mesh(boulderGeometry, boulderMaterial);

        boulder.position.set(
            Math.cos(angle) * distance,
            size / 2,
            Math.sin(angle) * distance
        );

        // Random rotation
        boulder.rotation.set(
            random() * Math.PI,
            random() * Math.PI,
            random() * Math.PI
        );

        island.add(boulder);
    }
}

/**
 * Add lava flows down the sides of the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius
 * @param {number} height - Volcano height
 * @param {Function} random - Seeded random function
 */
function addLavaFlows(island, radius, height, random) {
    // Number of lava flows
    const flowCount = 2 + Math.floor(random() * 3);

    for (let i = 0; i < flowCount; i++) {
        const angle = random() * Math.PI * 2;

        // Create lava flow path
        const points = [];
        const segments = 10;
        const flowWidth = 8 + random() * 6;

        // Starting point at top
        const startHeight = height * 0.85;
        const startDistance = radius * 0.3;

        points.push(new THREE.Vector3(
            Math.cos(angle) * startDistance,
            startHeight,
            Math.sin(angle) * startDistance
        ));

        // Middle points with some randomness
        for (let j = 1; j < segments; j++) {
            const t = j / segments;
            const segmentHeight = startHeight * (1 - t) + 5 * t;
            const segmentDistance = startDistance + (radius - startDistance) * t;
            const angleVariation = (random() - 0.5) * 0.4;

            points.push(new THREE.Vector3(
                Math.cos(angle + angleVariation * t) * segmentDistance,
                segmentHeight,
                Math.sin(angle + angleVariation * t) * segmentDistance
            ));
        }

        // Create a curve from the points
        const curve = new THREE.CatmullRomCurve3(points);

        // Create a tube geometry along the curve
        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            20,
            flowWidth / 2,
            8,
            false
        );

        // Create glowing lava material
        const lavaMaterial = new THREE.MeshStandardMaterial({
            color: 0xff4400,
            emissive: 0xff2200,
            emissiveIntensity: 0.8,
            roughness: 0.7
        });

        const lavaFlow = new THREE.Mesh(tubeGeometry, lavaMaterial);
        island.add(lavaFlow);

        // Animate the lava texture
        const textureOffset = { value: 0 };

        // Add to object for animation
        lavaFlow.userData.textureOffset = textureOffset;
        lavaFlow.userData.flowSpeed = 0.2 + random() * 0.3;
    }
}

/**
 * Add lava platforms around the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius of the volcano
 * @param {Function} random - Seeded random function
 */
function addLavaPlatforms(island, radius, random) {
    // Create 1-3 lava platforms around the island
    const platformCount = 1 + Math.floor(random() * 2);

    for (let i = 0; i < platformCount; i++) {
        // Position the platform at some distance from the volcano
        const angle = random() * Math.PI * 2;
        const distance = radius * (1.2 + random() * 0.8); // Place outside the main island

        // Platform dimensions
        const platformRadius = 20 + random() * 30;
        const platformHeight = 2 + random() * 2;

        // Create a group for this platform
        const platformGroup = new THREE.Group();

        // 1. Create cooled outer ring (black lava rock)
        const outerRingGeometry = new THREE.CircleGeometry(platformRadius, 32);
        const outerRingMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.1
        });

        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
        outerRing.rotation.x = -Math.PI / 2; // Lay flat
        outerRing.position.y = 0.5; // Just above water
        platformGroup.add(outerRing);

        // 2. Create inner active lava pool
        const innerRadius = platformRadius * (0.3 + random() * 0.3); // 30-60% of the platform
        const innerGeometry = new THREE.CircleGeometry(innerRadius, 32);
        const innerMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0xff0000,
            emissiveIntensity: 1,
            roughness: 0.5,
            metalness: 0.3
        });

        const innerLava = new THREE.Mesh(innerGeometry, innerMaterial);
        innerLava.rotation.x = -Math.PI / 2; // Lay flat
        innerLava.position.y = 0.6; // Slightly above the black ring
        platformGroup.add(innerLava);

        // 3. Add random cracks and details to make it look natural
        addLavaPlatformDetails(platformGroup, platformRadius, innerRadius, random);

        // Position the platform
        platformGroup.position.set(
            Math.cos(angle) * distance,
            0, // At water level
            Math.sin(angle) * distance
        );

        // Add some randomization to the platform
        platformGroup.rotation.y = random() * Math.PI * 2;

        // Add to island
        island.add(platformGroup);

        // Store reference for animations
        platformGroup.userData.lavaPool = innerLava;
        innerLava.userData.flowSpeed = 0.05 + random() * 0.1; // Slower flow for pools

        // Add bubble effects to the inner lava
        addLavaBubbles(innerLava, innerRadius, random);
    }
}

/**
 * Add details to a lava platform to make it look more natural
 * @param {THREE.Group} platformGroup - The platform group
 * @param {number} outerRadius - The outer platform radius
 * @param {number} innerRadius - The inner lava radius
 * @param {Function} random - Seeded random function
 */
function addLavaPlatformDetails(platformGroup, outerRadius, innerRadius, random) {
    // Add cracks radiating from the center
    const crackCount = 4 + Math.floor(random() * 6);
    const ringWidth = outerRadius - innerRadius;

    for (let i = 0; i < crackCount; i++) {
        const angle = (i / crackCount) * Math.PI * 2 + random() * 0.2;
        const length = ringWidth * (0.7 + random() * 0.3);
        const width = 0.8 + random() * 1.5;

        // Create a crack geometry
        const crackGeometry = new THREE.PlaneGeometry(length, width);
        const crackMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0xff2200,
            emissiveIntensity: 0.8,
            roughness: 0.7
        });

        const crack = new THREE.Mesh(crackGeometry, crackMaterial);

        // Position at the edge of the inner lava and point outward
        crack.position.set(
            Math.cos(angle) * (innerRadius + length / 2),
            0.55, // Just above platform
            Math.sin(angle) * (innerRadius + length / 2)
        );

        // Rotate to point outward
        crack.rotation.x = -Math.PI / 2; // Flat
        crack.rotation.z = -angle; // Point along radius

        platformGroup.add(crack);

        // Store for animation
        crack.userData.flowSpeed = 0.1 + random() * 0.2;
    }

    // Add elevated rocks and formations to make it less flat
    const rockCount = 6 + Math.floor(random() * 8);

    for (let i = 0; i < rockCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = innerRadius + (outerRadius - innerRadius) * random();

        // Only add rocks to the cooled area
        if (distance < innerRadius * 1.1) continue;

        const rockSize = 1 + random() * 3;
        const rockHeight = 1 + random() * 2;

        // Random rock shape
        let rockGeometry;
        const shapeType = Math.floor(random() * 3);

        if (shapeType === 0) {
            rockGeometry = new THREE.ConeGeometry(rockSize, rockHeight, 5);
        } else if (shapeType === 1) {
            rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);
        } else {
            rockGeometry = new THREE.BoxGeometry(
                rockSize * (0.8 + random() * 0.4),
                rockHeight,
                rockSize * (0.8 + random() * 0.4)
            );
        }

        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.1
        });

        const rock = new THREE.Mesh(rockGeometry, rockMaterial);

        rock.position.set(
            Math.cos(angle) * distance,
            rockHeight / 2, // Half above surface
            Math.sin(angle) * distance
        );

        // Random rotation
        rock.rotation.y = random() * Math.PI;

        platformGroup.add(rock);
    }
}

/**
 * Add steam vents around the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius
 * @param {number} height - Volcano height
 * @param {Function} random - Seeded random function
 */
function addSteamVents(island, radius, height, random) {
    // Number of vents
    const ventCount = 8 + Math.floor(random() * 8);

    for (let i = 0; i < ventCount; i++) {
        const angle = random() * Math.PI * 2;

        // Position vents at different heights
        const verticalPosition = random();
        const ventHeight = height * (0.1 + verticalPosition * 0.7);
        const ventDistance = radius * (0.3 + (1 - verticalPosition) * 0.6);

        // Create vent opening
        const ventGeometry = new THREE.CylinderGeometry(
            1 + random() * 1.5,
            2 + random() * 2,
            3,
            8
        );

        const ventMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.1
        });

        const vent = new THREE.Mesh(ventGeometry, ventMaterial);

        // Position vent on volcano surface
        const ventX = Math.cos(angle) * ventDistance;
        const ventZ = Math.sin(angle) * ventDistance;

        vent.position.set(ventX, ventHeight, ventZ);

        // Rotate to face away from center
        vent.lookAt(new THREE.Vector3(
            ventX * 2,
            ventHeight,
            ventZ * 2
        ));

        // Rotate 90 degrees to align with surface
        vent.rotation.x += Math.PI / 2;

        island.add(vent);

        // Add particle emitter for steam
        createSteamEmitter(vent, 2 + random() * 2);

        // Add discoloration around vent
        const discolorationRadius = 5 + random() * 5;
        const discolorationGeometry = new THREE.CircleGeometry(discolorationRadius, 16);

        const discolorationMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddd99, // Yellowish sulfur deposits
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9
        });

        const discoloration = new THREE.Mesh(discolorationGeometry, discolorationMaterial);

        // Position just above the surface
        discoloration.position.copy(vent.position);

        // Rotate to align with surface
        discoloration.lookAt(new THREE.Vector3(
            ventX * 2,
            ventHeight,
            ventZ * 2
        ));

        // Move slightly towards surface
        discoloration.translateZ(-0.1);

        island.add(discoloration);
    }
}

/**
 * Create the caldera at the top of the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} craterRadius - Radius of the crater
 * @param {number} craterDepth - Depth of the crater
 * @param {number} volcanoHeight - Total volcano height
 * @param {Function} random - Seeded random function
 */
function addCaldera(island, craterRadius, craterDepth, volcanoHeight, random) {
    // Create crater walls
    const craterWallGeometry = new THREE.CylinderGeometry(
        craterRadius,
        craterRadius * 1.4,
        craterDepth,
        32,
        2,
        true // Open-ended cylinder
    );

    const craterWallMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
    });

    const craterWall = new THREE.Mesh(craterWallGeometry, craterWallMaterial);
    craterWall.position.y = volcanoHeight - craterDepth / 2;
    island.add(craterWall);

    // Create lava pool at the bottom of the crater
    const lavaPoolGeometry = new THREE.CircleGeometry(craterRadius, 32);

    const lavaPoolMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3300,
        emissive: 0xff0000,
        emissiveIntensity: 1,
        roughness: 0.5,
        metalness: 0.3
    });

    const lavaPool = new THREE.Mesh(lavaPoolGeometry, lavaPoolMaterial);
    lavaPool.rotation.x = -Math.PI / 2; // Lay flat
    lavaPool.position.y = volcanoHeight - craterDepth + 0.1;
    island.add(lavaPool);

    // Add bubble effects on the lava surface
    addLavaBubbles(lavaPool, craterRadius, random);

    // Add rim details around the top
    addCalderaRim(island, craterRadius, volcanoHeight, random);

    // Store reference to lava pool for eruption animations
    island.userData.lavaPool = lavaPool;
}

/**
 * Add bubbling effect to lava surface
 * @param {THREE.Mesh} lavaPool - The lava pool mesh
 * @param {number} radius - Pool radius
 * @param {Function} random - Seeded random function
 */
function addLavaBubbles(lavaPool, radius, random) {
    // Add bubble formations on the lava
    const bubbleCount = 6 + Math.floor(random() * 6);

    for (let i = 0; i < bubbleCount; i++) {
        // Random position within the lava pool
        const bubbleDistance = random() * radius * 0.7;
        const bubbleAngle = random() * Math.PI * 2;
        const bubbleX = Math.cos(bubbleAngle) * bubbleDistance;
        const bubbleZ = Math.sin(bubbleAngle) * bubbleDistance;

        // Create bubble geometry
        const bubbleSize = 1 + random() * 3;
        const bubbleGeometry = new THREE.SphereGeometry(
            bubbleSize,
            8, 8,
            0, Math.PI * 2,
            0, Math.PI / 2
        );

        const bubbleMaterial = new THREE.MeshStandardMaterial({
            color: 0xff5500,
            emissive: 0xff2200,
            emissiveIntensity: 0.8,
            roughness: 0.6
        });

        const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);

        // Position on lava surface
        bubble.position.set(bubbleX, 0.1, bubbleZ);

        // Add to lava pool
        lavaPool.add(bubble);

        // Setup bubble animation
        bubble.userData.initialY = 0.1;
        bubble.userData.bubbleSpeed = 0.5 + random() * 1.5;
        bubble.userData.bubblePhase = random() * Math.PI * 2;
    }
}

/**
 * Add detailed rim around the caldera
 * @param {THREE.Group} island - The island group
 * @param {number} craterRadius - Radius of the crater
 * @param {number} volcanoHeight - Total volcano height
 * @param {Function} random - Seeded random function
 */
function addCalderaRim(island, craterRadius, volcanoHeight, random) {
    // Create a ring of rocks around the crater
    const rockCount = 12 + Math.floor(random() * 12);

    for (let i = 0; i < rockCount; i++) {
        const angle = (i / rockCount) * Math.PI * 2;

        // Size of rim rock
        const rockHeight = 5 + random() * 8;
        const rockWidth = 3 + random() * 4;
        const rockDepth = 4 + random() * 6;

        // Create rock geometry
        const rockGeometry = new THREE.BoxGeometry(
            rockWidth,
            rockHeight,
            rockDepth
        );

        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.9,
            metalness: 0.1
        });

        const rock = new THREE.Mesh(rockGeometry, rockMaterial);

        // Position around crater rim
        const rimRadius = craterRadius * (1 + random() * 0.2);
        rock.position.set(
            Math.cos(angle) * rimRadius,
            volcanoHeight + rockHeight / 2 - 3,
            Math.sin(angle) * rimRadius
        );

        // Tilt slightly outward
        rock.lookAt(new THREE.Vector3(
            Math.cos(angle) * rimRadius * 2,
            volcanoHeight,
            Math.sin(angle) * rimRadius * 2
        ));

        // Random rotation around local y-axis
        rock.rotateY(random() * Math.PI);

        island.add(rock);
    }
}

/**
 * Add volcanic rock formations to the island
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius
 * @param {number} height - Volcano height
 * @param {Function} random - Seeded random function
 */
function addVolcanicFormations(island, radius, height, random) {
    // Add various volcanic features like spires, lava domes, etc.
    const formationCount = 5 + Math.floor(random() * 5);

    for (let i = 0; i < formationCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = radius * (0.4 + random() * 0.5);

        // Choose a random formation type
        const formationType = Math.floor(random() * 3);

        if (formationType === 0) {
            // Spire formation
            addSpireFormation(island, angle, distance, height, random);
        } else if (formationType === 1) {
            // Lava dome
            addLavaDome(island, angle, distance, random);
        } else {
            // Volcanic plug
            addVolcanicPlug(island, angle, distance, random);
        }
    }
}

/**
 * Add a tall spire formation
 * @param {THREE.Group} island - The island group
 * @param {number} angle - Angle around the volcano
 * @param {number} distance - Distance from center
 * @param {number} volcanoHeight - Volcano height
 * @param {Function} random - Seeded random function
 */
function addSpireFormation(island, angle, distance, volcanoHeight, random) {
    // Create a tall, thin spire
    const spireHeight = 15 + random() * 25;
    const spireRadius = 3 + random() * 4;

    const spireGeometry = new THREE.ConeGeometry(
        spireRadius,
        spireHeight,
        8
    );

    const spireMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1
    });

    const spire = new THREE.Mesh(spireGeometry, spireMaterial);

    // Position at appropriate height on volcano surface
    const height = getHeightOnVolcano(distance, volcanoHeight);
    spire.position.set(
        Math.cos(angle) * distance,
        height + spireHeight / 2,
        Math.sin(angle) * distance
    );

    // Small random tilt
    spire.rotation.set(
        (random() - 0.5) * 0.2,
        random() * Math.PI * 2,
        (random() - 0.5) * 0.2
    );

    island.add(spire);
    applyOutline(spire, { scale: 1.03 });

    // Sometimes add a smaller spire next to it
    if (random() < 0.5) {
        const smallSpireHeight = spireHeight * 0.7;
        const smallSpireRadius = spireRadius * 0.6;

        const smallSpireGeometry = new THREE.ConeGeometry(
            smallSpireRadius,
            smallSpireHeight,
            8
        );

        const smallSpire = new THREE.Mesh(smallSpireGeometry, spireMaterial);

        // Position near the main spire
        const offsetAngle = angle + (random() - 0.5) * 0.3;
        const offsetDistance = distance + (random() - 0.5) * 10;

        const smallHeight = getHeightOnVolcano(offsetDistance, volcanoHeight);
        smallSpire.position.set(
            Math.cos(offsetAngle) * offsetDistance,
            smallHeight + smallSpireHeight / 2,
            Math.sin(offsetAngle) * offsetDistance
        );

        // Random rotation
        smallSpire.rotation.set(
            (random() - 0.5) * 0.2,
            random() * Math.PI * 2,
            (random() - 0.5) * 0.2
        );

        island.add(smallSpire);
        applyOutline(smallSpire, { scale: 1.03 });
    }
}

/**
 * Add a lava dome formation
 * @param {THREE.Group} island - The island group
 * @param {number} angle - Angle around the volcano
 * @param {number} distance - Distance from center
 * @param {Function} random - Seeded random function
 */
function addLavaDome(island, angle, distance, random) {
    // Create a dome with glowing lava cracks
    const domeRadius = 10 + random() * 15;
    const domeHeight = domeRadius * 0.7;

    // Create base dome shape
    const domeGeometry = new THREE.SphereGeometry(
        domeRadius,
        32, 16,
        0, Math.PI * 2,
        0, Math.PI / 2
    );

    const domeTexture = createLavaCracksTexture(random);

    const domeMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        map: domeTexture,
        emissive: 0xff2200,
        emissiveMap: domeTexture,
        emissiveIntensity: 0.5,
        roughness: 0.9,
        metalness: 0.1
    });

    const dome = new THREE.Mesh(domeGeometry, domeMaterial);

    // Position dome
    dome.position.set(
        Math.cos(angle) * distance,
        domeHeight / 2,
        Math.sin(angle) * distance
    );

    island.add(dome);
    applyOutline(dome, { scale: 1.02 });

    // Add some rocks around the dome
    const rockCount = 5 + Math.floor(random() * 5);

    for (let i = 0; i < rockCount; i++) {
        const rockAngle = random() * Math.PI * 2;
        const rockDistance = domeRadius * (0.8 + random() * 0.5);

        const rockSize = 2 + random() * 3;
        const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);

        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9,
            metalness: 0.1
        });

        const rock = new THREE.Mesh(rockGeometry, rockMaterial);

        // Position around the dome
        rock.position.set(
            dome.position.x + Math.cos(rockAngle) * rockDistance,
            rockSize / 2,
            dome.position.z + Math.sin(rockAngle) * rockDistance
        );

        // Random rotation
        rock.rotation.set(
            random() * Math.PI,
            random() * Math.PI,
            random() * Math.PI
        );

        island.add(rock);
    }
}

/**
 * Add a volcanic plug formation
 * @param {THREE.Group} island - The island group
 * @param {number} angle - Angle around the volcano
 * @param {number} distance - Distance from center
 * @param {Function} random - Seeded random function
 */
function addVolcanicPlug(island, angle, distance, random) {
    // Create a cylindrical volcanic plug
    const plugRadius = 5 + random() * 8;
    const plugHeight = 15 + random() * 25;

    const plugGeometry = new THREE.CylinderGeometry(
        plugRadius,
        plugRadius * 1.1,
        plugHeight,
        16
    );

    const plugMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.7,
        metalness: 0.3
    });

    const plug = new THREE.Mesh(plugGeometry, plugMaterial);

    // Position the plug
    plug.position.set(
        Math.cos(angle) * distance,
        plugHeight / 2,
        Math.sin(angle) * distance
    );

    // Add fracture lines/patterns to the plug
    addFracturePatterns(plug, plugRadius, plugHeight, random);

    island.add(plug);
    applyOutline(plug, { scale: 1.02 });

    // Add debris around the plug
    addRockDebris(island, plug.position, plugRadius * 1.5, random);
}

/**
 * Add fracture patterns to a volcanic plug
 * @param {THREE.Mesh} plug - The plug mesh
 * @param {number} radius - Plug radius
 * @param {number} height - Plug height
 * @param {Function} random - Seeded random function
 */
function addFracturePatterns(plug, radius, height, random) {
    // Add visible fractures along the plug
    const fractureCount = 3 + Math.floor(random() * 4);

    for (let i = 0; i < fractureCount; i++) {
        const fractureHeight = 1 + random() * 2;
        const fractureWidth = radius * 2.2;
        const fractureDepth = radius * 2.2;

        const fractureGeometry = new THREE.BoxGeometry(
            fractureWidth,
            fractureHeight,
            fractureDepth
        );

        const fractureMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.1
        });

        const fracture = new THREE.Mesh(fractureGeometry, fractureMaterial);

        // Position at random height on the plug
        const fractureY = -height / 2 + height * random();
        fracture.position.y = fractureY;

        // Random rotation
        fracture.rotation.y = random() * Math.PI;

        plug.add(fracture);
    }

    // Add smaller cracks and details
    const crackCount = 10 + Math.floor(random() * 15);

    for (let i = 0; i < crackCount; i++) {
        const crackWidth = 0.5 + random();
        const crackHeight = 2 + random() * 10;
        const crackDepth = 0.5 + random();

        const crackGeometry = new THREE.BoxGeometry(
            crackWidth,
            crackHeight,
            crackDepth
        );

        const crackMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.1
        });

        const crack = new THREE.Mesh(crackGeometry, crackMaterial);

        // Position randomly on the plug surface
        const crackAngle = random() * Math.PI * 2;
        const crackY = -height / 2 + height * random();

        crack.position.set(
            Math.cos(crackAngle) * (radius - 0.1),
            crackY,
            Math.sin(crackAngle) * (radius - 0.1)
        );

        // Orient to point inward/outward
        crack.lookAt(new THREE.Vector3(0, crackY, 0));

        plug.add(crack);
    }
}

/**
 * Add rock debris around a feature
 * @param {THREE.Group} island - The island group
 * @param {THREE.Vector3} position - Center position
 * @param {number} radius - Debris field radius
 * @param {Function} random - Seeded random function
 */
function addRockDebris(island, position, radius, random) {
    const debrisCount = 10 + Math.floor(random() * 15);

    for (let i = 0; i < debrisCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = random() * radius;

        const debrisSize = 1 + random() * 3;

        // Choose a random geometry
        let debrisGeometry;
        const shapeType = Math.floor(random() * 3);

        if (shapeType === 0) {
            debrisGeometry = new THREE.TetrahedronGeometry(debrisSize, 0);
        } else if (shapeType === 1) {
            debrisGeometry = new THREE.DodecahedronGeometry(debrisSize, 0);
        } else {
            debrisGeometry = new THREE.BoxGeometry(
                debrisSize * (0.8 + random() * 0.4),
                debrisSize * (0.8 + random() * 0.4),
                debrisSize * (0.8 + random() * 0.4)
            );
        }

        const debrisMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9,
            metalness: 0.1
        });

        const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);

        // Position around center
        debris.position.set(
            position.x + Math.cos(angle) * distance,
            position.y - (position.y - debrisSize / 2) * random() * 0.8, // Sometimes embed in ground
            position.z + Math.sin(angle) * distance
        );

        // Random rotation
        debris.rotation.set(
            random() * Math.PI,
            random() * Math.PI,
            random() * Math.PI
        );

        island.add(debris);
    }
}

/**
 * Add walkable paths up the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius
 * @param {number} height - Volcano height
 * @param {Function} random - Seeded random function
 */
function addWalkablePaths(island, radius, height, random) {
    // Create paths that spiral up the volcano
    const pathCount = 1 + Math.floor(random() * 2); // 1-2 paths

    for (let p = 0; p < pathCount; p++) {
        const startAngle = random() * Math.PI * 2;
        const pathWidth = 5 + random() * 3;

        // Create path segments that spiral upward
        const segments = 20;
        const totalAngle = Math.PI * 2 * 1.5; // 1.5 loops around

        for (let i = 0; i < segments; i++) {
            const t = i / (segments - 1);
            const nextT = (i + 1) / (segments - 1);

            // Calculate positions
            const angle1 = startAngle + t * totalAngle;
            const angle2 = startAngle + nextT * totalAngle;

            const radius1 = radius * (1 - 0.6 * t);
            const radius2 = radius * (1 - 0.6 * nextT);

            const height1 = height * t;
            const height2 = height * nextT;

            // Create path segment
            const pathGeometry = new THREE.PlaneGeometry(
                Math.sqrt(
                    Math.pow(Math.cos(angle1) * radius1 - Math.cos(angle2) * radius2, 2) +
                    Math.pow(height2 - height1, 2)
                ),
                pathWidth
            );

            const pathMaterial = new THREE.MeshStandardMaterial({
                color: 0x555555,
                roughness: 0.9,
                metalness: 0.1
            });

            const pathSegment = new THREE.Mesh(pathGeometry, pathMaterial);

            // Position at midpoint
            const midAngle = (angle1 + angle2) / 2;
            const midRadius = (radius1 + radius2) / 2;
            const midHeight = (height1 + height2) / 2;

            pathSegment.position.set(
                Math.cos(midAngle) * midRadius,
                midHeight,
                Math.sin(midAngle) * midRadius
            );

            // Orient along the path
            pathSegment.lookAt(new THREE.Vector3(
                Math.cos(angle2) * radius2,
                height2,
                Math.sin(angle2) * radius2
            ));

            // Rotate to make the path flat
            pathSegment.rotateX(Math.PI / 2);

            island.add(pathSegment);

            // Add some rocks along the path edges
            if (random() < 0.3) {
                addPathEdging(island, angle1, radius1, height1, angle2, radius2, height2, pathWidth, random);
            }
        }
    }
}

/**
 * Add rocks along path edges
 * @param {THREE.Group} island - The island group
 * @param {number} angle1 - Start angle
 * @param {number} radius1 - Start radius
 * @param {number} height1 - Start height
 * @param {number} angle2 - End angle
 * @param {number} radius2 - End radius
 * @param {number} height2 - End height
 * @param {number} pathWidth - Width of the path
 * @param {Function} random - Seeded random function
 */
function addPathEdging(island, angle1, radius1, height1, angle2, radius2, height2, pathWidth, random) {
    const rockCount = 2 + Math.floor(random() * 3);

    for (let i = 0; i < rockCount; i++) {
        const t = random();
        const angle = angle1 + (angle2 - angle1) * t;
        const radius = radius1 + (radius2 - radius1) * t;
        const height = height1 + (height2 - height1) * t;

        // Offset to path edge
        const offset = (pathWidth / 2) * (random() > 0.5 ? 1 : -1);
        const offsetDir = new THREE.Vector3(
            -Math.sin(angle),
            0,
            Math.cos(angle)
        ).normalize();

        const rockSize = 1 + random() * 2;
        const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);

        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.9,
            metalness: 0.1
        });

        const rock = new THREE.Mesh(rockGeometry, rockMaterial);

        rock.position.set(
            Math.cos(angle) * radius + offsetDir.x * offset,
            height,
            Math.sin(angle) * radius + offsetDir.z * offset
        );

        // Random rotation
        rock.rotation.set(
            random() * Math.PI,
            random() * Math.PI,
            random() * Math.PI
        );

        island.add(rock);
    }
}

/**
 * Create a steam particle emitter
 * @param {THREE.Object3D} parent - Parent object to attach emitter to
 * @param {number} intensity - Intensity of steam emission
 */
function createSteamEmitter(parent, intensity) {
    // Create a simple particle system for steam
    const particleCount = Math.floor(intensity * 100);
    const particles = new THREE.BufferGeometry();

    const positions = [];
    const velocities = [];
    const lifetimes = [];

    for (let i = 0; i < particleCount; i++) {
        // Initial positions (clustered near origin)
        positions.push(
            (Math.random() - 0.5) * 0.5,
            0,
            (Math.random() - 0.5) * 0.5
        );

        // Random velocities (mostly upward)
        velocities.push(
            (Math.random() - 0.5) * 0.5,
            0.5 + Math.random() * 1.5,
            (Math.random() - 0.5) * 0.5
        );

        // Random lifetimes
        lifetimes.push(Math.random() * 2);
    }

    particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    // Store velocities and lifetimes in userData
    const particleSystem = {
        geometry: particles,
        velocities: velocities,
        lifetimes: lifetimes,
        ages: new Array(particleCount).fill(0),
        intensity: intensity
    };

    // Create material
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xdddddd,
        size: 1.5,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(particles, particleMaterial);
    parent.add(points);

    // Store reference for updates
    parent.userData.particleSystem = particleSystem;
    parent.userData.particlePoints = points;
}

/**
 * Setup eruption cycle for the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius
 * @param {number} height - Volcano height
 * @param {Function} random - Seeded random function
 */
function setupEruptionCycle(island, radius, height, random) {
    // Time until next eruption
    const nextEruptionTime = 60000 + random() * 120000; // 1-3 minutes

    island.userData.volcano = {
        isErupting: false,
        nextEruptionTime: nextEruptionTime,
        eruptionDuration: 0,
        maxEruptionDuration: 20000 + random() * 20000, // 20-40 seconds
        particleSystem: null
    };

    // Create placeholder for eruption particle system
    const eruptionPoint = new THREE.Object3D();
    eruptionPoint.position.y = height;
    island.add(eruptionPoint);

    island.userData.volcano.eruptionPoint = eruptionPoint;
}

/**
 * Create volcanic texture with lava striations
 * @param {number} baseColor - Base color
 * @param {number} lavaColor - Lava color
 * @param {number} intensity - Intensity of lava striations
 * @param {Function} random - Seeded random function
 * @returns {THREE.Texture} Generated texture
 */
function createVolcanicTexture(baseColor, lavaColor, intensity, random) {
    // Check if texture is already cached
    const cacheKey = `volcanic_${baseColor.toString(16)}_${lavaColor.toString(16)}_${intensity}`;

    if (textureCache.has(cacheKey)) {
        return textureCache.get(cacheKey);
    }

    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill with base color
    ctx.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add lava striations
    const striationCount = 5 + Math.floor(random() * 10);

    for (let i = 0; i < striationCount; i++) {
        const x1 = random() * canvas.width;
        const y1 = random() * canvas.height;
        const x2 = x1 + (random() - 0.5) * 200;
        const y2 = y1 + (random() - 0.5) * 200;
        const width = 2 + random() * 10;

        // Create gradient for striation
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, `rgba(${(lavaColor >> 16) & 255}, ${(lavaColor >> 8) & 255}, ${lavaColor & 255}, ${intensity * (0.5 + random() * 0.5)})`);
        gradient.addColorStop(1, `rgba(${(lavaColor >> 16) & 255}, ${(lavaColor >> 8) & 255}, ${lavaColor & 255}, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    textureCache.set(cacheKey, texture);

    return texture;
}

/**
 * Create texture with lava cracks pattern
 * @param {Function} random - Seeded random function
 * @returns {THREE.Texture} Generated texture
 */
function createLavaCracksTexture(random) {
    // Create unique key for this texture
    const cacheKey = `lava_cracks_${Math.floor(random() * 1000)}`;

    if (textureCache.has(cacheKey)) {
        return textureCache.get(cacheKey);
    }

    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill with dark base color
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add lava cracks
    const crackCount = 10 + Math.floor(random() * 20);

    for (let i = 0; i < crackCount; i++) {
        const startX = random() * canvas.width;
        const startY = random() * canvas.height;

        // Create a crack with segments
        ctx.beginPath();
        ctx.moveTo(startX, startY);

        let x = startX;
        let y = startY;
        const segments = 5 + Math.floor(random() * 10);

        for (let j = 0; j < segments; j++) {
            // Random direction
            const angle = random() * Math.PI * 2;
            const length = 10 + random() * 30;

            x += Math.cos(angle) * length;
            y += Math.sin(angle) * length;

            ctx.lineTo(x, y);
        }

        // Create gradient for the lava glow
        const gradient = ctx.createLinearGradient(startX, startY, x, y);
        gradient.addColorStop(0, 'rgba(255, 100, 0, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0.5)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2 + random() * 4;
        ctx.stroke();
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    textureCache.set(cacheKey, texture);

    return texture;
}

/**
 * Get height on volcano surface at given distance
 * @param {number} distance - Distance from center
 * @param {number} volcanoHeight - Total volcano height
 * @returns {number} Height at this distance
 */
function getHeightOnVolcano(distance, volcanoHeight) {
    // Simple linear interpolation - height decreases as distance increases
    // This is a simplified model assuming a conical volcano
    const normalizedDistance = Math.min(distance, 1);
    return volcanoHeight * (1 - normalizedDistance);
}

/**
 * Update animations and effects for all active volcanoes
 * @param {number} deltaTime - Time since last update in seconds
 */
export function updateActiveVolcanoes(deltaTime) {
    // Add validation to prevent errors if deltaTime is invalid
    if (!deltaTime || isNaN(deltaTime)) {
        console.warn("Invalid deltaTime in updateActiveVolcanoes:", deltaTime);
        deltaTime = 1 / 60; // Use default 60 FPS if deltaTime is invalid
    }

    // Debug info
    if (activeVolcanoes.length > 0 && Math.random() < 0.01) { // Log occasionally
        console.log(`Updating ${activeVolcanoes.length} active volcanoes`);
    }

    for (let i = 0; i < activeVolcanoes.length; i++) {
        const volcano = activeVolcanoes[i];

        try {
            // Update eruption cycle
            if (volcano && volcano.volcanoData) {
                const now = Date.now();

                // Check if it's time for an eruption
                if (!volcano.volcanoData.isErupting && now >= volcano.volcanoData.nextEruptionTime) {
                    startEruption(volcano);
                }

                // Update ongoing eruption
                if (volcano.volcanoData.isErupting) {
                    updateEruption(volcano, deltaTime);

                    // Check if eruption should end
                    if (now >= volcano.volcanoData.eruptionEndTime) {
                        endEruption(volcano);
                    }
                }
            }

            // Update steam particles - check for both mesh and mesh.userData
            if (volcano && volcano.mesh) {
                // Debug output to check what's happening
                if (Math.random() < 0.001) { // Log occasionally to avoid flooding console
                    console.log(`Updating volcano ${volcano.id}:`, {
                        hasUserData: !!volcano.mesh.userData,
                        hasParticles: false, // Will be updated below
                        position: volcano.mesh.position.toArray()
                    });
                }

                updateSteamParticles(volcano.mesh, deltaTime);
                updateLavaAnimations(volcano.mesh, deltaTime);
            }
        } catch (error) {
            console.error(`Error updating volcano ${volcano?.id || i}:`, error);
            // Continue to the next volcano rather than stopping all updates
        }
    }
}

/**
 * Start a volcano eruption
 * @param {Object} volcano - Volcano object
 */
function startEruption(volcano) {
    if (!volcano.mesh) return;

    console.log(`Volcano eruption starting at ${volcano.id}`);

    const volcanoData = volcano.volcanoData;
    volcanoData.isErupting = true;

    // Set eruption duration
    const eruptionDuration = 30000 + Math.random() * 60000; // 30-90 seconds
    volcanoData.eruptionEndTime = Date.now() + eruptionDuration;

    // Create eruption particle system
    const eruptionPoint = volcano.mesh.userData.volcano?.eruptionPoint;
    if (eruptionPoint) {
        createEruptionParticles(eruptionPoint, volcanoData.eruptionStrength);
    }

    // Increase lava pool glow
    const lavaPool = volcano.mesh.userData.lavaPool;
    if (lavaPool) {
        const material = lavaPool.material;
        material.emissiveIntensity = 1.5;
    }

    // Schedule next eruption
    volcanoData.nextEruptionTime = volcanoData.eruptionEndTime + 60000 + Math.random() * 300000; // 1-6 minutes after end
}

/**
 * Update an ongoing eruption
 * @param {Object} volcano - Volcano object
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateEruption(volcano, deltaTime) {
    if (!volcano.mesh) return;

    // Update particle effects
    const eruptionPoint = volcano.mesh.userData.volcano?.eruptionPoint;
    if (eruptionPoint && eruptionPoint.userData.particleSystem) {
        updateEruptionParticles(eruptionPoint, deltaTime);

        // Add intensity pulses
        const timeSinceStart = Date.now() - (volcano.volcanoData.eruptionEndTime - volcano.volcanoData.eruptionDuration);
        const pulseFactor = Math.sin(timeSinceStart / 500) * 0.3 + 0.7;

        eruptionPoint.userData.particleSystem.intensity = volcano.volcanoData.eruptionStrength * pulseFactor;
    }
}

/**
 * End a volcano eruption
 * @param {Object} volcano - Volcano object
 */
function endEruption(volcano) {
    if (!volcano.mesh) return;

    console.log(`Volcano eruption ending at ${volcano.id}`);

    const volcanoData = volcano.volcanoData;
    volcanoData.isErupting = false;

    // Remove eruption particles
    const eruptionPoint = volcano.mesh.userData.volcano?.eruptionPoint;
    if (eruptionPoint && eruptionPoint.userData.particlePoints) {
        eruptionPoint.remove(eruptionPoint.userData.particlePoints);
        eruptionPoint.userData.particleSystem = null;
        eruptionPoint.userData.particlePoints = null;
    }

    // Return lava pool to normal
    const lavaPool = volcano.mesh.userData.lavaPool;
    if (lavaPool) {
        const material = lavaPool.material;
        material.emissiveIntensity = 1.0;
    }
}

/**
 * Create eruption particle system with enhanced validation
 * @param {THREE.Object3D} eruptionPoint - Point to attach particles to
 * @param {number} intensity - Eruption intensity
 */
function createEruptionParticles(eruptionPoint, intensity) {
    if (!eruptionPoint) {
        console.error("Cannot create eruption particles: eruptionPoint is null or undefined");
        return;
    }

    try {
        // Sanitize intensity and cap the maximum particle count to avoid array length errors
        const safeIntensity = Math.max(0, Math.min(intensity || 0.5, 5)); // Cap intensity between 0 and 5
        const maxParticles = 2000; // Lower maximum for better performance
        const particleCount = Math.min(Math.floor(safeIntensity * 500), maxParticles);

        // Log the particle count for debugging
        console.log(`Creating eruption with ${particleCount} particles (intensity: ${safeIntensity})`);

        // Early return if we can't create particles
        if (particleCount <= 0) {
            console.warn("Cannot create particles with zero or negative count");
            return;
        }

        const particles = new THREE.BufferGeometry();

        const positions = [];
        const velocities = [];
        const sizes = [];
        const colors = [];

        for (let i = 0; i < particleCount; i++) {
            // Initial positions
            positions.push(
                (Math.random() - 0.5) * 5,
                0,
                (Math.random() - 0.5) * 5
            );

            // Random velocities (mostly upward)
            const speed = 5 + Math.random() * 15 * safeIntensity;
            const angle = Math.random() * Math.PI * 2;
            const upwardBias = 0.6 + Math.random() * 0.4; // 60-100% upward

            velocities.push(
                Math.cos(angle) * speed * (1 - upwardBias),
                speed * upwardBias,
                Math.sin(angle) * speed * (1 - upwardBias)
            );

            // Particle sizes
            sizes.push(2 + Math.random() * 8);

            // Colors (red to orange to gray)
            const colorType = Math.random();
            if (colorType < 0.3) {
                // Red hot lava
                colors.push(1.0, 0.3, 0.1);
            } else if (colorType < 0.6) {
                // Orange
                colors.push(1.0, 0.5, 0.0);
            } else {
                // Gray ash
                const gray = 0.2 + Math.random() * 0.3;
                colors.push(gray, gray, gray);
            }
        }

        particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Create material
        const particleMaterial = new THREE.PointsMaterial({
            size: 3,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(particles, particleMaterial);
        eruptionPoint.add(points);

        // Store reference for updates with proper error handling
        eruptionPoint.userData.particleSystem = {
            geometry: particles,
            velocities: velocities,
            sizes: sizes,
            ages: new Array(particleCount).fill(0),
            lifespans: new Array(particleCount).fill(0).map(() => 1 + Math.random() * 2),
            intensity: safeIntensity
        };

        eruptionPoint.userData.particlePoints = points;

        // Debug output
        console.log("Successfully created eruption particle system:", {
            particleCount,
            eruptionPointPosition: eruptionPoint.position.toArray()
        });

    } catch (error) {
        console.error("Error creating particle system:", error);
        // Clean up if something went wrong
        if (eruptionPoint.userData.particlePoints) {
            eruptionPoint.remove(eruptionPoint.userData.particlePoints);
            eruptionPoint.userData.particleSystem = null;
            eruptionPoint.userData.particlePoints = null;
        }
    }
}

/**
 * Update eruption particles
 * @param {THREE.Object3D} eruptionPoint - Eruption point
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateEruptionParticles(eruptionPoint, deltaTime) {
    const ps = eruptionPoint.userData.particleSystem;
    if (!ps) return;

    const positions = ps.geometry.attributes.position.array;
    const velocities = ps.velocities;
    const ages = ps.ages;
    const lifespans = ps.lifespans;

    // Apply gravity and update positions
    const gravity = -9.8; // m/s²

    for (let i = 0; i < positions.length / 3; i++) {
        // Update age
        ages[i] += deltaTime;

        // Check if particle should be reset
        if (ages[i] >= lifespans[i]) {
            // Reset particle
            positions[i * 3] = (Math.random() - 0.5) * 5;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 5;

            // New velocity
            const speed = 5 + Math.random() * 15 * ps.intensity;
            const angle = Math.random() * Math.PI * 2;
            const upwardBias = 0.6 + Math.random() * 0.4;

            velocities[i * 3] = Math.cos(angle) * speed * (1 - upwardBias);
            velocities[i * 3 + 1] = speed * upwardBias;
            velocities[i * 3 + 2] = Math.sin(angle) * speed * (1 - upwardBias);

            // Reset age
            ages[i] = 0;
        } else {
            // Apply gravity to Y velocity
            velocities[i * 3 + 1] += gravity * deltaTime;

            // Update position
            positions[i * 3] += velocities[i * 3] * deltaTime;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;
        }
    }

    ps.geometry.attributes.position.needsUpdate = true;
}

/**
 * Update steam particle animations - with enhanced error handling
 * @param {THREE.Object3D} object - Parent object
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateSteamParticles(object, deltaTime) {
    if (!object) return;

    // Recursively update steam particles in all children
    object.traverse(child => {
        if (!child || !child.userData || !child.userData.particleSystem) return;

        try {
            const ps = child.userData.particleSystem;

            // Guard clauses to ensure all required properties exist
            if (!ps.geometry || !ps.geometry.attributes || !ps.geometry.attributes.position) return;
            if (!ps.velocities) ps.velocities = [];
            if (!ps.ages) ps.ages = [];
            if (!ps.lifetimes) ps.lifetimes = [];

            const positions = ps.geometry.attributes.position.array;
            const velocities = ps.velocities;
            const ages = ps.ages;
            const lifetimes = ps.lifetimes;

            // Make sure arrays are properly sized
            const particleCount = positions.length / 3;

            // Ensure velocities array has enough entries
            while (velocities.length < positions.length) {
                velocities.push(0, 0.5 + Math.random() * 1.5, 0);
            }

            // Ensure ages and lifetimes arrays have enough entries
            while (ages.length < particleCount) {
                ages.push(0);
            }

            while (lifespans.length < particleCount) {
                lifetimes.push(Math.random() * 2);
            }

            for (let i = 0; i < particleCount; i++) {
                // Update age
                ages[i] += deltaTime;

                // Reset if past lifetime
                if (ages[i] >= lifetimes[i]) {
                    positions[i * 3] = (Math.random() - 0.5) * 0.5;
                    positions[i * 3 + 1] = 0;
                    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
                    ages[i] = 0;
                } else {
                    // Update position
                    positions[i * 3] += velocities[i * 3] * deltaTime;
                    positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
                    positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;
                }
            }

            ps.geometry.attributes.position.needsUpdate = true;

            // Log successful update occasionally for debugging
            if (Math.random() < 0.0001) {
                console.log(`Successfully updated steam particles: count=${particleCount}`);
            }
        } catch (error) {
            console.error("Error updating steam particles:", error);
        }
    });
}

/**
 * Update lava animations with improved error handling
 * @param {THREE.Object3D} object - Parent object
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateLavaAnimations(object, deltaTime) {
    if (!object) return;

    try {
        // Update lava flows
        object.traverse(child => {
            if (!child || !child.userData) return;

            try {
                // Animate lava flows
                if (child.userData.flowSpeed) {
                    if (child.material) {
                        if (!child.material.map) {
                            // Create flowing lava texture if not exists
                            const lavaTexture = createLavaCracksTexture(Math.random);
                            child.material.map = lavaTexture;
                        }

                        // Animate texture offset
                        child.userData.textureOffset = (child.userData.textureOffset || 0) + deltaTime * child.userData.flowSpeed;
                        child.material.map.offset.y = child.userData.textureOffset;
                        child.material.map.needsUpdate = true;
                    }
                }

                // Animate lava bubbles
                if (child.userData.bubbleSpeed && child.userData.initialY !== undefined) {
                    const time = Date.now() / 1000;

                    // Bobbing motion
                    const newY = child.userData.initialY +
                        Math.sin(time * child.userData.bubbleSpeed + child.userData.bubblePhase) * 0.5;

                    child.position.y = newY;
                }
            } catch (innerError) {
                console.error("Error in lava animation for individual object:", innerError);
            }
        });
    } catch (error) {
        console.error("Error in updateLavaAnimations:", error);
    }
}