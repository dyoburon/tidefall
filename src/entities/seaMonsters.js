import * as THREE from 'three';
import { scene, getTime, boatVelocity, addToScene, removeFromScene, isInScene, boat } from '../core/gameState.js';
import { applyShipKnockback } from '../core/shipController.js';
import { getTimeOfDay } from '../environment/skybox.js'; // Import time of day function
import { flashBoatDamage } from '../entities/character.js'; // Add this import
import { getFishInventory } from '../gameplay/fishing.js'; // Import the fish inventory
import { createTreasureDrop, updateTreasures, initTreasureSystem } from '../gameplay/treasure.js';
import { applyOutline, removeOutline } from '../theme/outlineStyles.js';
import { registerMonsterType, createMonster, spawnMonstersInChunk, ensureMonsterVisibility } from '../entities/monsterManager.js';
import {
    entityChunkMap,
    registerEntity,
    updateEntityChunk,
    getVisibleChunks,
    removeEntity,
    getAllMonsters
} from '../world/chunkEntityController.js';

// Sea monster configuration
const MONSTER_COUNT = 5;
const MONSTER_TYPES = {
    YELLOW_BEAST: 'yellowBeast',   // Original monster
    KRAKEN: 'kraken',              // New octopus-like monster
    SEA_SERPENT: 'seaSerpent',     // New serpent monster
    PHANTOM_JELLYFISH: 'phantomJellyfish' // New jellyfish monster
};
const MONSTER_TYPE_WEIGHTS = {
    [MONSTER_TYPES.YELLOW_BEAST]: 1.0,    // 40% chance
    [MONSTER_TYPES.KRAKEN]: 0.0,          // 20% chance
    [MONSTER_TYPES.SEA_SERPENT]: 0.0,     // 20% chance 
    [MONSTER_TYPES.PHANTOM_JELLYFISH]: 0.0 // 20% chance
};
const MONSTER_SPEED = 0.04;
const MONSTER_DETECTION_RANGE = 200;
const MONSTER_ATTACK_RANGE = 50;
const MONSTER_DEPTH = -20;
const MONSTER_SURFACE_TIME = 10; // seconds monster stays on surface
const MONSTER_DIVE_TIME = 1; // seconds monster stays underwater before considering resurfacing

// Add a new constant for surfacing speed - much faster than regular movement
const MONSTER_SURFACING_SPEED = 0.24; // Significantly faster than MONSTER_SPEED (0.11)

// Monster states
const MONSTER_STATE = {
    LURKING: 'lurking',    // Deep underwater, moving randomly
    HUNTING: 'hunting',    // Detected player, moving toward them underwater
    SURFACING: 'surfacing', // Moving upward to surface
    ATTACKING: 'attacking', // On surface, actively pursuing player
    DIVING: 'diving',       // Returning to depth
    DYING: 'dying'         // Monster is dying
};

// Monster state
let monsters = [];
let lastNightSpawn = false; // Track if we've already spawned monsters this night
let lastTimeOfDay = ""; // Track the previous time of day
let treasureDrops = [];
let treasureInventory = {}; // Treasures collected from monsters

// Add a hit cooldown system to prevent constant damage
const HIT_COOLDOWN = 1.5; // Seconds between possible hits
let lastHitTime = -999; // Initialize to negative value to ensure first hit works

// Increase these constants for better collision detection
const BOAT_COLLISION_DAMAGE = 0.2;        // Base damage dealt to monster when hit by boat
const BOAT_COLLISION_COOLDOWN = 0;    // Reduced cooldown for more responsive collisions
const BOAT_COLLISION_RANGE = 20;        // INCREASED from 20 to 35 for much more reliable detection
const BOAT_SURFACE_THRESHOLD = -15;     // INCREASED depth threshold from -10 to -15
let lastBoatCollisionTime = -999;       // Timer for collision cooldown

export function setupSeaMonsters(boat) {
    try {
        // Initialize the treasure system with the same boat reference
        initTreasureSystem(boat);

        // Reset hit cooldown to ensure monsters can hit on first approach
        lastHitTime = -999; // Set to a very negative value to ensure first hit works

        // Return monsters from the entityChunkMap instead of local array
        return getMonsters();
    } catch (error) {
        return [];
    }
}

export function flashMonsterRed(monster, hadGreenLine = false) {
    // Ensure monster has the damage flash property to track state
    if (monster.isFlashingRed === undefined) {
        monster.isFlashingRed = false;
    }

    // Prevent color animation overlap if already flashing
    if (monster.isFlashingRed) {
        clearTimeout(monster.flashTimeout);
    }

    // Mark as currently flashing
    monster.isFlashingRed = true;

    // Store all original colors first if not already done
    if (!monster.storedColors) {
        monster.storedColors = new Map();
    }

    // Store original emissive if needed
    if (!monster.storedEmissive) {
        monster.storedEmissive = new Map();
    }

    // Process all mesh components of the monster
    if (monster.mesh) {
        monster.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                // Skip outline meshes - outlines use BackSide rendering
                if (child.material.side === THREE.BackSide) {
                    // Ensure outlines stay black
                    if (child.material.color) {
                        child.material.color.set(0x000000);
                    }
                    return; // Skip further processing for outline materials
                }

                // Handle both single materials and material arrays for non-outline meshes
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((material, index) => {
                    // Skip any BackSide materials (outlines)
                    if (material.side === THREE.BackSide) {
                        // Keep outlines black
                        if (material.color) {
                            material.color.set(0x000000);
                        }
                        return;
                    }

                    if (material && material.color) {
                        // Create a unique identifier for this material
                        const materialId = `${child.id}-${index}`;

                        // Store original color if not already stored
                        if (!monster.storedColors.has(materialId)) {
                            monster.storedColors.set(materialId, material.color.clone());
                        }

                        // Set to bright red - use a more intense red for targeted hits
                        material.color.set(hadGreenLine ? 0xff0000 : 0xdd0000);

                        // Boost emissive for extra glow effect if supported
                        if (material.emissive) {
                            if (!monster.storedEmissive.has(materialId)) {
                                monster.storedEmissive.set(materialId, material.emissive.clone());
                            }

                            // Add red glow - brighter for green line hits
                            material.emissive.set(hadGreenLine ? 0x550000 : 0x330000);
                        }
                    }
                });
            }
        });
    }

    // Also handle special monster parts like fins if they exist
    const specialParts = ['dorsalFin', 'leftFin', 'rightFin'];
    specialParts.forEach(partName => {
        if (monster[partName] && monster[partName].material && monster[partName].material.color) {
            const materialId = `special-${partName}`;

            // Store original color
            if (!monster.storedColors.has(materialId)) {
                monster.storedColors.set(materialId, monster[partName].material.color.clone());
            }

            // Set to red - brighter for targeted hits
            monster[partName].material.color.set(hadGreenLine ? 0xff0000 : 0xdd0000);
        }
    });

    // Flash longer for targeted hits (green line)
    const flashDuration = hadGreenLine ? 700 : 500;

    // Restore original colors after a delay
    monster.flashTimeout = setTimeout(() => {
        restoreMonsterColors(monster);
    }, flashDuration);
}

