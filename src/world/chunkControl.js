import * as THREE from 'three';
import { adjustFogToViewDistance } from '../environment/fog.js';
import {
    activeIslands,
    createIsland,
    areShoreEffectsEnabled,
    getMassiveIslandSpawned,
    getMassiveIslandPosition,
    removeIslandCollider,
} from './islands.js';
import {
    findNearestMassiveIsland,
    setMassiveIslandVisibility
} from './massiveIslands.js';
import {
    removeShore,
    setShoreVisibility
} from './shores.js';
import {
    initializeBiomeSystem,
    registerBiome,
    getBiomeForChunk,
    getBiomePropertiesForChunk,
    updateAllBiomes,
    cleanupAllBiomes,
    getAllBiomes
} from '../biomes/biomeSystem.js';
import openBiome from '../biomes/openbiome.js';
import arcticBiome from '../biomes/arcticbiome.js';
import { boat, scene } from '../core/gameState.js';
import volcanicBiome from '../biomes/volcanicbiome.js';

// Chunking system variables
export const visibleDistance = 1000; // Distance to see islands from
export const chunkSize = 600; // Size of each "chunk" of ocean
export const islandsPerChunk = 2; // Reduced from 3 to 1 island per chunk
export const maxViewDistance = 1; // Reduced from 5 to 3 chunks view distance


export const WORLD_SEED = 12345;
export const RENDER_DISTANCE = 1; // Number of chunks around player to render
export const CLEANUP_RADIUS = chunkSize * 4; // Distance beyond which to remove entities
// Store generated chunks
export const generatedChunks = new Set(); // Tracks fully processed chunks (both base and biome features)
export const activeWaterChunks = new Map(); // Maps water chunk ID to water mesh

// Add this map to store chunk groups
export const chunkGroups = new Map(); // Maps chunk keys to THREE.Group objects

// Declare at module scope, outside any function
const lastChunkUpdatePosition = new THREE.Vector3();

/**
 * Initialize the chunk control system and register biomes
 * Call this during game initialization
 */
export function initializeChunkSystem() {


    // Initialize the biome system with our seed
    initializeBiomeSystem(WORLD_SEED);

    // Register all biomes
    registerBiome(openBiome);
    registerBiome(arcticBiome);
    registerBiome(volcanicBiome);


}

/**
 * Generates a unique key for a chunk based on its coordinates
 * @param {number} chunkX - The X coordinate of the chunk
 * @param {number} chunkZ - The Z coordinate of the chunk
 * @returns {string} A unique key string for the chunk
 */
export function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

/**
 * Determines which chunk coordinates contain a given world position
 * @param {number} x - World X coordinate
 * @param {number} z - World Z coordinate
 * @returns {Object} Object containing the chunk x and z coordinates
 */
export function getChunkCoords(x, z) {
    return {
        x: Math.floor(x / chunkSize),
        z: Math.floor(z / chunkSize)
    };
}

export function createWaterChunk(chunkX, chunkZ, scene, waterShader) {/*
    const chunkKey = getChunkKey(chunkX, chunkZ);

    // Skip if this water chunk already exists
    if (activeWaterChunks.has(chunkKey)) {
        return;
    }

    // Create water geometry for this chunk - using fewer segments for better performance
    const waterGeometry = new THREE.PlaneGeometry(chunkSize, chunkSize, 16, 16);

    // Create water material using the shader
    const waterMaterial = new THREE.ShaderMaterial({
        uniforms: waterShader.uniforms,
        vertexShader: waterShader.vertexShader,
        fragmentShader: waterShader.fragmentShader,
        side: THREE.DoubleSide,
    });

    // Create water mesh
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;

    // Position the water chunk correctly in the world
    water.position.set(
        chunkX * chunkSize + chunkSize / 2,
        0,
        chunkZ * chunkSize + chunkSize / 2
    );

    // Add to scene
    //scene.add(water);

    // Store in active water chunks
    activeWaterChunks.set(chunkKey, water);

    return water;*/
}

