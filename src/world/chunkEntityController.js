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
import entitySpawner from '../entities/entityspawner.js'; // Import the EntitySpawner
// Import villager functionality
import { createVillager, respawnVillagers, activeVillagers } from '../entities/villagers.js';
import { activeIslands } from './islands.js';

// Entity tracking by type and chunk
export const entityChunkMap = {
    birds: new Map(),     // Maps entity → chunk key
    monsters: new Map(),  // Can add more entity types as needed
    villagers: new Map(), // Added villagers tracking
};

// Storage for inactive entity states
const inactiveEntityStates = {
    birds: new Map(),     // Maps chunk key → array of entity states
    monsters: new Map(),
    villagers: new Map(), // Added villagers storage
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
        } else if (entityType === 'villagers') {
            // Only mark a chunk as unpopulated if all villagers in it are gone
            let villagersRemaining = 0;
            entityChunkMap.villagers.forEach((entityChunkKey, villager) => {
                if (entityChunkKey === chunkKey) villagersRemaining++;
            });

            if (villagersRemaining === 0) {
                populatedChunks.delete(chunkKey);
            }
        }
    });

    // Now check for chunks that need to have entities added
    visibleChunks.forEach(chunkKey => {
        if (!populatedChunks.has(chunkKey)) {
            // Chunk needs to be populated
            populateChunkWithEntities(chunkKey);
        } else if (inactiveEntityStates[entityType] && inactiveEntityStates[entityType].has(chunkKey)) {
            // We have inactive entities to restore
            const states = getEntityStatesForChunk(entityType, chunkKey);
            if (states.length > 0 && respawnFn) {
                respawnFn(states, chunkKey);
            }
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
export function populateChunkWithEntities(chunkKey) {
    console.log("populating chunk with monsters")
    if (populatedChunks.has(chunkKey)) {
        return;
    }

    // Extract chunk coordinates from the key
    const [chunkX, chunkZ] = chunkKey.split(',').map(Number);

    // Populate with monsters
    populateChunkWithMonsters(chunkKey, chunkX, chunkZ);

    // Populate with villagers
    populateChunkWithVillagers(chunkKey, chunkX, chunkZ);

    // Mark chunk as populated
    populatedChunks.add(chunkKey);
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
 * Populate a chunk with villagers
 * @param {string} chunkKey - Key of the chunk to populate
 */
export function populateChunkWithVillagers(chunkKey) {
    if (!chunkKey || populatedChunks.has(chunkKey)) {
        return;
    }

    // Check if we have saved villagers for this chunk
    const savedVillagers = getEntityStatesForChunk('villagers', chunkKey);
    if (savedVillagers && savedVillagers.length > 0) {
        // We have saved villagers, respawn them using the villagers.js respawn function
        respawnVillagers(savedVillagers);
    } else {
        console.log("Spawning new villagers for chunk", chunkKey);
        // No saved villagers, generate new ones using our enhanced EntitySpawner

        // Use the activeIslands Map from islands.js instead of scene traversal
        const islands = [];

        // Always collect all islands regardless of other conditions
        // This ensures we attempt to spawn villagers on every island
        activeIslands.forEach((island) => {
            // Add all islands to the array with minimal filtering
            if (island && island.mesh) {
                islands.push({
                    id: island.id || island.mesh.id || `island-${Math.random().toString(36).substr(2, 9)}`,
                    mesh: island.mesh,
                    collider: island.collider || { radius: 50 }
                });
            }
        });

        console.log(`Found ${islands.length} islands for villager spawning in chunk ${chunkKey}`);

        // Use the EntitySpawner to find and spawn villagers in this chunk
        if (islands.length > 0) {
            // Parse chunk coordinates from the key
            const [chunkX, chunkZ] = chunkKey.split(',').map(Number);

            // Calculate chunk bounds with a larger buffer to ensure we catch all islands
            // that might be relevant to this chunk
            const bufferSize = chunkSize * 0.25; // 25% buffer to catch islands at the edges
            const chunkBounds = {
                minX: chunkX * chunkSize - chunkSize / 2 - bufferSize,
                maxX: chunkX * chunkSize + chunkSize / 2 + bufferSize,
                minZ: chunkZ * chunkSize - chunkSize / 2 - bufferSize,
                maxZ: chunkZ * chunkSize + chunkSize / 2 + bufferSize
            };

            // Use the entitySpawner to spawn villagers with guaranteed spawning
            // via our modified EntitySpawner implementation
            const spawnedVillagers = entitySpawner.spawnEntitiesInChunk(
                'villagers',
                createVillager,
                chunkBounds,
                islands
            );

            // Process the newly spawned villagers to add them to the scene and register them
            if (spawnedVillagers && spawnedVillagers.length > 0) {
                spawnedVillagers.forEach(villager => {
                    // Add to the scene
                    scene.add(villager);

                    // Add to active villagers tracking array in villagers.js
                    activeVillagers.push(villager);

                    // Register with the chunk system
                    registerEntity('villagers', villager, villager.position);
                });
            }

            console.log(`Spawned ${spawnedVillagers.length} villagers in chunk ${chunkKey}`);
        } else {
            console.log(`No islands found for villager spawning in chunk ${chunkKey}`);
        }
    }

    // Mark this chunk as populated
    populatedChunks.add(chunkKey);
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

/**
 * Get all villagers currently in the game
 * @returns {Array} Array of all active villagers
 */
export function getAllVillagers() {
    if (!entityChunkMap || !entityChunkMap.villagers) {
        return []; // Return empty array as fallback
    }
    return Array.from(entityChunkMap.villagers.keys());
}

/**
 * Get all entities of a specific type in a chunk
 * @param {string} entityType - Type of entity ('birds', 'monsters', 'villagers', etc.)
 * @param {string} chunkKey - The chunk key to get entities from
 * @returns {Array} Array of entities in the specified chunk
 */
export function getEntitiesInChunk(entityType, chunkKey) {
    if (!entityChunkMap || !entityChunkMap[entityType]) {
        return [];
    }

    const entitiesInChunk = [];
    entityChunkMap[entityType].forEach((entityChunkKey, entity) => {
        if (entityChunkKey === chunkKey) {
            entitiesInChunk.push(entity);
        }
    });

    return entitiesInChunk;
}

/**
 * Check if a specific entity type exists in a chunk
 * @param {string} entityType - Type of entity
 * @param {string} chunkKey - Chunk key to check
 * @returns {boolean} True if the chunk has entities of the specified type
 */
export function hasEntitiesInChunk(entityType, chunkKey) {
    return getEntitiesInChunk(entityType, chunkKey).length > 0;
}