// Create a separate function to restore monster colors to make the code cleaner
// and ensure it can be called from multiple places if needed
function restoreMonsterColors(monster) {
    // Safety check - make sure monster exists
    if (!monster || !monster.mesh || !monster.storedColors) {
        return;
    }

    // Only restore if monster still exists and has stored colors
    try {
        monster.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((material, index) => {
                    if (material && material.color) {
                        const materialId = `${child.id}-${index}`;
                        const originalColor = monster.storedColors.get(materialId);

                        if (originalColor) {
                            // Use copy to ensure we're properly transferring the color values
                            material.color.copy(originalColor);
                        }

                        // Restore emissive if it exists
                        if (material.emissive && monster.storedEmissive) {
                            const originalEmissive = monster.storedEmissive.get(materialId);
                            if (originalEmissive) {
                                material.emissive.copy(originalEmissive);
                            }
                        }
                    }
                });
            }
        });

        // Restore special parts
        const specialParts = ['dorsalFin', 'leftFin', 'rightFin'];
        specialParts.forEach(partName => {
            if (monster[partName] && monster[partName].material && monster[partName].material.color) {
                const materialId = `special-${partName}`;
                const originalColor = monster.storedColors.get(materialId);

                if (originalColor) {
                    monster[partName].material.color.copy(originalColor);
                }
            }
        });
    } catch (error) {

    }

    // Reset flag
    monster.isFlashingRed = false;
}


// Helper function to select random monster type based on weights
export function selectRandomMonsterType() {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const [type, weight] of Object.entries(MONSTER_TYPE_WEIGHTS)) {
        cumulativeWeight += weight;
        if (random < cumulativeWeight) {
            return type;
        }
    }

    // Default to original monster if something goes wrong
    return MONSTER_TYPES.YELLOW_BEAST;
}

export function updateSeaMonsters(deltaTime) {
    try {
        if (!deltaTime || isNaN(deltaTime)) {
            deltaTime = 0.016; // Default to ~60fps
        }

        if (!boat) return;

        // Get current time of day from skybox.js
        const currentTimeOfDay = getTimeOfDay();

        // DISABLED: Night respawning code
        /*
        // Check if night has just started (transition from another time to night)
        if (currentTimeOfDay === "Night" && lastTimeOfDay !== "Night") {
            
            respawnMonstersAtNight();
        }
        */

        // Update last time of day
        lastTimeOfDay = currentTimeOfDay;

        // Check for boat collisions with monsters
        checkBoatMonsterCollisions();

        // Update existing monsters - GET FROM CENTRAL SOURCE
        getMonsters().forEach((monster, index) => {
            // Update state timer
            monster.stateTimer -= deltaTime;

            // Update monster based on current state
            switch (monster.state) {
                case MONSTER_STATE.LURKING:
                    updateLurkingMonster(monster, deltaTime);
                    break;
                case MONSTER_STATE.HUNTING:
                    updateHuntingMonster(monster, deltaTime);
                    break;
                case MONSTER_STATE.SURFACING:
                    updateSurfacingMonster(monster, deltaTime);
                    break;
                case MONSTER_STATE.ATTACKING:
                    updateAttackingMonster(monster, deltaTime);
                    break;
                case MONSTER_STATE.DIVING:
                    updateDivingMonster(monster, deltaTime);
                    break;
                case MONSTER_STATE.DYING:
                    updateDyingMonster(monster, deltaTime);
                    break;
            }

            // Apply velocity to position
            monster.mesh.position.add(monster.velocity);

            // Make monster face direction of travel
            if (monster.velocity.length() > 0.01) {
                const lookTarget = monster.mesh.position.clone().add(monster.velocity);
                monster.mesh.lookAt(lookTarget);
            }

            // Apply special behaviors based on monster type
            updateSpecialMonsterBehaviors(monster, deltaTime);

            // Only run default tentacle animation for original yellow monster
            // (other monsters handle their own animations in updateSpecialMonsterBehaviors)
            if (monster.monsterType === MONSTER_TYPES.YELLOW_BEAST) {
                animateTentacles(monster, deltaTime);
            }

            // Ensure monster stays within world bounds
            keepMonsterInWorld(monster);

            // Make fins always visible above water when surfacing or attacking
            if (monster.state === MONSTER_STATE.SURFACING || monster.state === MONSTER_STATE.ATTACKING) {
                // Ensure dorsal fin sticks out of water
                const waterLevel = 0;
                const minFinHeight = waterLevel + 3; // Minimum height above water

                // Calculate how much of the monster is above water
                const monsterTopPosition = monster.mesh.position.y + 5;

                // Adjust fin visibility based on monster position
                if (monsterTopPosition < waterLevel) {
                    // Only fins should be visible
                    monster.dorsalFin.visible = true;
                    monster.leftFin.visible = true;
                    monster.rightFin.visible = true;

                    // Make fins stick out of water even when monster is below
                    const finOffset = Math.max(0, waterLevel - monsterTopPosition + 3);
                    monster.dorsalFin.position.y = 8 + finOffset;
                    monster.leftFin.position.y = 2 + finOffset;
                    monster.rightFin.position.y = 2 + finOffset;
                } else {
                    // Monster is partially above water, reset fin positions
                    monster.dorsalFin.position.y = 8;
                    monster.leftFin.position.y = 2;
                    monster.rightFin.position.y = 2;
                }
            }
        });

        // Update treasures using the new system
        updateTreasures(deltaTime);
    } catch (error) {

    }
}

export function updateLurkingMonster(monster, deltaTime) {
    // Random wandering movement underwater
    if (Math.random() < 0.01) {
        monster.velocity.x = (Math.random() - 0.5) * MONSTER_SPEED;
        monster.velocity.z = (Math.random() - 0.5) * MONSTER_SPEED;
    }

    // Check if player is in detection range - use boat from gameState instead of playerBoat
    const distanceToPlayer = monster.mesh.position.distanceTo(boat.position);
    if (distanceToPlayer < MONSTER_DETECTION_RANGE) {
        // 20% chance to start hunting when player is detected
        if (Math.random() < 0.2) {
            monster.state = MONSTER_STATE.HUNTING;
            monster.stateTimer = 10; // Hunt for 10 seconds before deciding to surface
            monster.eyeGlow = 1; // Make eyes glow when hunting
        }
    }

    // Occasionally consider surfacing even without player
    if (monster.stateTimer <= 0 && Math.random() < 0.005) {
        monster.state = MONSTER_STATE.SURFACING;
        monster.stateTimer = 5; // Time to reach surface
    }
}

export function updateHuntingMonster(monster, deltaTime) {
    // Move toward player underwater
    const directionToPlayer = new THREE.Vector3()
        .subVectors(boat.position, monster.mesh.position)
        .normalize();

    // Keep at depth while hunting
    directionToPlayer.y = 0;

    // Set velocity toward player
    monster.velocity.copy(directionToPlayer.multiplyScalar(MONSTER_SPEED * 1.5));

    // Check if close enough to attack
    const distanceToPlayer = monster.mesh.position.distanceTo(boat.position);
    if (distanceToPlayer < MONSTER_ATTACK_RANGE) {
        monster.state = MONSTER_STATE.SURFACING;
        monster.stateTimer = 3; // Faster surfacing when attacking
    }

    // If hunting timer expires, decide whether to surface or return to lurking
    if (monster.stateTimer <= 0) {
        if (distanceToPlayer < MONSTER_ATTACK_RANGE * 2 && Math.random() < 0.7) {
            // Close enough, surface to attack
            monster.state = MONSTER_STATE.SURFACING;
            monster.stateTimer = 3;
        } else {
            // Return to lurking
            monster.state = MONSTER_STATE.LURKING;
            monster.stateTimer = MONSTER_DIVE_TIME / 2;
            monster.eyeGlow = 0; // Reset eye glow
        }
    }
}

