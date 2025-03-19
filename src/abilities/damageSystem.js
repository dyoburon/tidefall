// src/combat/damageSystem.js (new file)
import { getAllMonsters, removeMonster } from '../entities/monsterManager.js';
import { updateHarpoons } from './harpoonDamageSystem.js';
import * as THREE from 'three';

// Centralized tracking of active projectiles
const activeProjectiles = new Map();

// Track if the collision system has been initialized
let collisionSystemInitialized = false;

/**
 * Initialize the damage and collision system
 * Should be called from the main game initialization
 */
export function initDamageSystem() {
    collisionSystemInitialized = true;
    console.log("Damage and collision system initialized");
}

/**
 * Register a projectile for collision detection
 * @param {string} id - Unique ID for the projectile
 * @param {Object} projectile - The projectile object
 * @param {THREE.Mesh} projectile.mesh - The Three.js mesh
 * @param {Object} projectile.data - Additional projectile data
 */
export function registerProjectile(id, projectile) {
    if (!collisionSystemInitialized) {
        console.warn("Damage system not initialized before registering projectile");
        initDamageSystem(); // Auto-initialize if needed
    }

    // Create a bounding sphere for collision detection
    const boundingSphere = new THREE.Sphere(
        projectile.mesh.position.clone(),
        (projectile.data.hitRadius || 1.2)
    );

    // Add bounding sphere to projectile data
    projectile.boundingSphere = boundingSphere;

    activeProjectiles.set(id, projectile);
    console.log(`Registered projectile: ${id}, Total active: ${activeProjectiles.size}`);
    return id;
}

/**
 * Unregister a projectile when it's removed
 * @param {string} id - Projectile ID to remove
 */
export function unregisterProjectile(id) {
    if (activeProjectiles.has(id)) {
        activeProjectiles.delete(id);
        console.log(`Unregistered projectile: ${id}, Total active: ${activeProjectiles.size}`);
        return true;
    }
    return false;
}

/**
 * Apply direct damage to a single monster
 * @param {Object} monster - Monster to damage
 * @param {Number} amount - Amount of damage to apply
 * @returns {Boolean} True if monster was killed by this damage
 */
export function applyDamage(monster, amount, options = {}) {
    if (!monster || monster.health <= 0) return false;

    const { forceLethal = false } = options;

    // Check if this is a harpoon (damage is 0 or we have a specific flag)
    const isHarpoon = amount === 0 || options.isHarpoon;

    if (isHarpoon) {
        // For harpoons, don't apply damage at all - just visual feedback
        console.log(`Harpoon attached to ${monster.typeId}! Health remains: ${monster.health}`);
        createDamageEffect(monster, amount);
        return false; // Not killed
    }

    if (forceLethal) {
        // Original behavior for cannonballs and other lethal weapons
        console.log(`Monster ${monster.typeId} hit! Original health: ${monster.health}`);
        monster.health = 0; // Force to zero for guaranteed kill
        console.log(`Health now set to 0 - Monster should be killed!`);
    } else {
        // Normal damage application for non-lethal weapons
        monster.health -= amount;
        console.log(`Monster ${monster.typeId} hit! Health reduced by ${amount} to ${monster.health}`);
    }

    // Check if monster is now dead
    if (monster.health <= 0) {
        // Handle monster death
        handleMonsterDeath(monster);
        return true; // Killed
    } else {
        // Still alive - just visual feedback
        createDamageEffect(monster, amount);
        return false; // Not killed
    }
}
/**
 * Handle a monster's death
 * @param {Object} monster - The monster that died
 */
function handleMonsterDeath(monster) {
    console.log(`Monster ${monster.typeId} has been killed!`);

    // Log the monster's state
    console.log(`Monster state before death: ${JSON.stringify({
        health: monster.health,
        position: monster.mesh ? [
            monster.mesh.position.x,
            monster.mesh.position.y,
            monster.mesh.position.z
        ] : 'no mesh',
        id: monster.id || 'no id'
    })}`);

    // Set state to dying
    monster.state = 'dying';

    // Make it sink
    if (monster.mesh) {
        const startY = monster.mesh.position.y;
        const sinkInterval = setInterval(() => {
            if (!monster.mesh) {
                clearInterval(sinkInterval);
                return;
            }

            monster.mesh.position.y -= 0.5;

            // Make it fade out
            monster.mesh.traverse(child => {
                if (child.material && child.material.opacity !== undefined) {
                    child.material.transparent = true;
                    child.material.opacity = Math.max(0, child.material.opacity - 0.1);
                }
            });

            // Once it's sunk below a certain point, remove it
            if (monster.mesh.position.y < startY - 20) {
                clearInterval(sinkInterval);
                removeMonster(monster);
                console.log('Monster completely removed!');
            }
        }, 100);
    } else {
        // No mesh, just remove directly
        removeMonster(monster);
    }
}

