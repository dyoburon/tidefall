import * as THREE from 'three';
import { boat, scene, getTime } from '../core/gameState.js';
import { getMonsters, flashMonsterRed } from '../entities/seaMonsters.js';

/**
 * Harpoon Shot ability - Fires a harpoon towards the target location.
 * If it hits an enemy, it attaches to them.
 */
class HarpoonShot {
    constructor() {
        this.id = 'harpoonShot';
        this.name = 'Harpoon Shot';
        this.canCancel = true;
        this.staysActiveAfterExecution = true; // Keep active while harpoon is attached
        this.harpoonSpeed = 25;
        this.gravity = 0.3; // Very small gravity value to start with

        // Track the harpoon state
        this.harpoon = null;
        this.harpoonLine = null;
        this.attachedEnemy = null;
        this.firingPosition = null;
        this.isAttached = false;

        // Fixed position on the boat front where the harpoon is fired from
        this.harpoonPosition = { x: 0, y: 2, z: -4 }; // Front of boat
    }

    onAimStart(crosshair) {
        console.log('Harpoon Shot Aiming Started');
        // Change crosshair color/shape for harpoon
        if (crosshair && crosshair.crosshairElement) {
            crosshair.crosshairElement.style.borderColor = '#FFD700'; // Gold color for harpoon
        } else {
            console.warn('Crosshair or crosshairElement is undefined');
        }
    }

    onExecute(targetPosition) {
        console.log('Harpoon Shot Executed at:', targetPosition);

        // Get harpoon firing position (from front of boat)
        this.firingPosition = this.getHarpoonFiringPosition();

        // Calculate direction from firing position to target
        const direction = new THREE.Vector3().subVectors(targetPosition, this.firingPosition);
        direction.normalize();
        console.log("Firing direction:", direction);

        // Create and fire the harpoon
        this.fireHarpoon(this.firingPosition, direction, targetPosition);
    }

    onCancel() {
        console.log('Harpoon Shot Canceled');
        // If we implement a way to detach the harpoon manually, it would go here
    }

    update(deltaTime) {
        // Update the harpoon line if attached
        if (this.isAttached && this.harpoon && this.harpoonLine) {
            // Update the line's start position (should follow the boat)
            const startPos = this.getHarpoonFiringPosition();
            this.updateHarpoonLine(startPos, this.harpoon.position);

            // If attached to an enemy, update position to follow enemy
            if (this.attachedEnemy) {
                this.harpoon.position.copy(this.attachedEnemy.mesh.position);
            }
        }
    }

    getHarpoonFiringPosition() {
        // Convert local boat position to world position
        const worldPosition = new THREE.Vector3(
            this.harpoonPosition.x,
            this.harpoonPosition.y,
            this.harpoonPosition.z
        ).applyMatrix4(boat.matrixWorld);

        return worldPosition;
    }