export function updateSurfacingMonster(monster, deltaTime) {
    // Move upward to surface at the dedicated surfacing speed - not tied to regular movement speed
    monster.velocity.y = MONSTER_SURFACING_SPEED;

    // Continue moving toward player if in attack range
    const distanceToPlayer = monster.mesh.position.distanceTo(boat.position);
    if (distanceToPlayer < MONSTER_ATTACK_RANGE * 2) {
        const directionToPlayer = new THREE.Vector3()
            .subVectors(boat.position, monster.mesh.position)
            .normalize();

        // Keep y component for surfacing using dedicated speed, but move toward player on xz plane with regular speed
        monster.velocity.x = directionToPlayer.x * MONSTER_SPEED;
        monster.velocity.z = directionToPlayer.z * MONSTER_SPEED;
    }

    // Check if reached surface
    if (monster.mesh.position.y >= 0) {
        monster.mesh.position.y = 0; // Clamp to water surface
        monster.state = MONSTER_STATE.ATTACKING;
        monster.stateTimer = MONSTER_SURFACE_TIME;

        // Create splash effect
        createSplashEffect(monster.mesh.position);
    }
}

export function updateAttackingMonster(monster, deltaTime) {
    // Initialize sub-state for attacking if not present
    if (!monster.attackSubState) {
        monster.attackSubState = 'charging';
        monster.chargeTarget = new THREE.Vector3();
        monster.repositionTimer = 0; // Initialize reposition timer
    }

    // Keep at surface level with slight bobbing
    monster.mesh.position.y = Math.sin(getTime() * 0.5) * 0.5;
    monster.velocity.y = 0;

    const distanceToPlayer = monster.mesh.position.distanceTo(boat.position);

    // Check if monster can hit the boat
    const currentTime = getTime() / 1000; // Convert to seconds
    const canHit = currentTime - lastHitTime > HIT_COOLDOWN;

    // Debug monster distance

    if (distanceToPlayer < 15) { // Increased hit range for better detection
        // Monster hit the boat - trigger damage flash
        flashBoatDamage();
        lastHitTime = currentTime;

        // Add some physical impact - push boat slightly
        const hitDirection = new THREE.Vector3()
            .subVectors(boat.position, monster.mesh.position)
            .normalize();

        // Use the imported boatVelocity directly instead of window.boatVelocity
        if (boatVelocity) {
            boatVelocity.add(hitDirection.multiplyScalar(0.5));
        }
    }

    if (monster.attackSubState === 'charging') {
        // Set charge target as player position
        monster.chargeTarget.copy(boat.position);

        // Calculate direction to the charge target
        const directionToTarget = new THREE.Vector3()
            .subVectors(monster.chargeTarget, monster.mesh.position)
            .normalize();

        // Set velocity to charge through player at increased speed
        monster.velocity.x = directionToTarget.x * MONSTER_SPEED * 3;
        monster.velocity.z = directionToTarget.z * MONSTER_SPEED * 3;

        // Check if we've passed the player (dot product becomes negative)
        const toPlayer = new THREE.Vector3().subVectors(boat.position, monster.mesh.position);
        const movingDirection = new THREE.Vector3(monster.velocity.x, 0, monster.velocity.z).normalize();
        const dotProduct = toPlayer.dot(movingDirection);

        // If passed player or gotten very close, switch to repositioning
        if (dotProduct < -5 || distanceToPlayer < 5) {
            monster.attackSubState = 'repositioning';

            // Set a random reposition timer between 5-7 seconds
            monster.repositionTimer = 5 + Math.random() * 2;

            // Calculate a position to swim away to - not too far from player
            const swimAwayDistance = MONSTER_ATTACK_RANGE * 1.5; // Not too far

            // Calculate direction away from player
            const awayFromPlayerDir = new THREE.Vector3()
                .subVectors(monster.mesh.position, boat.position)
                .normalize();

            // Set the target position to swim away to
            monster.chargeTarget.set(
                boat.position.x + awayFromPlayerDir.x * swimAwayDistance,
                0,
                boat.position.z + awayFromPlayerDir.z * swimAwayDistance
            );
        }
    } else { // repositioning
        // Update reposition timer
        monster.repositionTimer -= deltaTime;

        // During repositioning phase
        if (monster.repositionTimer > 0) {
            // Move toward reposition target at moderate speed
            const directionToTarget = new THREE.Vector3()
                .subVectors(monster.chargeTarget, monster.mesh.position)
                .normalize();

            monster.velocity.x = directionToTarget.x * MONSTER_SPEED * 1.2;
            monster.velocity.z = directionToTarget.z * MONSTER_SPEED * 1.2;
        } else {
            // Timer expired, prepare for another charge
            monster.attackSubState = 'charging';
        }
    }

    // If attack time expires or player gets too far, dive
    if (monster.stateTimer <= 0 || distanceToPlayer > MONSTER_ATTACK_RANGE * 3) {
        monster.state = MONSTER_STATE.DIVING;
        monster.stateTimer = 5; // Time to dive
        delete monster.attackSubState; // Clean up attack sub-state
        delete monster.chargeTarget;
        delete monster.repositionTimer;
    }
}

export function updateDivingMonster(monster, deltaTime) {
    // Move downward at a dedicated diving speed - faster than regular movement
    monster.velocity.y = -MONSTER_SURFACING_SPEED; // Use same speed as surfacing for consistency

    // Slow down horizontal movement
    monster.velocity.x *= 0.95;
    monster.velocity.z *= 0.95;

    // Check if reached depth
    if (monster.mesh.position.y <= MONSTER_DEPTH) {
        monster.mesh.position.y = MONSTER_DEPTH; // Clamp to depth
        monster.state = MONSTER_STATE.LURKING;
        monster.stateTimer = MONSTER_DIVE_TIME;
        monster.eyeGlow = 0; // Reset eye glow
    }
}

export function updateDyingMonster(monster, deltaTime) {
    // Handle dying animation
    monster.mesh.position.y += monster.velocity.y;
    monster.velocity.y -= 0.06; // Double sinking acceleration again (was 0.03)

    // Rotate as it sinks - DOUBLED rotation speed
    monster.mesh.rotation.x += 0.1;   // Double again (was 0.05)
    monster.mesh.rotation.z += 0.06;  // Double again (was 0.03)

    // Track if any material is still visible
    let stillVisible = false;

    // Reduce opacity if materials support it - FASTER fade out
    monster.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
            // Make all materials transparent if they aren't already
            if (!child.material.transparent) {
                child.material.transparent = true;
                child.material.opacity = 1.0;
                // Store original opacity for reference
                child.material.userData.originalOpacity = 1.0;
            }

            // Reduce opacity
            child.material.opacity = Math.max(0, child.material.opacity - 0.06); // Double again (was 0.03)

            // If any material still has opacity > 0, the monster is still visible
            if (child.material.opacity > 0) {
                stillVisible = true;
            }
        }
    });

    // If the monster is completely transparent, remove it immediately
    if (!stillVisible) {


        // Remove from scene
        scene.remove(monster.mesh);

        // Remove from entityChunkMap instead of local array
        entityChunkMap.monsters.delete(monster);

        return;
    }

    // Otherwise continue with state timer update
    monster.stateTimer -= deltaTime * 3.0;
}

function animateTentacles(monster, deltaTime) {
    // Animate tentacles with sine wave motion
    const time = getTime();

    monster.tentacles.forEach((tentacle, index) => {
        // Different phase for each tentacle
        const phase = index * Math.PI / 3;

        // Faster tentacle movement when attacking
        const speed = monster.state === MONSTER_STATE.ATTACKING ? 5 : 2;

        // Calculate rotation based on sine wave
        const rotationAmount = Math.sin(time * speed + phase) * 0.2;

        // Apply rotation
        tentacle.rotation.z = Math.PI / 2 + rotationAmount;

        // Additional x-rotation for more dynamic movement
        tentacle.rotation.x = Math.PI / 2 + Math.sin(time * speed * 0.7 + phase) * 0.15;
    });

    // Update eye glow if hunting or attacking
    if (monster.state === MONSTER_STATE.HUNTING || monster.state === MONSTER_STATE.ATTACKING) {
        // Pulse the emissive intensity
        const eyeIntensity = 0.4 + Math.sin(time * 5) * 0.2;
        monster.mesh.children[1].material.emissive.setScalar(eyeIntensity); // Left eye
        monster.mesh.children[2].material.emissive.setScalar(eyeIntensity); // Right eye
    }
}

