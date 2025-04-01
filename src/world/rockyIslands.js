import * as THREE from 'three';
import { createShoreEffect } from './shores.js';
import { applyOutline } from '../theme/outlineStyles.js';
import { scene } from '../core/gameState.js';
import { loadBrightenedModel } from '../utils/islandLoader.js';
// Constants for island generation
const ISLAND_SIZE_MULTIPLIER = 2.0; // Makes islands 2x bigger than regular islands
const MAX_ROCKS_PER_ISLAND = 25;
const SHORE_GRADIENT_LAYERS = 5; // Number of layers for the gradual shore slope

// At the top of the file, add these constants to control performance
const PERFORMANCE_MODE = true; // Toggle for easy switching
const GEOMETRY_DETAIL = PERFORMANCE_MODE ? 0.5 : 1.0; // Reduces geometry detail by 50%
const OBJECT_COUNT = PERFORMANCE_MODE ? 0.4 : 1.0; // Reduces object counts by 60%

// Cache for texture generation
const textureCache = {
    rock: new Map(),
    sand: new Map()
};

// Map to store active rocky islands
const activeRockyIslands = new Map();

// Array to store rocky island colliders for collision detection
const rockyIslandColliders = [];

/**
 * Checks if a rocky island with the given ID exists
 * @param {string} islandId - The unique ID of the island
 * @returns {boolean} - Whether the island exists
 */
function rockyIslandExists(islandId) {
    return activeRockyIslands.has(islandId);
}

/**
 * Generates a rocky island at the specified coordinates
 * @param {number} x - X coordinate in the world
 * @param {number} z - Z coordinate in the world
 * @param {number} seed - Seed for random generation
 * @param {THREE.Scene} scene - The scene to add the island to
 * @returns {Object} - The created island entry with mesh and collider info
 */
export function createRockyIsland(x, z, seed, chunkGroup) {
    // Create a deterministic random function based on the seed
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Generate unique island ID
    const islandId = `rocky_island_${Math.floor(x)}_${Math.floor(z)}`;

    // Skip if this island already exists
    if (rockyIslandExists(islandId)) {
        return activeRockyIslands.get(islandId);
    }

    // Island radius - much larger than regular islands
    const baseRadius = 90 * ISLAND_SIZE_MULTIPLIER;

    // Create island container
    const island = new THREE.Group();
    island.position.set(x, 0, z);
    chunkGroup.add(island);

    // Create island collider 
    const collider = {
        center: new THREE.Vector3(x, 0, z),
        radius: baseRadius,
        id: islandId
    };
    rockyIslandColliders.push(collider);

    // Create the gradual sloping base with multiple layers
    createGradualShoreBase(island, baseRadius, random);

    // Create main island plateau
    const mainLandRadius = baseRadius * 0.7;

    // Create a unique shape for the island plateau
    const mainLandIrregularity = 0.3 + random() * 0.3;
    const mainLandGeometry = createIrregularCylinderGeometry(
        mainLandRadius,
        mainLandRadius * 1.05,
        8,
        48,
        () => random(),
        mainLandIrregularity
    );

    // Create land texture and material
    const landColor = new THREE.Color().setHSL(0.1 + random() * 0.05, 0.7, 0.4);
    const landTexture = createSandTexture(landColor, 0.7);
    const landMaterial = new THREE.MeshPhongMaterial({
        color: landColor,
        map: landTexture,
        bumpMap: landTexture,
        bumpScale: 0.5,
        shininess: 5
    });

    const mainLand = new THREE.Mesh(mainLandGeometry, landMaterial);
    mainLand.position.y = 5; // Position above the shore base
    island.add(mainLand);

    // Apply outline to main plateau
    applyOutline(mainLand, { scale: 1.1 });

    // Create rocky terrain features
    addRockyTerrain(island, mainLandRadius, random);

    // Add structures (reusing logic from original islands)
    addStructures(island, random);

    // Add vegetation
    addVegetation(island, random);

    // Store the island with its ID and collider reference
    const islandEntry = {
        mesh: island,
        collider: collider,
        visible: true
    };

    activeRockyIslands.set(islandId, islandEntry);

    // Add shore effect if the scene is provided
    if (scene) {
        const shore = createShoreEffect(island, collider, scene);
        islandEntry.shore = shore;
    }

    return islandEntry;
}

/**
 * Creates an irregular cylinder geometry with jagged edges
 * @param {number} innerRadius - The base inner radius
 * @param {number} outerRadius - The base outer radius
 * @param {number} height - The height of the cylinder
 * @param {number} segments - The number of segments around the cylinder
 * @param {Function} random - Random function for deterministic randomness
 * @param {number} irregularity - How irregular the shape should be (0-1)
 * @returns {THREE.CylinderGeometry} - The modified cylinder geometry
 */
