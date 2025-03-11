import * as THREE from 'three';
import { boat } from '../core/gameState.js';
import { chunkSize } from '../world/chunkControl.js';


/**
 * BiomeSystem - Complete system for managing all biome-related functionality
 * Handles biome registration, storage, chunk assignment, and operations
 */

// Collection of registered biome implementations
const biomeImplementations = [];

// Map of biome IDs to their implementation instance
const biomeMap = new Map();

// Map to track which biome is assigned to which region (not chunk)
const regionBiomes = new Map();

// Default biome to use when no specific biome is assigned
let defaultBiome = null;

// Seed for biome distribution
let biomeSeed = 12345;

// Add these variables at the top of your file with other variables
let lastChunkMapPrintTime = 0;
const CHUNK_MAP_PRINT_INTERVAL = 5000; // 5 seconds in milliseconds

// Track the current/previous biome the player is in
let currentPlayerBiome = null;

// Near the top of the file with other variables
const FOG_STATE = {
    INACTIVE: 'inactive',
    FADING_IN: 'fading_in',
    ACTIVE: 'active',
    FADING_OUT: 'fading_out',
    TRANSITIONING: 'transitioning' // New state for fog-to-fog transitions
};

let currentFogState = FOG_STATE.INACTIVE;
let fogStateBiome = null; // Which biome's fog is currently active
let fogStateTimer = 0; // Timer for state transitions
let fogCheckCooldown = 0; // Cooldown between fog checks

/**
 * Initialize the biome system with the given seed
 * @param {number} seed - Seed for biome distribution
 */
function initializeBiomeSystem() {
    console.log("Initializing biome system...");
    clearBiomeCache();
    currentPlayerBiome = null;
}

/**
 * Register a biome implementation
 * @param {Object} biomeImplementation - Instance of a biome implementation
 * @returns {Object} The registered biome instance
 */
function registerBiome(biomeImplementation) {
    const id = biomeImplementation.id;

    // Prevent duplicate registration
    if (biomeMap.has(id)) {
        console.warn(`Biome with ID ${id} is already registered. Skipping.`);
        return biomeMap.get(id);
    }

    // Store the biome implementation
    biomeImplementations.push(biomeImplementation);
    biomeMap.set(id, biomeImplementation);

    // Register with the biome's own register method
    const registeredBiome = biomeImplementation.register();

    // Set as default if needed
    if (biomeImplementation.isDefault && !defaultBiome) {
        defaultBiome = biomeImplementation;
    } else if (!defaultBiome && biomeImplementations.length === 1) {
        // First biome becomes default if none is marked
        defaultBiome = biomeImplementation;
    }

    console.log(`Registered biome: ${biomeImplementation.name} (${id})`);
    return registeredBiome;
}

/**
 * Set the seed for biome distribution
 * @param {number} seed - New seed value
 */
function setBiomeSeed(seed) {
    biomeSeed = seed;
    clearBiomeCache();
}

/**
 * Deterministic random function based on coordinates and seed
 * @param {number} x - X coordinate
 * @param {number} z - Z coordinate
 * @returns {number} Random value between 0-1
 */
function seededRandom(x, z) {
    const hash = Math.sin(x * 12345.6789 + z * 9876.54321 + biomeSeed) * 43758.5453123;
    return hash - Math.floor(hash);
}

/**
 * Get the biome for a specific chunk
 * @param {number} chunkX - Chunk X coordinate
 * @param {number} chunkZ - Chunk Z coordinate
 * @returns {Object} Biome implementation for this chunk
 */
function getBiomeForChunk(chunkX, chunkZ) {
    // Convert chunk coordinates to region coordinates (each region is 2x2 chunks)
    const regionX = Math.floor(chunkX / 4);
    const regionZ = Math.floor(chunkZ / 4);
    const regionKey = `${regionX},${regionZ}`;

    // Return cached biome if available for this region
    if (regionBiomes.has(regionKey)) {
        return regionBiomes.get(regionKey);
    }

    // Determine biome based on noise and weights using region coordinates
    const random = seededRandom(regionX, regionZ);
    let totalWeight = 0;

    // Calculate total weight
    biomeImplementations.forEach(biome => {
        totalWeight += biome.weight || 1;
    });

    // Select biome based on weighted random
    let currentWeight = 0;
    let selectedBiome = null;

    for (const biome of biomeImplementations) {
        currentWeight += biome.weight || 1;
        if (random <= currentWeight / totalWeight) {
            selectedBiome = biome;
            break;
        }
    }

    // Fallback to default if no biome was selected
    if (!selectedBiome) {
        selectedBiome = defaultBiome || (biomeImplementations.length > 0 ? biomeImplementations[0] : null);
    }

    // Cache the result for the entire region
    regionBiomes.set(regionKey, selectedBiome);

    return selectedBiome;
}

/**
 * Get biome properties for a specific chunk
 * @param {number} chunkX - Chunk X coordinate
 * @param {number} chunkZ - Chunk Z coordinate
 * @returns {Object} Properties of the biome for this chunk
 */