function createSplashEffect(position) {
    // Create a simple splash effect with particles
    const splashGeometry = new THREE.SphereGeometry(0.5, 4, 4);
    const splashMaterial = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 1.0
    });

    for (let i = 0; i < 20; i++) {
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.copy(position);

        // Random velocity - INCREASED by 2x again for even faster effect
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 8,     // Double again (was 4)
            Math.random() * 8 + 4,         // Double again (was 4+2)
            (Math.random() - 0.5) * 8      // Double again (was 4)
        );

        scene.add(splash);

        // Animate and remove splash particles
        const startTime = getTime();

        function animateSplash() {
            const elapsedTime = (getTime() - startTime) / 1000;

            // Reduced duration from 0.6 to 0.3 seconds for 2x faster animation
            if (elapsedTime > 0.3) {
                scene.remove(splash);
                return;
            }

            // Apply gravity - INCREASED for faster falling
            velocity.y -= 0.5;  // Double again (was 0.25)

            // Move splash
            splash.position.add(velocity);

            // Faster fade out to match shorter duration
            splash.material.opacity = 1 - (elapsedTime / 0.3);

            requestAnimationFrame(animateSplash);
        }

        animateSplash();
    }
}

function keepMonsterInWorld(monster) {
    // Get distance from center
    const distanceFromCenter = new THREE.Vector2(
        monster.mesh.position.x,
        monster.mesh.position.z
    ).length();

    // If monster is too far from center, add force toward center
    if (distanceFromCenter > 5000) {
        const towardCenter = new THREE.Vector3(
            -monster.mesh.position.x,
            0,
            -monster.mesh.position.z
        ).normalize().multiplyScalar(0.05);

        monster.velocity.add(towardCenter);
    }
}

// Export monsters array for other modules
export function getMonsters() {
    return getAllMonsters();
}

function createYellowBeastMonster(options = {}) {
    // Create monster group
    const monster = new THREE.Group();

    // Create body with bright yellow color
    const bodyGeometry = new THREE.ConeGeometry(5, 20, 8);
    bodyGeometry.rotateX(-Math.PI / 2); // Point forward

    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00, // Bright yellow
        specular: 0xffffaa,
        shininess: 50
    });

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    monster.add(body);

    // Create eyes - red for contrast with yellow body
    const eyeGeometry = new THREE.SphereGeometry(1, 8, 8);
    const eyeMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        emissive: 0xaa0000
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-2, 2, -8);
    monster.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(2, 2, -8);
    monster.add(rightEye);

    // Create tentacles - also yellow
    const tentacleGeometry = new THREE.CylinderGeometry(1, 0.2, 15, 8);
    const tentacleMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00, // Bright yellow
        specular: 0xffffaa,
        shininess: 30
    });

    const tentaclePositions = [
        [-3, -2, 5],
        [3, -2, 5],
        [-5, -2, 0],
        [5, -2, 0],
        [-3, -2, -5],
        [3, -2, -5]
    ];

    const tentacles = [];

    tentaclePositions.forEach((pos, index) => {
        const tentacle = new THREE.Mesh(tentacleGeometry, tentacleMaterial);
        tentacle.position.set(pos[0], pos[1], pos[2]);

        // Rotate tentacles to hang down
        tentacle.rotation.x = Math.PI / 2;

        // Add some random rotation
        tentacle.rotation.z = Math.random() * Math.PI * 2;

        monster.add(tentacle);
        tentacles.push(tentacle);


    });

    // Add prominent dorsal fin that sticks out of water
    const finGeometry = new THREE.BoxGeometry(12, 1, 8);
    finGeometry.translate(0, 5, 0); // Move up so it sticks out of water

    const finMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00, // Bright yellow
        specular: 0xffffaa,
        shininess: 50
    });

    const dorsalFin = new THREE.Mesh(finGeometry, finMaterial);
    dorsalFin.position.set(0, 8, 0); // Position high on the monster
    dorsalFin.rotation.y = Math.PI / 2; // Orient correctly
    monster.add(dorsalFin);

    // Add side fins that also stick out
    const leftFin = new THREE.Mesh(finGeometry, finMaterial);
    leftFin.position.set(-6, 2, 0);
    leftFin.rotation.z = Math.PI / 4; // Angle outward
    leftFin.scale.set(0.7, 0.7, 0.7); // Slightly smaller
    monster.add(leftFin);

    const rightFin = new THREE.Mesh(finGeometry, finMaterial);
    rightFin.position.set(6, 2, 0);
    rightFin.rotation.z = -Math.PI / 4; // Angle outward
    rightFin.scale.set(0.7, 0.7, 0.7); // Slightly smaller
    monster.add(rightFin);

    // Position and configure monster
    //setupMonsterPosition(monster, tentacles, dorsalFin, leftFin, rightFin, MONSTER_TYPES.YELLOW_BEAST);

    // After creating the monster meshes, add this logging:





    // Return the fully configured monster
    return {
        mesh: monster,
        velocity: new THREE.Vector3(0, 0, 0),
        tentacles: tentacles || [],
        dorsalFin: dorsalFin,
        leftFin: leftFin,
        rightFin: rightFin,
        state: options.state || 'lurking',
        stateTimer: options.stateTimer || 30,
        targetPosition: new THREE.Vector3(),
        eyeGlow: 0,
        monsterType: 'yellowBeast',
        health: 1000
    };
}

function setupMonsterPosition(monster, tentacles, dorsalFin, leftFin, rightFin, monsterType) {
    // Position monster randomly around the player, but closer than normal
    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = 100 + Math.random() * 300; // Reduced distance range (was 200-1000)

    monster.position.set(
        Math.cos(randomAngle) * randomRadius,
        MONSTER_DEPTH, // Start underwater instead of at surface
        Math.sin(randomAngle) * randomRadius
    );

    // Set random velocity
    const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * MONSTER_SPEED,
        0,
        (Math.random() - 0.5) * MONSTER_SPEED
    );

    // Add monster to scene
    //scene.add(monster);

    // Determine initial state randomly for more natural behavior
    let initialState;
    /*const stateRoll = Math.random();

    if (stateRoll < 0.7) {
        // 70% chance to start lurking underwater
        initialState = MONSTER_STATE.LURKING;
    } else if (stateRoll < 0.9) {
        // 20% chance to start hunting
        initialState = MONSTER_STATE.HUNTING;
    } else {
        // 10% chance to start in attacking mode (for immediate challenge)
        initialState = MONSTER_STATE.ATTACKING;
    }*/

    // Create the monster data object
    const monsterData = {
        mesh: monster,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * MONSTER_SPEED,
            0,
            (Math.random() - 0.5) * MONSTER_SPEED
        ),
        tentacles: tentacles || [],
        dorsalFin: dorsalFin,
        leftFin: leftFin,
        rightFin: rightFin,
        state: initialState,
        stateTimer: initialState === MONSTER_STATE.ATTACKING ?
            MONSTER_SURFACE_TIME + Math.random() * 20 :
            MONSTER_DIVE_TIME + Math.random() * 30,
        targetPosition: new THREE.Vector3(),
        eyeGlow: initialState === MONSTER_STATE.HUNTING ? 1 : 0,
        monsterType: monsterType,
        health: getMonsterHealth(monsterType)
    };

    // Register the monster with the chunk entity system
    //registerEntity('monsters', monsterData, monster.position);

    // Apply styling with outline
    applyMonsterStyle(monsterData);

    return monsterData;
}

