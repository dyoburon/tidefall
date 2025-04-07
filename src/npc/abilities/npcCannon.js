import * as THREE from 'three';
import { scene, getTime, boat, applyDamageToPlayer } from '../../core/gameState.js';
import { playCannonSound } from '../../audio/soundEffects.js';
import { debugLog } from '../../utils/debug.js';
import {
    registerProjectile,
    unregisterProjectile,
    applyCannonballSplash
} from '../../abilities/damageSystem.js';
import AimingSystem from '../../abilities/aimingSystem.js';
import { createWaterSplashEffect } from '../../effects/playerDamageEffects.js';
import { showDamageEffect } from '../../effects/playerDamageEffects.js';

/**
 * NPC Cannon System - Provides cannons for NPC ships
 */
export class NpcCannonSystem {
    constructor() {
        this.cannonballSpeed = 130;  // Increased speed for better travel
        this.gravity = 80;         // Reduced gravity so cannonballs travel farther
        this.minCooldown = 1.0;    // Minimum cooldown time in seconds
        this.maxCooldown = 2.0;    // Maximum cooldown time in seconds
        this.range = 600;          // Keep original engagement range
        this.damage = 10;         // Changed from 100 to 10 damage per hit
        this.aimInaccuracy = 20.0;  // Randomness in aiming

        // Default cannon positions relative to ship model
        this.defaultCannonPositions = [
            { name: 'leftFront', x: -2.5, y: 1.5, z: -3 },
            { name: 'leftRear', x: -2.5, y: 1.5, z: 3 },
            { name: 'rightFront', x: 2.5, y: 1.5, z: -3 },
            { name: 'rightRear', x: 2.5, y: 1.5, z: 3 }
        ];

        // Log system creation

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

                return false;
            }

            if (!npcShip.position) {

                return false;
            }

            if (!npcShip.shipGroup) {

                return false;
            }

            if (!targetPosition) {

                return false;
            }

            // Always print distance info for debugging
            const shipPosition = npcShip.position.clone();
            const distanceToTarget = shipPosition.distanceTo(targetPosition);


            // Check cooldown - simple approach using the ship's cooldownTimer property
            if (npcShip.cooldownTimer > 0) {

                return false;
            }

            // Check range
            if (distanceToTarget > this.range) {

                return false;
            }

            // Debug info


            // Add randomness to target position for inaccuracy
            const randomizedTarget = this.addRandomnessToTarget(targetPosition, distanceToTarget);