function getBiomePropertiesForChunk(chunkX, chunkZ) {
    const biome = getBiomeForChunk(chunkX, chunkZ);
    return biome ? biome.getProperties() : {};
}

/**
 * Process a chunk using its assigned biome
 * @param {number} chunkX - Chunk X coordinate
 * @param {number} chunkZ - Chunk Z coordinate
 * @param {THREE.Scene} scene - Scene to add entities to
 * @param {number} seed - World seed
 * @returns {Array} Array of spawned entities
 */
function processChunk(chunkX, chunkZ, scene, seed) {
    const biome = getBiomeForChunk(chunkX, chunkZ);
    console.log("is in processChunk", chunkX, chunkZ, biome.name);

    if (!biome && !(getPlayerBiome().name === biome.name)) return [];


    //console.log("is in processChunk", chunkX, chunkZ, biome.name);

    return biome.processChunk(chunkX, chunkZ, chunkSize, scene, seed);
}

/**
 * Spawn biome features around a position
 * @param {THREE.Scene} scene - Scene to add entities to
 * @param {number} seed - World seed
 * @param {number} radius - Radius in chunks
 * @returns {Array} Array of spawned entities
 */
function spawnAroundPosition(scene, seed, radius = 2) {
    let allSpawned = [];

    // get chunk based on where the boat is
    const biome = getBiomeForChunk(boat.position.x, boat.position.z);


    if (getPlayerBiome().name === biome.name) {
        const centerChunkX = Math.floor(centerPosition.x / chunkSize);
        const centerChunkZ = Math.floor(centerPosition.z / chunkSize);

        // Process chunks in radius
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const chunkX = centerChunkX + dx;
                const chunkZ = centerChunkZ + dz;

                const spawned = processChunk(chunkX, chunkZ, scene, seed);
                allSpawned = allSpawned.concat(spawned);
            }
        }
    }

    return allSpawned;
}

/**
 * Update all biomes
 * @param {number} deltaTime - Time since last update
 * @param {THREE.Vector3} playerPosition - Current player position
 */
function updateAllBiomes(deltaTime, playerPosition) {
    // Check if player has changed biomes
    const playerBiome = getPlayerBiome();

    // Update current biome reference if needed
    if (!currentPlayerBiome || (playerBiome && playerBiome.name !== currentPlayerBiome.name)) {
        console.log(`Biome change detected: ${currentPlayerBiome?.name || 'none'} -> ${playerBiome.name}`);
        currentPlayerBiome = playerBiome;
    }

    // Update fog state timers
    if (fogStateTimer > 0) {
        fogStateTimer -= deltaTime * 1000;
        if (fogStateTimer <= 0) {
            // State transition completed
            handleFogStateCompletion();
        }
    }

    // Update fog check cooldown
    if (fogCheckCooldown > 0) {
        fogCheckCooldown -= deltaTime * 1000;
    }

    // Only check fog state if not transitioning and cooldown is complete
    if (currentFogState !== FOG_STATE.FADING_IN &&
        currentFogState !== FOG_STATE.FADING_OUT &&
        fogCheckCooldown <= 0) {

        checkAndUpdateFogState(playerBiome);

        // Set a cooldown before next check (1 second)
        fogCheckCooldown = 1000;
    }

    // Update active biomes
    biomeImplementations.forEach(biome => {
        if (playerBiome && playerBiome.name === biome.name) {
            biome.update(deltaTime, playerPosition);
        }
    });
}

/**
 * Check if fog state needs to change and update it
 * @param {Object} currentBiome - Current biome player is in
 */
