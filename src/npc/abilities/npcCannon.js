import * as THREE from 'three';
import { scene, getTime, boat } from '../../core/gameState.js';
import { playCannonSound } from '../../audio/soundEffects.js';
import { debugLog } from '../../utils/debug.js';
import {
    registerProjectile,
    unregisterProjectile,
    applyCannonballSplash
} from '../../abilities/damageSystem.js';
import AimingSystem from '../../abilities/aimingSystem.js';
import { createWaterSplashEffect } from '../../effects/playerDamageEffects.js';

/**
 * NPC Cannon System - Provides cannons for NPC ships
 */
export class NpcCannonSystem {
    constructor() {
        this.cannonballSpeed = 35;
        this.gravity = 100;
        this.cooldown = 1.0; // One second cooldown
        this.range = 600;    // Increased from 150 to 600 (4x)
        this.damage = 100;   // Damage per hit
        this.aimInaccuracy = 5.0; // New property for randomness in aiming

        // Track cooldowns for each ship by ID
        this.lastFiredTimes = new Map();

        // Default cannon positions relative to ship model
        this.defaultCannonPositions = [
            { name: 'leftFront', x: -2.5, y: 1.5, z: -3 },
            { name: 'leftRear', x: -2.5, y: 1.5, z: 3 },
            { name: 'rightFront', x: 2.5, y: 1.5, z: -3 },
            { name: 'rightRear', x: 2.5, y: 1.5, z: 3 }
        ];

        // Log system creation
        console.log("NPC Cannon System created with range:", this.range, "cooldown:", this.cooldown);
    }

    /**
     * Check if the ship is currently on cooldown
     * @param {Object} npc - The NPC ship object
     * @returns {boolean} - True if the ship is on cooldown
     */
    isOnCooldown(npc) {
        if (!npc || !npc.id) return false;

        const lastFiredTime = this.lastFiredTimes.get(npc.id);
        if (!lastFiredTime) return false;

        const currentTime = getTime() / 1000;
        return (currentTime - lastFiredTime) < this.cooldown;
    }

    /**
     * Get the remaining cooldown time for a ship
     * @param {Object} npc - The NPC ship object
     * @returns {number} - Remaining cooldown in seconds
     */
    getRemainingCooldown(npc) {
        if (!npc || !npc.id) return 0;

        const lastFiredTime = this.lastFiredTimes.get(npc.id);
        if (!lastFiredTime) return 0;

        const currentTime = getTime() / 1000;
        const timeElapsed = currentTime - lastFiredTime;
        const remaining = Math.max(0, this.cooldown - timeElapsed);

        return remaining;
    }

    /**
     * Fire cannons at the target if within range and off cooldown
     * @param {THREE.Object3D} npcShip - The NPC ship to fire from
     * @param {THREE.Vector3} targetPosition - The target position to fire at
     * @param {Object} options - Optional parameters
     * @returns {boolean} Whether cannons were fired
     */
    fireAtTarget(npcShip, targetPosition, options = {}) {
        try {
            // Basic validation with logging
            if (!npcShip) {
                console.log('Cannot fire cannons: npcShip is null');
                return false;
            }

            if (!npcShip.position) {
                console.log('Cannot fire cannons: npcShip.position is missing');
                return false;
            }

            if (!npcShip.shipGroup) {
                console.log('Cannot fire cannons: npcShip.shipGroup is missing');
                return false;
            }

            if (!targetPosition) {
                console.log('Cannot fire cannons: targetPosition is null');
                return false;
            }

            // Always print distance info for debugging
            const shipPosition = npcShip.position.clone();
            const distanceToTarget = shipPosition.distanceTo(targetPosition);
            console.log(`NPC Ship ${npcShip.id || 'unknown'} distance to target: ${distanceToTarget.toFixed(1)}, range: ${this.range}`);

            // Check cooldown using our new method
            if (this.isOnCooldown(npcShip)) {
                const remaining = this.getRemainingCooldown(npcShip);
                console.log(`Cannon on cooldown for ${remaining.toFixed(1)} more seconds`);
                return false;
            }

            // Check range
            if (distanceToTarget > this.range) {
                console.log(`Target out of range (${distanceToTarget.toFixed(0)} > ${this.range})`);
                return false;
            }

            // Debug info
            console.log(`NPC Ship ${npcShip.id || 'unknown'} FIRING cannons at target (distance: ${distanceToTarget.toFixed(1)})`);

            // Add randomness to target position for inaccuracy
            const randomizedTarget = this.addRandomnessToTarget(targetPosition, distanceToTarget);
            console.log(`Aiming with randomness: Original (${targetPosition.x.toFixed(1)}, ${targetPosition.z.toFixed(1)}) → Modified (${randomizedTarget.x.toFixed(1)}, ${randomizedTarget.z.toFixed(1)})`);

            // Firing logic
            const localTarget = randomizedTarget.clone().sub(shipPosition);
            localTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), -npcShip.rotation.y);

