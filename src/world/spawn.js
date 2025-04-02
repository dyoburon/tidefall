import * as THREE from 'three';
import { scene } from '../core/gameState.js';
import { createHugeIsland } from './hugeIsland.js';
import { createPortal } from '../portals/vibeverse.js';
import { createNpcShip } from '../entities/npcShip.js';
import { createIsland } from './islands.js';

const urlParams = new URLSearchParams(window.location.search);
const refParam = urlParams.get('ref');

// Configuration for the spawn area
const SPAWN_CONFIG = {
    // Distance from center (0,0,0) to place huge island
    hugeIslandDistance: 1500, // Closer to spawn than the default 2000

    // Seeds for consistent generation
    hugeIslandSeed: 42424242,

    // Respawn configuration
    respawnTime: 15, // Time in seconds before a destroyed ship respawns
    respawnEnabled: true, // Whether respawning is enabled

    // Portal configuration
    portalPositions: [
        {
            x: -500, y: 125, z: 0,
            name: "Vibeverse",
            url: "https://portal.pieter.com",
            modelPath: './portal_green.glb',
            scale: 350.0,
            rotation: { x: 0, y: Math.PI / 2, z: 0 } // Rotate 180 degrees around Y axis
        },
        {
            x: -500, y: 125, z: 600,
            name: "Jetski",
            url: "https://jetski.cemilsevim.com/",
            modelPath: './portal_blue.glb',
            scale: 350.0,
            rotation: { x: 0, y: Math.PI / 2, z: 0 } // Rotate 180 degrees around Y axis
        },
        {
            x: 1200, y: 125, z: 600,
            name: "Back",
            ref: true,
            url: "",
            modelPath: './portal_blue.glb',
            scale: 350.0,
            rotation: { x: 0, y: Math.PI / 2, z: 0 } // Rotate 180 degrees around Y axis
        }
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
            type: 'smallpirate',
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
            type: 'mediumpirate',
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
            type: 'mediumpirate',
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
            type: 'mediumpirate',
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
    npcShips: [],
    destroyedShips: [] // Track destroyed ships for respawning
};

/**
 * Set up the curated spawn area with predefined elements
 * @returns {Object} References to all spawned elements
 */
export function setupSpawnArea() {
    // Clear any existing destroyed ships tracking
    spawnedElements.destroyedShips = [];

    // Spawn huge island near the spawn point
    spawnHugeIslandNearSpawn();

    // Spawn portals
    spawnPortals();

    // Spawn NPC ships
    spawnNpcShips();

    // Start respawn system if enabled
    if (SPAWN_CONFIG.respawnEnabled) {
        startRespawnSystem();
    }

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
        null, // No chunk group as it will be added directly to scene
        null, // Use random model selection
        700   // Default height
    );

    // Create a second huge island with island2.glb model - using different angle
    const angle2 = -Math.PI / 3; // -60 degrees in radians
    const x2 = Math.cos(angle2) * (SPAWN_CONFIG.hugeIslandDistance + 1250);
    const z2 = Math.sin(angle2) * (SPAWN_CONFIG.hugeIslandDistance + 650);

    const hugeIsland2 = createHugeIsland(
        x2,
        z2,
        SPAWN_CONFIG.hugeIslandSeed + 1, // Different seed
        null,
        '/island2.glb', // Specify the model
        500    // Higher elevation
    );

    spawnedElements.hugeIsland = [hugeIsland, hugeIsland2];

    // Create islands with specific mega structures
    // Note: Seeds are carefully chosen to generate specific structures based on the random() calculation in islands.js

    // Ancient Temple (seed chosen to ensure random() < 0.2 and structureType = 0)
    const island1 = createIsland(0, -300, 10347, scene);

    // Lighthouse (seed chosen to ensure random() < 0.2 and structureType = 1)
    const island2 = createIsland(1085, 0, 12348, scene);

    // Giant Statue/Roman Obelisk (seed chosen to ensure random() < 0.2 and structureType = 2)
    const island3 = createIsland(1815, -50, 11000, scene);

    // Ruined Tower (seed chosen to ensure random() < 0.2 and structureType = 3)
    //const island4 = createIsland(1085, 0, 14000, scene);

    // Regular island with temples and vegetation (seed chosen to ensure random() >= 0.2)
    const island5 = createIsland(2145, 400, 13000, scene);

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

        if (portalConfig.ref) {
            if (!refParam) {
                return;
            }

            portalConfig.url = "https://" + refParam;
        }

        const portal = createPortal(
            position,
            portalConfig.name,
            portalConfig.url,
            {
                modelPath: portalConfig.modelPath,
                scale: portalConfig.scale,
                rotation: portalConfig.rotation
            }
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
 * Start the respawn system to check for and respawn destroyed ships
 */
function startRespawnSystem() {
    setInterval(() => {
        const currentTime = Date.now() / 1000; // Convert to seconds

        // Check each destroyed ship
        spawnedElements.destroyedShips = spawnedElements.destroyedShips.filter(destroyedShip => {
            // Check if enough time has passed for respawn
            if (currentTime - destroyedShip.destroyedTime >= SPAWN_CONFIG.respawnTime) {
                // Respawn the ship with original configuration
                const newShip = createNpcShip(
                    new THREE.Vector3(
                        destroyedShip.config.x,
                        destroyedShip.config.y,
                        destroyedShip.config.z
                    ),
                    {
                        type: destroyedShip.config.type,
                        ...destroyedShip.config.options
                    }
                );

                spawnedElements.npcShips.push(newShip);
                return false; // Remove from destroyed ships list
            }
            return true; // Keep in destroyed ships list
        });
    }, 5000); // Check every 5 seconds
}

/**
 * Track a destroyed ship for respawning
 * @param {Object} shipConfig - The original configuration of the destroyed ship
 */
export function trackDestroyedShip(shipConfig) {
    if (SPAWN_CONFIG.respawnEnabled) {
        spawnedElements.destroyedShips.push({
            config: shipConfig,
            destroyedTime: Date.now() / 1000 // Current time in seconds
        });
    }
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