import * as THREE from 'three';
import { createShoreEffect, updateShores, setShoreVisibility, removeShore } from './shores.js';

// Store massive islands data
const massiveIslands = new Map(); // Maps island ID to island object
const massiveIslandColliders = []; // Colliders for collision detection

// Scale factor compared to regular islands
const SCALE_FACTOR = 25;
const BASE_RADIUS = 50 * SCALE_FACTOR; // Base radius for massive islands
const VERTICAL_SCALE = 10; // New vertical scale multiplier

/**
 * Function to check if shore effects are enabled
 * @returns {boolean} Whether shore effects are enabled
 */
function areShoreEffectsEnabled() {
    // Check window.gameSettings if available
    if (typeof window !== 'undefined' && window.gameSettings) {
        return window.gameSettings.enableShoreEffects;
    }
    // Default to true
    return true;
}

/**
 * Checks if a massive island with the given ID exists
 * @param {string} islandId - The island ID to check
 * @returns {boolean} - Whether the island exists
 */
function massiveIslandExists(islandId) {
    return massiveIslands.has(islandId);
}

/**
 * Creates a massive island with a navigable cave/inlet
 * @param {number} x - X position
 * @param {number} z - Z position
 * @param {number} seed - Seed for random generation
 * @param {THREE.Scene} scene - The scene to add the island to
 * @returns {object} - The created island object
 */
export function createMassiveIsland(x, z, seed, scene) {
    // Create a unique ID for this island
    const islandId = `massive_island_${Math.floor(x)}_${Math.floor(z)}`;

    // Skip if this island already exists
    if (massiveIslandExists(islandId)) {
        return massiveIslands.get(islandId);
    }

    // Use the seed to create deterministic randomness for this island
    let seedValue = seed;
    const random = () => {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        return seedValue / 233280;
    };

    // Island group to hold all parts
    const island = new THREE.Group();
    island.position.set(x, 0, z);
    scene.add(island);

    // Create the main island mesh with a cave
    createMassiveIslandMesh(island, random);

    // Add detailed features
    addLandVegetation(island, random);
    addRockFormations(island, random);
    addCaveDetails(island, random);

    // Create colliders for the main island and the cave
    const colliders = createMassiveIslandColliders(island, islandId, random);
    massiveIslandColliders.push(...colliders);

    // Store the island with its ID and collider reference
    const islandEntry = {
        mesh: island,
        colliders: colliders,
        visible: true
    };

    massiveIslands.set(islandId, islandEntry);

    // Add shore effect if enabled
    if (areShoreEffectsEnabled() && scene) {
        // Each collider gets its own shore effect
        islandEntry.shores = colliders.map(collider => {
            return createShoreEffect(island, collider, scene);
        });
    }

    return islandEntry;
}

/**
 * Creates the main mesh for the massive island, including the cave
 * @param {THREE.Group} island - The island group to add meshes to
 * @param {Function} random - Seeded random function
 */
function createMassiveIslandMesh(island, random) {
    // Create the main island body as a large, irregular toroid shape with an opening
    const outerRadius = BASE_RADIUS;
    const innerRadius = BASE_RADIUS * 0.3; // Smaller inner radius for longer cave (was 0.4)
    const caveWidth = BASE_RADIUS * 0.25; // Slightly narrower but taller cave entrance (was 0.3)


    // Dramatically increase base height for vertical emphasis
    const baseHeight = (50 + random() * 30) * VERTICAL_SCALE;

    // Create the base mesh using a custom geometry
    const baseGeometry = createMassiveIslandGeometry(outerRadius, innerRadius, baseHeight, caveWidth, random);

    // Create a rocky texture for the main body
    const baseColor = new THREE.Color().setHSL(0.05 + random() * 0.05, 0.4, 0.3 + random() * 0.2);
    const baseTexture = createRockTexture(baseColor, 0.8);

    const baseMaterial = new THREE.MeshPhongMaterial({
        color: baseColor,
        map: baseTexture,
        bumpMap: baseTexture,
        bumpScale: 5,
        shininess: 5
    });

    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    island.add(baseMesh);

    // Add a shore/beach layer around the outer rim and cave entrance
    createShoreLayer(island, outerRadius, innerRadius, caveWidth, random);

    // Add an underwater base that extends deeper
    createUnderwaterBase(island, outerRadius, innerRadius, caveWidth, random);
}

/**
 * Creates the geometry for the massive island with a cave opening
 * @param {number} outerRadius - Outer radius of the island
 * @param {number} innerRadius - Inner radius (cave area)
 * @param {number} height - Height of the island
 * @param {number} caveWidth - Width of the cave entrance
 * @param {Function} random - Seeded random function
 * @returns {THREE.BufferGeometry} The island geometry
 */
