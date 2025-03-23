// src/entities/entityspawner.js
import * as THREE from 'three';

/**
 * EntitySpawner class handles the raycasting logic for positioning entities
 * on terrain surfaces such as islands
 */
export class EntitySpawner {
    constructor() {
        // Raycaster for finding valid spawn positions
        this.raycaster = new THREE.Raycaster();
        this.downDirection = new THREE.Vector3(0, -1, 0);
        this.upDirection = new THREE.Vector3(0, 1, 0);

        // Maximum raycast distance
        this.maxRaycastDistance = 1000;

        // Default configuration for different entity types
        this.defaultConfigs = {
            monsters: {
                density: 0.0003,
                minHeight: 1,
                maxHeight: 50,
                minSlope: 0,
                maxSlope: 35,
                avoidWater: true,
                verticalOffset: 1,
                groupSpawn: true,
                groupSize: { min: 1, max: 3 }
            },
            villagers: {
                density: 0.0002,
                minHeight: 2,
                maxHeight: 20,
                minSlope: 0,
                maxSlope: 15, // Villagers prefer flatter ground
                avoidWater: true,
                verticalOffset: 0.5,
                groupSpawn: true,
                groupSize: { min: 1, max: 3 },
                preferCenters: true, // Villagers prefer the center of islands
                minDistanceFromEdge: 5 // Minimum distance from the edge of an island
            }
        };
    }

    /**
     * Analyze a chunk for suitable island locations for entity spawning
     * @param {Object} chunkBounds - Boundaries of the chunk {minX, maxX, minZ, maxZ}
     * @param {Array} islands - Array of islands to filter
     * @param {Object} terrain - Terrain object with collision detection
     * @param {string} entityType - Type of entity to find spawn locations for
     * @returns {Array} Array of suitable island locations in the chunk
     */
    analyzeChunkForIslands(chunkBounds, islands, terrain, entityType = 'monsters') {
        if (!islands || !islands.length) {
            console.log("No islands provided to analyzeChunkForIslands");
            return [];
        }

        console.log(`Processing ${islands.length} islands for ${entityType} in chunk`);
        const suitableIslands = [];

        // For villagers, consider all islands without additional filtering
        if (entityType === 'villagers') {
            islands.forEach(island => {
                if (!island.mesh || !island.mesh.position) {
                    console.log("Island missing mesh or position", island);
                    return;
                }

                const position = island.mesh.position;

                // Get spawn points through analyzeIslandForEntityType which now always returns suitable:true for villagers
                const islandInfo = this.analyzeIslandForEntityType(island, entityType);

                // Always add the island to suitable islands list
                suitableIslands.push({
                    island: island,
                    spawnPoints: islandInfo.spawnPoints || [], // Ensure we have at least an empty array
                    center: position.clone(),
                    radius: island.collider ? island.collider.radius : 10,
                    height: position.y
                });
            });
        } else {
            // Maintain original logic for non-villager entity types
            const config = this.defaultConfigs[entityType] || this.defaultConfigs.monsters;

            // Check each island to see if it's in this chunk
            islands.forEach(island => {
                if (!island.mesh || !island.mesh.position) {
                    console.log("Island missing mesh or position", island);
                    return;
                }

                const position = island.mesh.position;

                // Use a very large buffer to ensure islands are included
                const bufferDistance = 150; // Increased buffer distance

                // Check if this island is within or overlaps the chunk boundaries with buffer
                if (position.x + bufferDistance >= chunkBounds.minX &&
                    position.x - bufferDistance <= chunkBounds.maxX &&
                    position.z + bufferDistance >= chunkBounds.minZ &&
                    position.z - bufferDistance <= chunkBounds.maxZ) {

                    // Get the spawn points
                    const islandInfo = this.analyzeIslandForEntityType(island, entityType);

                    // Add the island only if suitable for non-villager entities
                    if (islandInfo.suitable) {
                        suitableIslands.push({
                            island: island,
                            spawnPoints: islandInfo.spawnPoints || [],
                            center: position.clone(),
                            radius: island.collider ? island.collider.radius : 10,
                            height: position.y
                        });
                    }
                }
            });
        }

        console.log(`Found ${suitableIslands.length} islands for ${entityType} spawning`);
        return suitableIslands;
    }

