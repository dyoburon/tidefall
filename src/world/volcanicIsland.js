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
    /*
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
    //addLavaFlows(island, baseRadius, volcanoHeight, random);

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

    // Add floating pumice islands around the volcano - store return value
    const pumiceIslands = addPumiceIslands(island, baseRadius, scene, random);

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
            eruptionParticles: null,
            pumiceIslands: pumiceIslands // Store reference to pumice islands here
        }
    };

    // Add to tracking array for updates
    activeVolcanoes.push(islandEntry);

    return islandEntry;
    */
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
    // Simpler cone with fewer segments
    const coneGeometry = new THREE.ConeGeometry(radius, height, 16); // Reduced from 48 to 16 segments

    const coneMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.9,
        metalness: 0.1
    });

    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.y = height / 2;
    island.add(cone);

    // Simple outline - no detailed textures
    applyOutline(cone, { scale: 1.02 });

    // Create a simple base plate
    const baseGeometry = new THREE.CylinderGeometry(
        radius * 1.1,
        radius * 1.2,
        height * 0.1,
        16           // Reduced segments
    );

    const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2
    });

    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = height * 0.05;
    island.add(base);

    // Add crater at the top
    const craterGeometry = new THREE.CylinderGeometry(
        craterRadius,
        craterRadius * 1.2,
        craterDepth,
        16,
        1,
        true // Open-ended
    );

    const craterMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
    });

    const crater = new THREE.Mesh(craterGeometry, craterMaterial);
    crater.position.y = height - craterDepth / 2;
    island.add(crater);

    // Simple lava pool at the bottom of the crater
    const lavaPoolGeometry = new THREE.CircleGeometry(craterRadius, 16);
    const lavaPoolMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3300,
        emissive: 0xff0000,
        emissiveIntensity: 1
    });

    const lavaPool = new THREE.Mesh(lavaPoolGeometry, lavaPoolMaterial);
    lavaPool.rotation.x = -Math.PI / 2; // Lay flat
    lavaPool.position.y = height - craterDepth + 0.1;
    island.add(lavaPool);

    island.userData.lavaPool = lavaPool;
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
    // Just 1-2 lava flows
    const flowCount = 1 + Math.floor(random() * 1);

    for (let i = 0; i < flowCount; i++) {
        const angle = random() * Math.PI * 2;

        // Create simplified lava flow path
        const points = [];
        const segments = 5; // Reduced from 10

        // Starting point at top
        const startHeight = height * 0.85;
        const startDistance = radius * 0.3;

        points.push(new THREE.Vector3(
            Math.cos(angle) * startDistance,
            startHeight,
            Math.sin(angle) * startDistance
        ));

        // Few middle points with less randomness
        for (let j = 1; j < segments; j++) {
            const t = j / segments;
            const segmentHeight = startHeight * (1 - t);
            const segmentDistance = startDistance + (radius - startDistance) * t;

            points.push(new THREE.Vector3(
                Math.cos(angle) * segmentDistance,
                segmentHeight,
                Math.sin(angle) * segmentDistance
            ));
        }

        // Create a simple curve
        const curve = new THREE.CatmullRomCurve3(points);

        // Create a tube with fewer segments
        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            10, // Reduced segments
            6 + random() * 4, // Width
            6, // Fewer radial segments
            false
        );

        // Create glowing lava material
        const lavaMaterial = new THREE.MeshStandardMaterial({
            color: 0xff4400,
            emissive: 0xff2200,
            emissiveIntensity: 0.8
        });

        const lavaFlow = new THREE.Mesh(tubeGeometry, lavaMaterial);
        island.add(lavaFlow);
    }

    // Add lava pool at the base where flow ends
    for (let i = 0; i < flowCount; i++) {
        const angle = i * (Math.PI * 2 / flowCount);
        const distance = radius * 0.9;

        const poolRadius = 8 + random() * 6;
        const poolGeometry = new THREE.CircleGeometry(poolRadius, 16);
        const poolMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0xff2200,
            emissiveIntensity: 0.8
        });

        const pool = new THREE.Mesh(poolGeometry, poolMaterial);
        pool.rotation.x = -Math.PI / 2; // Lay flat
        pool.position.set(
            Math.cos(angle) * distance,
            1, // Just above ground
            Math.sin(angle) * distance
        );

        island.add(pool);

        // Add simple black edge around pool
        const edgeGeometry = new THREE.RingGeometry(poolRadius, poolRadius + 3, 16);
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111
        });

        const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(
            Math.cos(angle) * distance,
            1.1, // Slightly above pool
            Math.sin(angle) * distance
        );

        island.add(edge);
    }
}

