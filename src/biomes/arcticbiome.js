import * as THREE from 'three';
import BiomeInterface from './biomeinterface.js';
import { boat as playerObject, scene } from '../core/gameState.js';
import { createIceberg, checkIcebergCollision } from '../world/iceberg.js';
import { createSnowIsland } from '../world/snowIsland.js';
import { initSnow, clearAllSnow } from '../weather/snow.js';
import {
    createIsland,
    checkAllIslandCollisions,
    updateAllIslandEffects,
    areShoreEffectsEnabled
} from '../world/islands.js';
import { removeShore, setShoreVisibility } from '../world/shores.js';
import { toggleFog, setFogProperties } from '../environment/fog.js';

const ARCTIC_FOG_CONFIG = {
    color: 0xADD8E6,           // Red fog
    density: 0.001,            // Appropriate density for exponential fog
    enableWindEffect: true,    // Whether wind affects fog color
    windEffectColor: 0xADD8E6, // Custom color for wind effect
    windEffectStrength: 0.4    // Strength of wind color effect (0-1)
};

// Configuration for the arctic biome
const ARCTIC_BIOME_CONFIG = {
    id: 'arctic',
    name: 'Arctic',
    properties: {
        // Custom water color for this biome (slight blue-green tint)
        waterColor: new THREE.Color(0x85b8cb),
        // Very low island density 
        islandDensity: 0.3,
        // High iceberg density
        icebergDensity: 2.0,
        // Snow island density - add this new property
        snowIslandDensity: 0.5,
        // Icebergs spawn parameters
        icebergMinDistance: 200,
        icebergMaxDistance: 600,
        // Larger average scale for icebergs
        icebergScaleMin: 0.8,
        icebergScaleMax: 4.0,
        // Weather parameters
        snowChance: 0.85,        // High chance of snow
        snowIntensity: 3000,     // More snow particles
        windStrength: 0.06,      // Stronger wind
        // Environment parameters
        temperature: -5,         // Below freezing
        // Entity spawn parameters
        birdDensity: 0.4,        // Fewer birds
        fishDensity: 0.6,        // Fewer fish
        polarBearChance: 0.05,   // Chance of polar bears on icebergs
    },
    isDefault: false,
    weight: 1 // Rarity of this biome
};

/**
 * Arctic biome implementation
 * Features icebergs and snow in a frozen environment
 */
class ArcticBiome extends BiomeInterface {
    constructor(config = ARCTIC_BIOME_CONFIG) {
        super(config);

        // Add icebergs to tracked entities
        this.spawnedEntities.icebergs = [];

        // Add snow islands to tracked entities
        this.spawnedEntities.snowIslands = [];

        // Initialize snow system
        this.snowSystem = initSnow();
        this.isSnowActive = false;

        // Track when to update snow
        this.snowUpdateTimer = 0;
    }

    /**
     * Register this biome with the biome system
     * @returns {Object} The registered biome properties
     */
    register() {
        // Return the biome properties for registration
        return {
            id: this.id,
            name: this.name,
            properties: this.properties,
            isDefault: this.isDefault,
            weight: this.weight
        };
    }

    /**
     * Determines if an iceberg should spawn at given coordinates
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @returns {boolean} Whether an iceberg should spawn
     */
    shouldSpawnIceberg(x, z, seed) {
        return this.shouldSpawnFeature(x, z, seed, 'iceberg', 0.05);
    }

    /**
     * Determines if an island should spawn at given coordinates
     * (Much rarer in arctic biome)
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @returns {boolean} Whether an island should spawn
     */
    shouldSpawnIsland(x, z, seed) {
        return this.shouldSpawnFeature(x, z, seed, 'island', 0.008);
    }

    /**
     * Determines if a snow island should spawn at given coordinates
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @returns {boolean} Whether a snow island should spawn
     */
    shouldSpawnSnowIsland(x, z, seed) {
        return this.shouldSpawnFeature(x, z, seed, 'snowIsland', 1.0);
    }