    /**
     * Analyze an island for a specific entity type's spawn requirements
     * @param {Object} island - Island object to analyze
     * @param {string} entityType - Type of entity to analyze for
     * @returns {Object} Analysis results {suitable, spawnPoints}
     */
    analyzeIslandForEntityType(island, entityType) {
        const config = this.defaultConfigs[entityType] || this.defaultConfigs.monsters;
        const spawnPoints = [];

        // Get island properties
        const position = island.mesh.position.clone();
        const radius = island.collider ? island.collider.radius : 10;

        if (entityType === 'villagers') {
            // For villagers, always try to spawn them regardless of island properties
            // Sample multiple points across the island
            const samplePoints = 20; // Increased from 12 to 20 for better coverage

            for (let i = 0; i < samplePoints; i++) {
                const angle = (i / samplePoints) * Math.PI * 2;
                // Use the full radius to allow spawning anywhere on the island
                const distance = Math.random() * radius * 0.9; // Small margin from edge
                const offsetX = Math.cos(angle) * distance;
                const offsetZ = Math.sin(angle) * distance;

                const samplePoint = new THREE.Vector3(
                    position.x + offsetX,
                    position.y + 15, // Reduced from 50 to 15 to prevent high spawns
                    position.z + offsetZ
                );

                const validPoint = this.validateSpawnPoint(island, samplePoint, config);
                if (validPoint) {
                    spawnPoints.push(validPoint);
                }
            }

            // If no valid points found yet, try additional random points
            if (spawnPoints.length === 0) {
                for (let i = 0; i < 15; i++) { // Increased from 10 to 15 more random points
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.random() * radius * 0.9;
                    const offsetX = Math.cos(angle) * distance;
                    const offsetZ = Math.sin(angle) * distance;

                    const samplePoint = new THREE.Vector3(
                        position.x + offsetX,
                        position.y + 15, // Reduced from 50 to 15 to prevent high spawns
                        position.z + offsetZ
                    );

                    const validPoint = this.validateSpawnPoint(island, samplePoint, config);
                    if (validPoint) {
                        spawnPoints.push(validPoint);
                        break; // Found at least one point, that's enough
                    }
                }
            }

            // Always return suitable:true even if no points found
            // The spawnEntitiesInChunk method will handle the empty array case
            return {
                suitable: true,
                spawnPoints: spawnPoints
            };
        } else {
            // Monsters can spawn anywhere on the island, including the edges
            const samplePoints = 12; // More sample points for monsters

            for (let i = 0; i < samplePoints; i++) {
                const angle = (i / samplePoints) * Math.PI * 2;
                const distance = Math.random() * radius * 0.9; // Avoid the very edge
                const offsetX = Math.cos(angle) * distance;
                const offsetZ = Math.sin(angle) * distance;

                const samplePoint = new THREE.Vector3(
                    position.x + offsetX,
                    position.y + 15, // Also limit monster spawn height to 15 units for consistency
                    position.z + offsetZ
                );

                const validPoint = this.validateSpawnPoint(island, samplePoint, config);
                if (validPoint) {
                    spawnPoints.push(validPoint);
                }
            }
        }

        return {
            suitable: spawnPoints.length > 0,
            spawnPoints: spawnPoints
        };
    }

