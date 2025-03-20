import * as THREE from 'three';
import { createIsland, islandColliders } from './islands.js';
import { updateVisibleChunks as updateRegularIslands } from './chunkControl.js';
import { createRockyIsland, getRockyIslandColliders } from './rockyIslands.js';
import { createCoastalCliffScene } from './coastalCliff.js';

// Consistent chunk size used across the game
const chunkSize = 600; // Size of each "chunk" of ocean

// Define these functions directly in islandManager.js since they're not exported from islands.js
// Function to generate a chunk key based on coordinates
function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

// Function to determine which chunk coordinates contain a given position
function getChunkCoords(x, z) {
    return {
        x: Math.floor(x / chunkSize),
        z: Math.floor(z / chunkSize)
    };
}

// Constants for island generation and distribution
const ROCKY_ISLAND_PROBABILITY = 0.15; // Reduced from 0.3 to 0.15 (15% chance of a rocky island vs regular island)
const ISLAND_SPACING_MULTIPLIER = 3.0; // Increased from 2.5 to 3.0 to space islands further apart

/**
 * Enhanced chunk generation that integrates both regular and rocky islands
 * @param {number} chunkX - Chunk X coordinate
 * @param {number} chunkZ - Chunk Z coordinate
 * @param {THREE.Scene} scene - The scene to add islands to
 * @param {object} options - Additional options for island generation
 */
export function generateMixedChunk(chunkX, chunkZ, scene, options = {}) {
    const {
        islandsPerChunk = 1, // Reduced from 3 to 1 island per chunk
        rockyIslandProbability = ROCKY_ISLAND_PROBABILITY
    } = options;

    // Create a deterministic random function for this chunk
    // Use the chunk coordinates as seed
    let chunkSeed = Math.abs(chunkX * 73856093 ^ chunkZ * 19349663);

    const seededRandom = () => {
        chunkSeed = (chunkSeed * 9301 + 49297) % 233280;
        return chunkSeed / 233280;
    };

    // Track island positions to prevent overlapping
    const islandPositions = [];

    // Generate islands for this chunk
    for (let i = 0; i < islandsPerChunk; i++) {
        // Determine island type - rocky or regular
        const isRockyIsland = seededRandom() < rockyIslandProbability;

        // Rocky islands need more space, adjust margin accordingly
        const margin = isRockyIsland ? 150 : 100;

        // Set minimum distance between islands based on type
        const minDistance = isRockyIsland ? 350 : 200;

        // Try multiple positions until a valid one is found
        let attempts = 0;
        let validPosition = false;
        let islandX, islandZ;

        // Try up to 10 times to find a valid position
        while (!validPosition && attempts < 10) {
            // Generate position within this chunk with margin
            islandX = (chunkX * chunkSize) + margin + seededRandom() * (chunkSize - 2 * margin);
            islandZ = (chunkZ * chunkSize) + margin + seededRandom() * (chunkSize - 2 * margin);

            // Check if this position is far enough from existing islands
            validPosition = true;
            for (const pos of islandPositions) {
                const dx = islandX - pos.x;
                const dz = islandZ - pos.z;
                const distSquared = dx * dx + dz * dz;

                // If too close to another island, position is invalid
                if (distSquared < minDistance * minDistance) {
                    validPosition = false;
                    break;
                }
            }

            attempts++;
        }

        // If we couldn't find a valid position after multiple attempts, skip this island
        if (!validPosition) {
            continue;
        }

        // Create a seed for this specific island based on its coordinates
        const islandSeed = Math.floor(islandX * 13371 + islandZ * 92717);

        // Create either a rocky or regular island
        if (isRockyIsland) {
            //createRockyIsland(islandX, islandZ, islandSeed, scene);
        } else {
            //createIsland(islandX, islandZ, islandSeed, scene);
        }

        // Remember this position to prevent overlap
        islandPositions.push({ x: islandX, z: islandZ, isRocky: isRockyIsland });
    }
}

