/**
 * BiomeInterface - Standard interface for all biome implementations
 * This module defines the contract that all biome types must follow,
 * ensuring consistent behavior across different biome implementations.
 */

/**
 * Base class for all biome implementations
 * Each specific biome (Open Water, Arctic, Desert, etc.) should extend this class
 */
class BiomeInterface {
    /**
     * Create a new biome implementation
     * @param {Object} config - Configuration for this biome
     */
    constructor(config) {
        this._id = config.id;
        this._name = config.name;
        this._hasFog = config.hasFog || false;
        this.properties = config.properties || {};
        this.isDefault = config.isDefault || false;
        this.weight = config.weight || 1;

        // Track spawned entities within this biome
        this.spawnedEntities = {
            islands: [],
            structures: [],
            creatures: [],
            vegetation: [],
            effects: []
        };

        // Track processed chunks
        this.processedChunks = new Set();
    }

    /**
     * Get the ID of this biome
     * @returns {string} The biome ID
     */
    get id() {
        return this._id;
    }

    /**
     * Get the name of this biome
     * @returns {string} The biome name
     */
    get name() {
        return this._name;
    }

    /**
     * Get the name of this biome
     * @returns {string} The biome name
     */
    get hasFog() {
        return this._hasFog;
    }

    /**
     * Register this biome with the biome manager
     * @returns {Object} The registered biome instance
     */
    register() {
        throw new Error("register() must be implemented by biome classes");
    }

    /**
     * Process a single chunk according to this biome's rules
     * @param {number} chunkX - Chunk X coordinate
     * @param {number} chunkZ - Chunk Z coordinate
     * @param {number} chunkSize - Size of the chunk in world units
     * @param {THREE.Scene} scene - The scene to add entities to
     * @param {number} seed - World seed for consistent generation
     * @returns {Array} Array of spawned entities
     */
    processChunk(chunkX, chunkZ, chunkSize, scene, seed) {
        throw new Error("processChunk() must be implemented by biome classes");
    }

    /**
     * Spawns biome features around a position
     * @param {THREE.Vector3} centerPosition - Center position to spawn around
     * @param {THREE.Scene} scene - The scene to add entities to
     * @param {number} seed - World seed for consistent generation
     * @param {number} radius - Radius in chunks to spawn around
     * @returns {Array} Array of spawned entities
     */
    spawnAroundPosition(centerPosition, scene, seed, radius = 2) {
        throw new Error("spawnAroundPosition() must be implemented by biome classes");
    }

    /**
     * Update this biome's entities and effects
     * @param {number} deltaTime - Time since last update
     * @param {THREE.Vector3} playerPosition - Current player position
     */
    update(deltaTime, playerPosition) {
        throw new Error("update() must be implemented by biome classes");
    }

    /**
     * Update visibility of biome entities based on player position
     * @param {Object} playerObject - The player object (typically boat)
     * @param {THREE.Scene} scene - The scene containing entities
     * @param {Object} waterShader - Water shader for visual effects
     * @param {THREE.Vector3} lastUpdatePosition - Position during last visibility update
     */
    updateEntityVisibility(lastUpdatePosition) {
        throw new Error("updateEntityVisibility() must be implemented by biome classes");
    }

    /**
     * Cleanup entities that are too far from the player
     * @param {THREE.Vector3} centerPosition - Current player position
     * @param {number} cleanupRadius - Radius beyond which to remove entities
     */
    cleanupDistantEntities(centerPosition, cleanupRadius) {
        throw new Error("cleanupDistantEntities() must be implemented by biome classes");
    }

    /**
     * Clear all entities spawned by this biome
     * @param {THREE.Scene} scene - The scene containing the entities
     */
    clearAll(scene) {
        throw new Error("clearAll() must be implemented by biome classes");
    }

    /**
     * Get this biome's properties
     * @returns {Object} Biome properties
     */
    getProperties() {
        return { ...this.properties };
    }

    /**
     * Determine if a feature should spawn at given coordinates
     * @param {number} x - X coordinate in world space
     * @param {number} z - Z coordinate in world space
     * @param {number} seed - World seed for consistent generation
     * @param {string} featureType - Type of feature (island, creature, etc.)
     * @param {number} baseChance - Base chance of spawning (0-1)
     * @returns {boolean} Whether the feature should spawn
     */
    shouldSpawnFeature(x, z, seed, featureType, baseChance) {
        // Default implementation with common logic
        const hash = Math.sin(x * 12345.6789 + z * 9876.54321 + seed) * 43758.5453123;
        const value = hash - Math.floor(hash);

        // Get density modifier from properties
        const densityProp = `${featureType}Density`;
        const densityModifier = this.properties[densityProp] || 1.0;

        // Calculate final spawn chance
        const finalChance = baseChance * densityModifier;

        return value < finalChance;
    }

    /**
     * Handle fog effects when entering or leaving this biome
     * @param {boolean} isEntering - True if entering biome, false if leaving
     * @param {Object} playerObject - The player object
     * @returns {void}
     */
    handleFogTransition(isEntering, playerObject) {
        // Default implementation does nothing - biomes should override as needed
    }
}

export default BiomeInterface;