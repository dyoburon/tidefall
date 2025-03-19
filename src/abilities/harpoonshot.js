import * as THREE from 'three';
import { boat, scene, getTime } from '../core/gameState.js';
import { flashMonsterRed } from '../entities/seaMonsters.js';
import { getAllMonsters } from '../entities/monsterManager.js';
import {
    registerHarpoonProjectile,
    checkHarpoonCollisions,
    attachHarpoonToMonster,
    detachHarpoon,
    updateHarpoons,
    activeHarpoons
} from './harpoonDamageSystem.js';

/**
 * Harpoon Shot ability - Fires a harpoon that can attach to monsters and reel them in.
 */
class HarpoonShot {
    constructor() {
        this.id = 'harpoonShot';
        this.name = 'Harpoon Shot';
        this.canCancel = true;
        this.staysActiveAfterExecution = true; // Keep active while harpoon is attached
        this.harpoonSpeed = 35;
        this.gravity = 0.3; // Very small gravity value to start with

        // Track the harpoon state
        this.harpoon = null;
        this.harpoonLine = null;
        this.attachedEnemy = null;
        this.firingPosition = null;
        this.isAttached = false;
        this.isReeling = false;  // Track if we're reeling in the harpoon
        this.isPersisting = false; // Track if harpoon is in persistence state
        this.isReset = true; // Track if harpoon is in ready state

        // Unique ID for this harpoon instance
        this.harpoonId = null;

        // Reeling speed (units per second)
        this.reelingSpeed = 30;

        // Monster pull speed (slower than harpoon reeling)
        this.monsterPullSpeed = 20;

        // Fixed position on the boat front where the harpoon is fired from
        this.harpoonPosition = { x: 0, y: 2, z: -4 }; // Front of boat

        // Make sure this ability is updated even when not active
        this.alwaysUpdate = true;

        // Flag to help with background execution
        this.isExecuting = false;

        // Line thickness
        this.lineThickness = 0.1;
    }

    onAimStart(crosshair) {
        // Change crosshair color/shape for harpoon
        if (crosshair && crosshair.crosshairElement) {
            crosshair.crosshairElement.style.borderColor = '#FFD700'; // Gold color for harpoon
        }
    }

    onExecute(targetPosition) {
        // If we're already reeling, don't fire again
        if (this.isReeling) return true;

        // If harpoon is already fired but not reeling, start reeling instead of firing again
        if (this.harpoon && !this.isReset) {
            this.startReeling();
            return true;
        }

        // Get harpoon firing position (from front of boat)
        this.firingPosition = this.getHarpoonFiringPosition();

        // Calculate direction from firing position to target
        const direction = new THREE.Vector3().subVectors(targetPosition, this.firingPosition);
        direction.normalize();

        // Create and fire the harpoon
        this.fireHarpoon(this.firingPosition, direction, targetPosition);

        // Mark as executing - this helps with background tracking
        this.isExecuting = true;
        this.isReset = false;

        return true;
    }

    onCancel() {
        // Only do something if harpoon exists and we're not already reeling
        if (!this.harpoon || this.isReeling) return true;

        // Start reeling in the harpoon
        if (this.isAttached || this.isPersisting) {
            this.startReeling();
        }

        return false; // Don't fully cancel yet - wait until reeling is complete
    }

