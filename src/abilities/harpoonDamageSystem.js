import * as THREE from 'three';
import { registerProjectile, unregisterProjectile, applyDamage } from './damageSystem.js';
import { getAllMonsters } from '../entities/monsterManager.js';
import { getTime, boat, boatVelocity } from '../core/gameState.js';

// Constant values for harpoon damage configuration
export const HARPOON_CONFIG = {
    IMPACT_DAMAGE: 0,      // Initial damage on hit
    TICK_DAMAGE: 0,         // Damage per tick while attached
    TICK_INTERVAL: 1000,     // Time between damage ticks (milliseconds)
    HIT_RADIUS: 10,          // Larger collision detection radius
    MAX_ATTACH_DISTANCE: 30,  // Maximum attachment range
    MAX_TETHER_LENGTH: 100,    // Increased to a more noticeable length for testing
    ROPE_ELASTICITY: 0,     // How elastic the rope is
    DRAG_STRENGTH: 1.0,      // How strongly to pull the monster when beyond max length
    OVERRIDE_MONSTER_AI: true, // NEW: Force override monster AI when tethered
    POSITION_STABILITY: 3.0,    // NEW: How strongly to maintain our position changes
    USE_HARD_CONSTRAINT: true,  // New setting to enable hard position constraints
    ISLAND_GRAPPLE_STRENGTH: 1.2, // How strongly to pull the boat when grappling
    MAX_GRAPPLE_DISTANCE: 150,    // Maximum grappling range for islands
};

// Track active harpoons (potentially multiple in multiplayer)
export const activeHarpoons = new Map();

/**
 * Register a harpoon projectile with the damage system
 * @param {string} id - Unique identifier for this harpoon
 * @param {Object} harpoonObject - The harpoon mesh and related data
 * @returns {string} The registered harpoon id
 */
export function registerHarpoonProjectile(id, harpoonObject) {
    // Register with main damage system as a projectile first
    registerProjectile(id, {
        mesh: harpoonObject.mesh,
        data: {
            damage: HARPOON_CONFIG.IMPACT_DAMAGE,
            hitRadius: HARPOON_CONFIG.HIT_RADIUS,
            isHarpoon: true // Flag to identify harpoons
        },
        prevPosition: harpoonObject.mesh.position.clone(),
        // We don't use the default onHit handler - we'll handle attachment elsewhere
    });

    // Store additional harpoon-specific data
    activeHarpoons.set(id, {
        harpoonMesh: harpoonObject.mesh,
        harpoonLine: harpoonObject.line,
        isAttached: false,
        attachedMonster: null,
        attachPoint: new THREE.Vector3(),
        attachOffset: new THREE.Vector3(),
        lastDamageTime: 0,
        harpoonControls: harpoonObject.controls, // Reference to harpoon control methods
        isReeling: false
    });


    return id;
}

/**
 * Unregister a harpoon from the damage system
 * @param {string} id - Harpoon ID to unregister
 */
export function unregisterHarpoonProjectile(id) {
    // Unregister from the main damage system
    unregisterProjectile(id);

    // Remove from our harpoon tracking
    activeHarpoons.delete(id);


}

/**
 * Check if a harpoon has collided with any monsters
 * @param {string} harpoonId - ID of the harpoon to check
 * @returns {Object|null} The monster hit, or null if none
 */
export function checkHarpoonCollisions(harpoonId) {
    const harpoonData = activeHarpoons.get(harpoonId);
    if (!harpoonData || !harpoonData.harpoonMesh || harpoonData.isAttached) {
        return null;
    }

    const harpoonPosition = harpoonData.harpoonMesh.position;
    const monsters = getAllMonsters();

    // Track the closest monster that gets hit
    let closestMonster = null;
    let closestDistance = HARPOON_CONFIG.MAX_ATTACH_DISTANCE;

    // Find the closest monster within attachment range
    for (const monster of monsters) {
        if (!monster.mesh || monster.health <= 0) continue;

        const monsterPosition = monster.mesh.position;
        const distance = harpoonPosition.distanceTo(monsterPosition);

        // Consider monster size to make bigger monsters easier to hit
        const monsterSize = monster.size || 5; // Use monster size or default to 5
        const effectiveHitDistance = HARPOON_CONFIG.MAX_ATTACH_DISTANCE + monsterSize;

        // If this monster is closer than our current closest hit
        if (distance <= effectiveHitDistance && distance < closestDistance) {
            closestMonster = monster;
            closestDistance = distance;

            // Log hit detection for troubleshooting

        }
    }

    if (closestMonster) {

    }

    return closestMonster;
}