function createIrregularCylinderGeometry(innerRadius, outerRadius, height, segments, random, irregularity = 0.3) {
    try {
        // Create a standard cylinder geometry as the base
        const geometry = new THREE.CylinderGeometry(
            innerRadius,
            outerRadius,
            height,
            segments
        );

        // Safety check - make sure geometry was created properly
        if (!geometry || !geometry.attributes || !geometry.attributes.position) {

            return new THREE.CylinderGeometry(innerRadius, outerRadius, height, segments);
        }

        // Access the position attribute to modify vertices
        const positionAttribute = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        // Track which vertices are on the edge to create jagged coastline
        // We'll only modify the top and bottom edges, not the vertical sides
        for (let i = 0; i < positionAttribute.count; i++) {
            // Get current vertex position
            vertex.fromBufferAttribute(positionAttribute, i);

            // Only modify vertices that are on the top or bottom of the cylinder (y near ±height/2)
            const isTopOrBottom = Math.abs(Math.abs(vertex.y) - height / 2) < 0.001;

            if (isTopOrBottom) {
                // Calculate distance from center in the XZ plane
                const distanceFromCenter = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);

                // Skip vertices that are not on the outer edge
                const isOnEdge = Math.abs(distanceFromCenter - (vertex.y > 0 ? innerRadius : outerRadius)) < 0.1;

                if (isOnEdge) {
                    // Direction from center
                    const angle = Math.atan2(vertex.z, vertex.x);

                    // Add randomness based on angle for varied but consistent shape
                    // Use a mix of sine waves for natural looking variation
                    const variation = irregularity * (
                        Math.sin(angle * 3 + random() * 10) * 0.5 +
                        Math.sin(angle * 7 + random() * 10) * 0.3 +
                        Math.sin(angle * 11 + random() * 10) * 0.2
                    );

                    // Apply the variation to the radius
                    const newRadius = distanceFromCenter * (1 + variation);

                    // Scale the x and z to the new radius
                    const scale = newRadius / distanceFromCenter;
                    vertex.x *= scale;
                    vertex.z *= scale;

                    // Update the position
                    positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
                }
            }
        }

        // Update normals
        geometry.computeVertexNormals();

        return geometry;
    } catch (e) {

        // Return a standard cylinder geometry if there was an error
        return new THREE.CylinderGeometry(innerRadius, outerRadius, height, segments);
    }
}

/**
 * Creates a gradual sloping shore base with multiple layers and irregular shapes
 * @param {THREE.Group} island - The island group
 * @param {number} baseRadius - The base radius of the island
 * @param {Function} random - Random function with seed
 */
function createGradualShoreBase(island, baseRadius, random) {
    // Create multiple layers with decreasing height for gradual shore
    const baseColor = new THREE.Color().setHSL(0.12 + random() * 0.05, 0.9, 0.7);
    const sandTexture = createSandTexture(baseColor, 0.5);

    // Use the same irregularity seed for all layers so they match
    const seedValue = random() * 1000;
    const getConsistentRandom = () => {
        return ((Math.sin(seedValue) + 1) / 2);
    };

    // PERFORMANCE: Reduce segment count significantly
    const baseSegments = PERFORMANCE_MODE ?
        16 + Math.floor(random() * 8) : // 16-24 segments (reduced)
        32 + Math.floor(random() * 16); // 32-48 segments (original)

    // PERFORMANCE: Reduce number of shore layers
    const layerCount = PERFORMANCE_MODE ? 3 : SHORE_GRADIENT_LAYERS; // Reduce from 5 to 3

    for (let i = 0; i < layerCount; i++) {
        // Calculate each layer's parameters
        const layerRatio = i / layerCount;
        const innerRadius = baseRadius * (0.75 + layerRatio * 0.25);
        const outerRadius = baseRadius * (0.8 + layerRatio * 0.25);
        const height = 1.5 * (1 - layerRatio);
        const yPosition = i * 1.2;

        // More irregularity for outer layers, less for inner layers
        const irregularity = 0.2 + (layerRatio * 0.3);

        // Create irregular geometry with jagged edges
        // PERFORMANCE: Reduced segments
        const segments = Math.max(12, baseSegments - Math.floor(layerRatio * 8));
        const layerGeometry = createIrregularCylinderGeometry(
            innerRadius,
            outerRadius,
            height,
            segments,
            getConsistentRandom,
            irregularity
        );

        const layerMaterial = new THREE.MeshPhongMaterial({
            color: baseColor.clone().multiplyScalar(0.85 + layerRatio * 0.3),
            map: sandTexture,
            bumpMap: sandTexture,
            bumpScale: 0.2,
            shininess: 2
        });

        const layer = new THREE.Mesh(layerGeometry, layerMaterial);
        layer.position.y = yPosition;
        island.add(layer);

        // Apply outline to each shore layer
        applyOutline(layer, { scale: 1.08 });
    }
}

/**
 * Adds rocky terrain features to the island
 * @param {THREE.Group} island - The island group
 * @param {number} islandRadius - The radius of the main island
 * @param {Function} random - Random function with seed
 */
function addRockyTerrain(island, islandRadius, random) {
    // Add some terrain variations like small hills and elevations
    addTerrainVariations(island, islandRadius, random);

    // PERFORMANCE: Reduce rock count dramatically
    const numRocks = PERFORMANCE_MODE ?
        5 + Math.floor(random() * (MAX_ROCKS_PER_ISLAND * 0.4)) : // 5-15 rocks (reduced)
        10 + Math.floor(random() * MAX_ROCKS_PER_ISLAND);         // 10-35 rocks (original)

    for (let i = 0; i < numRocks; i++) {
        // Rock properties
        const rockSize = 2 + random() * 6;
        const rockHeight = 4 + random() * 12;

        // Position within island radius - more varied placement
        // Use polar coordinates for better distribution
        const angle = random() * Math.PI * 2;
        // Map random number to a distribution that favors edges
        const radiusFactor = Math.pow(random(), 0.7); // Push distribution toward edges
        const distance = radiusFactor * islandRadius * 0.9;

        const xPos = Math.cos(angle) * distance;
        const zPos = Math.sin(angle) * distance;

        // Create rock
        const rock = createRock(rockSize, rockHeight, random);
        rock.position.set(xPos, 8, zPos);

        // Random rotation
        rock.rotation.y = random() * Math.PI * 2;
        rock.rotation.x = (random() - 0.5) * 0.2;
        rock.rotation.z = (random() - 0.5) * 0.2;

        island.add(rock);
    }

    // PERFORMANCE: Drastically reduce rock formations (most expensive part)
    const numFormations = PERFORMANCE_MODE ?
        (random() < 0.5 ? 1 : 0) :                  // 0-1 formations (reduced)
        2 + Math.floor(random() * 3);               // 2-4 formations (original)

    for (let i = 0; i < numFormations; i++) {
        createRockFormation(island, islandRadius, random);
    }
}

/**
 * Adds terrain variations to create more natural looking islands
 * @param {THREE.Group} island - The island group
 * @param {number} islandRadius - The radius of the main island
 * @param {Function} random - Random function with seed
 */