    /**
     * Process a chunk in the arctic biome, spawning icebergs and islands as needed
     * @param {number} chunkX - Chunk X coordinate
     * @param {number} chunkZ - Chunk Z coordinate
     * @param {number} chunkSize - Size of the chunk in world units
     * @param {THREE.Scene} scene - The scene to add entities to
     * @param {number} seed - World seed for consistent generation
     * @returns {Array} Array of spawned entities
     */
    processChunk(chunkX, chunkZ, chunkSize, scene, seed) {
        // Create a unique key for this chunk
        const chunkKey = `${chunkX},${chunkZ}`;

        // Skip if already processed
        if (this.processedChunks.has(chunkKey)) {
            return [];
        }

        // Mark as processed
        this.processedChunks.add(chunkKey);

        // Calculate world coordinates for this chunk
        const worldX = chunkX * chunkSize;
        const worldZ = chunkZ * chunkSize;

        const spawnedInThisChunk = [];

        // Create a random function based on seed for consistency
        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        // Decide if this chunk gets any snow islands (maybe 50% chance)
        let spawnSnowIslands = random() < 1.0;

        // If yes, decide how many (1 or 2)
        let snowIslandsToSpawn = spawnSnowIslands ? (random() < 0.7 ? 1 : 2) : 0;
        let snowIslandsSpawned = 0;

        // Grid-based approach to entity placement
        const gridCells = 4; // Divide chunk into a 4x4 grid
        const cellSize = chunkSize / gridCells;

        for (let cellX = 0; cellX < gridCells; cellX++) {
            for (let cellZ = 0; cellZ < gridCells; cellZ++) {
                // Calculate position at center of the cell
                const posX = worldX + (cellX + 0.5) * cellSize;
                const posZ = worldZ + (cellZ + 0.5) * cellSize;

                // Add some randomness to the position
                const jitterX = (random() - 0.5) * cellSize * 0.5;
                const jitterZ = (random() - 0.5) * cellSize * 0.5;

                const finalX = posX + jitterX;
                const finalZ = posZ + jitterZ;
                const position = new THREE.Vector3(finalX, 0, finalZ);

                // Replace your existing snow island check with:
                if (snowIslandsToSpawn > snowIslandsSpawned) {
                    // Randomize which cells get a snow island (1 in 4 chance per cell)
                    if (random() < 0.25) {
                        // Make sure we don't spawn too close to other entities
                        if (!this.checkEntityCollisions(position, 500)) {
                            console.log("Spawning snow island at", finalX, finalZ);

                            // Create the snow island
                            const snowIsland = createSnowIsland(finalX, finalZ, seed * (finalX * finalZ), scene);

                            if (snowIsland) {
                                this.spawnedEntities.snowIslands.push(snowIsland);
                                spawnedInThisChunk.push({
                                    type: 'snowIsland',
                                    entity: snowIsland,
                                    position: position
                                });

                                // Increment the count of spawned islands
                                snowIslandsSpawned++;

                                // Skip other entity checks for this cell
                                continue;
                            }
                        }
                    }
                }

                // If we didn't spawn a snow island, try an iceberg
                if (this.shouldSpawnIceberg(finalX, finalZ, seed)) {
                    // Make sure we don't spawn too close to other entities
                    if (!this.checkEntityCollisions(position, this.properties.icebergMinDistance)) {
                        // Scale factor based on configuration
                        const scale = this.properties.icebergScaleMin +
                            random() * (this.properties.icebergScaleMax - this.properties.icebergScaleMin);

                        // Create the iceberg
                        const iceberg = createIceberg({
                            position: position,
                            random: random,
                            scale: scale,
                            parent: scene
                        });

                        if (iceberg) {
                            this.spawnedEntities.icebergs.push(iceberg);
                            spawnedInThisChunk.push({
                                type: 'iceberg',
                                entity: iceberg,
                                position: position
                            });
                        }
                    }
                }
                // Less frequently, try to spawn an island
                else if (this.shouldSpawnIsland(finalX, finalZ, seed)) {
                    // Make sure we don't spawn too close to other entities
                    if (!this.checkEntityCollisions(position, this.properties.islandMinDistance || 300)) {
                        // Create the island (snow-covered)
                        const island = createIsland(finalX, finalZ, seed * (finalX * finalZ), scene, {
                            snowCovered: true, // Flag for snow-covered texture
                            heightScale: 0.8   // Slightly lower islands
                        });

                        if (island) {
                            this.spawnedEntities.islands.push(island);
                            spawnedInThisChunk.push({
                                type: 'island',
                                entity: island,
                                position: position
                            });
                        }
                    }
                }
            }
        }

        return spawnedInThisChunk;
    }

