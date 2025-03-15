import * as THREE from 'three';
import {
    getChunkCoords,
    getChunkKey,
    chunkSize,
    maxViewDistance
} from './chunkControl.js';
import { boat, scene } from '../core/gameState.js';

// Entity tracking by type and chunk
const entityChunkMap = {
    birds: new Map(),     // Maps entity → chunk key
    monsters: new Map(),  // Can add more entity types as needed
};

// Storage for inactive entity states
const inactiveEntityStates = {
    birds: new Map(),     // Maps chunk key → array of entity states
    monsters: new Map(),
};

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

    entityChunkMap[entityType].forEach((chunkKey, entity) => {
        if (!visibleChunks.has(chunkKey)) {
            entitiesToRemove.push(entity);
        }
    });

    // Save state and remove entities
    entitiesToRemove.forEach(entity => {
        saveEntityState(entityType, entity, getStateFn, cleanupFn);
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
 * Update all entity types
 */
export function updateAllEntityChunks() {
    const visibleChunks = getVisibleChunks();

    // Individual entity systems will call updateEntityVisibility with their specific handlers
    // This function mainly exists as a central update point if needed

    return visibleChunks; // Return for use by entity systems
} 