            const cannonsToFire = [];
            if (localTarget.x < 0) {
                cannonsToFire.push('leftFront', 'leftRear');
                console.log('Target is on left side, using left cannons');
            } else {
                cannonsToFire.push('rightFront', 'rightRear');
                console.log('Target is on right side, using right cannons');
            }

            // Fire cannons
            let firedAny = false;

            for (const cannonName of cannonsToFire) {
                const cannonConfig = this.defaultCannonPositions.find(c => c.name === cannonName);
                if (!cannonConfig) continue;

                try {
                    // Get position in local space
                    const cannonLocalPos = new THREE.Vector3(
                        cannonConfig.x,
                        cannonConfig.y,
                        cannonConfig.z
                    );

                    // Create matrix for conversion
                    const shipMatrix = npcShip.shipGroup.matrixWorld.clone();

                    // Convert to world space
                    const cannonPosition = cannonLocalPos.clone().applyMatrix4(shipMatrix);

                    // Use aiming system
                    const direction = AimingSystem.calculateFiringDirection(
                        cannonPosition,
                        randomizedTarget,
                        {
                            adaptiveTrajectory: true,
                            minVerticalAdjust: -0.15,
                            maxVerticalAdjust: 0.1,
                            minDistance: 5,
                            maxDistance: 600, // Increased range here too
                            allowDownwardShots: true
                        }
                    );

                    // Fire!
                    this.createCannonball(cannonPosition, direction);
                    this.createCannonSmoke(npcShip, cannonName);
                    firedAny = true;

                    console.log(`Successfully fired ${cannonName} cannon from (${cannonPosition.x.toFixed(1)}, ${cannonPosition.y.toFixed(1)}, ${cannonPosition.z.toFixed(1)})`);
                } catch (error) {
                    console.error(`Error firing ${cannonName} cannon:`, error);
                }
            }