    /**
     * Check if a position collides with any existing entities
     * @param {THREE.Vector3} position - Position to check
     * @param {number} minDistance - Minimum distance required
     * @returns {boolean} Whether there is a collision
     */
    checkEntityCollisions(position, minDistance) {
        // Check iceberg collisions
        for (const iceberg of this.spawnedEntities.icebergs) {
            const distance = position.distanceTo(iceberg.collider.center);
            if (distance < minDistance) {
                return true;
            }
        }

        // Check snow island collisions
        for (const snowIsland of this.spawnedEntities.snowIslands) {
            const distance = position.distanceTo(snowIsland.collider.center);
            if (distance < minDistance) {
                return true;
            }
        }

        // Check island collisions
        return checkAllIslandCollisions(position, minDistance);
    }

    /**
     * Spawns icebergs and islands in a set of chunks around a position
     * @param {THREE.Vector3} centerPosition - Center position to spawn around
     * @param {THREE.Scene} scene - The scene to add entities to
     * @param {number} seed - World seed for consistent generation
     * @param {number} radius - Radius in chunks to spawn around
     * @returns {Array} Array of spawned entities
     */
    spawnAroundPosition(centerPosition, scene, seed, radius = 2) {
        const chunkSize = 1000; // Size of each chunk in world units

        // Calculate the central chunk coordinates
        const centerChunkX = Math.floor(centerPosition.x / chunkSize);
        const centerChunkZ = Math.floor(centerPosition.z / chunkSize);

        let allSpawned = [];

        // Process chunks in a radius around the center
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const chunkX = centerChunkX + dx;
                const chunkZ = centerChunkZ + dz;

                const spawned = this.processChunk(
                    chunkX,
                    chunkZ,
                    chunkSize,
                    scene,
                    seed
                );

                allSpawned = allSpawned.concat(spawned);
            }
        }

        // Make sure snow is active when in this biome
        if (!this.isSnowActive) {
            this.startSnow(centerPosition);
        }

        return allSpawned;
    }

    /**
     * Start snow in this biome
     * @param {THREE.Vector3} playerPosition - Player position
     */
    startSnow(playerPosition) {
        // Configure snow intensity based on biome properties
        const intensity = {
            count: this.properties.snowIntensity || 2000,
            windStrength: this.properties.windStrength || 0.03
        };

        this.snowSystem.start(playerPosition, intensity);
        this.isSnowActive = true;
    }

    /**
     * Update function to be called in the game loop
     * @param {number} deltaTime - Time since last update
     * @param {THREE.Vector3} playerPosition - Current player position
     */
    update(deltaTime, playerPosition) {
        // Update snow system
        if (this.isSnowActive) {
            this.snowSystem.update(deltaTime, playerPosition);
        } else if (playerPosition) {
            // Start snow if not active
            this.startSnow(playerPosition);
        }

        // Occasionally update snow conditions based on weather patterns
        this.snowUpdateTimer -= deltaTime;
        if (this.snowUpdateTimer <= 0) {
            // Reset timer (30-60 seconds)
            this.snowUpdateTimer = 30 + Math.random() * 30;

            // Maybe change snow intensity based on "weather patterns"
            if (Math.random() < this.properties.snowChance) {
                // Sometimes have heavier snow
                if (Math.random() < 0.3) {
                    const heavySnow = {
                        count: this.properties.snowIntensity * 1.5,
                        windStrength: this.properties.windStrength * 1.5
                    };
                    this.snowSystem.start(playerPosition, heavySnow);
                } else {
                    const normalSnow = {
                        count: this.properties.snowIntensity,
                        windStrength: this.properties.windStrength
                    };
                    this.snowSystem.start(playerPosition, normalSnow);
                }
            } else {
                // Rarely have light or no snow
                if (Math.random() < 0.2) {
                    this.snowSystem.stop();
                    this.isSnowActive = false;
                } else {
                    const lightSnow = {
                        count: this.properties.snowIntensity * 0.5,
                        windStrength: this.properties.windStrength * 0.7
                    };
                    this.snowSystem.start(playerPosition, lightSnow);
                }
            }
        }

        // Update all island effects
        updateAllIslandEffects(deltaTime);

        // Future: Update entity animations, behaviors, etc.
    }

    /**
     * Handles entity cleanup when moving away from an area
     * @param {THREE.Vector3} centerPosition - Current player position
     * @param {number} cleanupRadius - Radius beyond which to remove entities
     */
    cleanupDistantEntities(centerPosition, cleanupRadius = 3000) {
        // Check each iceberg and remove if too far
        const keepIcebergs = [];

        for (let i = 0; i < this.spawnedEntities.icebergs.length; i++) {
            const iceberg = this.spawnedEntities.icebergs[i];
            const distance = centerPosition.distanceTo(iceberg.collider.center);

            if (distance > cleanupRadius) {
                // Remove from scene
                if (iceberg.mesh && iceberg.mesh.parent) {
                    iceberg.mesh.parent.remove(iceberg.mesh);
                }
            } else {
                keepIcebergs.push(iceberg);
            }
        }

        // Update the array with only kept icebergs
        this.spawnedEntities.icebergs = keepIcebergs;

        // Also clean up snow islands
        const keepSnowIslands = [];

        for (let i = 0; i < this.spawnedEntities.snowIslands.length; i++) {
            const snowIsland = this.spawnedEntities.snowIslands[i];
            const distance = centerPosition.distanceTo(snowIsland.collider.center);

            if (distance > cleanupRadius) {
                // Remove from scene
                if (snowIsland.mesh && snowIsland.mesh.parent) {
                    snowIsland.mesh.parent.remove(snowIsland.mesh);
                }
            } else {
                keepSnowIslands.push(snowIsland);
            }
        }

        // Update the array with only kept snow islands
        this.spawnedEntities.snowIslands = keepSnowIslands;

        // Clean up islands using same logic as in OpenBiome
        const keepIslands = [];

        for (let i = 0; i < this.spawnedEntities.islands.length; i++) {
            const island = this.spawnedEntities.islands[i];
            const distance = centerPosition.distanceTo(island.collider.center);

            if (distance > cleanupRadius) {
                // Remove from scene
                if (island.mesh && island.mesh.parent) {
                    island.mesh.parent.remove(island.mesh);
                }

                // Remove shore effect if exists
                if (island.shore) {
                    removeShore(island.shore);
                }
            } else {
                keepIslands.push(island);
            }
        }

        // Update the arrays with only kept entities
        this.spawnedEntities.islands = keepIslands;
    }

    /**
     * Clear all spawned entities and reset the biome
     * @param {THREE.Scene} scene - The scene containing the entities
     */
    clearAll(scene) {
        // Clear icebergs
        this.spawnedEntities.icebergs.forEach(iceberg => {
            if (iceberg.mesh && iceberg.mesh.parent) {
                iceberg.mesh.parent.remove(iceberg.mesh);
            }
        });
        this.spawnedEntities.icebergs = [];

        // Clear snow islands
        this.spawnedEntities.snowIslands.forEach(snowIsland => {
            if (snowIsland.mesh && snowIsland.mesh.parent) {
                snowIsland.mesh.parent.remove(snowIsland.mesh);
            }
        });
        this.spawnedEntities.snowIslands = [];

        // Clear islands
        this.spawnedEntities.islands.forEach(island => {
            if (island.mesh && island.mesh.parent) {
                island.mesh.parent.remove(island.mesh);
            }

            // Remove shore effect if exists
            if (island.shore) {
                removeShore(island.shore);
            }
        });
        this.spawnedEntities.islands = [];

        // Clear snow particles
        clearAllSnow();
        this.isSnowActive = false;

        // Reset all other entity arrays
        for (const key in this.spawnedEntities) {
            if (!['icebergs', 'islands', 'snowIslands'].includes(key)) {
                this.spawnedEntities[key] = [];
            }
        }

        // Clear processed chunks set
        this.processedChunks.clear();
    }

    /**
     * Update visibility of entities based on player position
     * @param {THREE.Vector3} lastUpdatePosition - Position during last visibility update
     */
    updateEntityVisibility(lastUpdatePosition) {
        // Get player position for distance calculations
        const playerPosition = playerObject.position;

        // Get current chunk coordinates based on player position
        const chunkSize = 1000; // Make sure this matches your system
        const currentChunkX = Math.floor(playerPosition.x / chunkSize);
        const currentChunkZ = Math.floor(playerPosition.z / chunkSize);

        // Set visibility distance
        const visibleDistance = 2000;
        const maxViewDistance = 2; // Chunks away to keep visible

        // Track which chunks should be visible
        const chunksToKeep = new Set();

        // Generate a set of chunks that should be visible
        for (let xOffset = -maxViewDistance; xOffset <= maxViewDistance; xOffset++) {
            for (let zOffset = -maxViewDistance; zOffset <= maxViewDistance; zOffset++) {
                const chunkX = currentChunkX + xOffset;
                const chunkZ = currentChunkZ + zOffset;
                const chunkKey = `${chunkX},${chunkZ}`;

                // Add to set of chunks to keep
                chunksToKeep.add(chunkKey);
            }
        }

        // Update iceberg visibility
        for (let i = 0; i < this.spawnedEntities.icebergs.length; i++) {
            const iceberg = this.spawnedEntities.icebergs[i];

            // Calculate distance to player
            const distance = playerPosition.distanceTo(iceberg.collider.center);

            // Get the chunk this iceberg belongs to
            const icebergChunkX = Math.floor(iceberg.collider.center.x / chunkSize);
            const icebergChunkZ = Math.floor(iceberg.collider.center.z / chunkSize);
            const icebergChunkKey = `${icebergChunkX},${icebergChunkZ}`;

            // Check if chunk is within view distance
            const isChunkVisible = chunksToKeep.has(icebergChunkKey);

            // Update visibility
            if (iceberg.mesh) {
                iceberg.mesh.visible = distance <= visibleDistance && isChunkVisible;
            }
        }

        // Update island visibility
        for (let i = 0; i < this.spawnedEntities.islands.length; i++) {
            const island = this.spawnedEntities.islands[i];

            // Calculate distance to player
            const distance = playerPosition.distanceTo(island.collider.center);

            // Get the chunk this island belongs to
            const islandChunkX = Math.floor(island.collider.center.x / chunkSize);
            const islandChunkZ = Math.floor(island.collider.center.z / chunkSize);
            const islandChunkKey = `${islandChunkX},${islandChunkZ}`;

            // Check if chunk is within view distance
            const isChunkVisible = chunksToKeep.has(islandChunkKey);

            // Update visibility
            if (island.mesh) {
                island.mesh.visible = distance <= visibleDistance && isChunkVisible;
            }

            // Hide/show shore effects if they exist
            if (areShoreEffectsEnabled() && island.shore) {
                setShoreVisibility(island.id, distance <= visibleDistance && isChunkVisible);
            }
        }

        // Copy the last update position to track when we've moved significantly
        lastUpdatePosition.copy(playerPosition);
    }

    /**
     * Cleanup when leaving this biome
     * @param {THREE.Vector3} playerPosition - Player position
     */
    exitBiome(playerPosition) {
        // Stop snow when leaving the arctic biome
        if (this.isSnowActive) {
            this.snowSystem.stop();
            this.isSnowActive = false;
            console.log("Player left Arctic biome - stopping snow");
        }
    }

    handleFogTransition(isEntering, playerObject) {
        setFogProperties(ARCTIC_FOG_CONFIG);
        if (isEntering) {
            console.log("Entering volcanic biome - activating red fog");
            toggleFog(true); // Explicitly fade in the fog
        } else {
            console.log("Leaving volcanic biome - dissipating fog");
            toggleFog(false); // Explicitly fade out the fog
        }
    }
}

// Create singleton instance
const arcticBiome = new ArcticBiome(ARCTIC_BIOME_CONFIG);

// Export the instance and config
export default arcticBiome;
export { ARCTIC_BIOME_CONFIG }; 