    /**
     * Validate a potential spawn point by raycasting
     * @param {Object} island - Island object
     * @param {THREE.Vector3} point - Point to validate
     * @param {Object} config - Spawn configuration
     * @returns {THREE.Vector3|null} Valid spawn point or null
     */
    validateSpawnPoint(island, point, config) {
        const geometry = this.getIslandGeometry(island);
        if (!geometry) return null;

        // Get the island's position for relative calculations
        const islandPosition = new THREE.Vector3();
        island.getWorldPosition(islandPosition);

        // Set a maximum height for raycasting to prevent too-high spawns
        const maxRaycastHeight = 15; // Maximum height above island to consider valid

        // Use a modified point that's only a limited height above the island
        const rayStart = new THREE.Vector3(
            point.x,
            islandPosition.y + maxRaycastHeight, // Start from a reasonable height
            point.z
        );

        // Set up the raycast to go downward
        this.raycaster.set(rayStart, this.downDirection);
        this.raycaster.far = maxRaycastHeight * 2; // Limit the ray distance

        // Perform the raycast
        const intersects = this.raycaster.intersectObject(island, true);

        if (intersects.length > 0) {
            const intersection = intersects[0];

            // Check if this point meets our criteria
            if (this.isValidSpawnLocation(intersection, config)) {
                // Return the intersection point with any vertical offset
                const spawnPoint = intersection.point.clone();
                spawnPoint.y += config.verticalOffset || 0;
                return spawnPoint;
            }
        }

        return null;
    }

    /**
     * Spawn entities in a specific chunk
     * @param {string} entityType - Type of entity to spawn ('monsters', 'villagers')
     * @param {Function} createEntityFn - Function to create an entity
     * @param {Object} chunkBounds - Chunk boundaries {minX, maxX, minZ, maxZ}
     * @param {Array} islands - Available islands in the world
     * @param {Object} customConfig - Optional custom spawn configuration
     * @returns {Array} Array of spawned entities
     */
    spawnEntitiesInChunk(entityType, createEntityFn, chunkBounds, islands, customConfig = {}) {
        console.log("Spawning entities in chunk");
        const spawnedEntities = [];
        const config = { ...this.defaultConfigs[entityType] || this.defaultConfigs.monsters, ...customConfig };

        // Analyze the chunk for suitable islands
        const suitableIslands = this.analyzeChunkForIslands(chunkBounds, islands, null, entityType);

        if (suitableIslands.length === 0) {
            console.log("No suitable islands found");
            return spawnedEntities; // No suitable islands found
        }

        // For each suitable island, spawn entities
        suitableIslands.forEach(islandInfo => {
            const { island, spawnPoints, center, radius } = islandInfo;

            // Special handling for villagers - ensure we spawn them even if no spawn points found
            if (spawnPoints.length === 0 && entityType === 'villagers') {
                // Try to create a fallback spawn point at the island center
                // Get the island's position for relative calculations
                const islandPosition = new THREE.Vector3();
                if (island.mesh) {
                    island.mesh.getWorldPosition(islandPosition);
                } else if (island.getWorldPosition) {
                    island.getWorldPosition(islandPosition);
                }

                // Maximum fallback height of 5 units above island surface
                const fallbackHeight = 5;

                const fallbackPoint = center.clone();
                fallbackPoint.y = islandPosition.y + fallbackHeight; // Restricted to 5 units above island

                // Extra safety check to ensure we're not spawning too high
                if (fallbackPoint.y > islandPosition.y + 10) {
                    fallbackPoint.y = islandPosition.y + 5;
                }

                // Use this fallback point for spawning
                const entity = createEntityFn(fallbackPoint);
                if (entity) {
                    spawnedEntities.push(entity);

                    // Store island reference with the entity
                    if (entity.userData) {
                        entity.userData.islandId = island.id;
                        entity.userData.islandRadius = radius;
                        entity.userData.islandCenter = center.clone();
                    }
                }

                // Continue to next island
                return;
            }

            if (spawnPoints.length === 0) return;

            // Calculate how many entities to spawn based on island size and entity density
            const islandArea = Math.PI * radius * radius;
            let entityCount = Math.floor(islandArea * config.density);

            // Ensure we don't try to spawn more entities than we have spawn points
            entityCount = Math.min(entityCount, spawnPoints.length);

            // For villagers, ensure we always spawn at least one per island
            if (entityType === 'villagers') {
                entityCount = Math.max(1, entityCount); // At least one entity per suitable island
            } else {
                entityCount = Math.max(1, entityCount); // At least one entity per suitable island for other types too
            }

            // Shuffle spawn points to get random selection
            const shuffledPoints = this.shuffleArray([...spawnPoints]);

            // Spawn entities at the selected points
            for (let i = 0; i < entityCount; i++) {
                const spawnPoint = shuffledPoints[i % shuffledPoints.length];

                console.log("spawn point coords ", spawnPoint)
                const entity = this.createEntity(createEntityFn, spawnPoint);

                if (entity) {
                    spawnedEntities.push(entity);

                    // Store island reference with the entity if desired
                    if (entityType === 'villagers' && entity.userData) {
                        entity.userData.islandId = island.id;
                        entity.userData.islandRadius = radius;
                        entity.userData.islandCenter = center.clone();
                    }
                }
            }
        });

        return spawnedEntities;
    }