            if (firedAny) {
                // Update firing time in our cooldown tracking Map
                const currentTime = getTime() / 1000;
                this.lastFiredTimes.set(npcShip.id, currentTime);

                // Play sound
                playCannonSound();

                return true;
            } else {
                console.log('No cannons were fired');
                return false;
            }
        } catch (error) {
            console.error(`Unexpected error in fireAtTarget:`, error);
            return false;
        }
    }

    /**
     * Add randomness to the target position based on distance
     * @param {THREE.Vector3} targetPosition - Original target position
     * @param {number} distance - Distance to target
     * @returns {THREE.Vector3} Randomized target position
     */
    addRandomnessToTarget(targetPosition, distance) {
        // Create a copy of the target
        const randomizedTarget = targetPosition.clone();

        // Scale inaccuracy based on distance (farther = less accurate)
        const distanceFactor = Math.min(distance / 100, 3); // Cap at 3x base inaccuracy
        const maxDeviation = this.aimInaccuracy * distanceFactor;

        // Add random offset to x and z coordinates
        randomizedTarget.x += (Math.random() * 2 - 1) * maxDeviation;
        randomizedTarget.z += (Math.random() * 2 - 1) * maxDeviation;

        // Randomize y position slightly too for varied trajectories
        randomizedTarget.y += (Math.random() * 2 - 1) * 2;

        return randomizedTarget;
    }

    /**
     * Create a cannonball projectile
     * @param {THREE.Vector3} position - Starting position
     * @param {THREE.Vector3} direction - Direction vector
     */
    createCannonball(position, direction) {
        const cannonballGeometry = new THREE.SphereGeometry(0.66, 16, 16);
        const cannonballMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
        cannonball.position.copy(position);

        scene.add(cannonball);

        // Set velocity from direction
        const velocity = direction.clone().multiplyScalar(this.cannonballSpeed);

        // Create muzzle flash
        this.createMuzzleFlash(position, direction);

        const startTime = getTime();
        const maxDistance = 500;
        const initialPosition = position.clone();

        // Generate a unique ID for this cannonball
        const cannonballId = `npc-cannonball-${startTime}`;

        // Register projectile with damage system
        registerProjectile(cannonballId, {
            mesh: cannonball,
            isFromNPC: true,
            data: {
                damage: this.damage,
                hitRadius: 5.0
            },
            prevPosition: position.clone(),
            onHit: (hitData) => {
                debugLog(`NPC Cannonball hit: ${hitData.targetType}`, 1, 'combat');

                // Create hit effect
                this.createHitEffect(hitData.point);

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
                unregisterProjectile(cannonballId);
                scene.remove(cannonball);
                return;
            }

            // Apply gravity
            velocity.y -= this.gravity * 0.016; // Approximate for fixed timestep

            // Update position
            cannonball.position.x += velocity.x * 0.016;
            cannonball.position.y += velocity.y * 0.016;
            cannonball.position.z += velocity.z * 0.016;

            // Add rotation for visual effect
            cannonball.rotation.x += 0.02;
            cannonball.rotation.z += 0.02;

            // Check for water impact
            if (cannonball.position.y <= 0) {
                // Create splash effect
                this.createSplashEffect(cannonball.position.clone());

                // Apply splash damage
                const hitPosition = cannonball.position.clone();
                applyCannonballSplash(hitPosition);

                // Remove cannonball
                unregisterProjectile(cannonballId);
                scene.remove(cannonball);
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

        // Cleanup fallback
        setTimeout(() => {
            if (flash.parent) {
                scene.remove(flash);
                cancelAnimationFrame(animationId);
            }
        }, 500);
    }

    /**
     * Create a splash effect when cannonball hits water
     * @param {THREE.Vector3} position - Position of the splash
     */
    createSplashEffect(position) {
        position.y = 0; // Ensure at water level
        createWaterSplashEffect(position, 1.5);
    }

    /**
     * Create a hit effect when cannonball hits a target
     * @param {THREE.Vector3} position - Position of the hit
     */
    createHitEffect(position) {
        const hitGeometry = new THREE.SphereGeometry(2.0, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 1.0
        });

        const hit = new THREE.Mesh(hitGeometry, hitMaterial);
        hit.position.copy(position);
        scene.add(hit);

        const startTime = getTime();

        const animateHit = () => {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime >= 0.5) {
                scene.remove(hit);
                return;
            }

            const scale = 1.0 + elapsedTime * 3.0;
            hit.scale.set(scale, scale, scale);
            hit.material.opacity = 1.0 - elapsedTime * 2.0;

            requestAnimationFrame(animateHit);
        };

        // Start animation
        requestAnimationFrame(animateHit);
    }

    /**
     * Create cannon smoke effect
     * @param {THREE.Object3D} npcShip - The NPC ship
     * @param {string} cannonPosition - Name of the cannon position
     */
    createCannonSmoke(npcShip, cannonPosition) {
        const cannonConfig = this.defaultCannonPositions.find(c => c.name === cannonPosition);
        if (!cannonConfig) return;

        // Create cannon position in world space
        const smokePosition = new THREE.Vector3(
            cannonConfig.x,
            cannonConfig.y,
            cannonConfig.z
        ).applyMatrix4(npcShip.shipGroup.matrixWorld);

        // Create smoke particles
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

        const animateSmoke = () => {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime >= 2.0) {
                particles.forEach(particle => {
                    if (particle.parent) {
                        scene.remove(particle);
                    }
                });
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

            requestAnimationFrame(animateSmoke);
        };

        // Start animation
        requestAnimationFrame(animateSmoke);
    }

    /**
     * Update cooldowns using delta time
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // This method isn't needed with our current approach since we're 
        // checking cooldowns based on elapsed time from last fired time
        // But could be useful for other time-based effects in the future
    }
}

// Create singleton instance
const npcCannonSystem = new NpcCannonSystem();

// Export default instance
export default npcCannonSystem;

/**
 * Get the NPC cannon system instance (for debugging)
 * @returns {NpcCannonSystem} The cannon system singleton
 */
export function getNpcCannon() {
    return npcCannonSystem;
}

/**
 * Test function to fire a cannonball directly from a position to a direction
 * Call from console for testing: testFireCannonball()
 */
export function testFireCannonball() {
    if (!boat) {
        console.error("Cannot test cannon - player boat not found");
        return false;
    }

    console.log("TEST: Firing test cannonball from player position");

    // Create cannonball at player position
    const position = boat.position.clone();
    position.y += 5; // Elevate slightly

    // Add random direction
    const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.5,
        Math.random() * 2 - 1
    ).normalize();

    // Log test info
    console.log(`Firing from: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    console.log(`Direction: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)})`);

    // Use the cannonball system directly
    npcCannonSystem.createCannonball(position, direction);
    playCannonSound();

    return true;
}

// Register global test function for console access
if (typeof window !== 'undefined') {
    window.testFireCannonball = testFireCannonball;
    console.log("Test function registered: Call testFireCannonball() to test");
} 