/**
 * Attach a harpoon to a monster
 * @param {string} harpoonId - ID of the harpoon
 * @param {Object} monster - Monster to attach to
 * @returns {boolean} True if attachment successful
 */
export function attachHarpoonToMonster(harpoonId, monster) {
    const harpoonData = activeHarpoons.get(harpoonId);
    if (!harpoonData || !monster || !monster.mesh) {

        return false;
    }

    // Get monster position
    const monsterPosition = monster.mesh.position.clone();

    // Update harpoon data
    harpoonData.isAttached = true;
    harpoonData.attachedMonster = monster;
    harpoonData.attachPoint.copy(monsterPosition);

    // Calculate attachment offset from monster center
    harpoonData.attachOffset.copy(monsterPosition).sub(monsterPosition); // Initially zero, but could be adjusted

    // Position harpoon at attachment point
    harpoonData.harpoonMesh.position.copy(monsterPosition);

    // Deal initial impact damage
    applyDamage(monster, HARPOON_CONFIG.IMPACT_DAMAGE, { isHarpoon: true });

    // Mark time for damage ticks
    harpoonData.lastDamageTime = getTime();

    // Notify harpoon controls about attachment if available
    if (harpoonData.harpoonControls && harpoonData.harpoonControls.onAttach) {
        harpoonData.harpoonControls.onAttach(monster);
    }

    // In the attachHarpoonToMonster function, add this line after attaching:
    monster.isBeingDragged = true;


    return true;
}

/**
 * Detach a harpoon from its monster
 * @param {string} harpoonId - ID of the harpoon to detach
 */
export function detachHarpoon(harpoonId) {
    const harpoonData = activeHarpoons.get(harpoonId);
    if (!harpoonData || !harpoonData.isAttached) return;

    const monster = harpoonData.attachedMonster;

    // Update harpoon data
    harpoonData.isAttached = false;
    harpoonData.attachedMonster = null;

    // Notify harpoon controls about detachment if available
    if (harpoonData.harpoonControls && harpoonData.harpoonControls.onDetach) {
        harpoonData.harpoonControls.onDetach(monster);
    }

    // In the detachHarpoon function, add this line:
    if (monster) {
        monster.isBeingDragged = false;
    }


}

/**
 * Attach a harpoon to an island for grappling
 * @param {string} harpoonId - ID of the harpoon
 * @param {Object} islandData - Data about island collision
 * @returns {boolean} True if attachment successful
 */
export function attachHarpoonToIsland(harpoonId, islandData) {
    const harpoonData = activeHarpoons.get(harpoonId);
    if (!harpoonData || !islandData || !islandData.point) {

        return false;
    }

    // Update harpoon data
    harpoonData.isAttached = true;
    harpoonData.isAttachedToIsland = true; // New flag for island attachment
    harpoonData.attachedMonster = null;     // Not attached to monster
    harpoonData.islandData = islandData;    // Store island reference
    harpoonData.attachPoint = islandData.point.clone();

    // Position harpoon at attachment point
    harpoonData.harpoonMesh.position.copy(islandData.point);

    // Notify harpoon controls about attachment if available
    if (harpoonData.harpoonControls && harpoonData.harpoonControls.onAttachToIsland) {
        harpoonData.harpoonControls.onAttachToIsland(islandData);
    }


    return true;
}