    fireHarpoon(position, direction, targetPosition) {
        // Create harpoon mesh
        const harpoonLength = 1.5;
        const harpoonGeometry = new THREE.ConeGeometry(0.2, harpoonLength, 8);
        const harpoonMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
        this.harpoon = new THREE.Mesh(harpoonGeometry, harpoonMaterial);

        // Position and orient the harpoon
        this.harpoon.position.copy(position);
        this.harpoon.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), // Default cone points up
            direction
        );

        // Add to scene
        scene.add(this.harpoon);

        // Create the harpoon line
        this.createHarpoonLine(position, position);

        // Calculate target distance
        const targetDistance = position.distanceTo(targetPosition);
        console.log("Target distance:", targetDistance);

        // Animate the harpoon
        const startTime = getTime();
        const maxDistance = 150; // Maximum travel distance
        const initialPosition = position.clone();
        let verticalVelocity = 0; // Simple vertical velocity, starts at 0

        const animateHarpoon = () => {
            if (!this.harpoon) return; // Safety check

            const elapsedTime = (getTime() - startTime) / 1000;
            console.log("Harpoon elapsed time:", elapsedTime, "seconds");

            if (this.isAttached) {
                // Harpoon is attached, stop animation
                return;
            }

            // Move harpoon
            const distanceTraveled = this.harpoon.position.distanceTo(initialPosition);
            if (distanceTraveled > maxDistance) {
                console.log("Harpoon reached max distance. Will remove in 1 second.");
                // Add a 1 second delay before removing
                setTimeout(() => this.removeHarpoon(), 1000);
                return;
            }

            // Move the harpoon along direction
            const moveStep = this.harpoonSpeed * 0.16;
            this.harpoon.position.add(direction.clone().multiplyScalar(moveStep));

            // Apply very simple gravity
            verticalVelocity -= this.gravity * 0.16; // Increase downward velocity each frame
            this.harpoon.position.y += verticalVelocity; // Apply vertical velocity to position

            // Update the line
            this.updateHarpoonLine(this.getHarpoonFiringPosition(), this.harpoon.position);

            // Check for enemy collisions
            this.checkEnemyCollisions();

            // Check for water collision
            if (this.harpoon.position.y <= 0) {
                console.log("Harpoon hit water. Will remove in 1 second.");
                // Add a 1 second delay before removing
                setTimeout(() => this.removeHarpoon(), 1000);
                return;
            }

            // Continue animation if not attached
            if (!this.isAttached) {
                requestAnimationFrame(animateHarpoon);
            }
        };

        // Start animation
        requestAnimationFrame(animateHarpoon);
    }

    createHarpoonLine(startPos, endPos) {
        // Create line geometry
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,
            linewidth: 2 // Note: line width may not work on all renderers
        });

        // Set line points
        const points = [
            new THREE.Vector3(startPos.x, startPos.y, startPos.z),
            new THREE.Vector3(endPos.x, endPos.y, endPos.z)
        ];
        lineGeometry.setFromPoints(points);

        // Create line and add to scene
        this.harpoonLine = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(this.harpoonLine);
    }

    updateHarpoonLine(startPos, endPos) {
        if (!this.harpoonLine) return;

        // Update line positions
        const positions = this.harpoonLine.geometry.attributes.position.array;

        // Start point
        positions[0] = startPos.x;
        positions[1] = startPos.y;
        positions[2] = startPos.z;

        // End point
        positions[3] = endPos.x;
        positions[4] = endPos.y;
        positions[5] = endPos.z;

        // Flag the attribute for update
        this.harpoonLine.geometry.attributes.position.needsUpdate = true;
    }

    checkEnemyCollisions() {
        if (!this.harpoon || this.isAttached) return;

        // Get monsters from seaMonsters.js
        const monsters = getMonsters();

        if (monsters && monsters.length > 0) {
            for (const monster of monsters) {
                // Simple distance-based collision check
                const distanceToEnemy = this.harpoon.position.distanceTo(monster.mesh.position);
                const collisionThreshold = 10; // Adjust based on monster size

                if (distanceToEnemy < collisionThreshold) {
                    console.log("Harpoon hit monster:", monster);
                    this.attachToEnemy(monster);

                    // Flash the monster red to indicate it was hit
                    flashMonsterRed(monster, true);

                    break;
                }
            }
        }
    }

    attachToEnemy(enemy) {
        this.isAttached = true;
        this.attachedEnemy = enemy;

        // Position harpoon at enemy center
        this.harpoon.position.copy(enemy.mesh.position);

        console.log("Harpoon attached to enemy!");

        // Indicate visually that we're attached (e.g., change color)
        if (this.harpoon.material) {
            this.harpoon.material.color.set(0xff0000); // Red when attached
        }

        // Change line color to indicate tension
        if (this.harpoonLine.material) {
            this.harpoonLine.material.color.set(0xff8800); // Orange for tension
            this.harpoonLine.material.linewidth = 3; // Thicker line when attached
        }
    }

    removeHarpoon() {
        // Clean up harpoon and line
        if (this.harpoon) {
            scene.remove(this.harpoon);
            this.harpoon.geometry.dispose();
            this.harpoon.material.dispose();
            this.harpoon = null;
        }

        if (this.harpoonLine) {
            scene.remove(this.harpoonLine);
            this.harpoonLine.geometry.dispose();
            this.harpoonLine.material.dispose();
            this.harpoonLine = null;
        }

        this.isAttached = false;
        this.attachedEnemy = null;
    }
}

export default HarpoonShot; 