function addTerrainVariations(island, islandRadius, random) {
    // Number of terrain features to add
    const numVariations = 3 + Math.floor(random() * 4);

    for (let i = 0; i < numVariations; i++) {
        // Choose a variation type
        const variationType = Math.floor(random() * 3);

        switch (variationType) {
            case 0:
                // Add a hill or elevated area
                addElevatedArea(island, islandRadius, random);
                break;
            case 1:
                // Add a ridge or small mountain
                addRidge(island, islandRadius, random);
                break;
            case 2:
                // Add a depression or small valley
                addDepression(island, islandRadius, random);
                break;
        }
    }
}

/**
 * Add an elevated area to the island
 * @param {THREE.Group} island - The island group
 * @param {number} islandRadius - The base island radius
 * @param {Function} random - Random function
 */
function addElevatedArea(island, islandRadius, random) {
    try {
        const hillRadius = islandRadius * (0.3 + random() * 0.3);
        const hillHeight = 5 + random() * 10;

        // Create an irregular hill shape
        const segments = 16 + Math.floor(random() * 8);
        const hillGeometry = new THREE.SphereGeometry(hillRadius, segments, segments / 2, 0, Math.PI * 2, 0, Math.PI / 2);

        // Check if geometry was created successfully
        if (!hillGeometry || !hillGeometry.attributes || !hillGeometry.attributes.position) {

            return;
        }

        // Distort the geometry to make it more natural
        const vertices = hillGeometry.attributes.position;

        if (vertices && vertices.count) {
            for (let i = 0; i < vertices.count; i++) {
                const x = vertices.getX(i);
                const y = vertices.getY(i);
                const z = vertices.getZ(i);

                // Add noise to the shape
                const distanceFactor = 1 - (y / hillHeight); // Less distortion at the top
                const noise = (random() - 0.5) * hillRadius * 0.2 * distanceFactor;

                vertices.setX(i, x + noise);
                vertices.setZ(i, z + noise);
                // Slightly adjust height too
                vertices.setY(i, y + noise * 0.5);
            }

            // Update geometry normals
            hillGeometry.computeVertexNormals();
        }

        // Create material for the hill
        const hillColor = new THREE.Color().setHSL(
            0.08 + random() * 0.06,
            0.4 + random() * 0.3,
            0.3 + random() * 0.2
        );

        const hillMaterial = new THREE.MeshPhongMaterial({
            color: hillColor,
            shininess: 5
        });

        const hill = new THREE.Mesh(hillGeometry, hillMaterial);

        // Position randomly on the island
        const angle = random() * Math.PI * 2;
        const distance = random() * islandRadius * 0.5;
        hill.position.set(
            Math.cos(angle) * distance,
            8, // Position it above the base
            Math.sin(angle) * distance
        );

        island.add(hill);

        // Apply outline to hill
        applyOutline(hill, { scale: 1.1 });
    } catch (e) {

        // Continue without adding this feature
    }
}

/**
 * Add a ridge or small mountain
 * @param {THREE.Group} island - The island group
 * @param {number} islandRadius - The base island radius
 * @param {Function} random - Random function
 */
function addRidge(island, islandRadius, random) {
    try {
        const ridgeWidth = islandRadius * (0.3 + random() * 0.2);
        const ridgeHeight = 8 + random() * 12;
        const ridgeLength = islandRadius * (0.4 + random() * 0.4);

        // Use a box as the base shape for the ridge
        const ridgeGeometry = new THREE.BoxGeometry(ridgeWidth, ridgeHeight, ridgeLength, 8, 8, 8);

        // Check if geometry was created successfully
        if (!ridgeGeometry || !ridgeGeometry.attributes || !ridgeGeometry.attributes.position) {

            return;
        }

        // Distort the geometry to make it more mountain-like
        const vertices = ridgeGeometry.attributes.position;

        if (vertices && vertices.count) {
            for (let i = 0; i < vertices.count; i++) {
                const x = vertices.getX(i);
                const y = vertices.getY(i);
                const z = vertices.getZ(i);

                // Calculate distance from the center along the x-z plane
                const distanceFromCenter = Math.sqrt(x * x + z * z);

                // Add noise to vertices, more at the top
                const yRatio = (y + ridgeHeight / 2) / ridgeHeight; // 0 at bottom, 1 at top
                const noise = (random() - 0.5) * ridgeWidth * 0.3 * yRatio;

                // Taper toward the top like a mountain
                const taperFactor = 1 - (y / ridgeHeight) * 0.7;
                vertices.setX(i, x * taperFactor + noise);
                vertices.setZ(i, z * taperFactor + noise);

                // Add some noise to the height
                if (y > 0) { // Only affect upper part
                    vertices.setY(i, y + (random() - 0.5) * ridgeHeight * 0.2);
                }
            }

            // Update geometry normals
            ridgeGeometry.computeVertexNormals();
        }

        // Create a rocky material
        const ridgeColor = new THREE.Color().setHSL(
            0.05 + random() * 0.05,
            0.2 + random() * 0.2,
            0.3 + random() * 0.1
        );

        const ridgeTexture = createRockTexture(ridgeColor, 0.9);
        const ridgeMaterial = new THREE.MeshPhongMaterial({
            color: ridgeColor,
            map: ridgeTexture,
            bumpMap: ridgeTexture,
            bumpScale: 0.8,
            shininess: 10
        });

        const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);

        // Position on the island
        const angle = random() * Math.PI * 2;
        const distance = random() * islandRadius * 0.4;
        ridge.position.set(
            Math.cos(angle) * distance,
            ridgeHeight / 2 + 8, // Position above the island base
            Math.sin(angle) * distance
        );

        // Rotate the ridge
        ridge.rotation.y = random() * Math.PI;

        island.add(ridge);

        // Apply outline to ridge
        applyOutline(ridge, { scale: 1.12 });
    } catch (e) {

        // Continue without adding this feature
    }
}