function createMassiveIslandGeometry(outerRadius, innerRadius, height, caveWidth, random) {
    // Increase segment count for even smoother appearance
    const segments = 256; // Even higher resolution for ultra-smooth edges
    const radialSegments = 64; // More segments for smoother radial transitions
    const vertexCount = segments * radialSegments;

    // Create arrays for position, normal, and uv data
    const positions = new Float32Array(vertexCount * 3 * 2); // *2 for top and bottom faces
    const normals = new Float32Array(vertexCount * 3 * 2);
    const uvs = new Float32Array(vertexCount * 2 * 2);

    // Define the cave orientation (random angle)
    const caveAngle = random() * Math.PI * 2;
    const caveDirection = new THREE.Vector2(Math.cos(caveAngle), Math.sin(caveAngle));

    // Create height map for terrain variation
    const heightMap = generateHeightMap(segments, random);

    // Generate vertices
    let vertexIndex = 0;
    let uvIndex = 0;

    // Create top and bottom vertices
    for (let topBottom = 0; topBottom < 2; topBottom++) {
        const isTop = topBottom === 0;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const angleVector = new THREE.Vector2(Math.cos(angle), Math.sin(angle));

            // Determine cave influence
            // Calculate angular difference between current angle and cave angle
            let angleDiff = Math.abs(normalizeAngle(angle - caveAngle));
            angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

            // Modified cave influence calculation for even smoother transitions
            // Use a smoother transition function with wider transition area
            const caveTransitionSharpness = 2.0; // Lower = smoother transition (was 3.0)
            const caveInfluence = 1.0 / (1.0 + Math.exp(caveTransitionSharpness * (angleDiff / (caveWidth / outerRadius) - 0.5)));

            for (let j = 0; j < radialSegments; j++) {
                const radiusRatio = j / (radialSegments - 1);
                // Calculate current radius - interpolate between outer and inner
                let currentRadius = outerRadius * (1 - radiusRatio) + innerRadius * radiusRatio;

                // Enhanced cave entrance shaping - even smoother transitions
                if (caveInfluence > 0.01) { // Use a lower threshold for wider smooth area
                    // Use smoother expansion function
                    const expansion = Math.pow(caveInfluence, 1.2) * innerRadius * 0.6;

                    // Apply expansion with a bias toward the inner part of the toroid
                    const expansionBias = Math.pow(radiusRatio, 1.8) * (1.0 - radiusRatio) * 8.0;
                    currentRadius += expansion * expansionBias;

                    // Reduce irregularity near cave even more for smoother appearance
                    const caveSmoothing = Math.min(1.0, caveInfluence * 4.0);
                    const irregularityReduction = 1.0 - caveSmoothing * 0.9; // More reduction (was 0.8)

                    // Only apply irregular shape away from the cave
                    if (irregularityReduction > 0.3) {
                        const irregularity = 0.15 * (1 - radiusRatio) * outerRadius * irregularityReduction;
                        const noise = (random() - 0.5) * 2 * irregularity;
                        currentRadius += noise;
                    }
                } else {
                    // Regular irregularity away from cave
                    const irregularity = 0.15 * (1 - radiusRatio) * outerRadius;
                    const noise = (random() - 0.5) * 2 * irregularity;
                    currentRadius += noise;
                }

                // Apply height variation based on height map and position
                let currentHeight = height;

                // Make cave entrance even taller and smoother
                if (caveInfluence > 0.1) {
                    // Increase height near cave entrance to create a dramatic tall entrance
                    const distanceFromInner = 1.0 - radiusRatio;

                    // Cave arch effect - smoother curve
                    const archEffect = Math.sin(Math.PI * Math.pow(caveInfluence, 0.8)) * Math.pow(distanceFromInner, 0.6);
                    currentHeight *= (1.0 + archEffect * 0.9);

                    // But make sure the actual entrance has clearance (reduce height very close to entrance)
                    if (caveInfluence > 0.8 && radiusRatio > 0.7) {
                        currentHeight *= 0.5; // Lower the ceiling right at the entrance
                    }
                }

                // Add some height variation based on the height map
                const heightIndex = Math.floor(i / segments * heightMap.length);

                // Reduce height map influence near cave for smoother walls
                const heightMapInfluence = caveInfluence > 0.3 ? 0.1 : 0.6; // Even less influence (was 0.2)
                currentHeight *= (0.7 + heightMap[heightIndex] * heightMapInfluence);

                // For bottom vertices, if we're in the cave area (high cave influence and inner part),
                // don't generate a bottom - push it below the water level
                let finalHeight;
                if (!isTop) {
                    // Check if we're in the cave area - if so, push the bottom below the water
                    const inCaveArea = caveInfluence > 0.5 && radiusRatio > 0.5;
                    finalHeight = inCaveArea ? -30 : 0; // Push bottom vertices down below water
                } else {
                    finalHeight = currentHeight;
                }

                // Calculate position
                const x = angleVector.x * currentRadius;
                const z = angleVector.y * currentRadius;
                const y = finalHeight;

                // Set position
                const posIndex = vertexIndex * 3;
                positions[posIndex] = x;
                positions[posIndex + 1] = y;
                positions[posIndex + 2] = z;

                // Set normal (smoother normals for cave area)
                const normIndex = vertexIndex * 3;
                const normalX = angleVector.x;
                const normalZ = angleVector.y;

                // Adjust normals to be more vertical near cave walls for smoother appearance
                let normalYBias = 0;
                if (caveInfluence > 0.3 && isTop) {
                    normalYBias = caveInfluence * 0.8; // Add upward component to normals inside cave (was 0.7)
                }

                normals[normIndex] = isTop ? normalX * (1 - normalYBias) : 0;
                normals[normIndex + 1] = isTop ? 0.5 + normalYBias : -1;
                normals[normIndex + 2] = isTop ? normalZ * (1 - normalYBias) : 0;

                // Set UV coordinates
                uvs[uvIndex] = i / segments;
                uvs[uvIndex + 1] = j / radialSegments;

                vertexIndex++;
                uvIndex += 2;
            }
        }
    }

    // Create indices for the faces - keep the same as before
    const indices = [];

    const getIndex = (i, j, isTop) => {
        const segment = i % segments;
        return (isTop ? 0 : segments * radialSegments) + segment * radialSegments + j;
    };

    // Create top and bottom faces
    for (let topBottom = 0; topBottom < 2; topBottom++) {
        const isTop = topBottom === 0;

        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < radialSegments - 1; j++) {
                const a = getIndex(i, j, isTop);
                const b = getIndex(i + 1, j, isTop);
                const c = getIndex(i, j + 1, isTop);
                const d = getIndex(i + 1, j + 1, isTop);

                if (isTop) {
                    indices.push(a, b, c);
                    indices.push(c, b, d);
                } else {
                    indices.push(a, c, b);
                    indices.push(c, d, b);
                }
            }
        }
    }

    // Create wall faces connecting top and bottom
    for (let i = 0; i < segments; i++) {
        const a = getIndex(i, 0, true);
        const b = getIndex(i + 1, 0, true);
        const c = getIndex(i, 0, false);
        const d = getIndex(i + 1, 0, false);

        indices.push(a, c, b);
        indices.push(b, c, d);
    }

    // Inside wall faces
    for (let i = 0; i < segments; i++) {
        const a = getIndex(i, radialSegments - 1, true);
        const b = getIndex(i + 1, radialSegments - 1, true);
        const c = getIndex(i, radialSegments - 1, false);
        const d = getIndex(i + 1, radialSegments - 1, false);

        indices.push(a, b, c);
        indices.push(b, d, c);
    }

    // Create the geometry and set attributes
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // Compute vertex normals properly for smoother appearance
    geometry.computeVertexNormals();

    return geometry;
}

/**
 * Normalizes an angle to be between 0 and 2*PI
 * @param {number} angle - The angle to normalize
 * @returns {number} - The normalized angle
 */
