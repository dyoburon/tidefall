import * as THREE from 'three';
import { boat, scene, getTime } from '../core/gameState.js';
import { playCannonSound } from '../audio/soundEffects.js'; // Import sound
import {
    registerProjectile,
    unregisterProjectile,
    applyCannonballSplash
} from './damageSystem.js';
import { getAllMonsters } from '../entities/monsterManager.js';

/**
 * Cannon Shot ability - Fires a single cannonball towards the target location.
 */
class CannonShot {
    constructor() {
        this.id = 'cannonShot';
        this.name = 'Cannon Shot';
        this.canCancel = true;
        this.staysActiveAfterExecution = false;
        this.cannonballSpeed = 18;
        this.gravity = 100;      // Adjust as needed.  Increased significantly.

        this.cannonPositions = [
            { name: 'leftFront', x: -2.5, z: -3 },
            { name: 'leftRear', x: -2.5, z: 3 },
            { name: 'rightFront', x: 2.5, z: -3 },
            { name: 'rightRear', x: 2.5, z: 3 }
        ];
    }

    onAimStart(crosshair) {

        // Could change crosshair color/shape here if desired
    }

    onExecute(targetPosition) {
        // 

        // Find nearest cannon position
        const cannonPosition = this.getNearestCannonPosition(targetPosition);
        const cannonName = this.getCannonNameFromPosition(cannonPosition);


        // Calculate direction from cannon to target
        const direction = new THREE.Vector3().subVectors(targetPosition, cannonPosition);
        direction.normalize();


        // --- Create Cannonball (NEW LOGIC) ---
        this.createCannonball(cannonPosition, direction);

        // Play sound
        playCannonSound();

        // Create smoke effect (using existing function)
        this.createCannonSmoke(cannonName); // Use the correct name
    }

    onCancel() {

    }

    update(deltaTime) {
        // Nothing continuous needed *for the ability itself*.
        // Cannonball animation is handled separately.
    }

    getNearestCannonPosition(targetPosition) {
        let nearestPosition = null;
        let minDistance = Infinity;

        for (const pos of this.cannonPositions) {
            const worldPosition = new THREE.Vector3(pos.x, 1.5, pos.z).applyMatrix4(boat.matrixWorld);
            // // Log the matrix
            const distance = worldPosition.distanceTo(targetPosition);

            if (distance < minDistance) {
                minDistance = distance;
                nearestPosition = worldPosition;
            }
        }
        //
        return nearestPosition;
    }

    getCannonNameFromPosition(position) {
        for (const cannon of this.cannonPositions) {
            const worldPosition = new THREE.Vector3(cannon.x, 1.5, cannon.z).applyMatrix4(boat.matrixWorld);
            if (worldPosition.equals(position)) { // Use .equals() for Vector3 comparison
                return cannon.name;
            }
        }
        return null; // Should not happen, but handle for safety
    }

    createCannonball(position, direction) {
        const cannonballGeometry = new THREE.SphereGeometry(2.0 / 3, 16, 16);
        const cannonballMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
        cannonball.position.copy(position);

        scene.add(cannonball);

        // Add a slight upward component to the direction
        const firingDirection = direction.clone();
        firingDirection.y += 0.05; // Reduced upward angle
        firingDirection.normalize();

        const velocity = firingDirection.clone().multiplyScalar(this.cannonballSpeed);

        // Create muzzle flash
        this.createMuzzleFlash(position, firingDirection);

        const startTime = getTime();
        const maxDistance = 150;
        const initialPosition = position.clone();

        // Generate a unique ID for this cannonball
        const cannonballId = `cannonball-${startTime}`;

        // Register with more reasonable hit radius (reduced from 100)
        registerProjectile(cannonballId, {
            mesh: cannonball,
            data: {
                damage: 1000, // Extremely high damage to guarantee kill
                hitRadius: 15.0 // Very generous hit radius
            },
            prevPosition: position.clone(),
            onHit: (hitData) => {
                console.log(`Cannonball HIT: ${hitData.monster.typeId}!`);
                console.log(`Monster should now be DEAD. Health: ${hitData.monster.health}`);

                // Create a visible effect at the hit point
                this.createHitEffect(hitData.point);

                // Remove the cannonball from the scene
                scene.remove(cannonball);
            }
        });

        const animateCannonball = () => {
            const elapsedTime = (getTime() - startTime) / 1000;

            const distanceTraveled = cannonball.position.distanceTo(initialPosition);
            if (distanceTraveled > maxDistance) {
                unregisterProjectile(cannonballId);
                scene.remove(cannonball);
                return;
            }

            velocity.y -= this.gravity * elapsedTime;

            // Update cannonball position
            cannonball.position.x += velocity.x * 0.16;
            cannonball.position.y += velocity.y * 0.16;
            cannonball.position.z += velocity.z * 0.16;

            cannonball.rotation.x += 0.02;
            cannonball.rotation.z += 0.02;

            // Handle water impact
            if (cannonball.position.y <= 0) {
                // Apply splash damage
                const hitPosition = cannonball.position.clone();
                const damagedMonsters = applyCannonballSplash(hitPosition);

                // Log damage results
                if (damagedMonsters.length > 0) {
                    console.log(`Cannonball splash damaged ${damagedMonsters.length} monsters!`);
                }

                this.createEnhancedSplashEffect(cannonball.position.clone(), 2.0 / 3.0);
                unregisterProjectile(cannonballId);
                scene.remove(cannonball);
                return;
            }

            requestAnimationFrame(animateCannonball);
        };

        animateCannonball();
    }

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