    /**
     * Shuffle an array randomly (Fisher-Yates algorithm)
     * @private
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Spawn entities of a specific type on an island using raycasting
     * @param {THREE.Object3D} island - The island object
     * @param {Function} createEntityFn - Function to create an entity instance
     * @param {Object} config - Configuration for entity placement
     * @param {THREE.Group} targetGroup - Group to add entities to
     * @returns {Array} Array of spawned entities
     */
    spawnEntitiesOnIsland(island, createEntityFn, config, targetGroup) {
        const spawnedEntities = [];
        // Get island geometry for raycasting
        const islandGeometry = this.getIslandGeometry(island);
        if (!islandGeometry) return spawnedEntities;

        // Calculate number of entities to spawn based on island size and density
        const islandBoundingBox = new THREE.Box3().setFromObject(island);
        const islandSize = new THREE.Vector3();
        islandBoundingBox.getSize(islandSize);
        const islandArea = islandSize.x * islandSize.z;
        const entityCount = Math.floor(islandArea * config.density);

        // Create points for raycasting across the island surface
        const islandWidth = islandSize.x;
        const islandDepth = islandSize.z;

        // Get island position
        const islandPosition = new THREE.Vector3();
        island.getWorldPosition(islandPosition);

        // Spawn individual entities or groups
        for (let i = 0; i < entityCount; i++) {
            if (config.groupSpawn) {
                // Spawn a group of entities
                const groupSize = Math.floor(
                    config.groupSize.min + Math.random() * (config.groupSize.max - config.groupSize.min)
                );

                // Find a valid spawn point for the group center
                const centerPoint = this.findValidSpawnPoint(
                    island,
                    islandGeometry,
                    islandPosition,
                    islandWidth,
                    islandDepth,
                    config
                );

                if (centerPoint) {
                    // Spawn multiple entities around the center point
                    for (let j = 0; j < groupSize; j++) {
                        const offset = new THREE.Vector3(
                            (Math.random() - 0.5) * 10,
                            0,
                            (Math.random() - 0.5) * 10
                        );

                        const spawnPoint = centerPoint.clone().add(offset);

                        // Verify the spawn point is valid
                        const adjustedPoint = this.adjustSpawnPointHeight(
                            spawnPoint,
                            island,
                            islandGeometry,
                            config.verticalOffset
                        );

                        if (adjustedPoint) {
                            const entity = this.createEntity(createEntityFn, adjustedPoint, targetGroup);
                            if (entity) {
                                spawnedEntities.push(entity);
                            }
                        }
                    }
                }
            } else {
                // Spawn a single entity
                const spawnPoint = this.findValidSpawnPoint(
                    island,
                    islandGeometry,
                    islandPosition,
                    islandWidth,
                    islandDepth,
                    config
                );

                if (spawnPoint) {
                    const entity = this.createEntity(createEntityFn, spawnPoint, targetGroup);
                    if (entity) {
                        spawnedEntities.push(entity);
                    }
                }
            }
        }

        return spawnedEntities;
    }