function getMonsterHealth(monsterType) {
    switch (monsterType) {
        case MONSTER_TYPES.KRAKEN:
            return 6; // Tougher than regular monster
        case MONSTER_TYPES.SEA_SERPENT:
            return 4; // Average toughness
        case MONSTER_TYPES.PHANTOM_JELLYFISH:
            return 3; // Fragile but dangerous
        case MONSTER_TYPES.YELLOW_BEAST:
        default:
            return 3; // Original monster health
    }
}

function createKrakenMonster() {
    // Create monster group
    const monster = new THREE.Group();

    // Create kraken head - using sphere for a bulbous head
    const headGeometry = new THREE.SphereGeometry(8, 16, 16);
    const krakenMaterial = new THREE.MeshPhongMaterial({
        color: 0x800000, // Dark red color
        specular: 0xaa5555,
        shininess: 30
    });
    const head = new THREE.Mesh(headGeometry, krakenMaterial);
    head.scale.set(1, 0.8, 1.3); // Slightly oval shaped
    monster.add(head);

    // Create eyes - large and glowing
    const eyeGeometry = new THREE.SphereGeometry(1.5, 12, 12);
    const eyeMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff, // Cyan eyes
        emissive: 0x00aaaa, // Glowing
        shininess: 90
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-3, 2, -4);
    monster.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(3, 2, -4);
    monster.add(rightEye);

    // Create beak/mouth
    const beakGeometry = new THREE.ConeGeometry(3, 6, 8);
    const beakMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000, // Black beak
        shininess: 60
    });
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.rotation.x = Math.PI; // Point downward
    beak.position.set(0, 0, -8);
    monster.add(beak);

    // Create many long tentacles
    const tentacleCount = 12; // More tentacles than the original monster
    const tentacles = [];

    // Tentacle geometry - longer and more tapered
    const tentacleGeometry = new THREE.CylinderGeometry(2, 0.2, 30, 8);

    // Different positions for tentacles in a circle
    for (let i = 0; i < tentacleCount; i++) {
        const angle = (i / tentacleCount) * Math.PI * 2;
        const radius = 6;

        const tentacle = new THREE.Mesh(tentacleGeometry, krakenMaterial);

        // Position tentacles in a circle around the bottom of the head
        tentacle.position.set(
            Math.cos(angle) * radius,
            -4,
            Math.sin(angle) * radius + 2
        );

        // Rotate to hang down and outward
        tentacle.rotation.x = Math.PI / 2;
        tentacle.rotation.z = angle;

        monster.add(tentacle);
        tentacles.push(tentacle);
    }

    // Kraken doesn't have fins, but let's add some spikes on top
    const spikeGeometry = new THREE.ConeGeometry(1, 4, 4);
    const spikeMaterial = new THREE.MeshPhongMaterial({
        color: 0x600000, // Darker red
        shininess: 30
    });

    // Create central dorsal spike (replaces fin for fin detection)
    const dorsalSpike = new THREE.Mesh(spikeGeometry, spikeMaterial);
    dorsalSpike.position.set(0, 8, 0);
    monster.add(dorsalSpike);

    // Add side spikes in place of fins
    const leftSpike = new THREE.Mesh(spikeGeometry, spikeMaterial);
    leftSpike.position.set(-6, 3, 0);
    leftSpike.rotation.z = -Math.PI / 6;
    monster.add(leftSpike);

    const rightSpike = new THREE.Mesh(spikeGeometry, spikeMaterial);
    rightSpike.position.set(6, 3, 0);
    rightSpike.rotation.z = Math.PI / 6;
    monster.add(rightSpike);

    // Setup position and add to scene
    setupMonsterPosition(monster, tentacles, dorsalSpike, leftSpike, rightSpike, MONSTER_TYPES.KRAKEN);
}

function createSeaSerpentMonster() {
    // Create monster group
    const monster = new THREE.Group();

    // Create serpent segments - series of connected spheres for a segmented look
    const segmentCount = 7;
    const segmentGeometry = new THREE.SphereGeometry(4, 16, 16);
    const serpentMaterial = new THREE.MeshPhongMaterial({
        color: 0x006400, // Dark green
        specular: 0x88aa88,
        shininess: 70
    });

    // Keep track of segments for animation
    const segments = [];

    // Create body segments
    for (let i = 0; i < segmentCount; i++) {
        const segment = new THREE.Mesh(segmentGeometry, serpentMaterial);
        segment.position.set(0, 0, i * 8); // Spaced out along z-axis
        segment.scale.set(1, 0.8, 1); // Slightly flattened
        monster.add(segment);
        segments.push(segment);
    }

    // Serpent head is the first segment - make it larger
    segments[0].scale.set(1.3, 1, 1.3);

    // Create eyes - yellow with slit pupils
    const eyeGeometry = new THREE.SphereGeometry(1, 8, 8);
    const eyeMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00, // Yellow
        emissive: 0x888800
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-2.5, 1, -3);
    monster.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(2.5, 1, -3);
    monster.add(rightEye);

    // Add pupils (black slits)
    const pupilGeometry = new THREE.PlaneGeometry(0.5, 2);
    const pupilMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide
    });

    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(-2.5, 1, -3.6);
    monster.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(2.5, 1, -3.6);
    monster.add(rightPupil);

    // Create fins - triangular and thin
    const finGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        0, 0, 0,
        0, 10, 0,
        15, 0, 0
    ]);
    finGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    finGeometry.computeVertexNormals();

    const finMaterial = new THREE.MeshPhongMaterial({
        color: 0x008800, // Lighter green
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });

    // Dorsal fin - tall and prominent
    const dorsalFin = new THREE.Mesh(finGeometry, finMaterial);
    dorsalFin.position.set(0, 3, 16);
    dorsalFin.rotation.y = Math.PI / 2;
    monster.add(dorsalFin);

    // Create side fins
    const leftFin = new THREE.Mesh(finGeometry, finMaterial);
    leftFin.position.set(-4, 0, 16);
    leftFin.rotation.set(0, Math.PI / 2, Math.PI / 5);
    leftFin.scale.set(0.6, 0.6, 0.6);
    monster.add(leftFin);

    const rightFin = new THREE.Mesh(finGeometry, finMaterial);
    rightFin.position.set(4, 0, 16);
    rightFin.rotation.set(0, Math.PI / 2, -Math.PI / 5);
    rightFin.scale.set(0.6, 0.6, 0.6);
    monster.add(rightFin);

    // Create forked tail
    const tailGeometry = new THREE.BufferGeometry();
    const tailVertices = new Float32Array([
        0, 0, 0,
        -8, 8, 0,
        -8, -8, 0,
        8, 8, 0,
        8, -8, 0
    ]);
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
    tailGeometry.setIndex([0, 1, 2, 0, 3, 4]);
    tailGeometry.computeVertexNormals();

    const tail = new THREE.Mesh(tailGeometry, finMaterial);
    tail.position.set(0, 0, 8 * (segmentCount - 1) + 4);
    tail.rotation.y = Math.PI / 2;
    monster.add(tail);

    // Rotate entire monster to be horizontal
    monster.rotation.x = -Math.PI / 2;

    // Use segments as tentacles for animation system
    setupMonsterPosition(monster, segments, dorsalFin, leftFin, rightFin, MONSTER_TYPES.SEA_SERPENT);
}