/**
 * Generate a chunk at the specified coordinates with integrated biome processing
 * @param {number} chunkX - X coordinate of the chunk
 * @param {number} chunkZ - Z coordinate of the chunk
 * @param {THREE.Scene} scene - The scene to add the chunk to
 * @returns {Object} The generated chunk object
 */
function generateChunk(chunkX, chunkZ, scene) {
    const chunkKey = getChunkKey(chunkX, chunkZ);

    // Skip if already generated
    if (generatedChunks.has(chunkKey)) {
        return;
    }

    // Get biome for this chunk
    const biome = getBiomeForChunk(chunkX, chunkZ);
    const biomeProperties = biome ? biome.getProperties() : {};

    // Create a group for all objects in this chunk
    const chunkGroup = new THREE.Group();
    chunkGroup.name = `Chunk_${chunkKey}`;
    scene.add(chunkGroup);

    // Store the group in our map
    chunkGroups.set(chunkKey, chunkGroup);

    // Calculate chunk world coordinates
    const worldX = chunkX * chunkSize;
    const worldZ = chunkZ * chunkSize;

    // Process biome-specific features (like islands) using the chunk group
    if (biome) {
        // Pass the chunk group to the biome's processChunk method
        biome.processChunk(chunkX, chunkZ, chunkSize, chunkGroup, WORLD_SEED);
    }

    // Mark chunk as fully generated
    generatedChunks.add(chunkKey);

    return { chunkKey, chunkGroup };
}

/**
 * Update the chunk system for the current frame
 * This is the main entry point called from the game loop
 * @param {number} deltaTime - Time since last update in seconds
 * @param {THREE.Object3D} playerObject - The player object (boat)
 * @param {THREE.Scene} scene - The game scene
 * @param {Object} waterShader - The water shader for visual effects
 */
export function updateChunkSystem(deltaTime) {
    // Now the variable persists between function calls
    updateVisibleChunks(lastChunkUpdatePosition);

    // Use the biome system for entity visibility updates
    // Get all registered biomes and update their entity visibility
    getAllBiomes().forEach(biome => {
        // Each biome now handles visibility of its own entities
        biome.updateEntityVisibility(lastChunkUpdatePosition);
    });

    // Update biome entities (animations, behaviors, etc.)
    updateAllBiomes(deltaTime, boat.position);
}

/**
 * Update which chunks should be visible
 */
export function updateVisibleChunks(lastChunkUpdatePosition) {
    // Get current chunk coordinates based on boat position
    const currentChunk = getChunkCoords(boat.position.x, boat.position.z);

    // Set to track chunks that should be visible
    const chunksToKeep = new Set();

    // Generate chunks in view distance
    for (let xOffset = -maxViewDistance; xOffset <= maxViewDistance; xOffset++) {
        for (let zOffset = -maxViewDistance; zOffset <= maxViewDistance; zOffset++) {
            const chunkX = currentChunk.x + xOffset;
            const chunkZ = currentChunk.z + zOffset;
            const chunkKey = getChunkKey(chunkX, chunkZ);

            // Add to set of chunks to keep
            chunksToKeep.add(chunkKey);

            // Generate this chunk if needed
            generateChunk(chunkX, chunkZ, scene);
        }
    }

    // Show/hide chunk groups based on visibility
    chunkGroups.forEach((group, chunkKey) => {
        if (chunksToKeep.has(chunkKey)) {
            // Chunk should be visible
            group.visible = true;
        } else {
            // Chunk should be hidden
            group.visible = false;
        }
    });

    // Update the last chunk update position
    lastChunkUpdatePosition.copy(boat.position);
}

// Remove or modify updateAllIslandVisibility since it's now handled by biomes
// If needed for backward compatibility, you can keep it but have it delegate to biomes:
export function updateAllIslandVisibility(lastChunkUpdatePosition) {

    // For backward compatibility, delegate to biome system
    getAllBiomes().forEach(biome => {
        biome.updateEntityVisibility(lastChunkUpdatePosition);
    });
}