    /**
     * Find a valid spawn point on an island surface
     * @param {THREE.Object3D} island - The island object
     * @param {THREE.BufferGeometry} geometry - Island geometry for raycasting
     * @param {THREE.Vector3} islandPosition - Island world position
     * @param {number} width - Island width
     * @param {number} depth - Island depth
     * @param {Object} config - Entity configuration
     * @returns {THREE.Vector3|null} Valid spawn point or null if none found
     */
    findValidSpawnPoint(island, geometry, islandPosition, width, depth, config) {
        // Try several times to find a valid point
        const maxAttempts = 10;

        // Set maximum height limit for raycasting to prevent high spawns
        const maxRaycastHeight = 15;
        // Set maximum raycast distance
        const raycastDistance = 30;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Generate random position within island bounds
            const x = islandPosition.x + (Math.random() - 0.5) * width;
            const z = islandPosition.z + (Math.random() - 0.5) * depth;

            // Start raycasting from a limited height above the point
            const rayStart = new THREE.Vector3(x, islandPosition.y + maxRaycastHeight, z);
            this.raycaster.set(rayStart, this.downDirection);

            // Limit raycast distance
            this.raycaster.far = raycastDistance;

            // Perform raycast against island geometry
            const intersects = this.raycaster.intersectObject(island, true);

            if (intersects.length > 0) {
                const intersection = intersects[0];

                // Check if this point meets our criteria
                if (this.isValidSpawnLocation(intersection, config)) {
                    // Return the intersection point with any vertical offset
                    const spawnPoint = intersection.point.clone();
                    spawnPoint.y += config.verticalOffset || 0;

                    // Final safety check - ensure spawnPoint is not too high above the island
                    if (spawnPoint.y > islandPosition.y + maxRaycastHeight) {
                        spawnPoint.y = islandPosition.y + maxRaycastHeight;
                    }

                    return spawnPoint;
                }
            }
        }