function createPhantomJellyfishMonster() {
    // Create monster group
    const monster = new THREE.Group();

    // Create bell (main body) - translucent with bioluminescence
    const bellGeometry = new THREE.SphereGeometry(10, 32, 32);
    bellGeometry.scale(1, 0.6, 1); // Flatten to dome shape

    // Use MeshPhysicalMaterial for translucency effects
    const bellMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x5555ff, // Blue base color
        emissive: 0x0000ff, // Glowing blue
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7,
        roughness: 0.2,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.2,
        side: THREE.DoubleSide
    });

    const bell = new THREE.Mesh(bellGeometry, bellMaterial);
    bell.position.y = 5;
    monster.add(bell);

    // Create inner core - brighter glow
    const coreGeometry = new THREE.SphereGeometry(5, 16, 16);
    const coreMaterial = new THREE.MeshPhongMaterial({
        color: 0x8888ff, // Lighter blue
        emissive: 0x0088ff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6
    });

    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 5;
    monster.add(core);

    // Create tentacles - many thin, glowing strands
    const tentacleCount = 24;
    const tentacles = [];

    const tentacleMaterial = new THREE.MeshPhongMaterial({
        color: 0x8888ff,
        emissive: 0x0000ff,
        transparent: true,
        opacity: 0.6
    });

    // Create circular arrangement of tentacles
    for (let i = 0; i < tentacleCount; i++) {
        const angle = (i / tentacleCount) * Math.PI * 2;
        const radius = 8;

        // Vary tentacle length and thickness
        const length = 15 + Math.random() * 10;
        const thickness = 0.1 + Math.random() * 0.3;

        const tentacleGeometry = new THREE.CylinderGeometry(thickness, thickness * 0.5, length, 6);
        const tentacle = new THREE.Mesh(tentacleGeometry, tentacleMaterial);

        // Position around bottom edge of bell
        tentacle.position.set(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
        );

        // Rotate to hang down
        tentacle.rotation.x = Math.PI / 2;

        monster.add(tentacle);
        tentacles.push(tentacle);
    }

    // Create thicker feeding tentacles
    const feedingTentacleCount = 4;

    for (let i = 0; i < feedingTentacleCount; i++) {
        const angle = (i / feedingTentacleCount) * Math.PI * 2;
        const radius = 4;

        const feedingTentacleGeometry = new THREE.CylinderGeometry(0.6, 0.3, 25, 8);
        const feedingTentacle = new THREE.Mesh(feedingTentacleGeometry, tentacleMaterial);

        // Position near center of bell
        feedingTentacle.position.set(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
        );

        // Rotate to hang down
        feedingTentacle.rotation.x = Math.PI / 2;

        monster.add(feedingTentacle);
        tentacles.push(feedingTentacle);
    }

    // Add detection "eyes" - not visible but needed for system
    // We'll use the bell itself as the "fin" for surface detection

    setupMonsterPosition(monster, tentacles, bell, bell, bell, MONSTER_TYPES.PHANTOM_JELLYFISH);

    // Add pulsating glow animation capability
    monster.userData.pulseTime = Math.random() * Math.PI * 2;
    monster.userData.chargeLevel = 0;
}

// Add special monster update functions based on type
export function updateSpecialMonsterBehaviors(monster, deltaTime) {
    switch (monster.monsterType) {
        case MONSTER_TYPES.KRAKEN:
            updateKrakenBehavior(monster, deltaTime);
            break;
        case MONSTER_TYPES.SEA_SERPENT:
            updateSeaSerpentBehavior(monster, deltaTime);
            break;
        case MONSTER_TYPES.PHANTOM_JELLYFISH:
            updateJellyfishBehavior(monster, deltaTime);
            break;
    }
}

export function updateKrakenBehavior(monster, deltaTime) {
    // Kraken has more aggressive tentacle movement
    const time = getTime();

    if (monster.tentacles && monster.tentacles.length > 0) {
        monster.tentacles.forEach((tentacle, index) => {
            const phase = index * Math.PI / 6;
            const speed = 3;

            // Dramatic waving motion
            tentacle.rotation.x = Math.PI / 2 + Math.sin(time * speed + phase) * 0.5;
            tentacle.rotation.z = Math.sin(time * (speed * 0.7) + phase) * 0.4;
        });
    }

    // Kraken can periodically lunge at player when close enough
    if (monster.state === MONSTER_STATE.ATTACKING) {
        const distanceToPlayer = monster.mesh.position.distanceTo(boat.position);

        if (distanceToPlayer < MONSTER_ATTACK_RANGE * 0.7 && Math.random() < 0.01) {
            // Lunge toward player
            const directionToPlayer = new THREE.Vector3()
                .subVectors(boat.position, monster.mesh.position)
                .normalize();

            monster.velocity.copy(directionToPlayer.multiplyScalar(MONSTER_SPEED * 4));

            // Create splash for dramatic effect
            createSplashEffect(monster.mesh.position.clone());
        }
    }
}

export function updateSeaSerpentBehavior(monster, deltaTime) {
    // Sea serpent has snake-like undulating movement
    const time = getTime();

    // Adjust segments to create undulating motion
    if (monster.tentacles && monster.tentacles.length > 0) {
        monster.tentacles.forEach((segment, index) => {
            // Skip first segment (head)
            if (index === 0) return;

            const waveSpeed = 2;
            const waveAmplitude = 3;
            const wavelength = 4; // Controls how many waves appear along body

            // Sideways serpentine motion
            const xOffset = Math.sin((time * waveSpeed) + (index / wavelength) * Math.PI * 2) * waveAmplitude;

            segment.position.x = xOffset;
        });
    }

    // If attacking, serpent can occasionally do a quick strike
    if (monster.state === MONSTER_STATE.ATTACKING) {
        const distanceToPlayer = monster.mesh.position.distanceTo(boat.position);

        if (distanceToPlayer < MONSTER_ATTACK_RANGE * 1.5 && Math.random() < 0.005) {
            // Quick strike - sudden acceleration toward player
            const directionToPlayer = new THREE.Vector3()
                .subVectors(boat.position, monster.mesh.position)
                .normalize();

            monster.velocity.copy(directionToPlayer.multiplyScalar(MONSTER_SPEED * 5));

            // Create splash effect
            createSplashEffect(monster.mesh.position.clone());
        }
    }
}

export function updateJellyfishBehavior(monster, deltaTime) {
    // Jellyfish pulses and glows
    const time = getTime();

    // Pulsating animation for bell
    const pulseSpeed = 1.5;
    const pulseAmplitude = 0.15;

    // Use userData for storing the pulse time if not already set
    if (!monster.mesh.userData.pulseTime) {
        monster.mesh.userData.pulseTime = Math.random() * Math.PI * 2;
    }

    const scale = 1 + Math.sin(time * pulseSpeed + monster.mesh.userData.pulseTime) * pulseAmplitude;

    // Apply pulsing to bell (first child is bell)
    if (monster.mesh.children[0]) {
        monster.mesh.children[0].scale.set(scale, scale * 0.6, scale);
    }

    // Pulse tentacles slightly out of sync with bell
    if (monster.tentacles && monster.tentacles.length > 0) {
        monster.tentacles.forEach((tentacle, index) => {
            const phase = index * 0.2;
            tentacle.position.y = -1 + Math.sin(time * pulseSpeed + phase) * 0.5;
        });
    }

    // Special attack: charge and discharge electric shock
    if (monster.state === MONSTER_STATE.ATTACKING) {
        // When attacking, gradually charge up
        if (!monster.chargeLevel) monster.chargeLevel = 0;

        const distanceToPlayer = monster.mesh.position.distanceTo(boat.position);

        if (distanceToPlayer < MONSTER_ATTACK_RANGE) {
            // Charge up faster when closer to player
            monster.chargeLevel += deltaTime * 0.2;

            // Increase glow based on charge level
            if (monster.mesh.children[0] && monster.mesh.children[0].material) {
                // Adjust bell glow
                monster.mesh.children[0].material.emissiveIntensity = 0.5 + monster.chargeLevel * 0.5;

                // Core glow (second child)
                if (monster.mesh.children[1] && monster.mesh.children[1].material) {
                    monster.mesh.children[1].material.emissiveIntensity = 0.8 + monster.chargeLevel * 0.7;
                }

                // Change color toward electric blue as it charges
                const hue = 0.6 + monster.chargeLevel * 0.1; // Shift toward cyan
                monster.mesh.children[0].material.color.setHSL(hue, 0.8, 0.5);

                // When fully charged, discharge!
                if (monster.chargeLevel >= 1) {
                    // Create electric discharge effect
                    createElectricDischargeEffect(monster.mesh.position);

                    // Reset charge level
                    monster.chargeLevel = 0;

                    // Reset color
                    monster.mesh.children[0].material.color.set(0x5555ff);
                    monster.mesh.children[0].material.emissiveIntensity = 0.5;

                    if (monster.mesh.children[1]) {
                        monster.mesh.children[1].material.emissiveIntensity = 0.8;
                    }
                }
            }
        } else {
            // Discharge gradually when far from player
            monster.chargeLevel = Math.max(0, monster.chargeLevel - deltaTime * 0.1);
        }
    }
}

