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

/**
 * Initialize the biome system with the given seed
 * @param {number} seed - Seed for biome distribution
 */
function initializeBiomeSystem() {
    console.log("Initializing biome system...");
    clearBiomeCache();
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

    if (!biome && !(isPlayerInBiome(biome) === biome.name)) return [];


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


    if (isPlayerInBiome(biome).name === biome.name) {
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
    //console.log("is in updateAllBiomes");
    biomeImplementations.forEach(biome => {
        // if boat is in biome, update biome
        //console.log("is in updateAllBiomes", biome.name);
        // print what biome the player is in
        //console.log("is in updateAllBiomes", biome.name);

        if (isPlayerInBiome(biome).name === biome.name) {
            //console.log("player is in biome", biome.name);
            // print the region map
            //console.log("region map", regionBiomes);
            // print the biome map
            //console.log("biome map", biomeMap);
            //console.log("is in updateAllBiomes", biome.name);
            biome.update(deltaTime, playerPosition);
        }
    });
}

function isPlayerInBiome(biome) {
    const playerChunkX = Math.floor(boat.position.x / chunkSize);
    const playerChunkZ = Math.floor(boat.position.z / chunkSize);

    //console.log("get biome for chunk", getBiomeForChunk(playerChunkX, playerChunkZ));
    // print playerChunkX, playerChunkZ
    // print the chunk map
    // print the chunk map only once
    // print the biome map
    // player is in biome

    // print the chunk map only once
    const currentTime = Date.now();
    if (currentTime - lastChunkMapPrintTime > CHUNK_MAP_PRINT_INTERVAL) {
        //console.log("chunk map", regionBiomes);
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
    getBiomeById
};