function normalizeAngle(angle) {
    return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

/**
 * Generates a height map for the island
 * @param {number} resolution - The number of points in the height map
 * @param {Function} random - Seeded random function
 * @returns {Array} - The height map array
 */
function generateHeightMap(resolution, random) {
    const heightMap = [];

    // Generate initial random points
    const controlPoints = [];
    const numControlPoints = 12; // Number of control points

    for (let i = 0; i < numControlPoints; i++) {
        controlPoints.push({
            position: i / numControlPoints,
            height: 0.7 + random() * 0.6 // Height between 0.7 and 1.3
        });
    }

    // Add wrap-around points for smooth interpolation
    controlPoints.push({
        position: 1,
        height: controlPoints[0].height
    });

    // Interpolate between control points to get the height map
    for (let i = 0; i < resolution; i++) {
        const position = i / resolution;

        // Find the two control points to interpolate between
        let j = 0;
        while (j < controlPoints.length - 1 && controlPoints[j + 1].position < position) {
            j++;
        }

        const p1 = controlPoints[j];
        const p2 = controlPoints[j + 1];

        // Linear interpolation between control points
        const t = (position - p1.position) / (p2.position - p1.position);
        const height = p1.height * (1 - t) + p2.height * t;

        heightMap.push(height);
    }

    return heightMap;
}

/**
 * Creates a shore/beach layer around the island
 * @param {THREE.Group} island - The island group to add the shore to
 * @param {number} outerRadius - Outer radius of the island
 * @param {number} innerRadius - Inner radius (cave area)
 * @param {number} caveWidth - Width of the cave entrance
 * @param {Function} random - Seeded random function
 */
function createShoreLayer(island, outerRadius, innerRadius, caveWidth, random) {
    // Create a shore that follows the island's shape but slightly larger
    const shoreOuterRadius = outerRadius + 20;
    const shoreInnerRadius = innerRadius - 20;
    const shoreHeight = 5;

    const shoreGeometry = createMassiveIslandGeometry(shoreOuterRadius, shoreInnerRadius, shoreHeight, caveWidth * 1.1, random);

    // Create a sand texture for the shore
    const sandColor = new THREE.Color().setHSL(0.12 + random() * 0.05, 0.8, 0.7);
    const sandTexture = createSandTexture(sandColor, 0.7);

    const shoreMaterial = new THREE.MeshPhongMaterial({
        color: sandColor,
        map: sandTexture,
        bumpMap: sandTexture,
        bumpScale: 1,
        shininess: 2
    });

    const shore = new THREE.Mesh(shoreGeometry, shoreMaterial);
    shore.position.y = -2; // Slightly below the main island
    island.add(shore);
}

/**
 * Creates an underwater base that extends below the water line
 * @param {THREE.Group} island - The island group to add the base to
 * @param {number} outerRadius - Outer radius of the island
 * @param {number} innerRadius - Inner radius (cave area)
 * @param {number} caveWidth - Width of the cave entrance
 * @param {Function} random - Seeded random function
 */
function createUnderwaterBase(island, outerRadius, innerRadius, caveWidth, random) {
    const baseOuterRadius = outerRadius * 1.1;
    const baseInnerRadius = innerRadius * 0.9;
    const baseHeight = 30;

    const baseGeometry = createMassiveIslandGeometry(baseOuterRadius, baseInnerRadius, baseHeight, caveWidth * 1.2, random);

    // Create a darker rock texture for the underwater base
    const baseColor = new THREE.Color().setHSL(0.05 + random() * 0.05, 0.3, 0.2);
    const baseTexture = createRockTexture(baseColor, 0.6);

    const baseMaterial = new THREE.MeshPhongMaterial({
        color: baseColor,
        map: baseTexture,
        bumpMap: baseTexture,
        bumpScale: 3,
        shininess: 10
    });

    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -baseHeight; // Position it below the water
    island.add(base);
}

/**
 * Creates colliders for the massive island
 * @param {THREE.Group} island - The island group
 * @param {string} islandId - The island ID
 * @param {Function} random - Seeded random function
 * @returns {Array} - Array of collider objects
 */
function createMassiveIslandColliders(island, islandId, random) {
    const colliders = [];

    // Define the cave orientation
    const caveAngle = random() * Math.PI * 2;
    const caveVector = new THREE.Vector3(Math.cos(caveAngle), 0, Math.sin(caveAngle));

    // Create the main toroid collider (approximated with multiple spheres)
    const numColliders = 24; // More colliders for better coverage (was 16)
    const radius = BASE_RADIUS * 0.5;
    const colliderRadius = radius * 0.3;

    // Create colliders at multiple height levels for better vertical coverage
    const heightLevels = 3; // Create colliders at different heights

    for (let h = 0; h < heightLevels; h++) {
        const heightOffset = h * VERTICAL_SCALE * 70; // Vertical spacing between collider rings

        for (let i = 0; i < numColliders; i++) {
            const angle = (i / numColliders) * Math.PI * 2;
            const angleVector = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

            // Skip colliders near the cave entrance
            const angleDiff = Math.abs(normalizeAngle(angle - caveAngle));
            const minAngleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

            // Create a wider gap for the cave entrance
            if (minAngleDiff < 0.6) {
                continue; // Skip this collider to create a gap for the cave
            }

            // Calculate collider position
            const circleRadius = BASE_RADIUS * 0.6;
            const x = angleVector.x * circleRadius;
            const z = angleVector.z * circleRadius;

            // Create collider object
            const collider = {
                center: new THREE.Vector3(
                    island.position.x + x,
                    island.position.y + 20 + heightOffset, // Positioned at different heights
                    island.position.z + z
                ),
                radius: colliderRadius,
                id: `${islandId}_collider_${h}_${i}`,
                parentId: islandId
            };

            colliders.push(collider);
        }
    }

    // Add additional colliders for the tall areas - these make the peaks
    for (let i = 0; i < 12; i++) { // More peak colliders
        const angle = (i / 12) * Math.PI * 2;
        const angleVector = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

        // Skip areas near the cave
        const angleDiff = Math.abs(normalizeAngle(angle - caveAngle));
        const minAngleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

        if (minAngleDiff < 0.5) {
            continue;
        }

        const circleRadius = BASE_RADIUS * 0.7;
        const x = angleVector.x * circleRadius;
        const z = angleVector.z * circleRadius;

        // Create taller collider - much higher up now
        const collider = {
            center: new THREE.Vector3(
                island.position.x + x,
                island.position.y + VERTICAL_SCALE * 60, // Much higher
                island.position.z + z
            ),
            radius: colliderRadius * 0.7,
            id: `${islandId}_tall_collider_${i}`,
            parentId: islandId
        };

        colliders.push(collider);
    }

    // Add cave ceiling colliders to prevent flying through the top
    const caveInnerRadius = BASE_RADIUS * 0.3;
    const numCeilingColliders = 8;

    for (let i = 0; i < numCeilingColliders; i++) {
        const radius = caveInnerRadius * (0.3 + 0.6 * (i / numCeilingColliders));
        const x = caveVector.x * radius;
        const z = caveVector.z * radius;

        const ceilingCollider = {
            center: new THREE.Vector3(
                island.position.x + x,
                island.position.y + VERTICAL_SCALE * 40, // Position ceiling colliders high up
                island.position.z + z
            ),
            radius: colliderRadius * 0.8,
            id: `${islandId}_ceiling_${i}`,
            parentId: islandId
        };

        colliders.push(ceilingCollider);
    }

    return colliders;
}

/**
 * Adds detailed rock formations to the island
 * @param {THREE.Group} island - The island group
 * @param {Function} random - Seeded random function
 */
function addRockFormations(island, random) {
    const numFormations = 8 + Math.floor(random() * 5);

    for (let i = 0; i < numFormations; i++) {
        // Define position
        const angle = random() * Math.PI * 2;
        const radius = BASE_RADIUS * 0.6 + (random() * BASE_RADIUS * 0.3);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Create a group for this formation
        const formation = new THREE.Group();
        formation.position.set(x, 5, z);

        // Create 3-7 rocks per formation
        const numRocks = 3 + Math.floor(random() * 5);

        // Create a super tall central spire
        const centerRockSize = 25 + random() * 40;
        const centerRockHeight = (100 + random() * 200) * VERTICAL_SCALE * 0.3;

        const centerRock = createRock(centerRockSize, centerRockHeight, random);
        centerRock.position.y = 0;
        formation.add(centerRock);

        // Add surrounding rocks
        for (let j = 0; j < numRocks; j++) {
            const rockSize = 15 + random() * 30;
            const rockHeight = (30 + random() * 80) * VERTICAL_SCALE * 0.2;

            // Position each rock
            const rockAngle = random() * Math.PI * 2;
            const rockDistance = (20 + random() * 40);
            const rockX = Math.cos(rockAngle) * rockDistance;
            const rockZ = Math.sin(rockAngle) * rockDistance;

            const rock = createRock(rockSize, rockHeight, random);
            rock.position.set(rockX, 0, rockZ);

            // Random rotation
            rock.rotation.y = random() * Math.PI * 2;

            formation.add(rock);
        }

        island.add(formation);
    }
}

/**
 * Creates a single rock
 * @param {number} size - Base size of the rock
 * @param {number} height - Height of the rock
 * @param {Function} random - Seeded random function
 * @returns {THREE.Mesh} - The rock mesh
 */
function createRock(size, height, random) {
    // Create a geometric shape for the rock - use more segments for smoother appearance
    const segmentsRadial = Math.floor(8 + random() * 6);
    const segmentsHeight = Math.floor(8 + random() * 6);

    // Use a cone shape with irregular vertices, but make it more vertical
    const geometry = new THREE.CylinderGeometry(
        size * 0.1, // Much smaller top for more vertical appearance
        size,
        height,
        segmentsRadial,
        segmentsHeight
    );

    // Randomize vertices to create a jagged rock, but with smoother variation
    const positions = geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
        // Don't modify the top vertex or bottom vertices too much
        const vertexHeight = positions[i + 1];
        const heightRatio = vertexHeight / height;

        // Reduce irregularity toward the top for more tapered appearance
        const topReduction = Math.pow(1 - heightRatio, 2);
        const irregularity = 0.2 * topReduction;

        // Add noise to each vertex, but less on the y-axis to preserve height
        positions[i] += (random() - 0.5) * size * irregularity; // x
        positions[i + 1] += (random() - 0.5) * height * (irregularity * 0.3); // y (less variation)
        positions[i + 2] += (random() - 0.5) * size * irregularity; // z
    }

    // Update geometry
    geometry.computeVertexNormals();

    // Create a material for the rock
    const colorValue = 0.1 + random() * 0.2;
    const rockColor = new THREE.Color(colorValue, colorValue, colorValue);
    const rockTexture = createRockTexture(rockColor, 0.9);

    const material = new THREE.MeshPhongMaterial({
        color: rockColor,
        map: rockTexture,
        bumpMap: rockTexture,
        bumpScale: 2,
        shininess: 5
    });

    return new THREE.Mesh(geometry, material);
}