/**
 * Update island visibility and generate new islands as needed
 * @param {Object} boat - The player's boat object with position
 * @param {THREE.Scene} scene - The scene to add islands to
 * @param {Object} waterShader - The water shader instance
 * @param {THREE.Vector3} lastChunkUpdatePosition - The last position where chunks were updated
 * @param {Object} options - Additional options for island generation
 */
export function updateVisibleIslands(boat, scene, waterShader, lastChunkUpdatePosition, options = {}) {
    // Return early if boat is undefined or null
    if (!boat || !boat.position) {

        return;
    }

    // First, update regular islands (this will update water chunks too)
    updateRegularIslands(boat, scene, waterShader, lastChunkUpdatePosition);

    // Get current chunk coordinates based on boat position
    const currentChunk = getChunkCoords(boat.position.x, boat.position.z);

    // Define the maximum view distance (in chunks) - reduce view distance for rocky islands
    const maxViewDistance = options.maxViewDistance || 1; // Reduced from 2 to 1

    // Generate mixed chunks that include rocky islands
    // We do this with a different random seed to avoid conflicts with regular island generation
    for (let xOffset = -maxViewDistance; xOffset <= maxViewDistance; xOffset++) {
        for (let zOffset = -maxViewDistance; zOffset <= maxViewDistance; zOffset++) {
            // Only generate rocky islands in 1/4 of the chunks
            // This creates a much sparser distribution of rocky islands
            if ((currentChunk.x + xOffset + currentChunk.z + zOffset) % 4 === 0) {
                const chunkX = currentChunk.x + xOffset;
                const chunkZ = currentChunk.z + zOffset;
                const chunkKey = `rocky_${getChunkKey(chunkX, chunkZ)}`;

                // Skip if we've already generated this rocky island chunk before
                if (options.generatedRockyChunks && options.generatedRockyChunks.has(chunkKey)) {
                    continue;
                }

                // Generate this chunk with mixed islands
                generateMixedChunk(chunkX, chunkZ, scene, {
                    ...options,
                    // Keep islands per chunk low
                    islandsPerChunk: 1
                });

                // Mark this chunk as generated
                if (options.generatedRockyChunks) {
                    options.generatedRockyChunks.add(chunkKey);
                }
            }
        }
    }
}

/**
 * Get all island colliders for collision detection
 * @returns {Array} Combined array of all island colliders
 */
export function getAllIslandColliders() {
    return [...islandColliders, ...getRockyIslandColliders()];
}

/**
 * Checks if the given position collides with any island
 * @param {THREE.Vector3} position - The position to check
 * @param {number} extraRadius - Extra radius to add to the collision check (buffer)
 * @returns {boolean} - Whether there is a collision
 */
export function checkIslandCollision(position, extraRadius = 2) {
    // Get all island colliders
    const allColliders = getAllIslandColliders();

    // Check collision with any island
    for (const collider of allColliders) {
        const distanceSquared = position.distanceToSquared(collider.center);
        const combinedRadius = collider.radius + extraRadius;

        if (distanceSquared < combinedRadius * combinedRadius) {
            return true;
        }
    }

    return false;
}

/**
 * Finds the nearest island to the boat
 * @param {Object} boat - The player's boat
 * @returns {Object|null} - The nearest island or null if none found
 */
export function findNearestIsland(boat) {
    // Return null if boat is undefined or null
    if (!boat || !boat.position) {
        return null;
    }

    const allColliders = getAllIslandColliders();

    let nearestDistance = Infinity;
    let nearestIsland = null;

    for (const collider of allColliders) {
        const distance = boat.position.distanceTo(collider.center);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIsland = collider;
        }
    }

    return nearestIsland;
}

/**
 * Spawns a dramatic coastal cliff scene at the specified position
 * @param {THREE.Scene} scene - The scene to add the cliff to
 * @param {THREE.Vector3} position - Position to place the cliff (optional)
 */
export function spawnCoastalCliffScene(scene, position = new THREE.Vector3(0, 0, 0)) {

    const cliffScene = createCoastalCliffScene(scene, position);
    return cliffScene;
} 