/**
 * Add lava platforms around the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius of the volcano
 * @param {Function} random - Seeded random function
 */
function addLavaPlatforms(island, radius, random) {
    /*
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
        //addLavaPlatformDetails(platformGroup, platformRadius, innerRadius, random);

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
    }*/
}

/**
 * Add steam vents around the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius
 * @param {number} height - Volcano height
 * @param {Function} random - Seeded random function
 */
function addSteamVents(island, radius, height, random) {
    // Just add 1-2 steam vents with no particles
    const ventCount = 1 + Math.floor(random() * 1);

    for (let i = 0; i < ventCount; i++) {
        const angle = random() * Math.PI * 2;
        const ventHeight = height * 0.6;
        const ventDistance = radius * 0.5;

        // Simple cylinder for vent
        const ventGeometry = new THREE.CylinderGeometry(1, 2, 3, 8);
        const ventMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222
        });

        const vent = new THREE.Mesh(ventGeometry, ventMaterial);

        const ventX = Math.cos(angle) * ventDistance;
        const ventZ = Math.sin(angle) * ventDistance;

        vent.position.set(ventX, ventHeight, ventZ);
        vent.lookAt(new THREE.Vector3(ventX * 2, ventHeight, ventZ * 2));
        vent.rotation.x += Math.PI / 2;

        island.add(vent);
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
    /*
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
    }*/
}

/**
 * Add detailed rim around the caldera
 * @param {THREE.Group} island - The island group
 * @param {number} craterRadius - Radius of the crater
 * @param {number} volcanoHeight - Total volcano height
 * @param {Function} random - Seeded random function
 */
function addCalderaRim(island, craterRadius, volcanoHeight, random) {
    /*
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
    }*/
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
    /*
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
    }*/
}

/**
 * Add a volcanic plug formation
 * @param {THREE.Group} island - The island group
 * @param {number} angle - Angle around the volcano
 * @param {number} distance - Distance from center
 * @param {Function} random - Seeded random function
 */
function addVolcanicPlug(island, angle, distance, random) {
    /*
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
    addRockDebris(island, plug.position, plugRadius * 1.5, random);*/
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
    /*
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
    }*/
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
    /*
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
    */
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
    /*
    // Debug counter of how many pumice islands we're updating
    let pumiceCount = 0;

    for (let i = 0; i < activeVolcanoes.length; i++) {
        const volcano = activeVolcanoes[i];
        if (volcano && volcano.mesh) {
            // Update lava pool pulsing if it exists
            if (volcano.mesh.userData.lavaPool) {
                const time = Date.now() / 1000;
                const pulseValue = 0.8 + Math.sin(time) * 0.2;

                const lavaPool = volcano.mesh.userData.lavaPool;
                if (lavaPool && lavaPool.material) {
                    lavaPool.material.emissiveIntensity = pulseValue;
                }
            }

            // Check both possible locations for pumice islands
            let pumiceIslands = volcano.mesh.userData.pumiceIslands || [];

            // Also check in volcano data as backup
            if (volcano.volcanoData && volcano.volcanoData.pumiceIslands) {
                pumiceIslands = volcano.volcanoData.pumiceIslands;
            }

            // Update pumice islands
            for (let j = 0; j < pumiceIslands.length; j++) {
                const pumice = pumiceIslands[j];
                if (pumice && pumice.update) {
                    pumice.update(deltaTime);
                    pumiceCount++;
                }
            }
        }
    }

    // Log pumice update count occasionally
    if (Math.random() < 0.01) {
        console.log(`Updated ${pumiceCount} pumice islands`);
    }
        */
}

/**
 * Add floating pumice islands around the volcano
 * @param {THREE.Group} island - The island group
 * @param {number} radius - Base radius of the volcano
 * @param {THREE.Scene} scene - The scene to add entities to
 * @param {Function} random - Seeded random function
 */