/**
 * Add a depression or small valley
 * @param {THREE.Group} island - The island group
 * @param {number} islandRadius - The base island radius
 * @param {Function} random - Random function
 */
function addDepression(island, islandRadius, random) {
    try {
        // Create a depression by using a sphere that will be subtracted
        // Since we can't actually do CSG (Constructive Solid Geometry) easily here,
        // we'll fake it with a dark colored area that looks recessed

        const depressionRadius = islandRadius * (0.15 + random() * 0.2);
        const depressionDepth = 2 + random() * 3;

        // Use half a sphere as the depression shape
        const geometry = new THREE.SphereGeometry(
            depressionRadius,
            16,
            8,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2
        );

        // Check if geometry was created successfully
        if (!geometry || !geometry.attributes || !geometry.attributes.position) {

            return;
        }

        // Distort the geometry slightly
        const vertices = geometry.attributes.position;

        if (vertices && vertices.count) {
            for (let i = 0; i < vertices.count; i++) {
                const x = vertices.getX(i);
                const y = vertices.getY(i);
                const z = vertices.getZ(i);

                // Add noise to vertices
                const noise = (random() - 0.5) * depressionRadius * 0.2;

                vertices.setX(i, x + noise);
                vertices.setZ(i, z + noise);
                // No distortion for y to keep the flat bottom
            }

            // Update geometry normals
            geometry.computeVertexNormals();
        }

        // Create a darker material to give the illusion of depth
        const depressionColor = new THREE.Color().setHSL(
            0.07 + random() * 0.03,
            0.3 + random() * 0.2,
            0.2 + random() * 0.1
        );

        const depressionMaterial = new THREE.MeshPhongMaterial({
            color: depressionColor,
            shininess: 0
        });

        const depression = new THREE.Mesh(geometry, depressionMaterial);

        // Flip it upside down
        depression.rotation.x = Math.PI;

        // Position on the island
        const angle = random() * Math.PI * 2;
        const distance = random() * islandRadius * 0.5;
        depression.position.set(
            Math.cos(angle) * distance,
            6, // Slightly below the surface
            Math.sin(angle) * distance
        );

        island.add(depression);

        // Apply subtle outline to depression
        applyOutline(depression, { scale: 1.08 });
    } catch (e) {

        // Continue without adding this feature
    }
}

/**
 * Creates a single rock with jagged geometry
 * @param {number} size - Base size of the rock
 * @param {number} height - Height of the rock
 * @param {Function} random - Random function
 * @returns {THREE.Mesh} The rock mesh
 */
function createRock(size, height, random) {
    // Create rock group
    const rockGroup = new THREE.Group();

    // Determine rock type - several different rock shapes
    const rockType = Math.floor(random() * 4);
    let baseGeometry;

    // PERFORMANCE: Reduce geometry complexity
    const detailFactor = PERFORMANCE_MODE ? 0.5 : 1.0;

    // Create different rock shapes based on type with lower segment counts
    switch (rockType) {
        case 0: // Angular jagged rock
            baseGeometry = new THREE.BoxGeometry(
                size, height, size,
                Math.max(2, Math.floor(4 * detailFactor)),
                Math.max(3, Math.floor(6 * detailFactor)),
                Math.max(2, Math.floor(4 * detailFactor))
            );
            break;
        case 1: // Rounded rock
            baseGeometry = new THREE.SphereGeometry(
                size * 0.7,
                Math.max(4, Math.floor(8 * detailFactor)),
                Math.max(4, Math.floor(8 * detailFactor))
            );
            break;
        case 2: // Elongated rock
            baseGeometry = new THREE.CylinderGeometry(
                size * 0.5, size * 0.7, height,
                Math.max(4, Math.floor(8 * detailFactor)),
                Math.max(2, Math.floor(4 * detailFactor))
            );
            break;
        case 3: // Flat rock
            baseGeometry = new THREE.CylinderGeometry(
                size, size * 1.2, height * 0.6,
                Math.max(4, Math.floor(8 * detailFactor)),
                2
            );
            break;
        default: // Fallback to simple box if somehow rockType is invalid
            baseGeometry = new THREE.BoxGeometry(size, height, size);
            break;
    }

    // PERFORMANCE: Simplify vertex distortion in performance mode
    // Calculate once to reuse in the distortion loop
    const distortionFactor = PERFORMANCE_MODE ? 0.7 : 1.0;

    // Check that geometry was created successfully
    if (!baseGeometry || !baseGeometry.attributes || !baseGeometry.attributes.position) {

        baseGeometry = new THREE.BoxGeometry(size, height, size);
    }

    // Distort the geometry more aggressively to make it look jagged
    const vertices = baseGeometry.attributes.position;
    const directions = [];

    // Make sure vertices exist before processing
    if (vertices && vertices.count) {
        // Only compute directions if we're actually going to use them
        // First pass: compute directions for consistent distortion
        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i);
            const y = vertices.getY(i);
            const z = vertices.getZ(i);

            // Create a direction vector from center to vertex
            const length = Math.sqrt(x * x + y * y + z * z);
            // Avoid division by zero
            if (length > 0.00001) {
                directions.push({
                    x: x / length,
                    y: y / length,
                    z: z / length
                });
            } else {
                directions.push({ x: 0, y: 1, z: 0 }); // Default up direction
            }
        }

        // PERFORMANCE: Reduce noise complexity
        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i);
            const y = vertices.getY(i);
            const z = vertices.getZ(i);

            // Get the normalized direction to this vertex
            const dir = directions[i];

            // PERFORMANCE: Simpler noise calculation
            const highFreqNoise = (random() - 0.5) * size * 0.2 * distortionFactor;

            // Only compute these more expensive noises in full detail mode
            const midFreqNoise = PERFORMANCE_MODE ? 0 :
                Math.sin(x * 5 + y * 3 + z * 4) * size * 0.15;
            const lowFreqNoise = PERFORMANCE_MODE ? highFreqNoise * 0.5 :
                Math.cos(x * 0.8 + z * 0.7) * size * 0.3;

            // Different noise for different coordinates to make it more natural
            let noiseX = highFreqNoise + (PERFORMANCE_MODE ? 0 : (midFreqNoise * 0.8 + lowFreqNoise * 0.5));
            let noiseY = highFreqNoise * 0.7 + (PERFORMANCE_MODE ? 0 : (midFreqNoise + lowFreqNoise * 0.3));
            let noiseZ = highFreqNoise * 0.5 + (PERFORMANCE_MODE ? 0 : (midFreqNoise * 0.6 + lowFreqNoise));

            // Apply rock-type-specific adjustments
            if (rockType === 0) { // Angular rock - amplify the jaggedness
                noiseX *= 1.5;
                noiseY *= 1.3;
                noiseZ *= 1.5;
            } else if (rockType === 1) { // Rounded rock - less jagged
                noiseX *= 0.7;
                noiseY *= 0.7;
                noiseZ *= 0.7;
            }

            // Less distortion at the bottom for stability
            const yRatio = rockType === 3 ? 1 : Math.max(0, (y + height / 2) / height);

            // Calculate final vertex position with noise
            const newX = x + noiseX * yRatio * dir.x;
            // Less distortion for y to maintain general height
            const newY = y + noiseY * 0.4 * dir.y;
            const newZ = z + noiseZ * yRatio * dir.z;

            vertices.setXYZ(i, newX, newY, newZ);
        }

        // Update geometry normals after the distortion
        baseGeometry.computeVertexNormals();
    }

    // Create material for the rock
    const hue = 0.05 + random() * 0.05;
    const saturation = 0.2 + random() * 0.3;
    let lightness = 0.3 + random() * 0.2;

    // Different rock types have different colors
    if (rockType === 1) { // Rounded rocks are slightly lighter
        lightness += 0.1;
    } else if (rockType === 3) { // Flat rocks are slightly darker
        lightness -= 0.1;
    }

    const rockColor = new THREE.Color().setHSL(hue, saturation, lightness);

    // PERFORMANCE: Simplify rock materials in performance mode
    const rockMaterial = new THREE.MeshPhongMaterial({
        color: rockColor,
        // Only use texture in full detail mode, or for large rocks
        map: (!PERFORMANCE_MODE || size > 5) ? createRockTexture(rockColor, 0.7) : null,
        bumpMap: (!PERFORMANCE_MODE || size > 5) ? createRockTexture(rockColor, 0.7) : null,
        bumpScale: 0.5 + random() * 0.5,
        shininess: 5 + random() * 10
    });

    const rock = new THREE.Mesh(baseGeometry, rockMaterial);
    rockGroup.add(rock);

    // Apply outline to rock
    applyOutline(rock, {
        scale: 1.12 + (rockType === 0 ? 0.05 : 0) // More pronounced outline for angular rocks
    });

    // PERFORMANCE: Skip details in performance mode
    if (!PERFORMANCE_MODE && rockType === 0 && random() < 0.6) {
        // Add cracks or seams for angular rocks
        try {
            addRockDetail(rock, size, height, random);
        } catch (e) {

        }
    }

    return rockGroup;
}

