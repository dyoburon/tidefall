import * as THREE from 'three';
import {
    createIsland,
    SPAWN_CONTROLS,
    spawnIslands,
    spawnBlockCaveFromIsland,
    checkAllIslandCollisions,
    updateAllIslandEffects,
    areShoreEffectsEnabled
} from '../world/islands.js';
import { removeShore, setShoreVisibility } from '../world/shores.js';
import BiomeInterface from './biomeinterface.js';
import { boat as playerObject } from '../core/gameState.js';
import { toggleFog, setFogProperties, transitionFogType } from '../environment/fog.js';
import { initRain, startRain, updateRain } from '../weather/rain.js';
import { createRockyIsland } from '../world/rockyIslands.js';

export const OPEN_FOG_CONFIG = {
    color: 0xD3D3D3,           // Red fog
    density: 0.0,            // Appropriate density for exponential fog
    enableWindEffect: true,    // Whether wind affects fog color
    windEffectColor: 0xD3D3D3, // Custom color for wind effect
    windEffectStrength: 0.4    // Strength of wind color effect (0-1)
};

// Configuration for the open biome
const OPEN_BIOME_CONFIG = {
    id: 'open_water',
    name: 'Open Water',
    properties: {
        // Higher island density compared to default
        islandDensity: 1.4,
        // Custom water color for this biome
        waterColor: new THREE.Color(0x0066aa),
        // Island spawn parameters
        islandMinDistance: 300,
        islandMaxDistance: 800,
        // Random small variation in island height
        islandHeightVariation: 0.2,
        // Entity spawn parameters (for future implementation)
        birdDensity: 0.8,
        fishDensity: 1.2,
        monsterChance: 0.03,
        hasFog: true,
        fogType: 'open'
    },
    // Make this the default biome
    isDefault: true,
    // Higher weight means more common
    weight: 2
};

/**
 * Open Water biome implementation
 * Features islands scattered across open ocean with various sea life
 */
class OpenBiome extends BiomeInterface {
    constructor(config = OPEN_BIOME_CONFIG) {
        super(config);

        // Initialize rain system
        this.rainSystem = initRain();
        this.isRainActive = false;

        // Track when to update rain
        this.rainUpdateTimer = 0;
    }

    /**
     * Register this biome with the biome system
     * @returns {Object} The registered biome properties
     */
    register() {
        // Simply return the biome properties for registration
        return {
            id: this.id,
            name: this.name,
            properties: this.properties,
            isDefault: this.isDefault,
            weight: this.weight
        };
    }

    /**
     * Determines if an island should spawn at given coordinates
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @returns {boolean} Whether an island should spawn
     */
    shouldSpawnIsland(x, z, seed) {
        return this.shouldSpawnFeature(x, z, seed, 'island', 0.02);
    }

    /**
     * Process a chunk in the open biome, spawning islands as needed
     * @param {number} chunkX - Chunk X coordinate
     * @param {number} chunkZ - Chunk Z coordinate
     * @param {number} chunkSize - Size of the chunk in world units
     * @param {THREE.Group} chunkGroup - The chunk group to add entities to
     * @param {number} seed - World seed for consistent generation
     * @returns {Array} Array of spawned entities
     */
    processChunk(chunkX, chunkZ, chunkSize, chunkGroup, seed) {
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

        // Grid-based approach to island placement
        const gridCells = 4; // Divide chunk into a 4x4 grid
        const cellSize = chunkSize / gridCells;

        for (let cellX = 0; cellX < gridCells; cellX++) {
            for (let cellZ = 0; cellZ < gridCells; cellZ++) {
                // Calculate position at center of the cell
                const posX = worldX + (cellX + 0.5) * cellSize;
                const posZ = worldZ + (cellZ + 0.5) * cellSize;

                // Add some randomness to the position
                const jitterX = (Math.random() - 0.5) * cellSize * 0.5;
                const jitterZ = (Math.random() - 0.5) * cellSize * 0.5;

                const finalX = posX + jitterX;
                const finalZ = posZ + jitterZ;

                // Check if we should spawn an island here
                if (this.shouldSpawnIsland(finalX, finalZ, seed)) {
                    // Make sure we don't spawn too close to other islands
                    const position = new THREE.Vector3(finalX, 0, finalZ);

                    // Check for collisions with a larger radius to ensure spacing
                    if (!checkAllIslandCollisions(position, this.properties.islandMinDistance || 200)) {
                        // Decide if this should be a regular island or a rocky island (30% chance of rocky)
                        const isRocky = Math.random() < 0.3;

                        let island;
                        if (isRocky) {
                            // Create rocky island with the chunk group
                            const rockySeed = Math.floor(Math.random() * 1000000);
                            island = createRockyIsland(finalX, finalZ, rockySeed, chunkGroup);
                        } else {
                            // Create regular island with the chunk group
                            island = createIsland(finalX, finalZ, seed * (finalX * finalZ), chunkGroup);
                        }

                        if (island) {
                            // Store island type in the entity for later reference
                            island.islandType = isRocky ? 'rocky' : 'standard';

                            this.spawnedEntities.islands.push(island);
                            spawnedInThisChunk.push({
                                type: isRocky ? 'rockyIsland' : 'island',
                                entity: island,
                                position: new THREE.Vector3(finalX, 0, finalZ)
                            });
                        }
                    }
                }
            }
        }

        // Occasionally spawn a cave/structure system
        if (Math.random() < 0.02 && SPAWN_CONTROLS.blockCave) {
            const structureX = worldX + Math.random() * chunkSize;
            const structureZ = worldZ + Math.random() * chunkSize;
            const position = new THREE.Vector3(structureX, 0, structureZ);

            // Ensure we're not too close to other structures
            if (!checkAllIslandCollisions(position, 500)) {
                // Pass chunkGroup instead of scene
                const cave = spawnBlockCaveFromIsland(chunkGroup, position);
                if (cave) {
                    this.spawnedEntities.structures.push(cave);
                    spawnedInThisChunk.push({
                        type: 'cave',
                        entity: cave,
                        position: position
                    });
                }
            }
        }

        return spawnedInThisChunk;
    }