/**
 * Adds glowing crystals to the cave area
 * @param {THREE.Group} island - The island group
 * @param {THREE.Vector2} caveDirection - Direction vector of the cave
 * @param {Function} random - Seeded random function
 */
function addCaveCrystals(island, caveDirection, random) {
    const numCrystals = 15 + Math.floor(random() * 15);

    // Choose a color theme for the crystals
    const crystalThemes = [
        { color: 0x00ffff, intensity: 1.0 }, // Cyan
        { color: 0x8a2be2, intensity: 0.8 }, // Blue/purple
        { color: 0xff1493, intensity: 0.8 }, // Pink
        { color: 0x32cd32, intensity: 0.9 }  // Green
    ];

    const theme = crystalThemes[Math.floor(random() * crystalThemes.length)];

    for (let i = 0; i < numCrystals; i++) {
        // Position crystals inside the cave
        const radius = BASE_RADIUS * 0.2 + (random() * BASE_RADIUS * 0.2);

        // Calculate angle to place crystals in the cave area
        const caveAngle = Math.atan2(caveDirection.y, caveDirection.x);
        const angle = caveAngle + (random() - 0.5) * Math.PI * 0.8;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Create the crystal cluster
        const crystalGroup = new THREE.Group();

        // Add 3-7 crystal formations per cluster
        const numFormations = 3 + Math.floor(random() * 5);

        for (let j = 0; j < numFormations; j++) {
            // Create crystal geometry
            const height = 8 + random() * 15;
            const radius = 1.5 + random() * 3;

            const crystalGeometry = new THREE.ConeGeometry(radius, height, 5 + Math.floor(random() * 3));

            // Create glowing material
            const intensity = 0.6 + random() * 0.4;
            const crystalColor = new THREE.Color(theme.color);

            const crystalMaterial = new THREE.MeshBasicMaterial({
                color: crystalColor,
                transparent: true,
                opacity: 0.8
            });

            const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);

            // Position and rotate each crystal in the cluster
            const offsetX = (random() - 0.5) * 12;
            const offsetY = (random() - 0.5) * 12;
            const offsetZ = (random() - 0.5) * 12;

            crystal.position.set(offsetX, offsetY, offsetZ);

            // Random rotation
            crystal.rotation.x = (random() - 0.5) * Math.PI * 0.5;
            crystal.rotation.y = random() * Math.PI * 2;
            crystal.rotation.z = (random() - 0.5) * Math.PI * 0.5;

            crystalGroup.add(crystal);
        }

        // Position on ceiling, wall, or floor
        const placement = Math.floor(random() * 3); // 0: floor, 1: wall, 2: ceiling
        let yPos;

        if (placement === 0) {
            yPos = 1 + random() * 8; // Floor
        } else if (placement === 1) {
            yPos = 10 + random() * VERTICAL_SCALE * 3; // Wall
        } else {
            yPos = VERTICAL_SCALE * 35 + random() * 10; // Ceiling
        }

        crystalGroup.position.set(x, yPos, z);

        // Add a point light at the crystal location
        const pointLight = new THREE.PointLight(theme.color, theme.intensity * 1.2, 150);
        pointLight.position.set(0, 0, 0);
        crystalGroup.add(pointLight);

        island.add(crystalGroup);
    }
}