/**
 * Adds detailed features to rocks like cracks or seams
 * @param {THREE.Mesh} rock - The rock mesh to add details to
 * @param {number} size - The base size of the rock
 * @param {number} height - The height of the rock
 * @param {Function} random - Random function
 */
function addRockDetail(rock, size, height, random) {
    try {
        // Check if the rock is valid
        if (!rock || !rock.isObject3D) {

            return;
        }

        // Add a crack or seam as a thin, dark line
        const crackWidth = size * 0.08;
        const crackHeight = height * 0.8;
        const crackDepth = size * 1.2;

        const crackGeometry = new THREE.BoxGeometry(crackWidth, crackHeight, crackDepth);

        // Validate geometry
        if (!crackGeometry || !crackGeometry.attributes) {

            return;
        }

        // Create a dark material for the crack
        const crackColor = new THREE.Color().setHSL(0, 0, 0.1);
        const crackMaterial = new THREE.MeshBasicMaterial({
            color: crackColor
        });

        const crack = new THREE.Mesh(crackGeometry, crackMaterial);

        // Position and rotate the crack
        crack.position.y = random() * height * 0.4;
        crack.rotation.y = random() * Math.PI;

        // Slightly offset from center
        crack.position.x = (random() - 0.5) * size * 0.3;
        crack.position.z = (random() - 0.5) * size * 0.3;

        // Add to the parent rock
        rock.add(crack);

        // We don't need to outline the crack as it's meant to be a dark indentation
    } catch (e) {

        // Continue without adding this detail
    }
}

/**
 * Creates a formation of multiple rocks clustered together
 * @param {THREE.Group} island - The island group
 * @param {number} islandRadius - The island radius
 * @param {Function} random - Random function
 */
function createRockFormation(island, islandRadius, random) {
    try {
        const formationGroup = new THREE.Group();

        // Position the formation
        const angle = random() * Math.PI * 2;
        const distance = random() * islandRadius * 0.6;
        const xPos = Math.cos(angle) * distance;
        const zPos = Math.sin(angle) * distance;

        formationGroup.position.set(xPos, 8, zPos);

        // Choose a formation type
        const formationType = Math.floor(random() * 4);

        try {
            switch (formationType) {
                case 0:
                    // Standard formation - cluster of rocks
                    createStandardFormation(formationGroup, islandRadius, random);
                    break;
                case 1:
                    // Arch formation - rocks forming an arch
                    createArchFormation(formationGroup, islandRadius, random);
                    break;
                case 2:
                    // Stack formation - vertical stack of rocks
                    createStackFormation(formationGroup, islandRadius, random);
                    break;
                case 3:
                    // Circle formation - rocks in a circle pattern
                    createCircleFormation(formationGroup, islandRadius, random);
                    break;
                default:
                    // Fallback to standard formation
                    createStandardFormation(formationGroup, islandRadius, random);
            }
        } catch (e) {

            // Try to create a simpler formation as fallback
            try {
                // Add a single simple rock as fallback
                const rockSize = 3 + random() * 5;
                const rockHeight = 8 + random() * 15;
                const rock = createRock(rockSize, rockHeight, random);
                formationGroup.add(rock);
            } catch (fallbackError) {

            }
        }

        island.add(formationGroup);
    } catch (e) {

    }
}