function addPumiceIslands(island, radius, scene, random) {
    /*
    // DEBUG: Greatly increased number of pumice islands (15-20 instead of 2-5)
    const pumiceCount = 15 + Math.floor(random() * 5);
    console.log(`Creating ${pumiceCount} pumice islands around volcano`);

    const pumiceIslands = [];

    for (let i = 0; i < pumiceCount; i++) {
        // Position around the volcano in a more visible pattern
        const angle = (i / pumiceCount) * Math.PI * 2; // Evenly distribute
        // Keep them closer to the volcano and visible
        const distance = radius * (1.0 + random() * 0.5);

        const position = new THREE.Vector3(
            Math.cos(angle) * distance,
            0, // Water level
            Math.sin(angle) * distance
        );

        // Calculate global position
        const globalPosition = new THREE.Vector3().copy(position).add(island.position);
        const pumice = createPumiceIsland(globalPosition, scene);

        // DEBUG: Log each island creation
        console.log(`Pumice island ${i} created at`, globalPosition);

        pumiceIslands.push(pumice);
    }

    // Store in the island userData for updates
    island.userData.pumiceIslands = pumiceIslands;

    // DEBUG: Also store in volcanoData for redundancy
    if (island.userData.volcano) {
        island.userData.volcano.pumiceIslands = pumiceIslands;
    }

    return pumiceIslands; // Return for direct access
    */
}

/**
 * Create a single pumice island
 * @param {THREE.Vector3} position - Position in world space
 * @param {THREE.Scene} scene - The scene to add to
 * @returns {Object} The pumice island object
 */
function createPumiceIsland(position, scene) {
    // Make them much larger and more obvious
    const size = 25 + Math.random() * 15; // 25-40 units instead of 10-25

    // Create a more distinctive shape - taller with clearer outline
    const geometry = new THREE.CylinderGeometry(size, size * 0.8, 8, 12);

    // Use a brighter, more noticeable material
    const material = new THREE.MeshStandardMaterial({
        color: 0xDDDDDD, // Brighter white
        roughness: 0.7,
        metalness: 0.2,
        // Add slight emissive for better visibility
        emissive: 0x111111,
        emissiveIntensity: 0.1
    });

    const pumice = new THREE.Mesh(geometry, material);

    // Enhanced outline - thicker and more visible with contrasting color
    applyOutline(pumice, {
        scale: 1.04,  // Increased from 1.02 for a thicker outline
        color: 0x000000, // Black outline
        thickness: 0.5 // Add thickness parameter if supported by your applyOutline function
    });

    // Add some surface details to make it look more like pumice
    addPumiceDetails(pumice, size);

    // Position and add to scene
    pumice.position.copy(position);
    pumice.position.y = 2; // Higher above water to be more visible
    scene.add(pumice);

    // Add drift behavior - make it move faster for visibility
    pumice.userData.drift = {
        speed: 3 + Math.random() * 2, // Much faster: 3-5 units/sec instead of 0.5-1.5
        direction: Math.random() * Math.PI * 2
    };

    return {
        mesh: pumice,
        collider: { center: position, radius: size },
        update: (deltaTime) => {
            // Move the island
            pumice.position.x += Math.cos(pumice.userData.drift.direction) * pumice.userData.drift.speed * deltaTime;
            pumice.position.z += Math.sin(pumice.userData.drift.direction) * pumice.userData.drift.speed * deltaTime;

            // More dramatic bobbing
            pumice.position.y = 2 + Math.sin(Date.now() * 0.002) * 1.0; // Larger movement

            // Slowly rotate for visibility
            pumice.rotation.y += deltaTime * 0.2;
        }
    };
}

/**
 * Add surface details to make pumice look more realistic
 * @param {THREE.Mesh} pumice - The pumice mesh
 * @param {number} size - Size of the pumice
 */
function addPumiceDetails(pumice, size) {
    /*
    // Add small bumps and holes to simulate pumice's porous texture
    const bumpCount = 8 + Math.floor(Math.random() * 8);

    for (let i = 0; i < bumpCount; i++) {
        // Create small bump or divot
        const bumpSize = size * 0.1 * (0.5 + Math.random() * 0.5);
        const bumpGeometry = new THREE.SphereGeometry(bumpSize, 6, 6);

        // Alternate between bumps and holes
        const isBump = Math.random() > 0.5;
        const bumpMaterial = new THREE.MeshStandardMaterial({
            color: isBump ? 0xEEEEEE : 0x999999,
            roughness: 0.9,
            metalness: 0.1
        });

        const bump = new THREE.Mesh(bumpGeometry, bumpMaterial);

        // Position randomly on top surface
        const angle = Math.random() * Math.PI * 2;
        const distanceFromCenter = size * 0.6 * Math.random();

        bump.position.set(
            Math.cos(angle) * distanceFromCenter,
            4, // On top surface
            Math.sin(angle) * distanceFromCenter
        );

        if (!isBump) {
            // Make it a hole by pushing it down
            bump.position.y = 3;
            bump.scale.set(0.8, 0.5, 0.8);
        }

        pumice.add(bump);
    }*/
}