// New function to create electric discharge effect
function createElectricDischargeEffect(position) {
    // Create lightning bolt effect
    const lightningMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
    });

    const bolts = [];
    const boltCount = 8;

    for (let i = 0; i < boltCount; i++) {
        // Create jagged line for lightning
        const points = [];
        const segments = 6;
        const radius = 20;
        const angle = (i / boltCount) * Math.PI * 2;

        // Starting point at jellyfish position
        points.push(new THREE.Vector3(0, 0, 0));

        // Create jagged path outward
        for (let j = 1; j < segments; j++) {
            const segmentRadius = (j / segments) * radius;
            const jitter = 2 * (1 - j / segments); // More jitter near origin

            points.push(new THREE.Vector3(
                Math.cos(angle) * segmentRadius + (Math.random() - 0.5) * jitter,
                (Math.random() - 0.5) * jitter,
                Math.sin(angle) * segmentRadius + (Math.random() - 0.5) * jitter
            ));
        }

        // Create geometry from points
        const boltGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const bolt = new THREE.Line(boltGeometry, lightningMaterial);
        bolt.position.copy(position);

        scene.add(bolt);
        bolts.push(bolt);
    }

    // Add glow sphere at center
    const glowGeometry = new THREE.SphereGeometry(5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(position);
    scene.add(glow);

    // Animate the discharge
    const startTime = getTime();

    function animateDischarge() {
        const elapsedTime = (getTime() - startTime) / 1000;

        if (elapsedTime > 0.5) {
            // Remove all bolts and glow
            bolts.forEach(bolt => scene.remove(bolt));
            scene.remove(glow);
            return;
        }

        // Pulsate intensity
        const intensity = 1 - elapsedTime / 0.5;

        // Update bolt opacity
        bolts.forEach(bolt => {
            bolt.material.opacity = intensity * 0.8;
        });

        // Update glow
        glow.material.opacity = intensity * 0.6;
        glow.scale.set(1 + elapsedTime * 4, 1 + elapsedTime * 4, 1 + elapsedTime * 4);

        requestAnimationFrame(animateDischarge);
    }

    animateDischarge();
}

// Respawn monsters at night until we reach the maximum count
function respawnMonstersAtNight() {
    // DISABLED: Don't spawn monsters at night from here

    return;
}

// Helper function to create a monster by type
function createMonsterByType(monsterType, position = null) {
    switch (monsterType) {
        case MONSTER_TYPES.KRAKEN:
            createKrakenMonster(position);
            break;
        case MONSTER_TYPES.SEA_SERPENT:
            //createSeaSerpentMonster(position);
            break;
        case MONSTER_TYPES.PHANTOM_JELLYFISH:
            createPhantomJellyfishMonster(position);
            break;
        case MONSTER_TYPES.YELLOW_BEAST:
        default:
            createYellowBeastMonster(position); // Original monster
            break;
    }
}

// Modify the createTreasureDrop function to use the new system
export function handleMonsterTreasureDrop(monster) {
    // Call the imported createTreasureDrop function from treasure.js
    createTreasureDrop(monster.mesh.position, monster.monsterType);
}

// Add this function to apply styling based on monster type
function applyMonsterStyle(monster) {
    const monsterType = monster.monsterType;

    // Define style options based on monster type
    const styleOptions = {
        recursive: true,  // Apply to all meshes in the monster
        scale: 1.07       // Default outline thickness
    };

    // Customize style per monster type
    switch (monsterType) {
        case MONSTER_TYPES.KRAKEN:
            styleOptions.material = new THREE.MeshBasicMaterial({
                color: 0x000000,  // Dark red outline for Kraken
                side: THREE.BackSide
            });
            break;

        case MONSTER_TYPES.PHANTOM_JELLYFISH:
            styleOptions.material = new THREE.MeshBasicMaterial({
                color: 0x000000,  // Purple outline for jellyfish
                side: THREE.BackSide,
                transparent: true
            });
            styleOptions.scale = 1.09;  // Slightly thicker outline
            break;

        case MONSTER_TYPES.SEA_SERPENT:
            styleOptions.material = new THREE.MeshBasicMaterial({
                color: 0x000000,  // Dark green outline for serpent
                side: THREE.BackSide
            });
            break;

        case MONSTER_TYPES.YELLOW_BEAST:
        default:
            styleOptions.material = new THREE.MeshBasicMaterial({
                color: 0x000000,  // Black outline for yellow beast
                side: THREE.BackSide
            });
            styleOptions.scale = 1.05;  // Slightly thinner outline
            break;
    }

    // Apply the outline
    applyOutline(monster.mesh, styleOptions);
}

// Export function to remove monster outline
export function removeMonsterOutline(monster) {
    if (monster && monster.mesh) {
        removeOutline(monster.mesh, { recursive: true });
    }
}

