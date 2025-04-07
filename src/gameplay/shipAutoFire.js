// shipAutoFire.js - Auto-fires player ship weapons at nearby NPC ships when in attack mode
import * as THREE from 'three';
import { scene, boat, getTime } from '../core/gameState.js';
import { getCurrentNavigationMode, NavigationMode } from '../core/shipController.js';
import { activeNpcShips } from '../entities/npcShip.js';
import { playCannonSound } from '../audio/soundEffects.js';
import AimingSystem from '../abilities/aimingSystem.js';
import { registerProjectile, unregisterProjectile, applyCannonballSplash } from '../abilities/damageSystem.js';
import { createWaterSplashEffect } from '../effects/playerDamageEffects.js';

/**
 * ShipAutoFire System - Automatically fires at NPC ships when in attack mode
 */
class ShipAutoFireSystem {
    constructor() {
        // Configuration
        this.cannonballSpeed = 150;      // Higher base speed
        this.gravity = 70;               // Lower gravity for longer arcs
        this.minCooldown = 1.0;          // Match NPC cooldown
        this.maxCooldown = 2.0;          // Match NPC cooldown
        this.range = 200;                // Firing range
        this.damage = 15;                // More damage than NPC cannons
        this.aimInaccuracy = 10.0;       // Less randomness than NPCs (more accurate)
        this.enabled = true;             // System enabled by default

        // Tracking
        this.cooldownTimer = 0;
        this.lastFireTime = 0;
        this.debugEnabled = false;

        // Default cannon positions relative to ship model
        this.cannonPositions = [
            { name: 'leftFront', x: -3.5, y: 1.5, z: -5 },
            { name: 'leftRear', x: -3.5, y: 1.5, z: 5 },
            { name: 'rightFront', x: 3.5, y: 1.5, z: -5 },
            { name: 'rightRear', x: 3.5, y: 1.5, z: 5 }
        ];

        console.log('ShipAutoFire system initialized');
    }

    /**
     * Update the auto-fire system
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Skip if disabled
        if (!this.enabled) return;

        // Update cooldown timer
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }

        // Check if in attack mode
        if (getCurrentNavigationMode() !== NavigationMode.ATTACK) {
            return;
        }

        // Find nearest target
        const target = this.findNearestTarget();
        if (target) {
            this.attemptFire(target);
        }
    }

    /**
     * Find the nearest valid target
     * @returns {Object|null} The nearest valid target or null if none found
     */
    findNearestTarget() {
        if (!boat || !activeNpcShips || activeNpcShips.length === 0) {
            return null;
        }

        // Get player position
        const playerPosition = boat.position.clone();

        // Find closest NPC ship
        let closestShip = null;
        let closestDistance = Infinity;

        for (const npcShip of activeNpcShips) {
            // Skip destroyed ships
            if (npcShip.isDestroyed) continue;

            const distance = playerPosition.distanceTo(npcShip.position);

            // Check if in range
            if (distance <= this.range && distance < closestDistance) {
                closestDistance = distance;
                closestShip = npcShip;
            }
        }

        if (this.debugEnabled && closestShip) {
            console.log(`Found target at distance ${closestDistance.toFixed(1)}`);
        }

        return closestShip;
    }

