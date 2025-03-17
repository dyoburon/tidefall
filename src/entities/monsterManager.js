import * as THREE from 'three';
import { scene, getTime } from '../core/gameState.js';
import {
    entityChunkMap,
    registerEntity,
    updateEntityChunk,
    updateEntityVisibility,
    getVisibleChunks,
    removeEntity
} from '../world/chunkEntityController.js';
import { registerSeaMonsterTypes } from './seaMonsters.js';

// Central registry of monster types
const monsterTypes = new Map();

/**
 * Initialize the monster manager
 * Register all monster types
 */
export function initMonsterManager() {
    // Register all sea monster types
    registerSeaMonsterTypes();
}

/**
 * Register a monster type with the system
 * @param {string} typeId - Unique identifier for this monster type
 * @param {Object} typeInfo - Monster type information and handlers
 */
export function registerMonsterType(typeId, typeInfo) {
    // Store the typeInfo without the activeInstances array
    monsterTypes.set(typeId, {
        ...typeInfo
        // No activeInstances array - data will come from entityChunkMap
    });
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
        return null;
    }

    try {
        // Call the type's creation function
        const monster = typeInfo.createFn(options);

        // Safety check - if creation function didn't return a valid monster
        if (!monster || !monster.mesh) {
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

        // No more adding to active lists - just use entityChunkMap

        return monster;
    } catch (error) {
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
 */
export function spawnMonstersInChunk(chunkKey, chunkX, chunkZ, options = {}) {
    // TESTING: Force 100% spawn rate
    const spawnChance = 1.0; // Force 100% spawn chance for testing

    // Calculate position within chunk (add some randomness)
    const posX = chunkX * (options.chunkSize || 500) + Math.random() * (options.chunkSize || 500);
    const posZ = chunkZ * (options.chunkSize || 500) + Math.random() * (options.chunkSize || 500);
    const depth = -5; // Even shallower for better visibility

    // Create monster in SURFACING state to make it immediately visible
    const monster = createMonster('yellowBeast', {
        position: new THREE.Vector3(posX, depth, posZ),
        state: 'surfacing',
        stateTimer: 1 // Very short timer to reach surface quickly
    });

    if (monster) {
        // Force monster to be visible
        ensureMonsterVisibility(monster);

        // TEST - Also move monster above water for easy visibility
        monster.mesh.position.y = 5; // Position above water for easy visibility
    }
}

/**
 * Ensure monster visibility
 */
export function ensureMonsterVisibility(monster) {
    if (!monster || !monster.mesh) return;

    // Force monster to be visible
    monster.mesh.visible = true;

    // Check all mesh components
    monster.mesh.traverse(child => {
        if (child.isMesh) {
            child.visible = true;

            // Reset any transparency issues
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (material.transparent) {
                        material.opacity = 1.0;
                    }
                });
            }
        }
    });

    // Special case for monster parts
    ['dorsalFin', 'leftFin', 'rightFin'].forEach(part => {
        if (monster[part]) {
            monster[part].visible = true;
        }
    });

    // Force monster to surface quickly
    monster.state = 'surfacing';
    monster.stateTimer = 5;
    monster.velocity = new THREE.Vector3(0, 0.1, 0); // Add upward velocity
}

/**
 * Remove a monster from the game
 * @param {Object} monster - Monster to remove
 */
export function removeMonster(monster) {
    // Remove from entityChunkMap
    removeEntity('monsters', monster);

    // Find and remove from type-specific list - NO LONGER NEEDED
    // We're not maintaining separate type-specific arrays anymore

    // Remove from scene
    scene.remove(monster.mesh);

    // Call type-specific cleanup if available
    const typeInfo = monsterTypes.get(monster.typeId);
    if (typeInfo && typeInfo.cleanupFn) {
        typeInfo.cleanupFn(monster);
    }
}

/**
 * Get all active monsters
 * @returns {Array} All active monsters
 */
export function getAllMonsters() {
    // Return monsters from entityChunkMap instead of activeMonsters array
    return Array.from(entityChunkMap.monsters.keys());
}

/**
 * Get active monsters of a specific type
 * @param {string} typeId - Type of monsters to get
 * @returns {Array} Active monsters of the specified type
 */
export function getMonstersOfType(typeId) {
    // Filter monsters from entityChunkMap by typeId
    return getAllMonsters().filter(monster => monster.typeId === typeId);
}

/**
 * Set the monsters collection directly
 * @param {Array} newMonsters - Array of monsters to set
 */
export function setMonsters(newMonsters) {
    // Clear existing monsters in entityChunkMap
    entityChunkMap.monsters.clear();

    // Add all new monsters to entityChunkMap
    newMonsters.forEach(monster => {
        if (monster && monster.mesh) {
            registerEntity('monsters', monster, monster.mesh.position);
        }
    });

    console.log(`[DEBUG] Set monsters collection with ${newMonsters.length} monsters`);
}

/**
 * Single update function for all monsters
 * @param {number} deltaTime - Time since last update
 */
export function updateAllMonsters(deltaTime) {
    // Get monsters from entityChunkMap
    const monsters = getAllMonsters();

    // More frequent debugging - every 2 seconds
    if (Math.floor(getTime()) % 2 === 0) {
        console.log(`[DEBUG] Active monsters count: ${monsters.length}`);
    }

    // First update monster visibility based on chunks
    updateMonsterVisibility();

    // Update each monster based on its type
    monsters.forEach(monster => {
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