    /**
     * Spawns islands in a set of chunks around a position
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

        return allSpawned;
    }

    /**
     * Handles entity cleanup when moving away from an area
     * @param {THREE.Vector3} centerPosition - Current player position
     * @param {number} cleanupRadius - Radius beyond which to remove entities
     */
    cleanupDistantEntities(centerPosition, cleanupRadius = 3000) {
        // Check each island and remove if too far
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

        // Similarly handle other entity types when implemented
    }

    /**
     * Start rain in this biome
     * @param {THREE.Vector3} playerPosition - Player position
     */
    startRain(playerPosition) {
        // Configure rain intensity
        const intensity = {
            count: 0,           // Number of raindrops
            windStrength: 0.03    // Wind strength affecting rain
        };

        startRain(playerPosition, intensity);
        this.isRainActive = true;

    }

    /**
     * Update function to be called in the game loop
     * @param {number} deltaTime - Time since last update
     * @param {THREE.Vector3} playerPosition - Current player position
     */
    update(deltaTime, playerPosition) {
        // Update all island effects
        updateAllIslandEffects(deltaTime);

        // Update rain system
        if (this.isRainActive) {
            updateRain(deltaTime, playerPosition);
        } else if (playerPosition) {
            // Start rain if not active
            this.startRain(playerPosition);
        }

        // Future: Update entity animations, behaviors, etc.
    }

    /**
     * Clear all spawned entities and reset the biome
     * @param {THREE.Scene} scene - The scene containing the entities
     */
    clearAll(scene) {
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

        // Reset all entity arrays
        for (const key in this.spawnedEntities) {
            this.spawnedEntities[key] = [];
        }

        // Clear processed chunks set
        this.processedChunks.clear();
    }

    /**
     * Update visibility of islands and other entities based on player position
     * @param {THREE.Vector3} lastUpdatePosition - Position during last visibility update
     */
    updateEntityVisibility(lastUpdatePosition) {
        return;
        // Get player position for distance calculations
        const playerPosition = playerObject.position;

        // Get current chunk coordinates based on player position
        const chunkSize = 1000; // Make sure this matches your system
        const currentChunkX = Math.floor(playerPosition.x / chunkSize);
        const currentChunkZ = Math.floor(playerPosition.z / chunkSize);

        // Set visibility distance (should match chunking system)
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

        // Islands to remove (too far or in invisible chunks)
        const islandsToRemove = [];

        // Check each island for visibility
        for (let i = 0; i < this.spawnedEntities.islands.length; i++) {
            const island = this.spawnedEntities.islands[i];

            // Calculate distance to player
            const distance = playerPosition.distanceTo(island.collider.center);

            // Get the chunk this island belongs to
            const islandChunkX = Math.floor(island.collider.center.x / chunkSize);
            const islandChunkZ = Math.floor(island.collider.center.z / chunkSize);
            const islandChunkKey = `${islandChunkX},${islandChunkZ}`;

            // If the island is too far or its chunk is not in the keep set, mark for removal
            if (distance > visibleDistance || !chunksToKeep.has(islandChunkKey)) {
                islandsToRemove.push(i);

                // Hide the island while keeping it in our entities array
                // (we handle actual removal in cleanupDistantEntities)
                if (island.mesh) {
                    island.mesh.visible = false;
                }

                // Hide shore effects if they exist
                if (areShoreEffectsEnabled() && island.shore) {
                    setShoreVisibility(island.id, false);
                }
            } else {
                // Make sure the island is visible
                if (island.mesh) {
                    island.mesh.visible = true;
                }

                // Show shore effects if they exist
                if (areShoreEffectsEnabled() && island.shore) {
                    setShoreVisibility(island.id, true);
                }
            }
        }

        // Copy the last update position to track when we've moved significantly
        lastUpdatePosition.copy(playerPosition);
    }

    handleFogTransition(isEntering, playerObject) {
        setFogProperties(OPEN_FOG_CONFIG);
        if (isEntering) {

            toggleFog(true); // Explicitly fade in the fog
        } else {

            toggleFog(false); // Explicitly fade out the fog
        }
    }

    handleFogTypeTransition(fromType, toType, boat) {
        // Call the new method in fog.js
        transitionFogType(fromType, toType);
    }
}

// Create singleton instance
const openBiome = new OpenBiome(OPEN_BIOME_CONFIG);

// Export the instance and config
export default openBiome;