/**
 * Adds details to the cave area
 * @param {THREE.Group} island - The island group
 * @param {Function} random - Seeded random function
 */
function addCaveDetails(island, random) {
    // Define the cave orientation
    const caveAngle = random() * Math.PI * 2;
    const caveDirection = new THREE.Vector2(Math.cos(caveAngle), Math.sin(caveAngle));

    // Add stalactites from ceiling only - no stalagmites from floor
    const numFormations = 25 + Math.floor(random() * 20);

    for (let i = 0; i < numFormations; i++) {
        // Position near the cave entrance and inside
        const radius = BASE_RADIUS * 0.3 + (random() * BASE_RADIUS * 0.3);

        // Calculate angle to bias formations toward the cave area
        let angle;
        if (random() < 0.7) {
            // 70% of formations concentrated around cave entrance
            angle = caveAngle + (random() - 0.5) * Math.PI * 0.5;
        } else {
            // 30% randomly distributed
            angle = random() * Math.PI * 2;
        }

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Only create stalactites from ceiling, no stalagmites
        const isStalactite = true;

        // Create formation - make them larger and smoother
        const formationSize = 4 + random() * 12;
        const formationHeight = (15 + random() * 40) * 1.5;

        const formation = createRock(formationSize, formationHeight, random);

        // Position and rotate the formation - adjust height for taller cave
        const yPos = VERTICAL_SCALE * 40;
        formation.position.set(x, yPos, z);
        formation.rotation.x = Math.PI; // Flip stalactites
        formation.rotation.y = random() * Math.PI * 2;

        island.add(formation);
    }

    // Add some glowing crystals in the cave for visual interest
    addCaveCrystals(island, caveDirection, random);

    // Add some hanging features from the ceiling - no pillars connecting to floor
    const numHangingFeatures = 8 + Math.floor(random() * 5);

    for (let i = 0; i < numHangingFeatures; i++) {
        // Position features inside the cave
        const radius = BASE_RADIUS * 0.2 + (random() * BASE_RADIUS * 0.2);

        // Calculate angle to place features in the cave area
        const angle = caveAngle + (random() - 0.5) * Math.PI * 0.6;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Create a hanging formation
        const featureRadius = 3 + random() * 8;
        const featureHeight = (20 + random() * 60);

        const featureGeometry = new THREE.ConeGeometry(
            featureRadius,
            featureHeight,
            16,
            8
        );

        // Add some noise to the feature vertices for a more natural look
        const positions = featureGeometry.attributes.position.array;

        for (let j = 0; j < positions.length; j += 3) {
            // Don't modify the top vertex too much
            const vertexHeight = positions[j + 1];
            const heightRatio = vertexHeight / featureHeight;

            // More irregularity in the middle, smoother at top
            const irregularity = 0.1 * (1 - Math.abs(heightRatio - 0.5) * 2);

            // Add noise to each vertex
            positions[j] += (random() - 0.5) * featureRadius * irregularity; // x
            positions[j + 2] += (random() - 0.5) * featureRadius * irregularity; // z
        }

        featureGeometry.computeVertexNormals();

        // Create a material for the feature
        const colorValue = 0.15 + random() * 0.15;
        const featureColor = new THREE.Color(colorValue, colorValue, colorValue);
        const featureTexture = createRockTexture(featureColor, 0.6);

        const featureMaterial = new THREE.MeshPhongMaterial({
            color: featureColor,
            map: featureTexture,
            bumpMap: featureTexture,
            bumpScale: 1.5,
            shininess: 3
        });

        const feature = new THREE.Mesh(featureGeometry, featureMaterial);

        // Position at ceiling and flip
        feature.position.set(x, VERTICAL_SCALE * 40, z);
        feature.rotation.x = Math.PI; // Hang from ceiling

        // Random slight tilt
        feature.rotation.z = (random() - 0.5) * 0.2;

        island.add(feature);
    }
}

/**
 * Adds vegetation to the island - but not in the cave area
 * @param {THREE.Group} island - The island group
 * @param {Function} random - Seeded random function
 */
