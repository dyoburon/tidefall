import * as THREE from 'three';
import { registerProjectile, unregisterProjectile, applyDamage } from './damageSystem.js';
import { getAllMonsters } from '../entities/monsterManager.js';
import { getTime, boat, boatVelocity } from '../core/gameState.js';

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

    // In the attachHarpoonToMonster function, add this line after attaching:
    monster.isBeingDragged = true;

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

    // In the detachHarpoon function, add this line:
    if (monster) {
        monster.isBeingDragged = false;
    }

    console.log(`Harpoon ${harpoonId} detached from monster`);
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
        console.error("Cannot attach: Invalid harpoon data or island data");
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

    console.log(`Harpoon ${harpoonId} attached to island at ${islandData.point.x.toFixed(2)}, ${islandData.point.y.toFixed(2)}, ${islandData.point.z.toFixed(2)}`);
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

    console.log(`Harpoon ${harpoonId} detached from island`);
}

/**
 * Update all active harpoons
 * Should be called from the main game loop
 */
export function updateHarpoons() {
    const currentTime = getTime();

    activeHarpoons.forEach((harpoonData, harpoonId) => {
        // Skip if not attached
        if (!harpoonData.isAttached) return;

        // Handle island attachment differently from monster attachment
        if (harpoonData.isAttachedToIsland) {
            // Handle island grappling - only if reeling
            if (harpoonData.isReeling) {
                updateIslandGrappling(harpoonData, harpoonId);
            }
        }
        else if (harpoonData.attachedMonster) {
            // Existing monster handling code
            // ... existing monster code ...
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
        console.log("Boat reached island, detaching harpoon");
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

