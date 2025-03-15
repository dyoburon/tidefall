import * as THREE from 'three';
import { scene, getTime } from '../core/gameState.js';
import {
    registerEntity,
    updateEntityChunk,
    updateEntityVisibility,
    getVisibleChunks
} from '../world/chunkEntityController.js';

// Central registry of monster types
const monsterTypes = new Map();
const activeMonsters = []; // All active monsters

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

    // Call the type's creation function
    const monster = typeInfo.createFn(options);

    // Set common properties
    monster.typeId = typeId;
    monster.createdAt = getTime();

    // Add to scene
    scene.add(monster.mesh);

    // Register with entity chunk system
    registerEntity('monsters', monster, monster.mesh.position);

    // Add to active lists
    activeMonsters.push(monster);
    typeInfo.activeInstances.push(monster);

    return monster;
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