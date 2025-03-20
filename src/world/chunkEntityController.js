import * as THREE from 'three';
import {
    getChunkCoords,
    getChunkKey,
    chunkSize,
    maxViewDistance
} from './chunkControl.js';
import { boat, scene } from '../core/gameState.js';
// Import monster manager for spawning
import { createMonster, spawnMonstersInChunk } from '../entities/monsterManager.js';

// Entity tracking by type and chunk
export const entityChunkMap = {
    birds: new Map(),     // Maps entity → chunk key
    monsters: new Map(),  // Can add more entity types as needed
};

// Storage for inactive entity states
const inactiveEntityStates = {
    birds: new Map(),     // Maps chunk key → array of entity states
    monsters: new Map(),
};

// Track which chunks have already been populated with entities
const populatedChunks = new Set();

// Define monster despawn distance - monsters further than this will be despawned
const MONSTER_DESPAWN_DISTANCE_SQ = chunkSize * chunkSize * 2.25; // 1.5 chunks squared

// Add at the top of the file with other constants
const MONSTER_KEEP_DISTANCE = chunkSize * 2; // Distance to keep monsters active
const MONSTER_KEEP_DISTANCE_SQ = MONSTER_KEEP_DISTANCE * MONSTER_KEEP_DISTANCE; // Squared for efficiency

let currentPlayerChunk = null;

/**
 * Register an entity with the chunk system
 * @param {string} entityType - Type of entity ('birds', 'monsters', etc.)
 * @param {Object} entity - Entity to register
 * @param {THREE.Vector3} position - Current position
 */
export function registerEntity(entityType, entity, position) {
    if (!entityChunkMap[entityType]) {
        entityChunkMap[entityType] = new Map();
    }

    const chunkCoords = getChunkCoords(position.x, position.z);
    const chunkKey = getChunkKey(chunkCoords.x, chunkCoords.z);

    entityChunkMap[entityType].set(entity, chunkKey);
}

/**
 * Update an entity's chunk if it has moved to a new chunk
 * @param {string} entityType - Type of entity
 * @param {Object} entity - Entity to update
 * @param {THREE.Vector3} position - Current position
 * @returns {boolean} True if chunk changed
 */
export function updateEntityChunk(entityType, entity, position) {
    if (!entityChunkMap[entityType]) return false;

    const chunkCoords = getChunkCoords(position.x, position.z);
    const newChunkKey = getChunkKey(chunkCoords.x, chunkCoords.z);
    const currentChunkKey = entityChunkMap[entityType].get(entity);

    if (newChunkKey !== currentChunkKey) {
        entityChunkMap[entityType].set(entity, newChunkKey);
        return true;
    }

    return false;
}

/**
 * Save entity state and remove it from the active scene
 * @param {string} entityType - Type of entity
 * @param {Object} entity - Entity to remove
 * @param {Function} getStateFn - Function to extract state from entity
 * @param {Function} cleanupFn - Function to remove entity from scene
 */
export function saveEntityState(entityType, entity, getStateFn, cleanupFn) {
    const chunkKey = entityChunkMap[entityType].get(entity);

    if (!chunkKey) return;

    // Get entity state using the provided function
    const state = getStateFn(entity);

    // Save state in the inactive states map
    if (!inactiveEntityStates[entityType].has(chunkKey)) {
        inactiveEntityStates[entityType].set(chunkKey, []);
    }
    inactiveEntityStates[entityType].get(chunkKey).push(state);

    // Clean up entity using the provided function
    cleanupFn(entity);

    // Remove from tracking
    entityChunkMap[entityType].delete(entity);
}

/**
 * Get saved states for entities in a chunk
 * @param {string} entityType - Type of entity
 * @param {string} chunkKey - Chunk key to get states for
 * @returns {Array} Array of entity states or empty array
 */
export function getEntityStatesForChunk(entityType, chunkKey) {
    if (!inactiveEntityStates[entityType].has(chunkKey)) {
        return [];
    }

    const states = inactiveEntityStates[entityType].get(chunkKey);
    inactiveEntityStates[entityType].delete(chunkKey);

    return states;
}

/**
 * Update entity visibility based on current visible chunks
 * @param {Set} visibleChunks - Set of keys for currently visible chunks
 * @param {string} entityType - Type of entity to update
 * @param {Function} getStateFn - Function to extract state from entity
 * @param {Function} cleanupFn - Function to remove entity from scene
 * @param {Function} respawnFn - Function to respawn entities from states
 */
export function updateEntityVisibility(visibleChunks, entityType, getStateFn, cleanupFn, respawnFn) {
    // Find entities to remove (in chunks that are no longer visible)
    const entitiesToRemove = [];
    const chunksBeingDespawned = new Set();

    entityChunkMap[entityType].forEach((chunkKey, entity) => {
        // Special handling for monsters - use distance-based check instead of chunk boundaries
        if (entityType === 'monsters') {
            // Only consider removal if the monster's chunk is not visible
            if (!visibleChunks.has(chunkKey)) {
                if (entity && entity.mesh && entity.mesh.position && boat && boat.position) {
                    // Calculate squared distance to player for efficiency
                    const dx = entity.mesh.position.x - boat.position.x;
                    const dy = entity.mesh.position.y - boat.position.y;
                    const dz = entity.mesh.position.z - boat.position.z;
                    const distanceSquared = dx * dx + dy * dy + dz * dz;

                    // Only despawn if beyond the keep distance
                    if (distanceSquared > MONSTER_KEEP_DISTANCE_SQ) {
                        entitiesToRemove.push(entity);
                        chunksBeingDespawned.add(chunkKey);

                    } else {

                    }
                } else {
                    // Entity is invalid, remove it
                    entitiesToRemove.push(entity);
                    chunksBeingDespawned.add(chunkKey);
                }
            }
        } else {
            // Standard chunk-based logic for other entity types
            if (!visibleChunks.has(chunkKey)) {
                entitiesToRemove.push(entity);
                chunksBeingDespawned.add(chunkKey);
            }
        }
    });

    // Save state and remove entities
    entitiesToRemove.forEach(entity => {
        saveEntityState(entityType, entity, getStateFn, cleanupFn);
    });

    // Remove chunks from populatedChunks when we despawn all their entities
    chunksBeingDespawned.forEach(chunkKey => {
        if (entityType === 'monsters') {
            // Only mark a chunk as unpopulated if all monsters in it are gone
            let monstersRemaining = 0;
            entityChunkMap.monsters.forEach((entityChunkKey, monster) => {
                if (entityChunkKey === chunkKey) monstersRemaining++;
            });

            if (monstersRemaining === 0) {
                populatedChunks.delete(chunkKey);

            }
        }
    });

    // Check for chunks that are now visible and need entities respawned
    visibleChunks.forEach(chunkKey => {
        if (inactiveEntityStates[entityType].has(chunkKey)) {
            const states = getEntityStatesForChunk(entityType, chunkKey);
            respawnFn(states, chunkKey);
        }
    });
}