            // Determine which side of the ship the target is on
            const localTarget = randomizedTarget.clone().sub(shipPosition);
            localTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), -npcShip.rotation.y);
            const isTargetOnLeft = localTarget.x < 0;

            // Get all cannons on the side facing the target
            let potentialCannons = this.defaultCannonPositions.filter(cannon => {
                return (isTargetOnLeft && cannon.name.includes('left')) ||
                    (!isTargetOnLeft && cannon.name.includes('right'));
            });

            // Find the closest cannon to the target
            let closestCannon = null;
            let closestDistance = Infinity;

            for (const cannon of potentialCannons) {
                // Create local position
                const cannonLocalPos = new THREE.Vector3(cannon.x, cannon.y, cannon.z);

                // Get world position
                const cannonWorldPos = cannonLocalPos.clone().applyMatrix4(npcShip.shipGroup.matrixWorld);

                // Calculate distance to target
                const distanceToTarget = cannonWorldPos.distanceTo(randomizedTarget);

                if (distanceToTarget < closestDistance) {
                    closestDistance = distanceToTarget;
                    closestCannon = cannon;
                }
            }

            // If no cannon found, something is wrong
            if (!closestCannon) {

                return false;
            }



            try {
                // Get position in local space
                const cannonLocalPos = new THREE.Vector3(
                    closestCannon.x,
                    closestCannon.y,
                    closestCannon.z
                );

                // Create matrix for conversion
                const shipMatrix = npcShip.shipGroup.matrixWorld.clone();

                // Convert to world space
                const cannonPosition = cannonLocalPos.clone().applyMatrix4(shipMatrix);

                // Calculate vertical angle based on distance
                // Farther targets need higher arc
                const distanceFactor = Math.min(distanceToTarget / this.range, 1.0);
                const verticalAdjustment = 0.2 + (distanceFactor * 0.4); // 0.2 to 0.6 based on distance

                // Use aiming system with higher trajectory
                const direction = AimingSystem.calculateFiringDirection(
                    cannonPosition,
                    randomizedTarget,
                    {
                        adaptiveTrajectory: true,
                        minVerticalAdjust: 0.2,         // Force upward arcs
                        maxVerticalAdjust: 0.6,         // Higher arcs for longer shots
                        minDistance: 5,
                        maxDistance: this.range,
                        allowDownwardShots: false       // Never shoot downward
                    }
                );

                // Fire!
                this.createCannonball(cannonPosition, direction);
                this.createCannonSmoke(npcShip, closestCannon.name);



                // Set cooldown directly on the ship with random value
                npcShip.cooldownTimer = this.minCooldown + Math.random() * (this.maxCooldown - this.minCooldown);


                // Play sound
                playCannonSound();

                return true;
            } catch (error) {

                return false;
            }
        } catch (error) {

            return false;
        }
    }

    /**
     * Get the remaining cooldown for a ship (for debugging)
     * @param {Object} npc - The NPC ship
     * @returns {number} Remaining cooldown time
     */
    getRemainingCooldown(npc) {
        return npc?.cooldownTimer || 0;
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
        // Increased radius by ~30% (0.66 * 1.3)
        const cannonballGeometry = new THREE.SphereGeometry(0.866, 16, 16);
        const cannonballMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
        cannonball.position.copy(position);

        scene.add(cannonball);

        // Set velocity from direction
        const velocity = direction.clone().multiplyScalar(this.cannonballSpeed);

        // Create muzzle flash
        this.createMuzzleFlash(position, direction);

        const startTime = getTime();
        const maxDistance = 1200;  // Greatly increased max travel distance
        const initialPosition = position.clone();

        // Generate a unique ID for this cannonball
        const cannonballId = `npc-cannonball-${startTime}`;

        // Create a bounding sphere for player collision detection
        // Increased radius by 30% (5.0 * 1.3)
        const playerCollisionSphere = new THREE.Sphere(new THREE.Vector3(), 6.5);

        // Register projectile with damage system
        registerProjectile(cannonballId, {
            mesh: cannonball,
            isFromNPC: true,
            data: {
                damage: this.damage,
                // Increased hit radius by 30% (5.0 * 1.3)
                hitRadius: 6.5
            },
            prevPosition: position.clone(),
            onHit: (hitData) => {
                debugLog(`NPC Cannonball hit: ${hitData.targetType}`, 1, 'combat');

                // Create hit effect
                // Commenting out to remove red circles on impact
                // this.createHitEffect(hitData.point);

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

            // Save previous position for collision detection
            const prevPosition = cannonball.position.clone();

            // Apply gravity
            velocity.y -= this.gravity * 0.016; // Reduced gravity for longer arcs

            // Update position
            cannonball.position.x += velocity.x * 0.016;
            cannonball.position.y += velocity.y * 0.016;
            cannonball.position.z += velocity.z * 0.016;

            // Add rotation for visual effect
            cannonball.rotation.x += 0.02;
            cannonball.rotation.z += 0.02;

            // Check for player boat collision
            if (boat) {
                // Update player collision sphere
                playerCollisionSphere.center.copy(boat.position);

                // Create a ray from previous position to current position
                const rayDirection = new THREE.Vector3().subVectors(
                    cannonball.position, prevPosition
                ).normalize();

                const rayLength = prevPosition.distanceTo(cannonball.position);
                const ray = new THREE.Ray(prevPosition, rayDirection);

                // Check for intersection with player's collision sphere
                const intersection = ray.intersectSphere(playerCollisionSphere, new THREE.Vector3());

                if (intersection) {
                    // Hit the player boat!
                    debugLog(`NPC Cannonball hit player!`, 1, 'combat');


                    // Apply damage to player using the gameState damage system
                    // This will handle respawn automatically if health reaches zero
                    applyDamageToPlayer(this.damage, 'npc_cannon');

                    // Show hit effect on the player boat
                    showDamageEffect(boat, this.damage, 'cannon');

                    // Create explosion effect at hit point
                    //this.createHitEffect(intersection);

                    // Remove cannonball
                    unregisterProjectile(cannonballId);
                    scene.remove(cannonball);
                    return;
                }
            }

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
        /*
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
        */
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
        }, 2100); // Just slightly longer than the animation duration
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

    /**
     * Create the impact effect when a cannonball hits
     * @param {THREE.Vector3} position - Position of the impact
     */
    createImpactEffect(position) {
        // Create multiple visual effects for a more dramatic impact
        this.createImpactExplosion(position);
        this.createSplinters(position);
        this.createSmokeTrail(position);
    }

    /**
     * Create the main explosion at impact point
     * @param {THREE.Vector3} position - Position of the impact
     */
    createImpactExplosion(position) {
        // Create impact particles
        const particleCount = 25;
        const particles = [];

        // Create particle geometry
        const particleGeometry = new THREE.SphereGeometry(0.15, 8, 8);

        for (let i = 0; i < particleCount; i++) {
            // Create different colored particles for more interesting effect
            let color;
            const colorRoll = Math.random();

            if (colorRoll < 0.4) {
                color = 0xff5500; // Orange fire
            } else if (colorRoll < 0.7) {
                color = 0xff9500; // Yellow fire
            } else if (colorRoll < 0.9) {
                color = 0x555555; // Dark smoke
            } else {
                color = 0xeeeeee; // Bright spark
            }

            const particleMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9
            });

            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            // Position slightly randomized around impact point
            particle.position.copy(position).add(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5
                )
            );

            // Add random velocity, higher upward component
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                1 + Math.random() * 3,
                (Math.random() - 0.5) * 4
            );

            // Add to scene
            scene.add(particle);
            particles.push(particle);

            // Set particle properties for animation
            particle.userData.drag = 0.95 + Math.random() * 0.03;
            particle.userData.gravity = 0.1 + Math.random() * 0.1;
            particle.userData.opacityDecay = 0.03 + Math.random() * 0.03;
        }

        // Add a flash at impact point
        const flashGeometry = new THREE.SphereGeometry(0.8, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff80,
            transparent: true,
            opacity: 1
        });

        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        scene.add(flash);

        // Animate particles
        let elapsed = 0;
        const duration = 1.5; // seconds

        function animateImpact() {
            elapsed += 0.016; // Approximately 60fps

            if (elapsed >= duration) {
                // Remove particles when animation completes
                particles.forEach(particle => {
                    if (particle.parent) {
                        scene.remove(particle);
                        particle.geometry.dispose();
                        particle.material.dispose();
                    }
                });

                // Remove flash
                if (flash.parent) {
                    scene.remove(flash);
                    flash.geometry.dispose();
                    flash.material.dispose();
                }
                return;
            }

            // Quick flash fade
            if (flash.parent) {
                flash.material.opacity -= 0.1;
                const scale = 1.0 + elapsed * 3;
                flash.scale.set(scale, scale, scale);

                if (flash.material.opacity <= 0 || elapsed > 0.3) {
                    scene.remove(flash);
                    flash.geometry.dispose();
                    flash.material.dispose();
                }
            }

            // Update each particle
            particles.forEach(particle => {
                // Apply gravity
                particle.userData.velocity.y -= particle.userData.gravity;

                // Apply drag
                particle.userData.velocity.multiplyScalar(particle.userData.drag);

                // Move based on velocity
                particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.016));

                // Fade out
                particle.material.opacity -= particle.userData.opacityDecay;
                if (particle.material.opacity < 0) {
                    particle.material.opacity = 0;
                }
            });

            requestAnimationFrame(animateImpact);
        }

        // Start animation
        animateImpact();
    }

    /**
     * Create wood splinters at impact point
     * @param {THREE.Vector3} position - Position of the impact
     */
    createSplinters(position) {
        const splinterCount = 12;
        const splinters = [];

        // Create splinter geometries - wooden shards
        const splinterGeometries = [
            new THREE.BoxGeometry(0.1, 0.02, 0.4),
            new THREE.BoxGeometry(0.08, 0.02, 0.3),
            new THREE.BoxGeometry(0.12, 0.02, 0.2)
        ];

        // Wood colors for splinters
        const woodColors = [0x8B4513, 0x704214, 0x5C3A17];

        for (let i = 0; i < splinterCount; i++) {
            // Randomly select geometry and color
            const geometryIndex = Math.floor(Math.random() * splinterGeometries.length);
            const colorIndex = Math.floor(Math.random() * woodColors.length);

            const splinter = new THREE.Mesh(
                splinterGeometries[geometryIndex],
                new THREE.MeshBasicMaterial({
                    color: woodColors[colorIndex]
                })
            );

            // Position at impact point
            splinter.position.copy(position);

            // Random rotation
            splinter.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Add physics - flying outward from impact
            splinter.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                1 + Math.random() * 2,
                (Math.random() - 0.5) * 5
            );

            // Add rotation velocity
            splinter.userData.rotationSpeed = new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            );

            scene.add(splinter);
            splinters.push(splinter);
        }

        // Animate splinters
        let elapsed = 0;
        const splinterDuration = 2.0; // seconds

        function animateSplinters() {
            elapsed += 0.016;

            if (elapsed >= splinterDuration) {
                splinters.forEach(splinter => {
                    if (splinter.parent) {
                        scene.remove(splinter);
                        splinter.geometry.dispose();
                        splinter.material.dispose();
                    }
                });
                return;
            }

            splinters.forEach(splinter => {
                // Apply gravity
                splinter.userData.velocity.y -= 0.15;

                // Move based on velocity
                splinter.position.add(splinter.userData.velocity.clone().multiplyScalar(0.016));

                // Rotate splinter
                splinter.rotation.x += splinter.userData.rotationSpeed.x;
                splinter.rotation.y += splinter.userData.rotationSpeed.y;
                splinter.rotation.z += splinter.userData.rotationSpeed.z;
            });

            requestAnimationFrame(animateSplinters);
        }

        requestAnimationFrame(animateSplinters);
    }

    /**
     * Create a smoke trail effect at the impact point
     * @param {THREE.Vector3} position - Position of the impact
     */
    createSmokeTrail(position) {
        const smokeCount = 8;
        const smokeParticles = [];

        // Create smoke particles
        const smokeGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.6
        });

        for (let i = 0; i < smokeCount; i++) {
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());

            // Start at impact point
            smoke.position.copy(position);

            // Add slight delay to each smoke particle
            smoke.userData.delay = i * 0.05;
            smoke.userData.active = false;

            // Slow rising motion
            smoke.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                0.5 + Math.random() * 0.8,
                (Math.random() - 0.5) * 0.5
            );

            smoke.scale.set(0.1, 0.1, 0.1); // Start small
            smoke.userData.scaleRate = 0.02 + Math.random() * 0.02;
            smoke.userData.opacityDecay = 0.01 + Math.random() * 0.01;

            scene.add(smoke);
            smokeParticles.push(smoke);
        }

        // Animate smoke
        let elapsed = 0;
        const smokeDuration = 3.0; // seconds

        function animateSmoke() {
            elapsed += 0.016;

            if (elapsed >= smokeDuration) {
                smokeParticles.forEach(smoke => {
                    if (smoke.parent) {
                        scene.remove(smoke);
                        smoke.geometry.dispose();
                        smoke.material.dispose();
                    }
                });
                return;
            }

            smokeParticles.forEach(smoke => {
                // Check if this smoke particle should be active yet
                if (!smoke.userData.active && elapsed > smoke.userData.delay) {
                    smoke.userData.active = true;
                }

                if (smoke.userData.active) {
                    // Move smoke upward
                    smoke.position.add(smoke.userData.velocity.clone().multiplyScalar(0.016));

                    // Grow smoke
                    if (smoke.scale.x < 2.0) {
                        smoke.scale.addScalar(smoke.userData.scaleRate);
                    }

                    // Fade out gradually
                    smoke.material.opacity -= smoke.userData.opacityDecay;
                    if (smoke.material.opacity < 0) {
                        smoke.material.opacity = 0;
                    }
                }
            });

            requestAnimationFrame(animateSmoke);
        }

        requestAnimationFrame(animateSmoke);
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

        return false;
    }



    // Create cannonball at player position
    const position = boat.position.clone();
    position.y += 5; // Elevate slightly

    // Add random direction
    const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.5,
        Math.random() * 2 - 1
    ).normalize();

    // Use the cannonball system directly
    npcCannonSystem.createCannonball(position, direction);
    playCannonSound();

    return true;
}

// Register global test function for console access
if (typeof window !== 'undefined') {
    window.testFireCannonball = testFireCannonball;

} 