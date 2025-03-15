import * as THREE from 'three';
import { scene, getTime } from '../core/gameState.js';
import {
    registerEntity,
    updateEntityChunk,
    updateEntityVisibility,
    getVisibleChunks
} from '../world/chunkEntityController.js';
import { registerSeaMonsterTypes } from './seaMonsters.js';

// Central registry of monster types
const monsterTypes = new Map();
const activeMonsters = []; // All active monsters

/**
 * Initialize the monster manager
 * Register all monster types
 */
export function initMonsterManager() {
    // Register all sea monster types
    registerSeaMonsterTypes();

    console.log("Monster manager initialized with all monster types");
}

/**
 * Register a monster type with the system
 * @param {string} typeId - Unique identifier for this monster type
 * @param {Object} typeInfo - Monster type information and handlers
 */
export function registerMonsterType(typeId, typeInfo) {
    monsterTypes.set(typeId, {
        ...typeInfo,
        activeInstances: [] // Track instances of this type
    });
    console.log(`Registered monster type: ${typeId}`);
}

/**
 * Create a monster of the specified type
 * @param {string} typeId - Monster type to create
 * @param {Object} options - Options for monster creation
 * @returns {Object} The created monster
 */
export function createMonster(typeId, options = {}) {
    const typeInfo = monsterTypes.get(typeId);
    if (!typeInfo) {
        console.error(`Unknown monster type: ${typeId}`);
        return null;
    }

    // Debug output to help diagnose issues
    console.log(`Creating monster of type: ${typeId} with options:`, options);

    try {
        // Call the type's creation function
        const monster = typeInfo.createFn(options);

        // Safety check - if creation function didn't return a valid monster
        if (!monster || !monster.mesh) {
            console.error(`Creation function for ${typeId} did not return a valid monster object`);
            return null;
        }

        // Set common properties
        monster.typeId = typeId;
        monster.createdAt = getTime();

        // Set monster health based on type
        if (!monster.health) {
            monster.health = getMonsterTypeHealth(typeId);
        }

        // Add to scene
        scene.add(monster.mesh);

        // Register with entity chunk system
        registerEntity('monsters', monster, monster.mesh.position);

        // Add to active lists
        activeMonsters.push(monster);
        typeInfo.activeInstances.push(monster);

        console.log(`Successfully created ${typeId} monster`);
        return monster;
    } catch (error) {
        console.error(`Error creating monster of type ${typeId}:`, error);
        return null;
    }
}

/**
 * Get standard health value for a monster type
 * @param {string} typeId - Type of monster
 * @returns {number} Base health value
 */
function getMonsterTypeHealth(typeId) {
    switch (typeId) {
        case 'kraken':
            return 6; // Tougher than regular monster
        case 'seaSerpent':
            return 4; // Average toughness
        case 'phantomJellyfish':
            return 3; // Fragile but dangerous
        case 'yellowBeast':
        default:
            return 3; // Original monster health
    }
}

/**
 * Spawn monsters in a specific chunk
 * @param {string} chunkKey - Chunk key
 * @param {number} chunkX - Chunk X coordinate
 * @param {number} chunkZ - Chunk Z coordinate 
 * @param {Object} options - Additional spawn options
 */
export function spawnMonstersInChunk(chunkKey, chunkX, chunkZ, options = {}) {
    // Reduce spawn chance to 30% (from 70%) to have fewer monsters
    const spawnChance = 0.3;

    // Random check - 70% of chunks will have no monsters at all
    if (Math.random() > spawnChance) {
        return; // Skip this chunk for spawning
    }

    // SIMPLIFIED: Only ever spawn ONE monster per chunk
    const monstersToSpawn = 1;

    // SIMPLIFIED: Always spawn the Yellow Beast
    const selectedType = 'yellowBeast';

    // Calculate position within chunk (add some randomness)
    const posX = chunkX * (options.chunkSize || 500) + Math.random() * (options.chunkSize || 500);
    const posZ = chunkZ * (options.chunkSize || 500) + Math.random() * (options.chunkSize || 500);
    const depth = options.depth || -20; // Default underwater depth

    // Create single Yellow Beast monster with options
    const monster = createMonster(selectedType, {
        position: new THREE.Vector3(posX, depth, posZ),
        state: 'lurking',
        stateTimer: 30 + Math.random() * 30
    });

    if (monster) {
        console.log(`TEST MODE: Spawned exactly ONE Yellow Beast in chunk ${chunkKey} at ${posX.toFixed(0)}, ${depth}, ${posZ.toFixed(0)}`);
    }
}

/**
 * Remove a monster from the game
 * @param {Object} monster - Monster to remove
 */
export function removeMonster(monster) {
    // Find and remove from active monsters
    const index = activeMonsters.indexOf(monster);
    if (index !== -1) {
        activeMonsters.splice(index, 1);
    }

    // Find and remove from type-specific list
    const typeInfo = monsterTypes.get(monster.typeId);
    if (typeInfo) {
        const typeIndex = typeInfo.activeInstances.indexOf(monster);
        if (typeIndex !== -1) {
            typeInfo.activeInstances.splice(typeIndex, 1);
        }
    }

    // Remove from scene
    scene.remove(monster.mesh);

    // Call type-specific cleanup if available
    if (typeInfo && typeInfo.cleanupFn) {
        typeInfo.cleanupFn(monster);
    }
}

/**
 * Get all active monsters
 * @returns {Array} All active monsters
 */
export function getAllMonsters() {
    return [...activeMonsters];
}

/**
 * Get active monsters of a specific type
 * @param {string} typeId - Type of monsters to get
 * @returns {Array} Active monsters of the specified type
 */
export function getMonstersOfType(typeId) {
    const typeInfo = monsterTypes.get(typeId);
    return typeInfo ? [...typeInfo.activeInstances] : [];
}

/**
 * Single update function for all monsters
 * @param {number} deltaTime - Time since last update
 */
export function updateAllMonsters(deltaTime) {
    // First update monster visibility based on chunks
    updateMonsterVisibility();

    // Update each monster based on its type
    activeMonsters.forEach(monster => {
        const typeInfo = monsterTypes.get(monster.typeId);
        if (typeInfo && typeInfo.updateFn) {
            typeInfo.updateFn(monster, deltaTime);
        }
    });
}

/**
 * Update monster visibility based on chunks
 */
function updateMonsterVisibility() {
    const visibleChunks = getVisibleChunks();

    updateEntityVisibility(
        visibleChunks,
        'monsters',
        // Get monster state function
        (monster) => {
            const typeInfo = monsterTypes.get(monster.typeId);
            if (!typeInfo || !typeInfo.getStateFn) return null;

            // Get type-specific state
            const state = typeInfo.getStateFn(monster);
            return {
                ...state,
                typeId: monster.typeId // Always include type ID
            };
        },
        // Monster cleanup function
        (monster) => {
            removeMonster(monster);
        },
        // Monster respawn function
        (monsterStates, chunkKey) => {
            // Group states by monster type
            const statesByType = {};

            monsterStates.forEach(state => {
                if (!state || !state.typeId) return;

                if (!statesByType[state.typeId]) {
                    statesByType[state.typeId] = [];
                }
                statesByType[state.typeId].push(state);
            });

            // Respawn each type of monster
            Object.entries(statesByType).forEach(([typeId, states]) => {
                const typeInfo = monsterTypes.get(typeId);
                if (!typeInfo || !typeInfo.respawnFn) return;

                typeInfo.respawnFn(states, chunkKey);
            });
        }
    );
} 