/**
 * Update all projectiles and check for collisions with monsters
 * Called from the main game loop
 */
export function updateProjectileCollisions() {
    if (!collisionSystemInitialized) {
        console.warn("Damage system not initialized before checking collisions");
        return;
    }

    // Update all active harpoons first
    // This ensures tether logic happens before collision detection
    if (typeof updateHarpoons === 'function') {
        updateHarpoons();
    }

    const monsters = getAllMonsters();

    // Skip if no active monsters or projectiles
    if (monsters.length === 0 || activeProjectiles.size === 0) {
        return;
    }

    // Prepare monster hitboxes for this frame
    const monsterHitboxes = prepareMonsterHitboxes(monsters);

    // For each projectile, check collision with every monster
    activeProjectiles.forEach((projectile, id) => {
        const projectileMesh = projectile.mesh;

        // Check if the projectile is valid
        if (!projectileMesh || !projectileMesh.position) {
            unregisterProjectile(id);
            return;
        }

        // Update bounding sphere position
        projectile.boundingSphere.center.copy(projectileMesh.position);

        // Store projectile's current position
        const currentPosition = projectileMesh.position.clone();

        // Calculate the movement since last frame (if tracking previous position)
        if (projectile.prevPosition) {
            // Create movement vector for this frame
            const movement = new THREE.Vector3().subVectors(currentPosition, projectile.prevPosition);
            const movementLength = movement.length();

            // Debug - log if movement is abnormally large
            if (movementLength > 5) {
                console.warn(`Large movement detected for projectile ${id}: ${movementLength} units`);
            }

            // Create a ray for collision detection along the movement path
            const direction = movement.clone().normalize();
            const ray = new THREE.Ray(projectile.prevPosition, direction);

            // Check each monster for collision
            for (let i = 0; i < monsters.length; i++) {
                const monster = monsters[i];
                const hitbox = monsterHitboxes[i];

                // Skip dead monsters
                if (monster.health <= 0) continue;

                // First do a quick sphere-sphere test
                const quickTest = projectile.boundingSphere.intersectsSphere(hitbox.boundingSphere);

                if (quickTest) {
                    // More detailed collision check - ray vs bounding box or detailed mesh
                    let collision = false;
                    let collisionPoint = null;

                    if (hitbox.type === 'box') {
                        // Test ray against bounding box
                        const intersectionPoint = new THREE.Vector3();
                        collision = ray.intersectBox(hitbox.boundingBox, intersectionPoint);
                        if (collision) {
                            collisionPoint = intersectionPoint;
                        }
                    } else if (hitbox.type === 'sphere') {
                        // Test ray against bounding sphere
                        const intersectionPoint = new THREE.Vector3();
                        collision = ray.intersectSphere(hitbox.boundingSphere, intersectionPoint);
                        if (collision) {
                            collisionPoint = intersectionPoint;
                        }
                    }

                    // If we detected a collision
                    if (collision) {
                        console.log(`COLLISION DETECTED! Projectile ${id} hit monster ${monster.typeId}`);

                        // Damage the monster
                        const damage = projectile.data.damage || 3;
                        const killed = applyDamage(monster, damage);

                        // Create hit effect
                        createHitEffect(collisionPoint || currentPosition);

                        // Notify the projectile
                        if (projectile.onHit) {
                            projectile.onHit({
                                monster,
                                point: collisionPoint ? collisionPoint.clone() : currentPosition.clone(),
                                killed
                            });
                        }

                        // Remove the projectile
                        unregisterProjectile(id);
                        return; // Exit after hit
                    }
                }
            }
        }

        // Update previous position for next frame
        projectile.prevPosition = currentPosition;
    });
}

/**
 * Prepare hitboxes for all monsters for efficient collision detection
 * @param {Array} monsters - List of monsters to prepare hitboxes for
 * @returns {Array} Array of hitbox data for each monster
 */
function prepareMonsterHitboxes(monsters) {
    return monsters.map(monster => {
        // Skip if monster mesh is not available
        if (!monster.mesh) {
            return { type: 'none' };
        }

        // Get the monster's position and size
        const position = monster.mesh.position.clone();

        // Determine monster size (use size property if available, or estimate from mesh)
        const size = monster.size || estimateMonsterSize(monster);

        // Create a bounding sphere for quick tests
        const boundingSphere = new THREE.Sphere(position, size * 2); // Generous size for initial testing

        // For detailed tests, create a bounding box
        const boundingBox = new THREE.Box3();
        boundingBox.setFromCenterAndSize(position, new THREE.Vector3(size, size, size));

        return {
            type: 'sphere', // Use sphere as default hitbox type
            boundingSphere,
            boundingBox,
            monster
        };
    });
}