    /**
     * Attempt to fire at a target
     * @param {Object} target - The target to fire at
     * @returns {boolean} Whether the fire was successful
     */
    attemptFire(target) {
        // Check cooldown
        if (this.cooldownTimer > 0) {
            return false;
        }

        if (!boat || !boat.position) {
            return false;
        }

        // Get ship position
        const shipPosition = boat.position.clone();
        const targetPosition = target.position.clone();

        // Calculate distance for debugging and trajectory adjustments
        const distanceToTarget = shipPosition.distanceTo(targetPosition);

        if (this.debugEnabled) {
            console.log(`Attempting fire at target ${target.id} at distance ${distanceToTarget.toFixed(1)}`);
        }

        // Add distance-based targeting compensation
        const randomizedTarget = this.addRandomnessToTarget(targetPosition, distanceToTarget);

        // Determine which side of the ship the target is on
        const localTarget = targetPosition.clone().sub(shipPosition);
        localTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), -boat.rotation.y);
        const isTargetOnLeft = localTarget.x < 0;

        // Get all cannons on the side facing the target
        let potentialCannons = this.cannonPositions.filter(cannon => {
            return (isTargetOnLeft && cannon.name.includes('left')) ||
                (!isTargetOnLeft && cannon.name.includes('right'));
        });

        // If no cannons on that side, just return
        if (potentialCannons.length === 0) {
            return false;
        }

        // Select a random cannon on the correct side
        const selectedCannon = potentialCannons[Math.floor(Math.random() * potentialCannons.length)];

        // Calculate cannon world position
        const cannonLocalPos = new THREE.Vector3(selectedCannon.x, selectedCannon.y, selectedCannon.z);

        // Create a matrix for the boat's transform
        const shipMatrix = new THREE.Matrix4();
        shipMatrix.makeRotationY(boat.rotation.y);
        shipMatrix.setPosition(boat.position.x, boat.position.y, boat.position.z);

        // Transform cannon position to world space
        const cannonPosition = cannonLocalPos.clone().applyMatrix4(shipMatrix);

        // Calculate adaptive trajectory parameters based on distance
        const distanceFactor = distanceToTarget / this.range; // 0 to 1 based on distance

        // Calculate adaptive vertical adjustment - more arc for longer distances
        const verticalMin = 0.05 + (distanceFactor * 0.15); // 0.05 to 0.20 based on distance
        const verticalMax = 0.25 + (distanceFactor * 0.15); // 0.25 to 0.40 based on distance

        // Calculate adaptive speed multiplier - faster for longer distances
        const speedMultiplier = 1.0 + (distanceFactor * 0.5); // 1.0 to 1.5 based on distance

        // Use aiming system with distance-adaptive parameters
        const direction = AimingSystem.calculateFiringDirection(
            cannonPosition,
            randomizedTarget,
            {
                adaptiveTrajectory: true,
                minVerticalAdjust: verticalMin,
                maxVerticalAdjust: verticalMax,
                minDistance: 5,
                maxDistance: this.range,
                allowDownwardShots: false
            }
        );

        // Apply distance-based velocity adjustment
        const velocity = direction.clone().multiplyScalar(this.cannonballSpeed * speedMultiplier);

        // Fire with the adjusted velocity
        this.createCannonball(cannonPosition, direction, velocity);
        this.createCannonSmoke(boat, selectedCannon);

        // Set cooldown with fixed range to match NPC system
        this.cooldownTimer = this.minCooldown + Math.random() * (this.maxCooldown - this.minCooldown);
        this.lastFireTime = getTime();

        // Play sound
        playCannonSound();

        return true;
    }

    /**
     * Add randomness to the target position
     * @param {THREE.Vector3} targetPosition - Original target position
     * @param {number} distance - Distance to target
     * @returns {THREE.Vector3} Randomized target position
     */
    addRandomnessToTarget(targetPosition, distance) {
        // Simply return a clone of the original position without any randomness
        return targetPosition.clone();

        // The original randomized code is commented out below:
        /*
        // Create a clone so we don't modify the original
        const randomized = targetPosition.clone();

        // Scale inaccuracy based on distance (farther = less accurate)
        const distanceFactor = Math.min(distance / 100, 3); // Cap at 3x base inaccuracy
        const maxDeviation = this.aimInaccuracy * distanceFactor;

        // Add random offset to x and z coordinates
        randomized.x += (Math.random() * 2 - 1) * maxDeviation;
        randomized.z += (Math.random() * 2 - 1) * maxDeviation;

        // Randomize y position slightly too for varied trajectories
        randomized.y += (Math.random() * 2 - 1) * 2;

        return randomized;
        */
    }

    /**
     * Create a cannonball projectile
     * @param {THREE.Vector3} position - Starting position
     * @param {THREE.Vector3} direction - Direction vector
     * @param {THREE.Vector3} initialVelocity - Optional custom initial velocity
     */
    createCannonball(position, direction, initialVelocity = null) {
        // Create cannonball geometry and material
        const cannonballGeometry = new THREE.SphereGeometry(0.866, 16, 16);
        const cannonballMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
        cannonball.position.copy(position);

        scene.add(cannonball);

        // Create muzzle flash
        this.createMuzzleFlash(position, direction);

        // Set velocity from direction or use custom initial velocity
        const velocity = initialVelocity || direction.clone().multiplyScalar(this.cannonballSpeed);

        const startTime = getTime();
        const maxDistance = 1200; // Match NPC max travel distance
        const initialPosition = position.clone();

        // Generate a unique ID for this cannonball
        const cannonballId = `player-cannonball-${startTime}`;

        // Create collision spheres for NPC ships
        const npcShipCollisionSpheres = new Map();

        // Register projectile with damage system
        registerProjectile(cannonballId, {
            mesh: cannonball,
            isFromPlayer: true,
            data: {
                damage: this.damage,
                hitRadius: 6.5
            },
            prevPosition: position.clone(),
            onHit: (hitData) => {
                // Log hit information if debug enabled
                if (this.debugEnabled) {
                    console.log(`Player cannonball hit: ${hitData.targetType}`);
                }

                // Remove cannonball
                scene.remove(cannonball);
                unregisterProjectile(cannonballId);
            }
        });

        const animateCannonball = () => {
            const elapsedTime = (getTime() - startTime) / 1000;

            // Check if cannonball has traveled too far
            const distanceTraveled = cannonball.position.distanceTo(initialPosition);
            if (distanceTraveled > maxDistance) {
                scene.remove(cannonball);
                unregisterProjectile(cannonballId);
                return;
            }

            // Save previous position for collision detection
            const prevPosition = cannonball.position.clone();

            // Apply gravity
            velocity.y -= this.gravity * 0.016;

            // Update position
            cannonball.position.x += velocity.x * 0.016;
            cannonball.position.y += velocity.y * 0.016;
            cannonball.position.z += velocity.z * 0.016;

            // Add rotation for visual effect
            cannonball.rotation.x += 0.02;
            cannonball.rotation.z += 0.02;

            // Check for NPC ship collisions
            if (activeNpcShips && activeNpcShips.length > 0) {
                // For each NPC ship, check for collision
                for (const npcShip of activeNpcShips) {
                    // Skip if ship is already destroyed
                    if (npcShip.isDestroyed) continue;

                    // Get or create collision sphere for this NPC ship
                    if (!npcShipCollisionSpheres.has(npcShip.id)) {
                        // Create a new collision sphere for this ship
                        npcShipCollisionSpheres.set(
                            npcShip.id,
                            new THREE.Sphere(new THREE.Vector3(), 10.4) // Match the collision radius from cannonshot.js
                        );
                    }

                    const collisionSphere = npcShipCollisionSpheres.get(npcShip.id);

                    // Update collision sphere center to match ship position
                    collisionSphere.center.copy(npcShip.position);

                    // Calculate distance to center of ship
                    const distanceToCenter = cannonball.position.distanceTo(collisionSphere.center);

                    // Check if cannonball is inside or very close to the ship's collision sphere
                    if (distanceToCenter <= collisionSphere.radius + 0.5) {
                        // Hit the NPC ship!
                        if (this.debugEnabled) {
                            console.log(`Auto-fire cannonball hit NPC ship: ${npcShip.id}`);
                        }

                        // Apply damage to the NPC ship
                        if (npcShip.takeDamage) {
                            npcShip.takeDamage(this.damage, 'player_auto_cannon');
                        }

                        // Remove cannonball
                        unregisterProjectile(cannonballId);
                        scene.remove(cannonball);
                        return;
                    }
                }
            }

            // Check for water impact
            if (cannonball.position.y <= 0) {
                // Create splash effect
                createWaterSplashEffect(cannonball.position.clone());

                // Apply splash damage
                const hitPosition = cannonball.position.clone();
                applyCannonballSplash(hitPosition);

                // Remove cannonball
                scene.remove(cannonball);
                unregisterProjectile(cannonballId);
                return;
            }

            requestAnimationFrame(animateCannonball);
        };

        // Start animation
        animateCannonball();
    }

    /**
     * Create a muzzle flash effect
     * @param {THREE.Vector3} position - Position of the flash
     * @param {THREE.Vector3} direction - Direction of the shot
     */
    createMuzzleFlash(position, direction) {
        const flashGeometry = new THREE.SphereGeometry(1.0, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            transparent: true,
            opacity: 1.0
        });

        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        flash.position.add(direction.clone().multiplyScalar(1.0));
        scene.add(flash);

        const startTime = getTime();
        let animationId;

        const animateFlash = () => {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime >= 0.2) {
                scene.remove(flash);
                cancelAnimationFrame(animationId);
                return;
            }

            const scale = 1.0 + elapsedTime * 5.0;
            flash.scale.set(scale, scale, scale);
            flash.material.opacity = 1.0 - elapsedTime * 5.0;

            animationId = requestAnimationFrame(animateFlash);
        };

        // Start animation
        animationId = requestAnimationFrame(animateFlash);
    }

    /**
     * Create a splash effect when cannonball hits water
     * @param {THREE.Vector3} position - Position of the splash
     */
    createSplashEffect(position) {
        // Ensure y position is at water level
        position.y = 0;
        createWaterSplashEffect(position);
    }

    /**
     * Create cannon smoke effect
     * @param {THREE.Object3D} ship - The player ship
     * @param {Object} cannon - Cannon position data
     */
    createCannonSmoke(ship, cannon) {
        // Create local position
        const smokeLocalPos = new THREE.Vector3(cannon.x, cannon.y, cannon.z);

        // Create matrix for conversion
        const shipMatrix = new THREE.Matrix4();
        shipMatrix.makeRotationY(ship.rotation.y);
        shipMatrix.setPosition(ship.position.x, ship.position.y, ship.position.z);

        // Get world position
        const smokePosition = smokeLocalPos.clone().applyMatrix4(shipMatrix);

        // Create multiple smoke particles for a more realistic effect
        const particleCount = 10;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const smokeGeometry = new THREE.SphereGeometry(0.5, 8, 8);
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.7
            });

            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            smoke.position.copy(smokePosition);

            // Random velocity
            smoke.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );

            scene.add(smoke);
            particles.push(smoke);
        }

        const startTime = getTime();
        let animationFrameId;

        const animateSmoke = () => {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime >= 2.0) {
                // Clean up all particles
                particles.forEach(particle => {
                    if (particle.parent) {
                        scene.remove(particle);
                    }
                });

                // Cancel the animation frame to stop the loop
                cancelAnimationFrame(animationFrameId);
                return;
            }

            particles.forEach(particle => {
                // Move particle
                particle.position.x += particle.velocity.x * 0.016;
                particle.position.y += particle.velocity.y * 0.016;
                particle.position.z += particle.velocity.z * 0.016;

                // Slow down
                particle.velocity.multiplyScalar(0.98);

                // Grow and fade
                const scale = 1.0 + elapsedTime * 2.0;
                particle.scale.set(scale, scale, scale);
                particle.material.opacity = 0.7 * (1.0 - elapsedTime / 2.0);
            });

            animationFrameId = requestAnimationFrame(animateSmoke);
        };

        // Start animation
        animationFrameId = requestAnimationFrame(animateSmoke);

        // Backup cleanup timeout to ensure particles are removed
        setTimeout(() => {
            // Cancel animation frame if it's still running
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            // Remove any remaining particles
            particles.forEach(particle => {
                if (particle.parent) {
                    scene.remove(particle);
                }
            });
        }, 2100);
    }

    /**
     * Set the enabled state of the auto-fire system
     * @param {boolean} enabled - Whether the system should be enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`ShipAutoFire system ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Toggle the auto-fire system on/off
     * @returns {boolean} New enabled state
     */
    toggle() {
        this.enabled = !this.enabled;
        console.log(`ShipAutoFire system ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether debug mode should be enabled
     */
    setDebug(enabled) {
        this.debugEnabled = enabled;
    }
}

// Create singleton instance
const shipAutoFire = new ShipAutoFireSystem();

// Export the singleton
export default shipAutoFire;

/**
 * Initialize the ship auto-fire system
 * @returns {ShipAutoFireSystem} The initialized system
 */
export function initShipAutoFire() {
    console.log('Initializing ship auto-fire system');
    return shipAutoFire;
}

/**
 * Update the ship auto-fire system
 * @param {number} deltaTime - Time since last frame
 */
export function updateShipAutoFire(deltaTime) {
    shipAutoFire.update(deltaTime);
}

/**
 * Toggle the auto-fire system on/off
 * @returns {boolean} New state
 */
export function toggleShipAutoFire() {
    return shipAutoFire.toggle();
}

// Register globals for console access
if (typeof window !== 'undefined') {
    window.shipAutoFire = shipAutoFire;
    window.toggleShipAutoFire = toggleShipAutoFire;
}