function addLandVegetation(island, random) {
    // Define the cave orientation to avoid placing vegetation in the cave
    const caveAngle = random() * Math.PI * 2;

    // Add large trees and plants
    const numLargePlants = 30 + Math.floor(random() * 20);

    for (let i = 0; i < numLargePlants; i++) {
        // Position vegetation around the island but avoid the cave entrance
        const radius = BASE_RADIUS * 0.4 + (random() * BASE_RADIUS * 0.5);

        let angle;
        // Avoid placing vegetation near the cave entrance with a wider exclusion zone
        do {
            angle = random() * Math.PI * 2;
            const angleDiff = Math.abs(normalizeAngle(angle - caveAngle));
            const minAngleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

            // Make the exclusion zone larger to ensure no trees near or in the cave
            if (minAngleDiff > 0.7) { // Wider exclusion (was 0.5)
                break;
            }
        } while (true);

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Determine vegetation type
        const vegetationType = Math.floor(random() * 3); // 0: tree, 1: bush, 2: large plant

        if (vegetationType === 0) {
            // Create a tree
            createTree(island, x, z, random);
        } else if (vegetationType === 1) {
            // Create a bush
            createBush(island, x, z, random);
        } else {
            // Create a large plant/palm
            createPalmTree(island, x, z, random);
        }
    }

    // Add smaller vegetation and ground cover - also avoiding cave area
    const numGroundCover = 100 + Math.floor(random() * 50);

    for (let i = 0; i < numGroundCover; i++) {
        const radius = BASE_RADIUS * 0.4 + (random() * BASE_RADIUS * 0.5);
        const angle = random() * Math.PI * 2;

        // Skip if too close to cave entrance - wider exclusion
        const angleDiff = Math.abs(normalizeAngle(angle - caveAngle));
        const minAngleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        if (minAngleDiff < 0.7) { // Wider exclusion (was 0.5)
            continue;
        }

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Create small ground cover
        createGroundCover(island, x, z, random);
    }
}

/**
 * Creates a tree for the island
 * @param {THREE.Group} island - The island group
 * @param {number} x - X position relative to island center
 * @param {number} z - Z position relative to island center
 * @param {Function} random - Seeded random function
 */
function createTree(island, x, z, random) {
    // Tree group
    const tree = new THREE.Group();

    // Tree parameters
    const height = 30 + random() * 40;
    const trunkRadius = 3 + random() * 2;

    // Create trunk
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, height * 0.7, 8);
    const trunkColor = new THREE.Color().setHSL(0.07 + random() * 0.05, 0.4, 0.3);
    const trunkMaterial = new THREE.MeshPhongMaterial({ color: trunkColor });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = height * 0.35;
    tree.add(trunk);

    // Create foliage (several spheres clustered together)
    const foliageRadius = 10 + random() * 15;
    const foliageColor = new THREE.Color().setHSL(0.25 + random() * 0.1, 0.8, 0.3 + random() * 0.2);
    const foliageMaterial = new THREE.MeshPhongMaterial({ color: foliageColor });

    // Main foliage cluster
    const mainFoliage = new THREE.Mesh(
        new THREE.SphereGeometry(foliageRadius, 8, 8),
        foliageMaterial
    );
    mainFoliage.position.y = height * 0.7 + foliageRadius * 0.5;
    tree.add(mainFoliage);

    // Add 3-5 additional foliage clusters
    const numClusters = 3 + Math.floor(random() * 3);

    for (let i = 0; i < numClusters; i++) {
        const clusterRadius = foliageRadius * (0.6 + random() * 0.4);

        // Position the additional clusters around the main foliage
        const clusterAngle = random() * Math.PI * 2;
        const clusterDistance = foliageRadius * 0.5;
        const clusterX = Math.cos(clusterAngle) * clusterDistance;
        const clusterZ = Math.sin(clusterAngle) * clusterDistance;
        const clusterY = height * 0.7 + (random() - 0.3) * foliageRadius;

        const clusterFoliage = new THREE.Mesh(
            new THREE.SphereGeometry(clusterRadius, 8, 8),
            foliageMaterial
        );
        clusterFoliage.position.set(clusterX, clusterY, clusterZ);
        tree.add(clusterFoliage);
    }

    // Position the tree at the specified location
    tree.position.set(x, 5, z); // Slightly above ground

    // Add some random rotation
    tree.rotation.y = random() * Math.PI * 2;

    island.add(tree);
}

/**
 * Creates a bush for the island
 * @param {THREE.Group} island - The island group
 * @param {number} x - X position relative to island center
 * @param {number} z - Z position relative to island center
 * @param {Function} random - Seeded random function
 */
function createBush(island, x, z, random) {
    // Bush group
    const bush = new THREE.Group();

    // Bush parameters
    const size = 8 + random() * 12;

    // Bush consists of several overlapping spheres
    const bushColor = new THREE.Color().setHSL(0.25 + random() * 0.15, 0.7, 0.3 + random() * 0.2);
    const bushMaterial = new THREE.MeshPhongMaterial({ color: bushColor });

    // Create 3-6 overlapping spheres
    const numSpheres = 3 + Math.floor(random() * 4);

    for (let i = 0; i < numSpheres; i++) {
        const sphereRadius = size * (0.5 + random() * 0.5);

        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(sphereRadius, 8, 8),
            bushMaterial
        );

        // Position each sphere slightly offset
        const offsetX = (random() - 0.5) * size * 0.8;
        const offsetY = (random() * 0.5) * size * 0.5; // Mostly towards the top
        const offsetZ = (random() - 0.5) * size * 0.8;

        sphere.position.set(offsetX, offsetY, offsetZ);
        bush.add(sphere);
    }

    // Position the bush
    bush.position.set(x, 4, z); // Slightly above ground
    island.add(bush);
}

/**
 * Creates a palm-like tree for the island
 * @param {THREE.Group} island - The island group
 * @param {number} x - X position relative to island center
 * @param {number} z - Z position relative to island center
 * @param {Function} random - Seeded random function
 */
