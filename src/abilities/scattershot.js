import * as THREE from 'three';
import { boat, scene, getTime } from '../core/gameState.js';
import { playCannonSound } from '../audio/soundEffects.js';

/**
 * Scatter Shot ability - Fires multiple small cannonballs in a spread pattern.
 */
class ScatterShot {
    constructor() {
        this.id = 'scatterShot';
        this.name = 'Scatter Shot';
        this.canCancel = true;
        this.staysActiveAfterExecution = false;
        this.cannonballSpeed = 20; // Slightly faster than regular cannon
        this.gravity = 100;
        this.projectileCount = 20; // Number of projectiles to fire at once
        this.spreadAngle = 0.4; // Controls how wide the spread is (in radians)

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


        // Find nearest cannon position
        const cannonPosition = this.getNearestCannonPosition(targetPosition);
        const cannonName = this.getCannonNameFromPosition(cannonPosition);


        // Calculate base direction from cannon to target
        const baseDirection = new THREE.Vector3().subVectors(targetPosition, cannonPosition);
        baseDirection.normalize();


        // Fire multiple cannonballs in a spread pattern
        this.fireScatterShot(cannonPosition, baseDirection);

        // Play sound
        playCannonSound();

        // Create smoke effect
        this.createCannonSmoke(cannonName);
    }

    onCancel() {

    }

    update(deltaTime) {
        // Nothing continuous needed for the ability itself
    }

    getNearestCannonPosition(targetPosition) {
        let nearestPosition = null;
        let minDistance = Infinity;

        for (const pos of this.cannonPositions) {
            const worldPosition = new THREE.Vector3(pos.x, 1.5, pos.z).applyMatrix4(boat.matrixWorld);
            const distance = worldPosition.distanceTo(targetPosition);

            if (distance < minDistance) {
                minDistance = distance;
                nearestPosition = worldPosition;
            }
        }
        return nearestPosition;
    }

    getCannonNameFromPosition(position) {
        for (const cannon of this.cannonPositions) {
            const worldPosition = new THREE.Vector3(cannon.x, 1.5, cannon.z).applyMatrix4(boat.matrixWorld);
            if (worldPosition.equals(position)) {
                return cannon.name;
            }
        }
        return null;
    }

    fireScatterShot(position, baseDirection) {
        // Create a larger muzzle flash for the scatter shot
        this.createMuzzleFlash(position, baseDirection, 1.5);

        // Create multiple cannonballs with varied directions
        for (let i = 0; i < this.projectileCount; i++) {
            // Create a new direction with some randomization
            const spreadDirection = baseDirection.clone();

            // Add random spread (more in horizontal than vertical)
            const horizontalSpread = (Math.random() - 0.5) * this.spreadAngle;
            const verticalSpread = (Math.random() - 0.5) * (this.spreadAngle * 0.6);

            // Create a rotation matrix for the horizontal spread (around Y axis)
            const horizontalRotation = new THREE.Matrix4().makeRotationY(horizontalSpread);
            spreadDirection.applyMatrix4(horizontalRotation);

            // Create a rotation matrix for the vertical spread (around local X axis)
            // First find perpendicular axis
            const xAxis = new THREE.Vector3(0, 1, 0).cross(spreadDirection).normalize();
            const verticalRotation = new THREE.Matrix4().makeRotationAxis(xAxis, verticalSpread);
            spreadDirection.applyMatrix4(verticalRotation);

            // Add a slight upward component
            spreadDirection.y += 0.05;
            spreadDirection.normalize();

            // Create the cannonball with random size variation (but all smaller than regular)
            const sizeVariation = 0.2 + Math.random() * 0.2; // Between 0.2 and 0.4 of regular size
            this.createCannonball(position.clone(), spreadDirection, sizeVariation);
        }
    }