/**
 * Creates a standard formation of clustered rocks
 * @param {THREE.Group} parent - The parent group to add to
 * @param {number} islandRadius - The island radius for scale
 * @param {Function} random - Random function
 */
function createStandardFormation(parent, islandRadius, random) {
    try {
        // Add several rocks to the formation
        const numRocksInFormation = 3 + Math.floor(random() * 5);
        const formationRadius = 5 + random() * 10;

        for (let i = 0; i < numRocksInFormation; i++) {
            try {
                const rockSize = 3 + random() * 5;
                const rockHeight = 8 + random() * 15;

                // Position within formation
                const rockDistance = (random() * 0.8) * formationRadius;
                const rockAngle = random() * Math.PI * 2;
                const rockX = Math.cos(rockAngle) * rockDistance;
                const rockZ = Math.sin(rockAngle) * rockDistance;

                // Create rock
                const rock = createRock(rockSize, rockHeight, random);
                rock.position.set(rockX, 0, rockZ);
                rock.rotation.y = random() * Math.PI * 2;
                rock.rotation.x = (random() - 0.5) * 0.3;
                rock.rotation.z = (random() - 0.5) * 0.3;

                parent.add(rock);
            } catch (e) {

                // Continue with next rock
            }
        }
    } catch (e) {

    }
}

/**
 * Creates a rock formation in the shape of an arch
 * @param {THREE.Group} parent - The parent group to add to
 * @param {number} islandRadius - The island radius for scale
 * @param {Function} random - Random function
 */
function createArchFormation(parent, islandRadius, random) {
    try {
        const archWidth = 10 + random() * 15;
        const archHeight = 10 + random() * 20;
        const archThickness = 3 + random() * 6;

        // Create the arch legs
        for (let side = -1; side <= 1; side += 2) {
            try {
                // Skip middle
                if (side === 0) continue;

                const legSize = archThickness;
                const legHeight = archHeight * 0.8;

                // Create rock for the leg
                const leg = createRock(legSize, legHeight, random);
                leg.position.set(side * archWidth / 2, legHeight / 2, 0);

                // Make the legs more vertical
                leg.scale.set(1, 1.2, 1);

                parent.add(leg);
            } catch (e) {

            }
        }

        // Create the arch top
        try {
            // Use a curved shape for the arch top
            const archTop = new THREE.Group();

            // Create several rocks to form the arch top
            const numArchSegments = 5 + Math.floor(random() * 3);
            for (let i = 0; i < numArchSegments; i++) {
                try {
                    const ratio = i / (numArchSegments - 1);
                    const angle = ratio * Math.PI;

                    const topSegmentSize = archThickness * 0.8;
                    const topSegmentHeight = archThickness * 1.2;

                    // Position along an arc
                    const xPos = -archWidth / 2 + archWidth * ratio;
                    const yPos = archHeight - Math.sin(angle) * (archHeight * 0.3);

                    const rock = createRock(topSegmentSize, topSegmentHeight, random);
                    rock.position.set(xPos, yPos, 0);

                    // Rotate to follow the curve
                    rock.rotation.z = Math.PI / 2 - angle;

                    archTop.add(rock);
                } catch (e) {

                }
            }

            parent.add(archTop);
        } catch (e) {

        }

        // Add some fallen/debris rocks around the base
        for (let i = 0; i < 3; i++) {
            try {
                const debrisSize = 2 + random() * 3;
                const debrisHeight = 2 + random() * 4;

                const debris = createRock(debrisSize, debrisHeight, random);

                // Position around the base of the arch
                const angle = random() * Math.PI * 2;
                const dist = archWidth * 0.6 * random();
                debris.position.set(
                    Math.cos(angle) * dist,
                    debrisHeight / 3,
                    Math.sin(angle) * dist
                );

                parent.add(debris);
            } catch (e) {

            }
        }
    } catch (e) {

    }
}

/**
 * Creates a rock formation in a vertical stack
 * @param {THREE.Group} parent - The parent group to add to
 * @param {number} islandRadius - The island radius for scale
 * @param {Function} random - Random function
 */
function createStackFormation(parent, islandRadius, random) {
    try {
        const stackHeight = 4 + Math.floor(random() * 4); // Number of rocks in stack
        const baseSize = 8 + random() * 6;
        let currentHeight = 0;

        for (let i = 0; i < stackHeight; i++) {
            try {
                // Each rock in the stack gets progressively smaller
                const sizeRatio = 1 - (i / stackHeight) * 0.6;
                const rockSize = baseSize * sizeRatio;
                const rockHeight = 5 + random() * 7;

                const rock = createRock(rockSize, rockHeight, random);

                // Position rocks in a stack
                rock.position.y = currentHeight + rockHeight / 2;

                // Add some subtle offsets for more natural look
                if (i > 0) {
                    rock.position.x = (random() - 0.5) * rockSize * 0.3;
                    rock.position.z = (random() - 0.5) * rockSize * 0.3;

                    // Random slight rotation, more for higher rocks
                    const rotationAmount = 0.05 + (i / stackHeight) * 0.15;
                    rock.rotation.x = (random() - 0.5) * rotationAmount;
                    rock.rotation.z = (random() - 0.5) * rotationAmount;
                }

                parent.add(rock);

                // Update height for next rock
                currentHeight += rockHeight;
            } catch (e) {

            }
        }

        // Add some smaller rocks around the base
        const numBaseRocks = 2 + Math.floor(random() * 4);
        for (let i = 0; i < numBaseRocks; i++) {
            try {
                const baseRockSize = 2 + random() * 3;
                const baseRockHeight = 2 + random() * 4;

                const baseRock = createRock(baseRockSize, baseRockHeight, random);

                // Position around the stack base
                const angle = random() * Math.PI * 2;
                const dist = baseSize * 0.7 + random() * baseSize * 0.4;
                baseRock.position.set(
                    Math.cos(angle) * dist,
                    baseRockHeight / 2,
                    Math.sin(angle) * dist
                );

                parent.add(baseRock);
            } catch (e) {

            }
        }
    } catch (e) {

    }
}