function createPalmTree(island, x, z, random) {
    // Palm tree group
    const palm = new THREE.Group();

    // Palm parameters
    const height = 25 + random() * 20;
    const trunkRadius = 2 + random() * 1.5;

    // Create curved trunk
    const trunkSegments = 8;
    const trunkCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3((random() - 0.5) * 10, height * 0.33, (random() - 0.5) * 10),
        new THREE.Vector3((random() - 0.5) * 15, height * 0.66, (random() - 0.5) * 15),
        new THREE.Vector3((random() - 0.5) * 5, height, (random() - 0.5) * 5)
    );

    const trunkPoints = trunkCurve.getPoints(trunkSegments);
    const trunkGeometry = new THREE.BufferGeometry().setFromPoints(trunkPoints);

    // Create tube geometry along the curve
    const tubeGeometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(trunkPoints),
        trunkSegments,
        trunkRadius,
        8,
        false
    );

    const trunkColor = new THREE.Color().setHSL(0.07 + random() * 0.05, 0.4, 0.3);
    const trunkMaterial = new THREE.MeshPhongMaterial({ color: trunkColor });
    const trunk = new THREE.Mesh(tubeGeometry, trunkMaterial);
    palm.add(trunk);

    // Create palm fronds
    const frondCount = 5 + Math.floor(random() * 6);
    const frondColor = new THREE.Color().setHSL(0.25 + random() * 0.15, 0.8, 0.3 + random() * 0.2);
    const frondMaterial = new THREE.MeshPhongMaterial({ color: frondColor, side: THREE.DoubleSide });

    for (let i = 0; i < frondCount; i++) {
        // Create frond geometry
        const frondLength = 15 + random() * 10;
        const frondWidth = 3 + random() * 2;

        // Create a custom frond shape using a plane with custom vertices
        const frondGeometry = new THREE.PlaneGeometry(frondLength, frondWidth, 6, 2);
        const positions = frondGeometry.attributes.position.array;

        // Taper the frond and add some curve
        for (let j = 0; j < positions.length; j += 3) {
            const xPos = positions[j]; // Along the length

            // Distance from center line (0 to frondWidth/2)
            const zPos = Math.abs(positions[j + 2]);

            // Calculate a curve factor that's higher at the tip
            const curveFactor = (xPos / frondLength) * 4;

            // Apply downward curve based on distance from base
            positions[j + 1] -= Math.pow(xPos / frondLength, 2) * frondLength * 0.3;

            // Taper width from base to tip
            positions[j + 2] *= (1 - (xPos / frondLength) * 0.7);
        }

        frondGeometry.computeVertexNormals();

        const frond = new THREE.Mesh(frondGeometry, frondMaterial);

        // Position and rotate fronds around the top of the trunk
        const angle = (i / frondCount) * Math.PI * 2;
        frond.rotation.z = -Math.PI / 6; // Angle fronds slightly downward
        frond.rotation.y = angle;

        // Position at the top of the trunk
        frond.position.set(
            trunkPoints[trunkSegments].x,
            trunkPoints[trunkSegments].y,
            trunkPoints[trunkSegments].z
        );

        palm.add(frond);
    }

    // Position the palm tree
    palm.position.set(x, 2, z);
    island.add(palm);
}

/**
 * Creates small ground cover vegetation
 * @param {THREE.Group} island - The island group
 * @param {number} x - X position relative to island center
 * @param {number} z - Z position relative to island center
 * @param {Function} random - Seeded random function
 */
function createGroundCover(island, x, z, random) {
    // Create a small patch of grass or flowers
    const patch = new THREE.Group();

    // Random color variations for ground cover
    const colorTypes = [
        { h: 0.25 + random() * 0.15, s: 0.7, l: 0.3 + random() * 0.2 }, // Green (grass)
        { h: 0.1 + random() * 0.05, s: 0.8, l: 0.5 + random() * 0.2 },  // Yellow (flowers)
        { h: 0.95 + random() * 0.1, s: 0.8, l: 0.5 + random() * 0.2 },  // Red (flowers)
        { h: 0.6 + random() * 0.1, s: 0.7, l: 0.5 + random() * 0.2 }    // Purple (flowers)
    ];

    const colorType = colorTypes[Math.floor(random() * colorTypes.length)];
    const coverColor = new THREE.Color().setHSL(colorType.h, colorType.s, colorType.l);

    // Determine if this is grass-like or flower-like
    const isGrass = colorType.h > 0.2 && colorType.h < 0.4;

    if (isGrass) {
        // Create grass-like ground cover with multiple blades
        const numBlades = 5 + Math.floor(random() * 10);
        const grassMaterial = new THREE.MeshPhongMaterial({
            color: coverColor,
            side: THREE.DoubleSide
        });

        for (let i = 0; i < numBlades; i++) {
            const height = 1 + random() * 2;
            const width = 0.2 + random() * 0.3;

            // Create a simple blade of grass
            const bladeGeometry = new THREE.PlaneGeometry(width, height, 1, 3);
            const positions = bladeGeometry.attributes.position.array;

            // Curve the blade slightly
            for (let j = 0; j < positions.length; j += 3) {
                const yRatio = positions[j + 1] / height;
                positions[j] += Math.pow(yRatio, 2) * (random() - 0.5) * width;
            }

            bladeGeometry.computeVertexNormals();

            const blade = new THREE.Mesh(bladeGeometry, grassMaterial);

            // Position around center
            const angle = random() * Math.PI * 2;
            const distance = random() * 2;
            blade.position.set(
                Math.cos(angle) * distance,
                0,
                Math.sin(angle) * distance
            );

            // Random rotation
            blade.rotation.y = random() * Math.PI * 2;
            blade.rotation.x = (random() * 0.2) - 0.1; // Slight tilt

            patch.add(blade);
        }
    } else {
        // Create flower-like ground cover
        const flowerMaterial = new THREE.MeshPhongMaterial({ color: coverColor });
        const stemMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(0.25, 0.6, 0.3)
        });

        // Create 1-3 flowers
        const numFlowers = 1 + Math.floor(random() * 3);

        for (let i = 0; i < numFlowers; i++) {
            const stemHeight = 1 + random() * 2;
            const flowerSize = 0.3 + random() * 0.4;

            // Create stem
            const stemGeometry = new THREE.CylinderGeometry(0.05, 0.1, stemHeight, 4);
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            stem.position.y = stemHeight / 2;

            // Create flower head
            const flowerGeometry = new THREE.SphereGeometry(flowerSize, 8, 6);
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flower.position.y = stemHeight;

            // Group stem and flower
            const flowerGroup = new THREE.Group();
            flowerGroup.add(stem);
            flowerGroup.add(flower);

            // Position around center
            const angle = random() * Math.PI * 2;
            const distance = random() * 2;
            flowerGroup.position.set(
                Math.cos(angle) * distance,
                0,
                Math.sin(angle) * distance
            );

            // Slight random tilt
            flowerGroup.rotation.x = (random() * 0.2) - 0.1;
            flowerGroup.rotation.z = (random() * 0.2) - 0.1;

            patch.add(flowerGroup);
        }
    }

    // Position the ground cover patch
    patch.position.set(x, 2, z); // Slightly above ground to avoid z-fighting
    island.add(patch);
}