/**
 * Detach a harpoon from an island
 * @param {string} harpoonId - ID of the harpoon to detach
 */
export function detachHarpoonFromIsland(harpoonId) {
    const harpoonData = activeHarpoons.get(harpoonId);
    if (!harpoonData || !harpoonData.isAttached || !harpoonData.isAttachedToIsland) return;

    // Update harpoon data
    harpoonData.isAttached = false;
    harpoonData.isAttachedToIsland = false;
    harpoonData.islandData = null;

    // Notify harpoon controls about detachment if available
    if (harpoonData.harpoonControls && harpoonData.harpoonControls.onDetachFromIsland) {
        harpoonData.harpoonControls.onDetachFromIsland();
    }


}

/**
 * Update all active harpoons
 * Should be called from the main game loop
 */
export function updateHarpoons() {
    const currentTime = getTime();

    // EXPLICIT CALL FOR DEBUGGING: Make sure line break system is always updated
    //console.log('DEBUG: Calling updateLineBreakSystem from updateHarpoons');

    activeHarpoons.forEach((harpoonData, harpoonId) => {
        // Skip if not attached
        if (!harpoonData.isAttached) return;

        // Handle island attachment differently from monster attachment
        if (harpoonData.isAttachedToIsland) {
            // Handle island grappling - only if reeling
            if (harpoonData.isReeling) {
                updateIslandGrappling(harpoonData, harpoonId);
            }
        } else if (harpoonData.attachedMonster) {
            const monster = harpoonData.attachedMonster;

            // Check if monster still exists and is alive
            const monsters = getAllMonsters();
            const monsterStillExists = monsters.some(m => m === monster);


            if (!monsterStillExists || monster.health <= 0 || monster.state === 'dying') {
                detachHarpoon(harpoonId);
                return;
            }

            // Update harpoon position to follow monster
            if (monster.mesh) {
                const monsterPosition = monster.mesh.position.clone();

                // TETHER FUNCTIONALITY - Check if monster is beyond max tether length
                const boatPosition = boat.position.clone();
                const toMonster = monsterPosition.clone().sub(boatPosition);
                const distanceToMonster = toMonster.length();

                // NEW: Log the distance for debugging
                if (Math.random() < 0.01) { // Only log occasionally to avoid spam
                    // Debug logging if needed
                }

                // If monster is beyond max tether length
                if (distanceToMonster > HARPOON_CONFIG.MAX_TETHER_LENGTH) {
                    // Define exceedDistance outside the if/else blocks so it's available for both constraint types
                    const exceedDistance = distanceToMonster - HARPOON_CONFIG.MAX_TETHER_LENGTH;

                    if (HARPOON_CONFIG.USE_HARD_CONSTRAINT) {
                        // HARD CONSTRAINT: Directly place monster at maximum distance
                        // This enforces a rigid tether that cannot be stretched
                        const constrainedPosition = boatPosition.clone().add(
                            toMonster.normalize().multiplyScalar(HARPOON_CONFIG.MAX_TETHER_LENGTH)
                        );

                        // Apply the constrained position directly
                        monster.mesh.position.copy(constrainedPosition);
                    } else {
                        // SOFT CONSTRAINT: Original pulling code 
                        // (we're now using the exceedDistance from outside this block)
                        const pullStrength = exceedDistance * HARPOON_CONFIG.DRAG_STRENGTH * HARPOON_CONFIG.POSITION_STABILITY;
                        const pullDirection = toMonster.normalize().negate();
                        const pullVector = pullDirection.multiplyScalar(pullStrength);
                        monsterPosition.add(pullVector);
                        monster.mesh.position.copy(monsterPosition);
                    }

                    // Override the monster AI if configured
                    if (HARPOON_CONFIG.OVERRIDE_MONSTER_AI) {
                        // Force the monster to stop its own movement
                        if (monster.velocity) {
                            // Reset velocity to zero or redirect it
                            monster.velocity.set(0, 0, 0);
                        }

                        // Temporarily change monster state to prevent AI from fighting us
                        // Store the original state if we haven't already
                        if (!monster.originalState && monster.state !== 'tethered') {
                            monster.originalState = monster.state;
                            monster.state = 'tethered'; // Custom state the AI won't recognize
                        }
                    }

                    // Visual tension effect - this now works because exceedDistance is defined
                    if (harpoonData.harpoonLine && harpoonData.harpoonLine.material) {
                        // Calculate tension factor (0-1)
                        const tension = Math.min(1, exceedDistance / 15);

                        // Interpolate from normal color to bright red based on tension
                        //const r = 1.0; // Full red
                        //const g = 0.27 - tension * 0.27; // Reduce green with tension
                        //const b = 0.27 - tension * 0.27; // Reduce blue with tension

                        //harpoonData.harpoonLine.material.color.setRGB(r, g, b);
                    }
                } else {
                    // NEW: If we're back within range, restore original state if needed
                    if (monster.originalState && monster.state === 'tethered') {
                        monster.state = monster.originalState;
                        delete monster.originalState;
                    }

                    // Reset rope color when not under tension
                    if (harpoonData.harpoonLine && harpoonData.harpoonLine.material) {
                        //harpoonData.harpoonLine.material.color.setRGB(1.0, 0.27, 0.27); // Normal red color
                    }
                }

                // Calculate attachment point with offset
                const newAttachPoint = monsterPosition.clone().add(harpoonData.attachOffset);

                // Update harpoon position
                harpoonData.attachPoint.copy(newAttachPoint);
                harpoonData.harpoonMesh.position.copy(newAttachPoint);

                // Apply recurring damage tick
                if (currentTime - harpoonData.lastDamageTime >= HARPOON_CONFIG.TICK_INTERVAL) {
                    applyDamage(monster, HARPOON_CONFIG.TICK_DAMAGE, { isHarpoon: true });
                    harpoonData.lastDamageTime = currentTime;

                    // Notify harpoon controls about damage tick if available
                    if (harpoonData.harpoonControls && harpoonData.harpoonControls.onDamageTick) {
                        harpoonData.harpoonControls.onDamageTick(monster);
                    }
                }
            }
        }
    });
}