/**
 * Estimate the size of a monster based on its mesh
 * @param {Object} monster - The monster object
 * @returns {Number} Estimated size (radius)
 */
function estimateMonsterSize(monster) {
    if (monster.size) return monster.size;

    // Default sizes based on monster type
    if (monster.typeId === 'kraken') return 5;
    if (monster.typeId === 'seaSerpent') return 4;
    if (monster.typeId === 'phantomJellyfish') return 3.5;

    // Default for unknown monster types
    return 3;
}

/**
 * Apply area damage to all monsters within radius of position
 * @param {THREE.Vector3} position - Center position of damage
 * @param {Number} radius - Radius of effect
 * @param {Number} damage - Base damage amount
 * @param {Object} options - Additional options (falloff, etc)
 * @returns {Array} Monsters that were damaged
 */
export function applyAreaDamage(position, radius, damage, options = {}) {
    const monsters = getAllMonsters();
    const affectedMonsters = [];

    console.log(`Area damage at ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
    console.log(`Radius: ${radius}, Damage: ${damage}, Monsters in area: ${monsters.length}`);

    // Create a sphere to represent the area of effect
    const aoeSphere = new THREE.Sphere(position, radius);

    monsters.forEach(monster => {
        // Skip already dead monsters
        if (monster.health <= 0) return;

        // Get monster position and estimated size
        const monsterPos = monster.mesh.position;
        const monsterSize = monster.size || estimateMonsterSize(monster);

        // Create a sphere representing the monster's area
        const monsterSphere = new THREE.Sphere(monsterPos, monsterSize);

        // Test for intersection between spheres
        const isInRange = aoeSphere.intersectsSphere(monsterSphere);

        // Alternative: Use simple distance check
        const distance = monsterPos.distanceTo(position);
        const effectiveRange = radius + monsterSize;

        if (isInRange || distance <= effectiveRange) {
            // Calculate damage based on distance
            let damageMultiplier = 1.0;

            if (options.falloff) {
                // Calculate falloff based on distance
                const normalizedDistance = distance / effectiveRange;
                damageMultiplier = 1 - Math.min(1, normalizedDistance);
            }

            const damageAmount = damage * damageMultiplier;

            console.log(`Hitting ${monster.typeId} with ${damageAmount.toFixed(2)} damage (distance: ${distance.toFixed(2)})`);

            const killed = applyDamage(monster, damageAmount);
            affectedMonsters.push(monster);

            if (killed) {
                console.log(`Monster ${monster.typeId} was killed by splash damage!`);
            }
        }
    });

    return affectedMonsters;
}

/**
 * Apply cannonball splash damage when it hits the water
 * @param {THREE.Vector3} position - Impact position
 * @param {Number} splashRadius - Radius of effect 
 * @param {Number} splashDamage - Base damage amount
 * @returns {Array} Affected monsters
 */
export function applyCannonballSplash(position, splashRadius = 20, splashDamage = 1000) {
    console.log(`Cannonball splash at ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);

    // Force higher damage to ensure kills
    splashDamage = 1000; // Extremely high damage to guarantee kills

    // Ensure splash is at water level
    const splashPosition = position.clone();
    splashPosition.y = 0;

    console.log(`Applying MASSIVE splash damage (${splashDamage}) with radius ${splashRadius}`);

    // Apply area damage
    return applyAreaDamage(
        splashPosition,
        splashRadius,
        splashDamage,
        {
            falloff: false,  // No falloff - full damage everywhere in radius
            visualFeedback: true  // Show damage effect
        }
    );
}

/**
 * Create visual feedback for damage
 * @param {Object} monster - Monster that was damaged 
 * @param {Number} amount - Amount of damage applied
 */
function createDamageEffect(monster, amount) {
    // Add particle effects, color flashing, etc.
    if (monster && monster.mesh) {
        // Simple red flash effect
        const originalMaterials = [];

        // Store original materials and replace with red
        if (monster.mesh.material) {
            // Single material case
            originalMaterials.push({
                object: monster.mesh,
                material: monster.mesh.material
            });
            monster.mesh.material = monster.mesh.material.clone();
            monster.mesh.material.color.set(0xff0000);
        } else if (monster.mesh.children) {
            // Multi-part monster case
            monster.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    originalMaterials.push({
                        object: child,
                        material: child.material
                    });
                    child.material = child.material.clone();
                    child.material.color.set(0xff0000);
                }
            });
        }

        // Restore original materials after a short delay
        setTimeout(() => {
            originalMaterials.forEach(item => {
                item.object.material = item.material;
            });
        }, 150);
    }
}

/**
 * Create visual effect at hit location
 * @param {THREE.Vector3} position - Hit position
 */
function createHitEffect(position) {
    // This function should be implemented in the game's visual effects system
    console.log(`Hit effect at ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
}

// Add more specialized damage functions as needed