/**
 * Get massive island colliders for collision detection
 * @returns {Array} Array of collider objects
 */
export function getMassiveIslandColliders() {
    return massiveIslandColliders;
}

/**
 * Clear all massive islands from the scene
 * @param {THREE.Scene} scene - The scene to remove islands from
 */
export function clearMassiveIslands(scene) {
    massiveIslands.forEach((islandEntry) => {
        scene.remove(islandEntry.mesh);

        // Remove shores if they exist
        if (islandEntry.shores) {
            islandEntry.shores.forEach(shore => {
                removeShore(shore.id, scene);
            });
        }
    });

    massiveIslands.clear();
    massiveIslandColliders.length = 0;
}

/**
 * Update massive island shores
 * @param {number} deltaTime - Time since last update
 */
export function updateMassiveIslandShores(deltaTime) {
    if (areShoreEffectsEnabled()) {
        // The shores are already updated by the main updateShores function
        // This function is included for API consistency
    }
}

/**
 * Check if position collides with any massive island
 * @param {THREE.Vector3} position - Position to check
 * @param {number} extraRadius - Extra radius to add to collision check
 * @returns {boolean} Whether there is a collision
 */
export function checkMassiveIslandCollision(position, extraRadius = 2) {
    for (const collider of massiveIslandColliders) {
        const distance = position.distanceTo(collider.center);
        if (distance < collider.radius + extraRadius) {
            return true;
        }
    }
    return false;
}

/**
 * Find the nearest massive island to a position
 * @param {THREE.Vector3} position - Position to check from
 * @returns {object} Object with distance and name properties
 */
export function findNearestMassiveIsland(position) {
    let nearest = { distance: Infinity, name: "None" };

    massiveIslands.forEach((island, id) => {
        // Use the first collider as a reference point
        if (island.colliders && island.colliders.length > 0) {
            const collider = island.colliders[0];
            const distance = position.distanceTo(collider.center);

            if (distance < nearest.distance) {
                nearest = {
                    distance: distance,
                    name: `Massive Island ${id.substring(id.lastIndexOf('_') + 1)}`,
                    id: id
                };
            }
        }
    });

    return nearest;
}

/**
 * Sets visibility of a massive island
 * @param {string} islandId - ID of the island to set visibility for
 * @param {boolean} visible - Whether the island should be visible
 */
export function setMassiveIslandVisibility(islandId, visible) {
    const island = massiveIslands.get(islandId);
    if (island) {
        island.mesh.visible = visible;
        island.visible = visible;

        // Update shore visibility if shores exist
        if (island.shores) {
            island.shores.forEach(shore => {
                setShoreVisibility(shore.id, visible);
            });
        }
    }
}

/**
 * Utility function to create only one massive island for initial testing
 * @param {THREE.Scene} scene - The scene to add the island to
 * @param {number} x - X position for the island
 * @param {number} z - Z position for the island
 * @returns {object} The created island
 */
export function createSingleMassiveIsland(scene, x = 0, z = 0) {
    // Clear any existing massive islands first
    clearMassiveIslands(scene);

    // Create a fixed seed for consistent generation
    const seed = 12345;

    // Create and return a single massive island
    return createMassiveIsland(x, z, seed, scene);
}

/**
 * Creates and caches a rock texture with imperfections
 * @param {THREE.Color} color - Base color for the texture
 * @param {number} roughness - Roughness factor (0-1)
 * @returns {THREE.Texture} - The created texture
 */
function createRockTexture(color, roughness) {
    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = `#${color.getHexString()}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add noise/imperfections
    for (let i = 0; i < 12000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * 3;

        // Random darker or lighter spots
        const shade = Math.random() > 0.5 ? 0 : 255;
        ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.05 + Math.random() * roughness * 0.15})`;
        ctx.fillRect(x, y, size, size);
    }

    // Add some cracks/lines
    ctx.strokeStyle = `rgba(0, 0, 0, ${roughness * 0.3})`;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.lineWidth = 0.5 + Math.random() * 1.5;

        // Random start point
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height;

        ctx.moveTo(startX, startY);

        // Create jaggy line
        let x = startX;
        let y = startY;
        const segments = 3 + Math.floor(Math.random() * 5);

        for (let j = 0; j < segments; j++) {
            x += (Math.random() - 0.5) * 80;
            y += (Math.random() - 0.5) * 80;
            ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4); // Larger repeat for massive islands

    return texture;
}

/**
 * Creates a sand texture with grainy appearance
 * @param {THREE.Color} baseColor - Base color for the sand
 * @param {number} graininess - Amount of grain effect (0-1)
 * @returns {THREE.Texture} - The created texture
 */
function createSandTexture(baseColor, graininess = 0.5) {
    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base color (warm sand)
    const sandColor = baseColor.clone();
    ctx.fillStyle = `#${sandColor.getHexString()}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create a lighter variant for contrast
    const lighterColor = sandColor.clone().multiplyScalar(1.1);

    // Add a subtle noise pattern that looks like sand
    const dotCount = Math.floor(15000 * graininess);
    for (let i = 0; i < dotCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * 2;

        // Simple dots in varying shades for a sand look
        if (Math.random() > 0.7) {
            // Darker dots (30% of dots)
            const dotColor = sandColor.clone().multiplyScalar(0.9);
            ctx.fillStyle = `#${dotColor.getHexString()}`;
        } else {
            // Lighter dots (70% of dots)
            ctx.fillStyle = `#${lighterColor.getHexString()}`;
        }

        ctx.fillRect(x, y, size, size);
    }

    // Add very subtle directional "brushed" lines for some texture variation
    ctx.strokeStyle = `rgba(0, 0, 0, 0.03)`;
    ctx.lineWidth = 1;

    // Horizontal gentle waves suggesting sand
    for (let y = 10; y < canvas.height; y += 20) {
        ctx.beginPath();

        for (let x = 0; x < canvas.width; x += 5) {
            const yOffset = Math.sin(x / 30) * 3;

            if (x === 0) {
                ctx.moveTo(x, y + yOffset);
            } else {
                ctx.lineTo(x, y + yOffset);
            }
        }

        ctx.stroke();
    }

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6); // Repeat texture for more detail

    return texture;
} 