/**
 * Update grappling physics for island attachment
 * @param {Object} harpoonData - The harpoon data object
 * @param {string} harpoonId - The harpoon ID
 */
function updateIslandGrappling(harpoonData, harpoonId) {
    // Skip if we don't have attachment point
    if (!harpoonData.attachPoint) return;

    // Calculate direction from boat to grapple point
    const boatPos = boat.position.clone();
    const grapplePoint = harpoonData.attachPoint;
    const direction = new THREE.Vector3().subVectors(grapplePoint, boatPos);
    const distance = direction.length();

    // If boat reached the island (close enough), detach
    if (distance < 10) {

        detachHarpoonFromIsland(harpoonId);

        // Notify harpoon controls (for cleanup)
        if (harpoonData.harpoonControls && harpoonData.harpoonControls.onReachGrapplePoint) {
            harpoonData.harpoonControls.onReachGrapplePoint();
        }
        return;
    }

    // Normalize and calculate pull force
    direction.normalize();

    // Calculate pull strength based on distance (stronger when closer)
    const pullStrength = Math.min(1.0, 60 / distance) * HARPOON_CONFIG.ISLAND_GRAPPLE_STRENGTH;
    const deltaTime = 0.016; // Assumed frame time, could be passed in

    // Apply force to boat using boatVelocity from gameState
    boatVelocity.add(direction.multiplyScalar(pullStrength * deltaTime * 60));

    // Update tension visualization based on distance
    if (harpoonData.harpoonControls && harpoonData.harpoonControls.updateLineThickness) {
        // Thicker line when under tension
        const baseTension = 0.1 + Math.min(0.15, (HARPOON_CONFIG.MAX_GRAPPLE_DISTANCE - distance) / 200);
        harpoonData.harpoonControls.updateLineThickness(baseTension);
    }
}