// Add this simple function to handle boat-monster collisions
function checkBoatMonsterCollisions() {
    if (!boat) return;  // Updated this line

    const currentTime = getTime() / 1000; // Convert to seconds

    // Check if we can deal damage (cooldown expired)
    if (currentTime - lastBoatCollisionTime <= BOAT_COLLISION_COOLDOWN) {
        return; // Still in cooldown period
    }

    // Get boat velocity magnitude (speed)
    const boatSpeed = boatVelocity.length();

    // Lower the minimum speed threshold to make collisions more forgiving
    const MIN_COLLISION_SPEED = 0.01; // REDUCED from 0.05 for more consistent detection
    if (boatSpeed < MIN_COLLISION_SPEED) return;

    // Debug collision info
    // 

    // Check collision with each monster - GET FROM CENTRAL SOURCE
    getMonsters().forEach(monster => {
        // Skip monsters that are already dying
        if (monster.state === MONSTER_STATE.DYING) return;

        // Increased surface threshold - check monsters that are closer to surface
        if (monster.mesh.position.y < BOAT_SURFACE_THRESHOLD) return;

        // Check distance between boat and monster
        const distanceToMonster = boat.position.distanceTo(monster.mesh.position);

        // Log distance for monsters near collision range
        if (distanceToMonster < BOAT_COLLISION_RANGE * 1.5) {

        }

        if (distanceToMonster < BOAT_COLLISION_RANGE) {
            // Collision detected! Apply damage proportional to boat speed
            const speedFactor = Math.min(4, Math.max(1, boatSpeed * 5));
            const damageAmount = Math.floor(BOAT_COLLISION_DAMAGE * speedFactor);

            // Apply damage to monster
            monster.health -= damageAmount;


            // NEW: Flash monster red to indicate damage (reusing cannon hit effect)
            flashMonsterRed(monster, true); // Use true to make it brighter like a well-targeted hit

            // Set collision cooldown
            lastBoatCollisionTime = currentTime;

            // Create BIGGER splash effect for better visual feedback
            createBiggerSplashEffect(monster.mesh.position.clone());

            // Calculate impact direction (from monster to player)
            const impactDirection = new THREE.Vector3()
                .subVectors(boat.position, monster.mesh.position)
                .normalize();

            // Apply knockback force proportional to boat speed
            // Force is stronger when boat is moving fast
            const impactForce = 0.001 + boatSpeed * 3.0; // INCREASED force for more noticeable knockback

            // Use the new knockback function
            applyShipKnockback(impactDirection, impactForce, {
                resetVelocity: true,      // CHANGED to reset velocity for more dramatic effect
                bounceFactor: 1.5,        // INCREASED bounce factor for stronger impact
                dampingFactor: 1.0,       // No damping on impact
                knockbackDuration: 0.8,    // INCREASED duration from 0.5 to 0.8 seconds
                isMonsterCollision: true   // Flag this as a monster collision so it can be filtered
            });

            // Add direct position shift for immediate feedback
            boat.position.add(impactDirection.multiplyScalar(1.5));

            // Check if monster is defeated
            if (monster.health <= 0) {
                // 
                // 

                // Check if any other monsters are using the same materials
                const dyingMaterials = new Set();
                monster.mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        dyingMaterials.add(child.material.uuid);
                    }
                });

                // Check all other monsters for material sharing
                getMonsters().forEach((otherMonster, index) => {
                    if (otherMonster !== monster) {
                        let sharedMaterials = false;
                        otherMonster.mesh.traverse(child => {
                            if (child.isMesh && child.material && dyingMaterials.has(child.material.uuid)) {
                                sharedMaterials = true;

                            }
                        });

                    }
                });

                // Transition to dying state
                monster.state = MONSTER_STATE.DYING;
                monster.stateTimer = 3; // Time for dying animation

                // Possibly drop treasure
                handleMonsterTreasureDrop(monster);

                // No need for setTimeout removal since updateDyingMonster will handle it
            } else {
                // Monster is still alive but damaged - make it flee
                /*monster.state = MONSTER_STATE.DIVING;
                monster.stateTimer = 3;

                // Move away from player
                const fleeDirection = new THREE.Vector3()
                    .subVectors(monster.mesh.position, playerBoat.position)
                    .normalize();

                monster.velocity.copy(fleeDirection.multiplyScalar(MONSTER_SPEED * 3));*/
            }
        }
    });
}

// Add this function for a bigger splash visual effect on collision
function createBiggerSplashEffect(position) {
    // Create a larger splash effect with particles
    const splashGeometry = new THREE.SphereGeometry(0.7, 6, 6); // Larger particles
    const splashMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF, // White for better visibility
        transparent: true,
        opacity: 1.0
    });

    for (let i = 0; i < 30; i++) { // More particles
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.copy(position);
        splash.position.y = Math.max(0, position.y); // Ensure at water level

        // Random velocity - Even more explosive for better visual feedback
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,     // Wider spread
            Math.random() * 12 + 6,         // Higher splash
            (Math.random() - 0.5) * 10      // Wider spread
        );

        scene.add(splash);

        // Animate and remove splash particles
        const startTime = getTime();

        function animateSplash() {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime > 0.5) {
                scene.remove(splash);
                return;
            }

            // Apply gravity
            velocity.y -= 0.6;  // Faster falling

            // Move splash
            splash.position.add(velocity.clone().multiplyScalar(0.03));

            // Fade out
            splash.material.opacity = 1 - (elapsedTime / 0.5);

            requestAnimationFrame(animateSplash);
        }

        animateSplash();
    }
}

export function registerSeaMonsterTypes() {
    // Register all sea monster types with the monster manager

    // Yellow Beast (original monster)
    registerMonsterType(MONSTER_TYPES.YELLOW_BEAST, {
        createFn: createYellowBeastMonster,
        updateFn: updateYellowBeastMonster,
        getStateFn: getMonsterState,
        respawnFn: respawnMonster,
        cleanupFn: cleanupMonster
    });

    /*
    // Kraken monster
    registerMonsterType(MONSTER_TYPES.KRAKEN, {
        createFn: createKrakenMonster,
        updateFn: updateKrakenMonster,
        getStateFn: getMonsterState,
        respawnFn: respawnMonster,
        cleanupFn: cleanupMonster
    });

    // Phantom Jellyfish monster
    registerMonsterType(MONSTER_TYPES.PHANTOM_JELLYFISH, {
        createFn: createPhantomJellyfishMonster,
        updateFn: updateJellyfishBehavior,
        getStateFn: getMonsterState,
        respawnFn: respawnMonster,
        cleanupFn: cleanupMonster
    });*/

    // More monster types can be added similarly
}

// Create a general monster state getter
function getMonsterState(monster) {
    return {
        position: monster.mesh.position.clone(),
        rotation: monster.mesh.rotation.clone(),
        velocity: monster.velocity.clone(),
        health: monster.health,
        state: monster.state,
        stateTimer: monster.stateTimer,
        monsterType: monster.monsterType
    };
}

// Generic respawn function to use with monster manager
function respawnMonster(states, chunkKey) {
    return;


    states.forEach(state => {
        if (!state || !state.monsterType) {

            return;
        }

        // CHANGE 1: Skip any monsters that were in dying state
        if (state.state === 'dying') {

            return;
        }

        console.log(`Respawning ${state.monsterType} at position:`,
            state.position ? `${state.position.x.toFixed(1)}, ${state.position.y.toFixed(1)}, ${state.position.z.toFixed(1)}` : 'unknown');

        // CHANGE 2: Always force surfacing state for better visibility
        const respawnState = state.state === 'lurking' ? 'surfacing' : state.state;

        const monster = createMonster(state.monsterType, {
            position: state.position,
            rotation: state.rotation,
            velocity: state.velocity || new THREE.Vector3(0, 0.1, 0), // Add upward motion
            health: state.health || 3,
            state: respawnState,
            stateTimer: respawnState === 'surfacing' ? 5 : (state.stateTimer || 30)
        });

        if (monster) {
            // CHANGE 3: Force monster visibility with our new function
            ensureMonsterVisibility(monster);

        }
    });
}

// Cleanup function for monster manager
function cleanupMonster(monster) {
    // Remove from scene
    scene.remove(monster.mesh);

    // Any additional cleanup like removing event listeners, etc.
}

// Update functions for specific monster types
function updateYellowBeastMonster(monster, deltaTime) {
    // Call appropriate update function based on state
    switch (monster.state) {
        case MONSTER_STATE.LURKING:
            updateLurkingMonster(monster, deltaTime);
            break;
        case MONSTER_STATE.HUNTING:
            updateHuntingMonster(monster, deltaTime);
            break;
        case MONSTER_STATE.SURFACING:
            updateSurfacingMonster(monster, deltaTime);
            break;
        case MONSTER_STATE.ATTACKING:
            updateAttackingMonster(monster, deltaTime);
            break;
        case MONSTER_STATE.DIVING:
            updateDivingMonster(monster, deltaTime);
            break;
        case MONSTER_STATE.DYING:
            updateDyingMonster(monster, deltaTime);
            break;
    }

    // Common yellow beast behaviors
    animateTentacles(monster, deltaTime);

    // Apply velocity to position
    monster.mesh.position.add(monster.velocity);

    // Make monster face direction of travel
    if (monster.velocity.length() > 0.01) {
        const lookTarget = monster.mesh.position.clone().add(monster.velocity);
        monster.mesh.lookAt(lookTarget);
    }
}

function updateKrakenMonster(monster, deltaTime) {
    // Base updates like yellowBeast
    updateYellowBeastMonster(monster, deltaTime);

    // Additional kraken-specific behavior
    updateKrakenBehavior(monster, deltaTime);
}

