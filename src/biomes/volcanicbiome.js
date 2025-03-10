import * as THREE from 'three';
import BiomeInterface from './biomeinterface.js';
import { boat as playerObject, scene } from '../core/gameState.js';
import { createIsland, checkAllIslandCollisions, updateAllIslandEffects, areShoreEffectsEnabled } from '../world/islands.js';
import { removeShore, setShoreVisibility } from '../world/shores.js';
import { createActiveVolcanoIsland, updateActiveVolcanoes } from '../world/volcanicIsland.js';
import { toggleFog } from '../environment/fog.js';


const VOLCANIC_FOG_CONFIG = {
    color: 0xFF0000,           // Red fog
    density: 0.001,            // Appropriate density for exponential fog
    enableWindEffect: true,    // Whether wind affects fog color
    windEffectColor: 0xFF0000, // Custom color for wind effect
    windEffectStrength: 0.4    // Strength of wind color effect (0-1)
};

// Configuration for the volcanic biome
const VOLCANIC_BIOME_CONFIG = {
    id: 'volcanic',
    name: 'Volcanic',
    properties: {
        // Custom water color for this biome (dark red tint)
        waterColor: new THREE.Color(0x992222),
        // Moderate island density
        islandDensity: 0.6,
        // Volcanic formation density
        volcanoFormationDensity: 1.5,
        // Lava flow density
        lavaFlowDensity: 0.7,
        // Volcano spawn parameters
        volcanoMinDistance: 300,
        volcanoMaxDistance: 800,
        // Scale range for volcanos
        volcanoScaleMin: 1.0,
        volcanoScaleMax: 5.0,
        // Weather parameters
        ashCloudChance: 0.7,      // High chance of ash clouds
        ashIntensity: 2500,       // Number of ash particles
        emberChance: 0.4,         // Chance of embers in the air
        windStrength: 0.04,       // Moderate wind
        // Environment parameters
        temperature: 35,          // Very hot
        // Entity spawn parameters
        birdDensity: 0.2,         // Very few birds
        fishDensity: 0.4,         // Fewer fish
    },
    isDefault: false,
    weight: 1 // Rarity of this biome
};

/**
 * Volcanic biome implementation
 * Features active volcanoes, lava flows, and ash in a hot, dangerous environment
 */
