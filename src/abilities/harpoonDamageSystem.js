import * as THREE from 'three';
import { registerProjectile, unregisterProjectile, applyDamage } from './damageSystem.js';
import { getAllMonsters } from '../entities/monsterManager.js';
import { getTime, boat } from '../core/gameState.js';

// Constant values for harpoon damage configuration
const HARPOON_CONFIG = {
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
    USE_HARD_CONSTRAINT: true  // New setting to enable hard position constraints
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

    console.log(`Registered harpoon projectile: ${id}`);
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

    console.log(`Unregistered harpoon: ${id}`);
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
            console.log(`Potential harpoon hit: ${monster.typeId} at distance ${distance.toFixed(2)}`);
        }
    }

    if (closestMonster) {
        console.log(`Harpoon ${harpoonId} will attach to ${closestMonster.typeId} at distance ${closestDistance.toFixed(2)}`);
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
        console.error("Cannot attach: Invalid harpoon data or monster");
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

    console.log(`Harpoon ${harpoonId} attached to ${monster.typeId}`);
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

    console.log(`Harpoon ${harpoonId} detached from monster`);
}

/**
 * Update all active harpoons
 * Should be called from the main game loop
 */
export function updateHarpoons() {
    const currentTime = getTime();

    activeHarpoons.forEach((harpoonData, harpoonId) => {
        // Skip if not attached
        if (!harpoonData.isAttached || !harpoonData.attachedMonster) return;

        const monster = harpoonData.attachedMonster;

        // Check if monster still exists and is alive
        const monsters = getAllMonsters();
        const monsterStillExists = monsters.some(m => m === monster);

        if (!monsterStillExists || monster.health <= 0 || monster.state === 'dying') {
            console.log(`Monster died or disappeared, detaching harpoon ${harpoonId}`);
            detachHarpoon(harpoonId);
            return;
        }

        // Update harpoon position to follow monster
        console.log(`Updating harpoon position for ${harpoonId}`);
        if (monster.mesh) {
            const monsterPosition = monster.mesh.position.clone();

            // TETHER FUNCTIONALITY - Check if monster is beyond max tether length
            const boatPosition = boat.position.clone();
            const toMonster = monsterPosition.clone().sub(boatPosition);
            const distanceToMonster = toMonster.length();

            // NEW: Log the distance for debugging
            if (Math.random() < 0.01) { // Only log occasionally to avoid spam
                console.log(`Harpoon tether: Distance to monster = ${distanceToMonster.toFixed(2)}, Max = ${HARPOON_CONFIG.MAX_TETHER_LENGTH}`);
            }
            console.log(`Monster position: ${monsterPosition.x}, ${monsterPosition.y}, ${monsterPosition.z}`);

            // If monster is beyond max tether length
            if (distanceToMonster > HARPOON_CONFIG.MAX_TETHER_LENGTH) {
                // Define exceedDistance outside the if/else blocks so it's available for both constraint types
                const exceedDistance = distanceToMonster - HARPOON_CONFIG.MAX_TETHER_LENGTH;

                console.log(`Monster is beyond max tether length, applying constraint: ${distanceToMonster.toFixed(2)} > ${HARPOON_CONFIG.MAX_TETHER_LENGTH}`);

                if (HARPOON_CONFIG.USE_HARD_CONSTRAINT) {
                    // HARD CONSTRAINT: Directly place monster at maximum distance
                    // This enforces a rigid tether that cannot be stretched
                    const constrainedPosition = boatPosition.clone().add(
                        toMonster.normalize().multiplyScalar(HARPOON_CONFIG.MAX_TETHER_LENGTH)
                    );

                    // Apply the constrained position directly
                    monster.mesh.position.copy(constrainedPosition);

                    // Debug message to confirm constraint is being applied
                    console.log(`HARD CONSTRAINT: Monster position set to distance ${HARPOON_CONFIG.MAX_TETHER_LENGTH}, was ${distanceToMonster.toFixed(2)}`);
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
                        console.log(`Monster state changed to tethered (was ${monster.originalState})`);
                    }
                }

                // Visual tension effect - this now works because exceedDistance is defined
                if (harpoonData.harpoonLine && harpoonData.harpoonLine.material) {
                    // Calculate tension factor (0-1)
                    const tension = Math.min(1, exceedDistance / 15);

                    // Interpolate from normal color to bright red based on tension
                    const r = 1.0; // Full red
                    const g = 0.27 - tension * 0.27; // Reduce green with tension
                    const b = 0.27 - tension * 0.27; // Reduce blue with tension

                    harpoonData.harpoonLine.material.color.setRGB(r, g, b);
                }
            } else {
                // NEW: If we're back within range, restore original state if needed
                if (monster.originalState && monster.state === 'tethered') {
                    monster.state = monster.originalState;
                    delete monster.originalState;
                    console.log(`Monster state restored to ${monster.state}`);
                }

                // Reset rope color when not under tension
                if (harpoonData.harpoonLine && harpoonData.harpoonLine.material) {
                    harpoonData.harpoonLine.material.color.setRGB(1.0, 0.27, 0.27); // Normal red color
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
    });
}