    update(deltaTime) {
        // IMPORTANT: Always update the harpoon line if it exists, regardless of state
        if (this.harpoonLine) {
            // Get current boat position where the harpoon is attached
            const startPos = this.getHarpoonFiringPosition();

            // Get end position (either harpoon position or attached enemy)
            let endPos;
            if (this.harpoon) {
                endPos = this.harpoon.position;
            } else {
                // If somehow harpoon is missing but line exists, use the boat position
                endPos = startPos.clone();
            }

            // Update the line EVERY frame
            this.updateHarpoonLine(startPos, endPos);

            // If attached to an enemy, update position to follow enemy
            if (this.isAttached && this.attachedEnemy) {
                this.harpoon.position.copy(this.attachedEnemy.mesh.position);
            }

            // Handle reeling in the harpoon
            if (this.isReeling && this.harpoon) {
                this.updateReeling(deltaTime);
            }
        }

        // If harpoon exists but somehow there's no line, recreate the line
        if (this.harpoon && !this.harpoonLine) {
            this.createHarpoonLine(this.getHarpoonFiringPosition(), this.harpoon.position);
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

        // Generate a unique ID for this harpoon instance
        this.harpoonId = `harpoon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // Register with the harpoon damage system
        registerHarpoonProjectile(this.harpoonId, {
            mesh: this.harpoon,
            line: this.harpoonLine,
            isReeling: this.isReeling,
            controls: {
                onAttach: (monster) => this.handleHarpoonAttached(monster),
                onDetach: () => this.handleHarpoonDetached(),
                onDamageTick: (monster) => this.handleDamageTick(monster),
                updateLineThickness: (thickness) => this.updateLineThickness(thickness)
            }
        });

        // Calculate target distance
        const targetDistance = position.distanceTo(targetPosition);

        // Animate the harpoon
        const startTime = getTime();
        const initialPosition = position.clone();
        let verticalVelocity = 0; // Simple vertical velocity, starts at 0

        const animateHarpoon = () => {
            if (!this.harpoon) return; // Safety check

            if (this.isAttached || this.isReeling) {
                // Harpoon is attached or reeling, stop animation
                return;
            }

            // Move the harpoon along direction
            const moveStep = this.harpoonSpeed * 0.16;
            this.harpoon.position.add(direction.clone().multiplyScalar(moveStep));

            // Apply very simple gravity
            verticalVelocity -= this.gravity * 0.16;
            this.harpoon.position.y += verticalVelocity;

            // Check for collision with monsters using the damage system
            const hitMonster = checkHarpoonCollisions(this.harpoonId);
            if (hitMonster) {
                attachHarpoonToMonster(this.harpoonId, hitMonster);
                return;
            }

            // Check for water collision
            if (this.harpoon.position.y <= 0) {
                this.isPersisting = true;
                this.harpoon.position.y = 0.1; // Keep slightly above water
                return;
            }

            // Continue animation unless attached
            if (!this.isAttached && !this.isReeling) {
                requestAnimationFrame(animateHarpoon);
            }
        };

        // Start animation
        requestAnimationFrame(animateHarpoon);
    }

    createHarpoonLine(startPos, endPos) {
        // First remove any existing line
        if (this.harpoonLine) {
            scene.remove(this.harpoonLine);
            if (this.harpoonLine.geometry) this.harpoonLine.geometry.dispose();
            if (this.harpoonLine.material) this.harpoonLine.material.dispose();
            this.harpoonLine = null;
        }

        // Calculate direction and length
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const length = direction.length();

        // Use the stored thickness or default
        const tubeRadius = this.lineThickness || 0.1;

        // Create a tube geometry instead of a line
        // This will be visible from all angles
        const tubeRadialSegments = 8; // Level of detail around the tube
        const path = new THREE.LineCurve3(startPos, endPos);
        const tubeGeometry = new THREE.TubeGeometry(
            path,
            1,         // Path segments - just 1 for a straight line
            tubeRadius,
            tubeRadialSegments,
            false      // Closed - false for an open tube
        );

        // Create a bright material that will be visible from all angles
        const tubeMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF4444,
            side: THREE.DoubleSide, // Important: render both sides
            transparent: true,
            opacity: 0.8
        });

        // Create the tube/rope mesh
        this.harpoonLine = new THREE.Mesh(tubeGeometry, tubeMaterial);
        this.harpoonLine.name = "HarpoonRope";

        // Add to scene
        scene.add(this.harpoonLine);
    }

    updateHarpoonLine(startPos, endPos) {
        // For tube geometry, it's easier to just recreate it
        // when the positions change rather than updating vertices
        this.createHarpoonLine(startPos, endPos);
    }

    // Callback for when the harpoon attaches to a monster through the damage system
    handleHarpoonAttached(monster) {
        this.isAttached = true;
        this.attachedEnemy = monster;

        // Position harpoon at enemy center
        if (monster && monster.mesh) {
            this.harpoon.position.copy(monster.mesh.position);
        }

        // Indicate visually that we're attached
        if (this.harpoon.material) {
            this.harpoon.material.color.set(0xff0000); // Red when attached
        }

        // Change line color to indicate tension
        if (this.harpoonLine.material) {
            this.harpoonLine.material.color.set(0xff8800); // Orange for tension
        }

        console.log(`Harpoon attached to ${monster.typeId}`);
    }

    // Callback for when the harpoon detaches
    handleHarpoonDetached() {
        // Visual indication of detachment already handled in startReeling
        console.log("Harpoon detached from monster");
    }

    // Callback for damage ticks (if implemented)
    handleDamageTick(monster) {
        console.log(`Applied damage tick to ${monster.typeId}`);
    }

    startReeling() {
        // Start reeling in the harpoon
        this.isReeling = true;

        // Update the harpoon data in the damage system to know we're reeling
        if (this.harpoonId) {
            const harpoonData = activeHarpoons.get(this.harpoonId);
            if (harpoonData) {
                harpoonData.isReeling = true;
            }
        }

        // If attached to an enemy, notify the damage system to detach
        if (this.attachedEnemy && this.harpoonId) {
            detachHarpoon(this.harpoonId);

            // But we're still keeping track of the monster to pull it
            console.log(`Starting to reel in monster: ${this.attachedEnemy.typeId}`);
        }

        // Change line color to indicate reeling
        if (this.harpoonLine && this.harpoonLine.material) {
            this.harpoonLine.material.color.set(0x00ff00); // Green when reeling
        }
    }

    updateReeling(deltaTime) {
        if (!this.harpoon || !this.isReeling) return;

        const boatPosition = this.getHarpoonFiringPosition();
        const direction = new THREE.Vector3().subVectors(boatPosition, this.harpoon.position);
        const distance = direction.length();

        // If we're close enough to the boat, remove the harpoon
        if (distance < 3) {
            this.removeHarpoon();
            return;
        }

        // Normalize direction
        direction.normalize();

        // Move the harpoon toward the boat
        const moveAmount = this.reelingSpeed * (deltaTime || 0.016);
        this.harpoon.position.add(direction.clone().multiplyScalar(moveAmount));

        // If we have an attached enemy, pull it too (but slower)
        if (this.attachedEnemy && this.attachedEnemy.mesh) {
            // Calculate pull direction toward boat
            const pullDirection = new THREE.Vector3().subVectors(boatPosition, this.attachedEnemy.mesh.position);
            const monsterDistance = pullDirection.length();

            // Don't pull if already very close to boat
            if (monsterDistance > 5) {
                pullDirection.normalize();

                // Pull monster toward boat (slower than harpoon itself)
                const monsterMoveAmount = this.monsterPullSpeed * (deltaTime || 0.016);
                this.attachedEnemy.mesh.position.add(pullDirection.multiplyScalar(monsterMoveAmount));

                // If monster has physics or collisions, update those too
                if (this.attachedEnemy.updatePhysics) {
                    this.attachedEnemy.updatePhysics();
                }
            }
        }

        // Update harpoon rotation to point along movement direction
        this.harpoon.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), // Default cone points up
            direction.clone().negate() // Point toward movement direction
        );
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
            if (this.harpoonLine.geometry) this.harpoonLine.geometry.dispose();
            if (this.harpoonLine.material) this.harpoonLine.material.dispose();
            this.harpoonLine = null;
        }

        this.isAttached = false;
        this.isReeling = false;
        this.isPersisting = false;
        this.attachedEnemy = null;
        this.harpoonId = null;

        // Mark as no longer executing
        this.isExecuting = false;
        this.isReset = true;

        // Let the AbilityManager know we're fully reset
        if (window.abilityManager) {
            window.abilityManager.notifyAbilityReset(this.id);
        }
    }

    // Convenience method to check if harpoon is in use
    isHarpoonInUse() {
        return !this.isReset;
    }

    // Utility to check if this ability should stay active in background
    shouldKeepActive() {
        return this.isExecuting && !this.isReset;
    }

    updateLineThickness(thickness) {
        // Store the current thickness for recreating the line
        this.lineThickness = thickness || 0.1;

        // Line thickness is set when creating the line, so we don't need
        // to do anything else here - the next updateHarpoonLine call will use this value
    }
}

export default HarpoonShot; 