import * as THREE from 'three';
import { scene, getTime } from '../core/gameState.js';
import {
    registerEntity,
    updateEntityChunk,
    updateEntityVisibility,
    getVisibleChunks,
    removeEntity
} from '../world/chunkEntityController.js';

// Store all active villagers
const activeVillagers = [];
// Export activeVillagers so it can be accessed from other files
export { activeVillagers };

/**
 * Extract state from a villager for chunk system storage
 * @param {THREE.Group} villager - The villager to extract state from
 * @returns {Object} Villager state object
 */
export function getVillagerState(villager) {
    if (!villager || !villager.userData) return null;

    // Get all the essential state information needed to recreate this villager
    const position = villager.position.clone();

    // Extract all the necessary data from userData
    const userData = { ...villager.userData };

    // Remove references to actual scene objects that can't be serialized
    // We'll recreate these when respawning
    delete userData.leftLeg;
    delete userData.rightLeg;
    delete userData.leftArm;
    delete userData.rightArm;

    // Return a state object with all necessary data
    return {
        position,
        rotation: villager.rotation.clone(),
        scale: villager.scale.clone(),
        userData
    };
}

/**
 * Cleanup function to remove a villager from the scene
 * @param {THREE.Group} villager - The villager to remove
 */
export function cleanupVillager(villager) {
    // Remove from scene
    if (villager && scene) {
        scene.remove(villager);
    }

    // Remove from active villagers array
    const index = activeVillagers.indexOf(villager);
    if (index !== -1) {
        activeVillagers.splice(index, 1);
    }
}

/**
 * Respawn villagers from saved states
 * @param {Array} villagerStates - Array of villager state objects
 * @param {string} chunkKey - Chunk key where the states were saved
 */
export function respawnVillagers(villagerStates, chunkKey) {
    if (!villagerStates || !Array.isArray(villagerStates)) {
        return;
    }

    // For each saved state, recreate the villager
    villagerStates.forEach(state => {
        if (!state || !state.position) return;

        // Create a new villager at the saved position
        const villager = createVillager(state.position);

        // Restore rotation and scale
        if (state.rotation) {
            villager.rotation.copy(state.rotation);
        }

        if (state.scale) {
            villager.scale.copy(state.scale);
        }

        // Restore userData (except for mesh references which are recreated)
        if (state.userData) {
            // Merge the saved userData with the new userData (preserving new references)
            Object.assign(villager.userData, state.userData);
        }

        // Add to scene and active villagers
        scene.add(villager);
        activeVillagers.push(villager);

        // Register with chunk system
        registerEntity('villagers', villager, villager.position);
    });

    // Log respawn information
    if (villagerStates.length > 0) {
        console.log(`Respawned ${villagerStates.length} villagers in chunk ${chunkKey}`);
    }
}

// Function to create a single villager
export function createVillager(position) {
    console.log("villager being spawned")
    // Villager group to hold all body parts
    const villager = new THREE.Group();

    // Use a more reasonable scale
    const villagerScale = 3.0; // Normal scale, can be adjusted between 0.5-2 for size variation
    villager.scale.set(villagerScale, villagerScale, villagerScale);

    // Random color palette for this villager
    const hue = Math.random();
    const skinColor = new THREE.Color().setHSL(hue, 0.5 + Math.random() * 0.3, 0.5 + Math.random() * 0.3);
    const clothesColor = new THREE.Color().setHSL((hue + 0.5) % 1.0, 0.7, 0.4);
    const hatColor = new THREE.Color().setHSL((hue + 0.3) % 1.0, 0.8, 0.5);

    // Head
    const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const headMaterial = new THREE.MeshPhongMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.6;
    villager.add(head);

    // Hat (add a hat!)
    const hatType = Math.floor(Math.random() * 3); // 3 different hat types

    if (hatType === 0) {
        // Top hat
        const hatGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.7, 8);
        const hatMaterial = new THREE.MeshPhongMaterial({ color: hatColor });
        const hat = new THREE.Mesh(hatGeometry, hatMaterial);
        hat.position.y = 2.1;
        villager.add(hat);
    } else if (hatType === 1) {
        // Cone hat
        const hatGeometry = new THREE.ConeGeometry(0.5, 0.8, 8);
        const hatMaterial = new THREE.MeshPhongMaterial({ color: hatColor });
        const hat = new THREE.Mesh(hatGeometry, hatMaterial);
        hat.position.y = 2.2;
        villager.add(hat);
    } else {
        // Wide brim hat
        const hatGeometry = new THREE.CylinderGeometry(0.8, 0.9, 0.3, 8);
        const hatMaterial = new THREE.MeshPhongMaterial({ color: hatColor });
        const hat = new THREE.Mesh(hatGeometry, hatMaterial);
        hat.position.y = 2.05;
        villager.add(hat);
    }

    // Body
    const bodyGeometry = new THREE.BoxGeometry(1, 1.2, 0.6);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: clothesColor });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    villager.add(body);

    // Arms
    const armGeometry = new THREE.BoxGeometry(0.4, 1, 0.4);

    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, headMaterial);
    leftArm.position.set(-0.7, 0.6, 0);
    villager.add(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, headMaterial);
    rightArm.position.set(0.7, 0.6, 0);
    villager.add(rightArm);

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.4, 1, 0.4);
    const legMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL((hue + 0.1) % 1.0, 0.7, 0.3)
    });

    // Left leg
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.3, -0.5, 0);
    villager.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.3, -0.5, 0);
    villager.add(rightLeg);

    // Store initial position and animation data in userData
    villager.userData = {
        initialPosition: position.clone(),
        timeOffset: Math.random() * Math.PI * 2, // Random starting phase
        moveRadius: 5 + Math.random() * 5, // How far they move from center
        moveSpeed: 0.2 + Math.random() * 0.4, // How fast they move
        leftLeg: leftLeg,
        rightLeg: rightLeg,
        leftArm: leftArm,
        rightArm: rightArm
    };

    // Actually set the position of the villager to the spawn point
    if (position) {
        villager.position.copy(position);
        console.log("Setting villager position to", position);
    }

    return villager;
}