function checkAndUpdateFogState(currentBiome) {
    // Make sure we have a valid biome with properties
    if (!currentBiome || !currentBiome.getProperties) {
        console.error("Invalid biome passed to checkAndUpdateFogState:", currentBiome);
        return;
    }

    // Get properties using the getter method
    const properties = currentBiome.getProperties();

    // Determine if the current biome should have fog
    const biomeWantsFog = properties.hasFog || false;
    const fogType = biomeWantsFog ? (properties.fogType || 'default') : null;

    console.log(`Checking fog state:`);
    console.log(`- Biome: ${currentBiome.name}`);
    console.log(`- Properties:`, properties);
    console.log(`- hasFog: ${biomeWantsFog}`);
    console.log(`- fogType: ${fogType}`);
    console.log(`- Current fog state: ${currentFogState}`);
    console.log(`- Current fog biome: ${fogStateBiome?.name || 'none'}`);

    // Case 1: No fog → Fog (fade in)
    if (biomeWantsFog && currentFogState === FOG_STATE.INACTIVE) {
        console.log(`✅ CONDITION 1 MET: Activating ${fogType} fog for ${currentBiome.name}`);
        currentFogState = FOG_STATE.FADING_IN;
        fogStateBiome = currentBiome;
        currentBiome.handleFogTransition(true, boat, fogType);
        fogStateTimer = 10000; // 10 seconds for fade in
    }
    // Case 2: Fog → No Fog (fade out)
    else if (!biomeWantsFog && currentFogState === FOG_STATE.ACTIVE) {
        console.log(`✅ CONDITION 2 MET: Deactivating fog from ${fogStateBiome.name}`);
        currentFogState = FOG_STATE.FADING_OUT;
        const oldFogType = fogStateBiome.getProperties().fogType || 'default';
        fogStateBiome.handleFogTransition(false, boat, oldFogType);
        fogStateTimer = 5000; // 5 seconds for fade out
    }
    // Case 3: Fog Type A → Fog Type B (transition between fog types)
    else if (biomeWantsFog && currentFogState === FOG_STATE.ACTIVE && fogStateBiome) {
        const currentFogType = fogStateBiome.getProperties().fogType || 'default';
        if (fogType !== currentFogType) {
            console.log(`✅ CONDITION 3 MET: Transitioning fog: ${currentFogType} → ${fogType}`);
            currentFogState = FOG_STATE.TRANSITIONING;
            handleFogTypeTransition(currentFogType, fogType, currentBiome);
            fogStateTimer = 500; // 8 seconds for transition
        }
    }
    else {
        console.log(`❌ NO CONDITIONS MET - Debug info:`);
        console.log(`- biomeWantsFog: ${biomeWantsFog}`);
        console.log(`- currentFogState: ${currentFogState}`);
        console.log(`- fogStateBiome: ${fogStateBiome?.name || 'none'}`);
    }
}

/**
 * Handle transition between different fog types
 * @param {string} fromType - Current fog type
 * @param {string} toType - Target fog type
 * @param {Object} targetBiome - The biome we're transitioning to
 */
function handleFogTypeTransition(fromType, toType, targetBiome) {
    // We'll call our new function in fog.js here
    // This will need to be implemented in fog.js
    targetBiome.handleFogTypeTransition(fromType, toType, boat);
    fogStateBiome = targetBiome;
}

/**
 * Handle completion of a fog state transition
 */
function handleFogStateCompletion() {
    if (currentFogState === FOG_STATE.FADING_IN || currentFogState === FOG_STATE.TRANSITIONING) {
        console.log("Fog transition complete - now active");
        currentFogState = FOG_STATE.ACTIVE;
    }
    else if (currentFogState === FOG_STATE.FADING_OUT) {
        console.log("Fog fade-out complete");
        currentFogState = FOG_STATE.INACTIVE;
        fogStateBiome = null;
    }

    // After any transition completes, set a cooldown before next check
    fogCheckCooldown = 3000; // 3 second cooldown after transition
}

/**
 * Check which biome the player is currently in
 * @returns {Object|null} The biome the player is in, or null
 */
function getPlayerBiome() {
    const playerChunkX = Math.floor(boat.position.x / chunkSize);
    const playerChunkZ = Math.floor(boat.position.z / chunkSize);

    // Print debug info at intervals
    const currentTime = Date.now();
    if (currentTime - lastChunkMapPrintTime > CHUNK_MAP_PRINT_INTERVAL) {
        lastChunkMapPrintTime = currentTime;
        // Debug logging as needed
    }

    return getBiomeForChunk(playerChunkX, playerChunkZ);
}

/**
 * Clean up distant entities across all biomes
 * @param {THREE.Vector3} playerPosition - Current player position
 * @param {number} cleanupRadius - Radius beyond which to remove entities
 */
function cleanupAllBiomes(playerPosition, cleanupRadius) {
    biomeImplementations.forEach(biome => {
        biome.cleanupDistantEntities(playerPosition, cleanupRadius);
    });
}

/**
 * Check if a biome is registered
 * @param {string} biomeId - ID of the biome to check
 * @returns {boolean} Whether the biome is registered
 */
function hasBiome(biomeId) {
    return biomeMap.has(biomeId);
}

/**
 * Get all registered biome implementations
 * @returns {Array} Array of biome implementations
 */
function getAllBiomes() {
    return [...biomeImplementations];
}

/**
 * Clear the biome assignment cache
 */
function clearBiomeCache() {
    regionBiomes.clear();
}

/**
 * Get the default biome
 * @returns {Object} Default biome implementation
 */
function getDefaultBiome() {
    return defaultBiome;
}

/**
 * Get a biome implementation by ID
 * @param {string} biomeId - ID of the biome to get
 * @returns {Object|null} Biome implementation or null if not found
 */
function getBiomeById(biomeId) {
    return biomeMap.get(biomeId) || null;
}

// Export the public API
export {
    initializeBiomeSystem,
    registerBiome,
    setBiomeSeed,
    getBiomeForChunk,
    getBiomePropertiesForChunk,
    processChunk,
    spawnAroundPosition,
    updateAllBiomes,
    cleanupAllBiomes,
    hasBiome,
    getAllBiomes,
    clearBiomeCache,
    getDefaultBiome,
    getBiomeById,
    getPlayerBiome
};