            if (elapsedTime >= 0.2) { // Flash duration: 0.2 seconds, use >=

                scene.remove(flash);
                cancelAnimationFrame(animationId); // Ensure we cancel the animation frame
                return;
            }

            const scale = 1.0 + elapsedTime * 5.0;
            flash.scale.set(scale, scale, scale);
            flash.material.opacity = 1.0 - elapsedTime * 5.0;
            animationId = requestAnimationFrame(animateFlash);
        };

        // Start the animation
        animationId = requestAnimationFrame(animateFlash);

        // Backup timer in case animation frame doesn't trigger properly
        setTimeout(() => {
            if (scene.children.includes(flash)) {

                scene.remove(flash);
                cancelAnimationFrame(animationId);
            }
        }, 500); // Half a second is more than enough
    }

    createEnhancedSplashEffect(position, intensity = 3.0) {
        position.y = 0;
        const splashCount = Math.round(10 * intensity);
        const columnGeometry = new THREE.CylinderGeometry(0.1, 0.6, intensity * 2, 8);
        const columnMaterial = new THREE.MeshBasicMaterial({
            color: 0xAACCFF,
            transparent: true,
            opacity: 0.7
        });
        const column = new THREE.Mesh(columnGeometry, columnMaterial);
        column.position.copy(position);
        column.position.y += intensity;
        scene.add(column);

        const columnStartTime = getTime();
        const columnDuration = 0.5;
        let columnAnimationId;

        const animateColumn = () => {
            const elapsedTime = (getTime() - columnStartTime) / 1000;
            if (elapsedTime > columnDuration) {
                scene.remove(column);
                column.geometry.dispose();
                column.material.dispose();
                return;
            }
            const progress = elapsedTime / columnDuration;
            column.scale.y = 1 + progress * 2;
            column.position.y = intensity * (1 - progress * 0.5);
            column.material.opacity = 0.7 * (1 - progress);
            columnAnimationId = requestAnimationFrame(animateColumn);
        };

        columnAnimationId = requestAnimationFrame(animateColumn);

        // Backup timer for column
        setTimeout(() => {
            if (scene.children.includes(column)) {

                scene.remove(column);
                column.geometry.dispose();
                column.material.dispose();
            }
        }, 1000);

        const splashGeometry = new THREE.SphereGeometry(0.2 * intensity, 4, 4);
        const splashMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.7
        });

        const splashes = [];
        for (let i = 0; i < splashCount; i++) {
            const splash = new THREE.Mesh(splashGeometry, splashMaterial);
            splash.position.copy(position);
            splash.position.y += 0.1;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5 * intensity,
                (Math.random() * 1.5 + 1.0) * intensity,
                (Math.random() - 0.5) * 1.5 * intensity
            );
            scene.add(splash);
            splashes.push(splash);

            const startTime = getTime();
            const splashDuration = 1 + Math.random() * 0.5;
            let splashAnimationId;

            const animateSplash = () => {
                const elapsedTime = (getTime() - startTime) / 1000;
                if (elapsedTime > splashDuration) {
                    scene.remove(splash);
                    splash.geometry.dispose();
                    splash.material.dispose();
                    return;
                }
                velocity.y -= 0.1 * intensity;
                splash.position.add(velocity.clone().multiplyScalar(0.1));
                if (splash.position.y <= 0 && velocity.y < 0) {
                    splash.position.y = 0;
                    velocity.y = Math.abs(velocity.y) * 0.3;
                    splash.material.opacity *= 0.7;
                }
                splash.material.opacity = 0.7 * (1 - elapsedTime / splashDuration);
                splashAnimationId = requestAnimationFrame(animateSplash);
            };

            splashAnimationId = requestAnimationFrame(animateSplash);
        }

        // Backup timer for splashes
        setTimeout(() => {
            splashes.forEach(splash => {
                if (scene.children.includes(splash)) {
                    scene.remove(splash);
                    splash.geometry.dispose();
                    splash.material.dispose();
                }
            });
        }, 2000);

        const rippleGeometry = new THREE.RingGeometry(0.2, 2 * intensity, 32);
        const rippleMaterial = new THREE.MeshBasicMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
        ripple.rotation.x = -Math.PI / 2;
        ripple.position.copy(position);
        ripple.position.y = 0.05;
        scene.add(ripple);

        const rippleStartTime = getTime();
        const rippleDuration = 1.0 * intensity;
        let rippleAnimationId;

        const animateRipple = () => {
            const rippleElapsedTime = (getTime() - rippleStartTime) / 1000;
            if (rippleElapsedTime > rippleDuration) {
                scene.remove(ripple);
                ripple.geometry.dispose();
                ripple.material.dispose();
                return;
            }
            const scale = 1 + rippleElapsedTime * 5 * intensity;
            ripple.scale.set(scale, scale, 1);
            ripple.material.opacity = 0.6 * (1 - rippleElapsedTime / rippleDuration);
            rippleAnimationId = requestAnimationFrame(animateRipple);
        };

        rippleAnimationId = requestAnimationFrame(animateRipple);

        // Backup timer for ripple
        setTimeout(() => {
            if (scene.children.includes(ripple)) {
                scene.remove(ripple);
                ripple.geometry.dispose();
                ripple.material.dispose();
            }
        }, 2000);
    }

    // Re-use the createCannonSmoke function, but make sure it's self-contained
    createCannonSmoke(cannonPosition) {
        if (!boat) return;

        const positionConfig = {
            leftFront: { x: -2.5, z: -3 },
            leftRear: { x: -2.5, z: 3 },
            rightFront: { x: 2.5, z: -3 },
            rightRear: { x: 2.5, z: 3 }
        }[cannonPosition];

        if (!positionConfig) return;

        const cannonWorldPosition = new THREE.Vector3(
            positionConfig.x,
            1.5, // Height above deck
            positionConfig.z
        );
        cannonWorldPosition.applyMatrix4(boat.matrixWorld);


        const cannonDirection = new THREE.Vector3();
        if (positionConfig.x < 0) {
            cannonDirection.set(-0.7, 0, positionConfig.z < 0 ? -0.7 : 0.7);
        } else {
            cannonDirection.set(0.7, 0, positionConfig.z < 0 ? -0.7 : 0.7);
        }
        cannonDirection.applyQuaternion(boat.quaternion);


        const smokeCount = 45;
        const smokeGeometries = [
            new THREE.SphereGeometry(0.4, 8, 8),
            new THREE.SphereGeometry(0.6, 8, 8),
            new THREE.SphereGeometry(0.8, 8, 8)
        ];

        const blastGeometry = new THREE.SphereGeometry(1.0, 10, 10);
        const blastMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.9, 0.8, 0.6),
            transparent: true,
            opacity: 0.9
        });
        const blastCloud = new THREE.Mesh(blastGeometry, blastMaterial);
        blastCloud.position.copy(cannonWorldPosition);
        blastCloud.position.add(cannonDirection.clone().multiplyScalar(1.2));
        scene.add(blastCloud);

        const blastStartTime = getTime();
        let blastAnimationId;

        const animateBlast = () => {
            const elapsed = (getTime() - blastStartTime) / 1000;
            if (elapsed > 0.4) { // Blast duration: 0.4 seconds (unchanged, already short)

                scene.remove(blastCloud);
                blastCloud.geometry.dispose();
                blastCloud.material.dispose();
                return;
            }
            const scale = 1 + elapsed * 8;
            blastCloud.scale.set(scale, scale, scale);
            blastCloud.material.opacity = 0.9 * (1 - elapsed / 0.4);
            blastAnimationId = requestAnimationFrame(animateBlast);
        };

        blastAnimationId = requestAnimationFrame(animateBlast);

        // Backup timer for blast cloud
        setTimeout(() => {
            if (scene.children.includes(blastCloud)) {

                scene.remove(blastCloud);
                blastCloud.geometry.dispose();
                blastCloud.material.dispose();
            }
        }, 1000);

        const smokeElements = [];
        for (let i = 0; i < smokeCount; i++) {
            const brightness = 0.3 + Math.random() * 0.4;
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(brightness, brightness, brightness),
                transparent: true,
                opacity: 0.8 + Math.random() * 0.2
            });

            const geometryIndex = Math.floor(Math.random() * smokeGeometries.length);
            const smoke = new THREE.Mesh(smokeGeometries[geometryIndex], smokeMaterial);
            const smokePosition = cannonWorldPosition.clone();
            smokePosition.add(cannonDirection.clone().multiplyScalar(1.0 + Math.random() * 1.0));
            smokePosition.x += (Math.random() - 0.5) * 1.0;
            smokePosition.y += (Math.random() - 0.5) * 0.8;
            smokePosition.z += (Math.random() - 0.5) * 1.0;
            smoke.position.copy(smokePosition);
            smokeElements.push(smoke);

            const smokeVelocity = cannonDirection.clone().multiplyScalar(0.2 + Math.random() * 0.8);
            smokeVelocity.x += (Math.random() - 0.5) * 0.7;
            smokeVelocity.y += 0.6 + Math.random() * 1.2;
            smokeVelocity.z += (Math.random() - 0.5) * 0.7;
            scene.add(smoke);

            const smokeStartTime = getTime();
            const smokeDuration = 1.5 + Math.random() * 0.5; // Max smoke duration: 2 seconds
            let smokeAnimationId;

            const animateSmoke = () => {
                const smokeElapsedTime = (getTime() - smokeStartTime) / 1000;
                if (smokeElapsedTime > smokeDuration) {

                    scene.remove(smoke);
                    smoke.geometry.dispose();
                    smoke.material.dispose();
                    return;
                }
                smoke.position.add(smokeVelocity.clone().multiplyScalar(0.06));
                smokeVelocity.multiplyScalar(0.98);
                const windEffect = Math.sin(getTime() * 0.001 + smoke.position.x * 0.1) * 0.006;
                smoke.position.x += windEffect;
                smoke.position.z += windEffect * 0.5;
                const normalizedTime = smokeElapsedTime / smokeDuration;
                if (normalizedTime < 0.7) {
                    smoke.material.opacity = 1.0 - normalizedTime * 0.3;
                } else {
                    smoke.material.opacity = 0.79 - (normalizedTime - 0.7) * 2.5;
                }
                const scale = 1 + smokeElapsedTime * (1.0 + Math.random() * 0.5);
                smoke.scale.set(scale, scale, scale);
                smokeAnimationId = requestAnimationFrame(animateSmoke);
            };

            smokeAnimationId = requestAnimationFrame(animateSmoke);
        }

        // Backup timer for all smoke elements
        setTimeout(() => {
            smokeElements.forEach((smoke, index) => {
                if (scene.children.includes(smoke)) {

                    scene.remove(smoke);
                    smoke.geometry.dispose();
                    smoke.material.dispose();
                }
            });
        }, 3000); // Ensure all smoke is gone after 3 seconds
    }

    /**
     * Find the closest point on a line segment to a point
     * @param {THREE.Vector3} segmentStart - Start of segment
     * @param {THREE.Vector3} segmentEnd - End of segment
     * @param {THREE.Vector3} point - Point to find closest position to
     * @returns {THREE.Vector3} Closest point on segment
     */
    getClosestPointOnSegment(segmentStart, segmentEnd, point) {
        const segment = new THREE.Vector3().subVectors(segmentEnd, segmentStart);
        const segmentLength = segment.length();
        const segmentDirection = segment.clone().normalize();

        const pointToStart = new THREE.Vector3().subVectors(point, segmentStart);

        // Project point onto segment
        const projection = pointToStart.dot(segmentDirection);

        // Clamp to segment bounds
        const normalizedProjection = Math.max(0, Math.min(segmentLength, projection));

        // Get the closest point on the segment
        return new THREE.Vector3().addVectors(
            segmentStart,
            segmentDirection.multiplyScalar(normalizedProjection)
        );
    }

    /**
     * Create visual effect at hit location
     * @param {THREE.Vector3} position - Hit position
     */
    createHitEffect(position) {
        // Create a small explosion effect
        const hitGeometry = new THREE.SphereGeometry(0.8, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 1.0
        });

        const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
        hitEffect.position.copy(position);
        scene.add(hitEffect);

        const startTime = getTime();
        const duration = 0.4; // seconds

        const animateHit = () => {
            const elapsed = (getTime() - startTime) / 1000;
            if (elapsed > duration) {
                scene.remove(hitEffect);
                hitEffect.geometry.dispose();
                hitEffect.material.dispose();
                return;
            }

            const progress = elapsed / duration;
            const scale = 1 + progress * 2;
            hitEffect.scale.set(scale, scale, scale);
            hitEffect.material.opacity = 1.0 - progress;

            requestAnimationFrame(animateHit);
        };

        requestAnimationFrame(animateHit);

        // Safety cleanup
        setTimeout(() => {
            if (scene.children.includes(hitEffect)) {
                scene.remove(hitEffect);
                hitEffect.geometry.dispose();
                hitEffect.material.dispose();
            }
        }, duration * 1000 + 100);
    }
}

export default CannonShot; 