/**
 * Creates a rock formation in a circle pattern
 * @param {THREE.Group} parent - The parent group to add to
 * @param {number} islandRadius - The island radius for scale
 * @param {Function} random - Random function
 */
function createCircleFormation(parent, islandRadius, random) {
    try {
        const circleRadius = 8 + random() * 12;
        const numRocks = 6 + Math.floor(random() * 6);

        // Create rocks arranged in a circle
        for (let i = 0; i < numRocks; i++) {
            try {
                const angle = (i / numRocks) * Math.PI * 2;

                // Vary rock sizes around the circle
                const rockSizeVariation = 0.7 + random() * 0.6;
                const rockSize = 3 + random() * 4 * rockSizeVariation;
                const rockHeight = 6 + random() * 12 * rockSizeVariation;

                const rock = createRock(rockSize, rockHeight, random);

                // Position in a circle
                // Add some randomness to the radius for a more natural look
                const radiusVariation = 0.8 + random() * 0.4;
                const xPos = Math.cos(angle) * circleRadius * radiusVariation;
                const zPos = Math.sin(angle) * circleRadius * radiusVariation;

                rock.position.set(xPos, rockHeight / 2, zPos);

                // Rotate to face center roughly
                rock.rotation.y = angle + Math.PI + (random() - 0.5) * 0.5;

                // Random slight tilt
                rock.rotation.x = (random() - 0.5) * 0.2;
                rock.rotation.z = (random() - 0.5) * 0.2;

                parent.add(rock);
            } catch (e) {

            }
        }

        // Optionally add a central rock or feature
        if (random() < 0.7) {
            try {
                const centerSize = 4 + random() * 6;
                const centerHeight = 4 + random() * 8;

                const centerRock = createRock(centerSize, centerHeight, random);
                centerRock.position.y = centerHeight / 2;

                parent.add(centerRock);
            } catch (e) {

            }
        }
    } catch (e) {

    }
}

/**
 * Adds structures to the island (similar to original islands)
 * @param {THREE.Group} island - The island group
 * @param {Function} random - Random function with seed
 */
function addStructures(island, random) {
    // 30% chance for a large structure
    if (random() < 0.3) {
        // Create a large central structure
        const structureType = Math.floor(random() * 4);

        // This would ideally call the structure creation functions from islands.js
        // For now, we'll create a simple placeholder structure

        const size = 20 + random() * 25;
        const height = 25 + random() * 30;

        // Create a temple-like structure
        const baseGeometry = new THREE.BoxGeometry(size, height * 0.2, size);
        const midGeometry = new THREE.BoxGeometry(size * 0.8, height * 0.6, size * 0.8);
        const topGeometry = new THREE.BoxGeometry(size * 0.6, height * 0.2, size * 0.6);

        const structureColor = new THREE.Color().setHSL(random(), 0.6, 0.5);
        const structureMaterial = new THREE.MeshPhongMaterial({
            color: structureColor,
            shininess: 10
        });

        const base = new THREE.Mesh(baseGeometry, structureMaterial);
        base.position.y = 10 + height * 0.1;

        const mid = new THREE.Mesh(midGeometry, structureMaterial);
        mid.position.y = 10 + height * 0.5;

        const top = new THREE.Mesh(topGeometry, structureMaterial);
        top.position.y = 10 + height * 0.9;

        island.add(base);
        island.add(mid);
        island.add(top);

        // Apply outlines to all structure components
        applyOutline(base, { scale: 1.12 });
        applyOutline(mid, { scale: 1.12 });
        applyOutline(top, { scale: 1.12 });
    }
}

/**
 * Adds vegetation to the island
 * @param {THREE.Group} island - The island group
 * @param {Function} random - Random function with seed
 */