/**
 * Get the currently visible chunks based on player position
 * @returns {Set} Set of visible chunk keys
 */
export function getVisibleChunks() {
    const currentChunk = getChunkCoords(boat.position.x, boat.position.z);
    const visibleChunks = new Set();

    for (let xOffset = -maxViewDistance; xOffset <= maxViewDistance; xOffset++) {
        for (let zOffset = -maxViewDistance; zOffset <= maxViewDistance; zOffset++) {
            const chunkX = currentChunk.x + xOffset;
            const chunkZ = currentChunk.z + zOffset;
            const chunkKey = getChunkKey(chunkX, chunkZ);
            visibleChunks.add(chunkKey);
        }
    }

    return visibleChunks;
}

/**
 * Main function to update entity chunks - call this every frame
 */
export function updateAllEntityChunks() {
    // Get current player chunk
    const playerChunkCoords = getChunkCoords(boat.position.x, boat.position.z);
    const playerChunkKey = getChunkKey(playerChunkCoords.x, playerChunkCoords.z);

    // On first load or entering a new chunk, only populate the current chunk
    if (currentPlayerChunk !== playerChunkKey) {

        currentPlayerChunk = playerChunkKey;

        // Only populate player's current chunk if needed
        if (!populatedChunks.has(playerChunkKey) && !inactiveEntityStates.monsters.has(playerChunkKey)) {

            populateChunkWithEntities(playerChunkKey);
            populatedChunks.add(playerChunkKey);
        }
    }

    // Get visible chunks but DO NOT populate them all
    const visibleChunks = getVisibleChunks();

    // REMOVED: The code that was populating all visible chunks
    // visibleChunks.forEach(chunkKey => {
    //    if (!populatedChunks.has(chunkKey) && !inactiveEntityStates.monsters.has(chunkKey)) {
    //        populateChunkWithEntities(chunkKey);
    //        populatedChunks.add(chunkKey);
    //    }
    // });

    // Still need to return visible chunks for other systems
    return visibleChunks;
}

/**
 * Populate a chunk with appropriate entities
 * @param {string} chunkKey - Key of the chunk to populate
 */
function populateChunkWithEntities(chunkKey) {
    // Extract chunk coordinates from key
    const [chunkX, chunkZ] = chunkKey.split(',').map(Number);

    // BIRDS: Birds are handled separately in birds.js

    // MONSTERS: Spawn monsters in this chunk
    populateChunkWithMonsters(chunkKey, chunkX, chunkZ);
}

/**
 * Populate a chunk with monsters
 * @param {string} chunkKey - Chunk key 
 * @param {number} chunkX - Chunk X coordinate
 * @param {number} chunkZ - Chunk Z coordinate
 */
function populateChunkWithMonsters(chunkKey, chunkX, chunkZ) {
    // First check if this chunk already has monsters (from entity map)
    let chunkHasMonsters = false;
    entityChunkMap.monsters.forEach((existingChunkKey, monster) => {
        if (existingChunkKey === chunkKey) {
            chunkHasMonsters = true;
        }
    });

    // Skip if already has monsters
    if (chunkHasMonsters) {

        return;
    }



    // Use the enhanced monster manager to spawn monsters in this chunk
    spawnMonstersInChunk(chunkKey, chunkX, chunkZ, {
        chunkSize: chunkSize,
        depth: -20, // Underwater depth
        spawnChance: 1.0, // Always spawn monsters when we request a new chunk
        minCount: 1,
        maxCount: 2, // Up to 2 monsters per chunk
        typeWeights: {
            'yellowBeast': 1.0,
            'kraken': 0.0,
            'seaSerpent': 0.0,
            'phantomJellyfish': 0.0
        }
    });
}

/**
 * Remove an entity from the chunk system
 * @param {string} entityType - Type of entity ('birds', 'monsters', etc.)
 * @param {Object} entity - Entity to remove
 * @returns {boolean} True if entity was successfully removed
 */
export function removeEntity(entityType, entity) {
    if (!entityChunkMap[entityType]) {

        return false;
    }

    const wasRemoved = entityChunkMap[entityType].delete(entity);

    if (wasRemoved) {

    } else {

    }

    return wasRemoved;
}

/**
 * Get all monsters currently in the game
 * @returns {Array} Array of all active monsters
 */
export function getAllMonsters() {
    if (!entityChunkMap || !entityChunkMap.monsters) {

        return []; // Return empty array as fallback
    }
    return Array.from(entityChunkMap.monsters.keys());
} 