class VolcanicBiome extends BiomeInterface {
    constructor(config = VOLCANIC_BIOME_CONFIG) {
        super(config);

        // Add volcanos to tracked entities
        this.spawnedEntities.volcanos = [];

        // Add lava flows to tracked entities
        this.spawnedEntities.lavaFlows = [];

        // Initialize ash particle system
        // Note: Ash system would need to be implemented similar to snow system
        this.ashSystem = null; // Will be initialized on first entry
        this.isAshActive = false;

        // Track when to update ash effects
        this.ashUpdateTimer = 0;

        // Track active lava glows and eruptions
        this.activeEffects = [];
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
     * Determines if a volcano should spawn at given coordinates
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @returns {boolean} Whether a volcano should spawn
     */
    shouldSpawnVolcano(x, z, seed) {
        return this.shouldSpawnFeature(x, z, seed, 'volcano', 0.06);
    }

    /**
     * Determines if a lava flow should spawn at given coordinates
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @returns {boolean} Whether a lava flow should spawn
     */
    shouldSpawnLavaFlow(x, z, seed) {
        return this.shouldSpawnFeature(x, z, seed, 'lavaFlow', 0.04);
    }

    /**
     * Determines if an island should spawn at given coordinates
     * (Special volcanic islands in this biome)
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @returns {boolean} Whether an island should spawn
     */
    shouldSpawnIsland(x, z, seed) {
        return this.shouldSpawnFeature(x, z, seed, 'island', 0.01);
    }

    /**
     * Process a chunk in the volcanic biome, spawning volcanos and islands as needed
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

        // Decide if this chunk gets any volcanos
        let volcanosToSpawn = (random() < 0.6) ? (random() < 0.7 ? 1 : 2) : 0;
        let volcanosSpawned = 0;

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

                // Try to spawn a volcano if we haven't reached our limit
                if (volcanosToSpawn > volcanosSpawned) {
                    // Randomize which cells get a volcano (1 in 4 chance per cell)
                    if (random() < 0.25) {
                        // Make sure we don't spawn too close to other entities
                        if (!this.checkEntityCollisions(position, 500)) {
                            console.log("Spawning volcano at", finalX, finalZ);

                            // Create the volcano island using the advanced implementation
                            const volcano = createActiveVolcanoIsland(
                                finalX,
                                finalZ,
                                seed * (finalX * finalZ),
                                scene,
                                {
                                    radius: this.properties.volcanoScaleMin + random() * (this.properties.volcanoScaleMax - this.properties.volcanoScaleMin),
                                    height: 100 + random() * 100  // Height between 100-200 units
                                }
                            );

                            if (volcano) {
                                this.spawnedEntities.volcanos.push(volcano);
                                spawnedInThisChunk.push({
                                    type: 'volcano',
                                    entity: volcano,
                                    position: position
                                });

                                // Increment the count of spawned volcanos
                                volcanosSpawned++;

                                // Skip other entity checks for this cell
                                continue;
                            }
                        }
                    }
                }

                // If we didn't spawn a volcano, try a lava flow
                if (this.shouldSpawnLavaFlow(finalX, finalZ, seed)) {
                    // Make sure we don't spawn too close to other entities
                    if (!this.checkEntityCollisions(position, this.properties.volcanoMinDistance)) {
                        // Create the lava flow
                        const lavaFlow = this.createLavaFlow({
                            position: position,
                            random: random,
                            scene: scene
                        });

                        if (lavaFlow) {
                            this.spawnedEntities.lavaFlows.push(lavaFlow);
                            spawnedInThisChunk.push({
                                type: 'lavaFlow',
                                entity: lavaFlow,
                                position: position
                            });
                        }
                    }
                }
                // Less frequently, try to spawn a smaller volcanic island
                else if (this.shouldSpawnIsland(finalX, finalZ, seed)) {
                    // Make sure we don't spawn too close to other entities
                    if (!this.checkEntityCollisions(position, this.properties.volcanoMinDistance || 300)) {
                        // Create a smaller volcanic island with less dramatic features
                        const island = createActiveVolcanoIsland(
                            finalX,
                            finalZ,
                            seed * (finalX * finalZ),
                            scene,
                            {
                                radius: 30 + random() * 30,    // Smaller radius
                                height: 40 + random() * 60     // Lower height
                            }
                        );

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
     * Create a lava flow at the specified position
     * @param {Object} options - Options including position and scene
     * @returns {Object} The created lava flow object
     */
    createLavaFlow(options) {
        const { position, random, scene } = options;

        // This is a placeholder - in a real implementation, you would:
        // 1. Create lava flow meshes or particle systems
        // 2. Set up proper physics and visuals

        // For now we'll create a simple placeholder using a plane with glowing material
        const width = 50 + random() * 100;
        const length = 100 + random() * 200;

        const geometry = new THREE.PlaneGeometry(width, length);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.position.y = 1; // Slightly above water
        mesh.rotation.x = -Math.PI / 2; // Lay flat
        scene.add(mesh);

        // Create a simple collider
        const collider = {
            center: position.clone(),
            radius: Math.max(width, length) / 2
        };

        // Create lava flow object with references
        return {
            id: `lavaFlow_${position.x}_${position.z}`,
            mesh: mesh,
            collider: collider,
            flowSpeed: 0.5 + random() * 1.5
        };
    }

    /**
     * Check if a position collides with any existing entities
     * @param {THREE.Vector3} position - Position to check
     * @param {number} minDistance - Minimum distance required
     * @returns {boolean} Whether there is a collision
     */
    checkEntityCollisions(position, minDistance) {
        // Check volcano collisions
        for (const volcano of this.spawnedEntities.volcanos) {
            const distance = position.distanceTo(volcano.collider.center);
            if (distance < minDistance) {
                return true;
            }
        }

        // Check lava flow collisions
        for (const lavaFlow of this.spawnedEntities.lavaFlows) {
            const distance = position.distanceTo(lavaFlow.collider.center);
            if (distance < minDistance) {
                return true;
            }
        }

        // Check island collisions
        return checkAllIslandCollisions(position, minDistance);
    }

    /**
     * Spawns volcanos and islands in a set of chunks around a position
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

        // Make sure ash is active when in this biome
        if (!this.isAshActive) {
            this.startAshEffects(centerPosition);
        }

        return allSpawned;
    }

    /**
     * Start ash effects in this biome
     * @param {THREE.Vector3} playerPosition - Player position
     */
    startAshEffects(playerPosition) {
        // TODO: Implement ash particle system similar to snow
        // For now, just log that it would be activated
        console.log("Starting volcanic ash effects");
        this.isAshActive = true;

        // Here you would initialize and start a particle system for ash
        // this.ashSystem = initAsh();
        // this.ashSystem.start(playerPosition, {
        //     count: this.properties.ashIntensity,
        //     windStrength: this.properties.windStrength
        // });
    }

    /**
     * Update function to be called in the game loop
     * @param {number} deltaTime - Time since last update
     * @param {THREE.Vector3} playerPosition - Current player position
     */
    update(deltaTime, playerPosition) {
        // Update ash system if active
        if (this.isAshActive && this.ashSystem) {
            // TODO: Update ash particle system
            // this.ashSystem.update(deltaTime, playerPosition);
        } else if (playerPosition) {
            // Start ash if not active
            this.startAshEffects(playerPosition);
        }

        // Update volcano animations using the built-in function
        updateActiveVolcanoes(deltaTime);

        // Update lava flows
        this.updateLavaFlows(deltaTime);

        // Update all island effects
        updateAllIslandEffects(deltaTime);
    }

    /**
     * Update lava flow animations
     * @param {number} deltaTime - Time since last update
     */
    updateLavaFlows(deltaTime) {
        // Update each lava flow
        for (const lavaFlow of this.spawnedEntities.lavaFlows) {
            // Animate lava texture
            if (lavaFlow.mesh && lavaFlow.mesh.material) {
                // If using a texture with offset for flow effect:
                // lavaFlow.mesh.material.map.offset.y += deltaTime * lavaFlow.flowSpeed * 0.1;

                // Or simply pulse the color/opacity for a simple effect
                const time = Date.now() * 0.001;
                const pulse = 0.8 + Math.sin(time * lavaFlow.flowSpeed) * 0.2;
                lavaFlow.mesh.material.opacity = 0.7 * pulse;
            }
        }
    }

    /**
     * Handles entity cleanup when moving away from an area
     * @param {THREE.Vector3} centerPosition - Current player position
     * @param {number} cleanupRadius - Radius beyond which to remove entities
     */
    cleanupDistantEntities(centerPosition, cleanupRadius = 3000) {
        // Check each volcano and remove if too far
        const keepVolcanos = [];

        for (let i = 0; i < this.spawnedEntities.volcanos.length; i++) {
            const volcano = this.spawnedEntities.volcanos[i];
            const distance = centerPosition.distanceTo(volcano.collider.center);

            if (distance > cleanupRadius) {
                // Remove from scene
                if (volcano.mesh && volcano.mesh.parent) {
                    volcano.mesh.parent.remove(volcano.mesh);
                }
            } else {
                keepVolcanos.push(volcano);
            }
        }

        // Update the array with only kept volcanos
        this.spawnedEntities.volcanos = keepVolcanos;

        // Clean up lava flows
        const keepLavaFlows = [];

        for (let i = 0; i < this.spawnedEntities.lavaFlows.length; i++) {
            const lavaFlow = this.spawnedEntities.lavaFlows[i];
            const distance = centerPosition.distanceTo(lavaFlow.collider.center);

            if (distance > cleanupRadius) {
                // Remove from scene
                if (lavaFlow.mesh && lavaFlow.mesh.parent) {
                    lavaFlow.mesh.parent.remove(lavaFlow.mesh);
                }
            } else {
                keepLavaFlows.push(lavaFlow);
            }
        }

        // Update the array with only kept lava flows
        this.spawnedEntities.lavaFlows = keepLavaFlows;

        // Clean up islands
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

        // Update the array with only kept islands
        this.spawnedEntities.islands = keepIslands;
    }

    /**
     * Clear all spawned entities and reset the biome
     * @param {THREE.Scene} scene - The scene containing the entities
     */
    clearAll(scene) {
        // Clear volcanos
        this.spawnedEntities.volcanos.forEach(volcano => {
            if (volcano.mesh && volcano.mesh.parent) {
                volcano.mesh.parent.remove(volcano.mesh);
            }
        });
        this.spawnedEntities.volcanos = [];

        // Clear lava flows
        this.spawnedEntities.lavaFlows.forEach(lavaFlow => {
            if (lavaFlow.mesh && lavaFlow.mesh.parent) {
                lavaFlow.mesh.parent.remove(lavaFlow.mesh);
            }
        });
        this.spawnedEntities.lavaFlows = [];

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

        // Clear ash particles
        if (this.ashSystem) {
            // TODO: Clear ash particles
            // clearAllAsh();
            this.isAshActive = false;
        }

        // Reset all other entity arrays
        for (const key in this.spawnedEntities) {
            if (!['volcanos', 'lavaFlows', 'islands'].includes(key)) {
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

        // Update volcano visibility
        for (let i = 0; i < this.spawnedEntities.volcanos.length; i++) {
            const volcano = this.spawnedEntities.volcanos[i];

            // Calculate distance to player
            const distance = playerPosition.distanceTo(volcano.collider.center);

            // Get the chunk this volcano belongs to
            const volcanoChunkX = Math.floor(volcano.collider.center.x / chunkSize);
            const volcanoChunkZ = Math.floor(volcano.collider.center.z / chunkSize);
            const volcanoChunkKey = `${volcanoChunkX},${volcanoChunkZ}`;

            // Check if chunk is within view distance
            const isChunkVisible = chunksToKeep.has(volcanoChunkKey);

            // Update visibility
            if (volcano.mesh) {
                volcano.mesh.visible = distance <= visibleDistance && isChunkVisible;
            }
        }

        // Update lava flow visibility
        for (let i = 0; i < this.spawnedEntities.lavaFlows.length; i++) {
            const lavaFlow = this.spawnedEntities.lavaFlows[i];

            // Calculate distance to player
            const distance = playerPosition.distanceTo(lavaFlow.collider.center);

            // Get the chunk this lava flow belongs to
            const lavaFlowChunkX = Math.floor(lavaFlow.collider.center.x / chunkSize);
            const lavaFlowChunkZ = Math.floor(lavaFlow.collider.center.z / chunkSize);
            const lavaFlowChunkKey = `${lavaFlowChunkX},${lavaFlowChunkZ}`;

            // Check if chunk is within view distance
            const isChunkVisible = chunksToKeep.has(lavaFlowChunkKey);

            // Update visibility
            if (lavaFlow.mesh) {
                lavaFlow.mesh.visible = distance <= visibleDistance && isChunkVisible;
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
        // Stop ash effects when leaving the volcanic biome
        if (this.isAshActive) {
            // TODO: Stop ash system
            // this.ashSystem.stop();
            this.isAshActive = false;
            console.log("Player left Volcanic biome - stopping ash effects");
        }
    }

    /**
     * Handle fog effects when entering or leaving this biome
     * @param {boolean} isEntering - True if entering biome, false if leaving
     * @param {Object} playerObject - The player object
     */
    handleFogTransition(isEntering, playerObject) {
        setFogProperties(VOLCANIC_FOG_CONFIG);
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
const volcanicBiome = new VolcanicBiome(VOLCANIC_BIOME_CONFIG);

// Export the instance and config
export default volcanicBiome;
export { VOLCANIC_BIOME_CONFIG }; 