    createCannonball(position, direction, sizeScale = 0.3) {
        // Create a smaller cannonball
        const cannonballGeometry = new THREE.SphereGeometry((2.0 / 3) * sizeScale, 12, 12);
        const cannonballMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
        cannonball.position.copy(position);
        scene.add(cannonball);

        // Apply slight positional variation for better scatter effect
        cannonball.position.x += (Math.random() - 0.5) * 0.2;
        cannonball.position.y += (Math.random() - 0.5) * 0.2;
        cannonball.position.z += (Math.random() - 0.5) * 0.2;

        // Calculate velocity based on direction and speed
        // Slight speed variation for more natural effect
        const speedVariation = 0.9 + Math.random() * 0.2;
        const velocity = direction.clone().multiplyScalar(this.cannonballSpeed * speedVariation);

        const startTime = getTime();
        const maxDistance = 150;
        const initialPosition = position.clone();

        const animateCannonball = () => {
            const elapsedTime = (getTime() - startTime) / 1000;

            const distanceTraveled = cannonball.position.distanceTo(initialPosition);
            if (distanceTraveled > maxDistance) {
                scene.remove(cannonball);
                cannonball.geometry.dispose();
                cannonball.material.dispose();
                return;
            }

            velocity.y -= this.gravity * elapsedTime;

            cannonball.position.x += velocity.x * 0.16;
            cannonball.position.y += velocity.y * 0.16;
            cannonball.position.z += velocity.z * 0.16;

            cannonball.rotation.x += 0.02;
            cannonball.rotation.z += 0.02;

            if (cannonball.position.y <= 0) {
                // Smaller splash for smaller cannonballs
                this.createEnhancedSplashEffect(cannonball.position.clone(), sizeScale);
                scene.remove(cannonball);
                cannonball.geometry.dispose();
                cannonball.material.dispose();
                return;
            }

            requestAnimationFrame(animateCannonball);
        };

        animateCannonball();
    }

    createMuzzleFlash(position, direction, sizeScale = 1.0) {
        const flashGeometry = new THREE.SphereGeometry(1.0 * sizeScale, 8, 8);
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
                flash.geometry.dispose();
                flash.material.dispose();
                cancelAnimationFrame(animationId);
                return;
            }

            const scale = (1.0 + elapsedTime * 5.0) * sizeScale;
            flash.scale.set(scale, scale, scale);
            flash.material.opacity = 1.0 - elapsedTime * 5.0;
            animationId = requestAnimationFrame(animateFlash);
        };

        animationId = requestAnimationFrame(animateFlash);

        // Backup timer in case animation frame doesn't trigger properly
        setTimeout(() => {
            if (scene.children.includes(flash)) {
                scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
                cancelAnimationFrame(animationId);
            }
        }, 500);
    }

    createEnhancedSplashEffect(position, intensity = 1.0) {
        position.y = 0;
        const splashCount = Math.round(5 * intensity);
        const columnGeometry = new THREE.CylinderGeometry(0.1 * intensity, 0.3 * intensity, intensity * 1.5, 8);
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
        const columnDuration = 0.4;
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
            const splashDuration = 0.8 + Math.random() * 0.3;
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

        // Create ripple effect on water
        const rippleGeometry = new THREE.RingGeometry(0.2, 1.5 * intensity, 32);
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
        const rippleDuration = 0.8 * intensity;
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

        // Create denser smoke for scatter shot
        const smokeCount = 60; // More smoke particles
        const smokeGeometries = [
            new THREE.SphereGeometry(0.4, 8, 8),
            new THREE.SphereGeometry(0.6, 8, 8),
            new THREE.SphereGeometry(0.8, 8, 8)
        ];

        // Create larger blast effect
        const blastGeometry = new THREE.SphereGeometry(1.2, 10, 10);
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
            if (elapsed > 0.4) {
                scene.remove(blastCloud);
                blastCloud.geometry.dispose();
                blastCloud.material.dispose();
                return;
            }
            const scale = 1 + elapsed * 10; // Faster expansion
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
            smokePosition.x += (Math.random() - 0.5) * 1.5; // Wider smoke spread
            smokePosition.y += (Math.random() - 0.5) * 1.0;
            smokePosition.z += (Math.random() - 0.5) * 1.5; // Wider smoke spread
            smoke.position.copy(smokePosition);
            smokeElements.push(smoke);

            const smokeVelocity = cannonDirection.clone().multiplyScalar(0.2 + Math.random() * 0.8);
            smokeVelocity.x += (Math.random() - 0.5) * 0.9; // More lateral movement
            smokeVelocity.y += 0.6 + Math.random() * 1.2;
            smokeVelocity.z += (Math.random() - 0.5) * 0.9; // More lateral movement
            scene.add(smoke);

            const smokeStartTime = getTime();
            const smokeDuration = 1.5 + Math.random() * 0.5;
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
            smokeElements.forEach(smoke => {
                if (scene.children.includes(smoke)) {
                    scene.remove(smoke);
                    smoke.geometry.dispose();
                    smoke.material.dispose();
                }
            });
        }, 3000);
    }
}

export default ScatterShot; 