function addVegetation(island, random) {
    // Number of trees is proportional to island size
    const numTrees = 5 + Math.floor(random() * 10);

    for (let i = 0; i < numTrees; i++) {
        // Create a tree group
        const tree = new THREE.Group();

        // Tree properties
        const treeHeight = 10 + random() * 15;
        const trunkHeight = treeHeight * 0.6;
        const trunkRadius = 0.8 + random() * 0.6;
        const foliageRadius = 4 + random() * 5;
        const foliageHeight = treeHeight - trunkHeight;

        // Tree types (0: cone/pine, 1: rounded/deciduous, 2: palm)
        const treeType = Math.floor(random() * 3);

        // Create trunk
        const trunkGeometry = new THREE.CylinderGeometry(
            trunkRadius * 0.7,
            trunkRadius,
            trunkHeight,
            8
        );
        const trunkColor = new THREE.Color().setHSL(
            0.07 + random() * 0.05,
            0.5 + random() * 0.2,
            0.2 + random() * 0.1
        );
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: trunkColor });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        tree.add(trunk);

        // Apply outline to trunk
        applyOutline(trunk, { scale: 1.15 });

        // Create foliage based on tree type
        let foliageGeometry;

        if (treeType === 0) {
            // Pine/cone shaped
            foliageGeometry = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8);
        } else if (treeType === 1) {
            // Rounded/deciduous
            foliageGeometry = new THREE.SphereGeometry(
                foliageRadius,
                8,
                6,
                0,
                Math.PI * 2,
                0,
                Math.PI * 0.8
            );
        } else {
            // Palm-like with multiple fronds
            const palmFronds = new THREE.Group();

            // Create 5-8 palm fronds
            const numFronds = 5 + Math.floor(random() * 4);

            for (let f = 0; f < numFronds; f++) {
                const frondGeometry = new THREE.PlaneGeometry(
                    1 + random() * 0.5,
                    6 + random() * 4
                );
                const frondColor = new THREE.Color().setHSL(
                    0.25 + random() * 0.1,
                    0.8,
                    0.3 + random() * 0.2
                );
                const frondMaterial = new THREE.MeshPhongMaterial({
                    color: frondColor,
                    side: THREE.DoubleSide
                });

                const frond = new THREE.Mesh(frondGeometry, frondMaterial);

                // Position and rotate frond
                frond.position.y = 2;
                frond.rotation.x = -Math.PI / 4;
                frond.rotation.y = (f / numFronds) * Math.PI * 2;
                frond.rotation.z = Math.PI / 6;

                palmFronds.add(frond);

                // Apply outline to each frond
                applyOutline(frond, { scale: 1.12 });
            }

            palmFronds.position.y = trunkHeight;
            tree.add(palmFronds);

            // Palm trees don't need the regular foliage geometry
            foliageGeometry = null;
        }

        // Add foliage for non-palm trees
        if (foliageGeometry) {
            const foliageColor = new THREE.Color().setHSL(
                0.25 + random() * 0.15,
                0.8,
                0.3 + random() * 0.2
            );
            const foliageMaterial = new THREE.MeshPhongMaterial({ color: foliageColor });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);

            // Position foliage based on tree type
            if (treeType === 0) {
                foliage.position.y = trunkHeight + foliageHeight / 2;
            } else {
                foliage.position.y = trunkHeight + foliageHeight / 4;
            }

            tree.add(foliage);

            // Apply outline to foliage
            applyOutline(foliage, { scale: 1.15 });
        }

        // Position the tree on the island
        const treeAngle = random() * Math.PI * 2;
        const treeDistance = 30 + random() * 50;
        tree.position.set(
            Math.cos(treeAngle) * treeDistance,
            10,
            Math.sin(treeAngle) * treeDistance
        );

        // Random rotation and slight tilt
        tree.rotation.y = random() * Math.PI * 2;
        tree.rotation.x = (random() - 0.5) * 0.1;
        tree.rotation.z = (random() - 0.5) * 0.1;

        island.add(tree);
    }
}

/**
 * Creates a texture for rocks with appropriate detail
 * @param {THREE.Color} baseColor - Base color for the rock
 * @param {number} roughness - Roughness factor (0-1)
 * @returns {THREE.Texture} - The generated texture
 */
function createRockTexture(baseColor, roughness) {
    // Use cached texture if available
    const cacheKey = `${baseColor.getHexString()}_${roughness}`;
    if (textureCache.rock.has(cacheKey)) {
        return textureCache.rock.get(cacheKey);
    }

    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add noise/grain texture
    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2 + 1;

        // Vary the grain color slightly from the base
        const brightness = 0.7 + Math.random() * 0.6;
        const r = Math.floor(baseColor.r * 255 * brightness);
        const g = Math.floor(baseColor.g * 255 * brightness);
        const b = Math.floor(baseColor.b * 255 * brightness);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${roughness * 0.4})`;
        ctx.fillRect(x, y, size, size);
    }

    // Add cracks and crevices
    ctx.strokeStyle = `rgba(0, 0, 0, ${roughness * 0.5})`;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.lineWidth = Math.random() * 2 + 0.5;

        // Start point
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height;
        ctx.moveTo(startX, startY);

        // Create jagged line for rock cracks
        let x = startX;
        let y = startY;
        const segments = 3 + Math.floor(Math.random() * 5);

        for (let j = 0; j < segments; j++) {
            x += (Math.random() - 0.5) * 50;
            y += (Math.random() - 0.5) * 50;
            ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Cache the texture
    textureCache.rock.set(cacheKey, texture);

    return texture;
}

/**
 * Creates a texture for sand with appropriate detail
 * @param {THREE.Color} baseColor - Base color for the sand
 * @param {number} graininess - Graininess factor (0-1)
 * @returns {THREE.Texture} - The generated texture
 */
function createSandTexture(baseColor, graininess = 0.5) {
    // Use cached texture if available
    const cacheKey = `${baseColor.getHexString()}_${graininess}`;
    if (textureCache.sand.has(cacheKey)) {
        return textureCache.sand.get(cacheKey);
    }

    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add fine grain texture
    for (let i = 0; i < 15000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 1.5 + 0.5;

        // Randomize grain color slightly
        const variation = Math.random() * 0.2 - 0.1;
        const r = Math.min(255, Math.max(0, Math.floor(baseColor.r * 255 * (1 + variation))));
        const g = Math.min(255, Math.max(0, Math.floor(baseColor.g * 255 * (1 + variation))));
        const b = Math.min(255, Math.max(0, Math.floor(baseColor.b * 255 * (1 + variation))));

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${graininess * 0.3})`;
        ctx.fillRect(x, y, size, size);
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Cache the texture
    textureCache.sand.set(cacheKey, texture);

    return texture;
}

/**
 * Returns the list of all rocky island colliders
 * @returns {Array} Array of rocky island colliders
 */
export function getRockyIslandColliders() {
    return rockyIslandColliders;
}

/**
 * Removes all rocky islands and clears caches
 * @param {THREE.Scene} scene - The scene containing the islands
 */
export function clearRockyIslands(scene) {
    // Remove all rocky islands from the scene
    for (const [id, island] of activeRockyIslands.entries()) {
        if (island.mesh && scene) {
            scene.remove(island.mesh);
        }
    }

    // Clear all collections
    activeRockyIslands.clear();
    rockyIslandColliders.length = 0;

    // Note: We don't clear texture caches to avoid regenerating textures
    // if islands are recreated
} 