/**
 * Initialize villagers using the chunk-based system
 * @param {Array|Map} islands - Island objects available in the world
 */
function initVillagers(islands) {
    if (!islands) return;

    // Get visible chunks to determine where to spawn initial villagers
    const visibleChunks = getVisibleChunks();

    // Convert islands to array if it's a Map or other collection
    const islandArray = Array.isArray(islands) ? islands : Array.from(islands.values());

    // For each visible chunk, check if we need to populate with villagers
    visibleChunks.forEach(chunkKey => {
        const [chunkX, chunkZ] = chunkKey.split(',').map(Number);

        // Call the chunk controller's populate function
        // This will handle the actual spawning through EntitySpawner
        populateChunkWithVillagers(chunkKey, chunkX, chunkZ);
    });

    console.log(`Initialized villager system with ${activeVillagers.length} villagers in visible chunks`);
}

// Update villager animations to keep them on their island
function updateVillagerAnimations() {
    const time = getTime();

    for (let i = 0; i < activeVillagers.length; i++) {
        const villager = activeVillagers[i];
        const data = villager.userData;

        // Skip if no island data (safety check)
        if (!data.islandCenter || !data.islandRadius) continue;

        // Calculate movement within island boundary
        const xOffset = Math.sin(time * 0.5 * data.moveSpeed + data.timeOffset) * data.moveRadius;
        const zOffset = Math.cos(time * 0.3 * data.moveSpeed + data.timeOffset) * data.moveRadius;

        // Calculate new position
        const newX = data.islandCenter.x + xOffset;
        const newZ = data.islandCenter.z + zOffset;

        // Check if new position is within island boundary
        const distanceFromCenter = Math.sqrt(xOffset * xOffset + zOffset * zOffset);

        if (distanceFromCenter <= data.islandRadius) {
            // Update position if within bounds
            villager.position.x = newX;
            villager.position.z = newZ;

            // Add slight bobbing up and down
            villager.position.y = data.initialPosition.y + Math.sin(time * 2 * data.moveSpeed) * 0.2;

            // Check if villager has moved to a new chunk
            updateEntityChunk('villagers', villager, villager.position);
        }

        // Calculate movement direction for rotation
        const xDir = Math.cos(time * 0.5 * data.moveSpeed + data.timeOffset) * data.moveSpeed;
        const zDir = -Math.sin(time * 0.3 * data.moveSpeed + data.timeOffset) * data.moveSpeed;

        // Rotate villager to face movement direction
        if (Math.abs(xDir) > 0.01 || Math.abs(zDir) > 0.01) {
            villager.rotation.y = Math.atan2(xDir, zDir);
        }

        // Animate legs and arms with simple sine wave
        const animSpeed = 5; // Faster animation
        const legRotation = Math.sin(time * animSpeed * data.moveSpeed) * 0.4;

        // Update leg rotations
        data.leftLeg.rotation.x = legRotation;
        data.rightLeg.rotation.x = -legRotation;

        // Update arm rotations (opposite phase to legs)
        data.leftArm.rotation.x = -legRotation * 0.7;
        data.rightArm.rotation.x = legRotation * 0.7;
    }
}

/**
 * Update villager visibility based on chunks
 */
export function updateVillagerVisibility() {
    const visibleChunks = getVisibleChunks();

    updateEntityVisibility(
        visibleChunks,
        'villagers',
        // Get villager state function
        getVillagerState,
        // Villager cleanup function
        cleanupVillager,
        // Villager respawn function
        respawnVillagers
    );
}

/**
 * Main update function for villagers system
 * @param {Array|Map} islands - Island objects available in the world
 */
export function updateVillagers(islands) {
    // If no villagers exist yet and we have islands, initialize the system
    if (activeVillagers.length === 0 && islands) {
        initVillagers(islands);
        return; // Return early since we just initialized
    }

    // Update animations for active villagers
    updateVillagerAnimations();

    // Update chunk registration for active villagers
    updateVillagerChunks();

    // Update visibility based on chunks (spawns/despawns as needed)
    updateVillagerVisibility();
}

/**
 * Update chunk registration for all active villagers
 */
function updateVillagerChunks() {
    activeVillagers.forEach(villager => {
        if (villager && villager.position) {
            // Update this villager's chunk registration if it has moved
            updateEntityChunk('villagers', villager, villager.position);
        }
    });
}