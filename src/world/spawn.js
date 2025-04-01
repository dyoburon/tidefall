import * as THREE from 'three';
import { scene } from '../core/gameState.js';
import { createHugeIsland } from './hugeIsland.js';
import { createPortal } from '../portals/vibeverse.js';
import { createNpcShip } from '../entities/npcShip.js';

// Configuration for the spawn area
const SPAWN_CONFIG = {
    // Distance from center (0,0,0) to place huge island
    hugeIslandDistance: 1500, // Closer to spawn than the default 2000

    // Seeds for consistent generation
    hugeIslandSeed: 42424242,

    // Portal configuration
    portalPositions: [
        { x: -500, y: 0, z: 0, name: "Vibeverse", url: "https://portal.pieter.com" },
        { x: -500, y: 0, z: 600, name: "Jetski", url: "https://jetski.cemilsevim.com/" },
    ],

    // NPC ship configuration - expanded with more ships and ship types
    npcShipPositions: [
        // Patrol ships near spawn - aggressive
        {
            x: -200, y: 0, z: -100,
            type: 'mediumpirate',
            options: {
                moveSpeed: 12.0,
                patrolRadius: 400,
                combatEnabled: true,
                attackRange: 100,
                aggroRange: 150
            }
        },
        {
            x: -350, y: 0, z: 0,
            type: 'mediumpirate',
            options: {
                moveSpeed: 12.0,
                patrolRadius: 400,
                combatEnabled: true,
                attackRange: 100,
                aggroRange: 150
            }
        },
        {
            x: 500, y: 0, z: 570,
            type: 'mediumpirate',
            options: {
                moveSpeed: 12.0,
                patrolRadius: 400,
                combatEnabled: true,
                attackRange: 100,
                aggroRange: 150
            }
        },
        {
            x: 450, y: 0, z: 500,
            type: 'mediumpirate',
            options: {
                moveSpeed: 12.0,
                patrolRadius: 400,
                combatEnabled: true,
                attackRange: 100,
                aggroRange: 150
            }
        },
        {
            x: -100, y: 0, z: -100,
            type: 'smallpirate',
            options: {
                moveSpeed: 15.0,
                patrolRadius: 500,
                combatEnabled: true,
                attackRange: 90,
                aggroRange: 130
            }
        },
        {
            x: -400, y: 0, z: 500,
            type: 'smallcolonial',
            options: {
                moveSpeed: 13.0,
                patrolRadius: 350,
                combatEnabled: true,
                attackRange: 80,
                aggroRange: 120
            }
        },

        // Distant patrol ships - passive (non-combat)
        {
            x: -100, y: 0, z: 300,
            type: 'mediumcolonial',
            options: {
                moveSpeed: 9.0,
                patrolRadius: 600,
                combatEnabled: false
            }
        },
        {
            x: -100, y: 0, z: 600,
            type: 'mediumpirate',
            options: {
                moveSpeed: 10.0,
                patrolRadius: 700,
                combatEnabled: false
            }
        },

        // Ships around the huge island - aggressive with longer range
        {
            x: -300, y: 0, z: 300,
            type: 'massivepirate',
            options: {
                moveSpeed: 7.0,
                patrolRadius: 500,
                combatEnabled: true,
                attackRange: 120,
                aggroRange: 180
            }
        },
        {
            x: -350, y: 0, z: 0,
            type: 'smallpirate',
            options: {
                moveSpeed: 14.0,
                patrolRadius: 300,
                combatEnabled: true,
                attackRange: 80,
                aggroRange: 150
            }
        }
    ]
};

// Keep track of spawned elements
const spawnedElements = {
    hugeIsland: null,
    portals: [],
    npcShips: []
};

/**
 * Set up the curated spawn area with predefined elements
 * @returns {Object} References to all spawned elements
 */
export function setupSpawnArea() {


    // Spawn huge island near the spawn point
    spawnHugeIslandNearSpawn();

    // Spawn portals
    spawnPortals();

    // Spawn NPC ships
    spawnNpcShips();


    return spawnedElements;
}

/**
 * Spawn a huge island at a fixed distance from the spawn point
 * @returns {Object} The created huge island
 */
function spawnHugeIslandNearSpawn() {
    // Position the huge island at a specific location relative to spawn
    const angle = 360; // 45 degrees
    const x = Math.cos(angle) * SPAWN_CONFIG.hugeIslandDistance;
    const z = Math.sin(angle) * SPAWN_CONFIG.hugeIslandDistance;



    // Create the island with a fixed seed for consistency
    const hugeIsland = createHugeIsland(
        x,
        z,
        SPAWN_CONFIG.hugeIslandSeed,
        null // No chunk group as it will be added directly to scene
    );

    spawnedElements.hugeIsland = hugeIsland;
    return hugeIsland;
}

/**
 * Spawn predefined portals around the spawn area
 * @returns {Array} The created portals
 */
function spawnPortals() {
    SPAWN_CONFIG.portalPositions.forEach(portalConfig => {
        const position = new THREE.Vector3(
            portalConfig.x,
            portalConfig.y,
            portalConfig.z
        );

        const portal = createPortal(
            position,
            portalConfig.name,
            portalConfig.url
        );

        spawnedElements.portals.push(portal);
    });

    return spawnedElements.portals;
}

/**
 * Spawn NPC ships around the spawn area
 * @returns {Array} The created NPC ships
 */
function spawnNpcShips() {
    SPAWN_CONFIG.npcShipPositions.forEach(shipConfig => {
        const position = new THREE.Vector3(
            shipConfig.x,
            shipConfig.y,
            shipConfig.z
        );

        const npcShip = createNpcShip(position, {
            shipType: shipConfig.type || 'mediumpirate',
            ...shipConfig.options // Add any custom options like speed
        });

        spawnedElements.npcShips.push(npcShip);
    });


    return spawnedElements.npcShips;
}

/**
 * Clear all spawned elements from the scene
 */
export function clearSpawnArea() {
    // Handle cleanup if necessary
    spawnedElements.hugeIsland = null;
    spawnedElements.portals = [];
    spawnedElements.npcShips = [];
} 