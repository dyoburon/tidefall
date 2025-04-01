import * as THREE from 'three';
import { scene } from '../core/gameState.js';
import { createHugeIsland } from './hugeIsland.js';
import { createPortal } from '../portals/vibeverse.js';

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
    ]
};

// Keep track of spawned elements
const spawnedElements = {
    hugeIsland: null,
    portals: []
};

/**
 * Set up the curated spawn area with predefined elements
 * @returns {Object} References to all spawned elements
 */
export function setupSpawnArea() {
    console.log("Setting up curated spawn area...");

    // Spawn huge island near the spawn point
    spawnHugeIslandNearSpawn();

    // Spawn portals
    spawnPortals();

    console.log("Spawn area setup complete");
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

    console.log(`Spawning huge island at (${x}, ${z})`);

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
 * Clear all spawned elements from the scene
 */
export function clearSpawnArea() {
    // Handle cleanup if necessary
    spawnedElements.hugeIsland = null;
    spawnedElements.portals = [];
} 