        return null;
    }

    /**
     * Check if a spawn location meets the criteria for an entity
     * @param {Object} intersection - Raycast intersection result
     * @param {Object} config - Entity configuration
     * @returns {boolean} True if location is valid
     */
    isValidSpawnLocation(intersection, config) {
        const minHeight = config.minHeight !== undefined ? config.minHeight : 0;
        const maxHeight = config.maxHeight !== undefined ? config.maxHeight : 15; // Reduce default max height to 15
        const minSlope = config.minSlope !== undefined ? config.minSlope : 0;
        const maxSlope = config.maxSlope !== undefined ? config.maxSlope : 45;
        const avoidWater = config.avoidWater !== undefined ? config.avoidWater : true;

        // Check height constraints - stricter enforcement
        if (intersection.point.y < minHeight || intersection.point.y > maxHeight) {
            return false;
        }

        // Additional check - ensure point is not too high relative to the hit object
        // This helps prevent floating spawns when raycast hits distant objects
        if (intersection.distance > 20) { // If raycast traveled too far
            return false;
        }

        // Check slope constraints (angle in degrees from horizontal)
        const slopeAngle = THREE.MathUtils.radToDeg(Math.acos(intersection.face.normal.dot(this.upDirection)));
        if (slopeAngle < minSlope || slopeAngle > maxSlope) {
            return false;
        }

        // Check if we need to avoid water (can implement water level check here)
        if (avoidWater && intersection.point.y < 0.5) { // Assuming water level is at y=0
            return false;
        }

        return true;
    }

    /**
     * Adjust a spawn point's height to properly sit on the terrain
     * @param {THREE.Vector3} point - Initial spawn point
     * @param {THREE.Object3D} island - Island object
     * @param {THREE.BufferGeometry} geometry - Island geometry
     * @param {number} verticalOffset - Vertical offset to apply
     * @returns {THREE.Vector3|null} Adjusted spawn point or null if invalid
     */
    adjustSpawnPointHeight(point, island, geometry, verticalOffset = 0) {
        // Get the island's position for relative calculations
        const islandPosition = new THREE.Vector3();
        if (island.mesh) {
            island.mesh.getWorldPosition(islandPosition);
        } else if (island.getWorldPosition) {
            island.getWorldPosition(islandPosition);
        }

        // Maximum height above island to prevent floating entities
        const maxHeightAboveSurface = 15;

        // Cast ray down from a limited height above the point
        const rayHeight = Math.min(5, maxHeightAboveSurface / 2);
        const rayStart = point.clone().add(new THREE.Vector3(0, rayHeight, 0));
        this.raycaster.set(rayStart, this.downDirection);
        this.raycaster.far = rayHeight * 2; // Limit ray distance

        const intersects = this.raycaster.intersectObject(island, true);

        if (intersects.length > 0) {
            const adjustedPoint = intersects[0].point.clone();
            adjustedPoint.y += verticalOffset;

            // Ensure we're not too high above the island surface
            if (adjustedPoint.y > islandPosition.y + maxHeightAboveSurface) {
                adjustedPoint.y = islandPosition.y + maxHeightAboveSurface;
            }

            return adjustedPoint;
        }

        // Fallback if no intersection - don't go higher than max height
        if (point.y <= islandPosition.y + maxHeightAboveSurface) {
            const safePoint = point.clone();
            safePoint.y += verticalOffset;
            return safePoint;
        }

        return null;
    }

    /**
     * Get geometry from an island for raycasting
     * @param {THREE.Object3D} island - Island object
     * @returns {THREE.BufferGeometry|null} Geometry for raycasting
     */
    getIslandGeometry(island) {
        // First check if we have a simplified island object from the chunk controller
        if (island && island.mesh) {
            // Direct access to the mesh property when passed from chunkEntityController
            return island.mesh.geometry;
        }

        // Original approach for THREE.Object3D islands
        if (island.isMesh) {
            return island.geometry;
        }

        // For complex objects, find the first mesh with geometry
        let geometry = null;

        // Check if the island has traverse method (THREE.Object3D)
        if (island.traverse) {
            island.traverse(child => {
                if (!geometry && child.isMesh) {
                    geometry = child.geometry;
                }
            });
        }

        return geometry;
    }

    /**
     * Create an entity at a specific position
     * @param {Function} createFn - Function to create the entity
     * @param {THREE.Vector3} position - World position
     * @param {THREE.Group} targetGroup - Group to add the entity to
     * @returns {Object} The created entity
     */
    createEntity(createFn, position, targetGroup) {
        // Final safety check to prevent entities spawning too high
        // Look for nearest island to determine relative height
        const MAX_ALLOWED_HEIGHT = 15; // Maximum height above terrain

        // Clone the position to avoid modifying the original
        const safePosition = position.clone();

        // If the entity is spawning extremely high for some reason, apply a final cap
        // This serves as a last failsafe if all other checks somehow failed
        if (safePosition.y > MAX_ALLOWED_HEIGHT) {
            console.warn("Prevented entity from spawning too high: ", safePosition.y,
                "capping at", MAX_ALLOWED_HEIGHT);
            safePosition.y = MAX_ALLOWED_HEIGHT;
        }

        // Create the entity using the provided function with the safe position
        const entity = createFn(safePosition);

        // Add to the target group
        if (entity && targetGroup) {
            targetGroup.add(entity);
        }

        return entity;
    }
}

// Singleton instance for game use
const entitySpawner = new EntitySpawner();
export default entitySpawner;