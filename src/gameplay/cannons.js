import * as THREE from 'three';
import { scene, getTime, boat, camera } from '../core/gameState.js';
import { gameUI } from '../ui/ui.js';
import { onMonsterKilled, addToInventory } from '../core/network.js';
import { handleMonsterTreasureDrop, removeMonsterOutline } from '../entities/seaMonsters.js';
import { initCannonTargetingSystem, updateTargeting, isMonsterEffectivelyTargeted, isMonsterTargetedWithGreenLine, canHitMonster } from './cannonautosystem.js';
import { playCannonSound } from '../audio/soundEffects.js';
import { flashMonsterRed } from '../entities/seaMonsters.js';

// Cannon system configuration
const CANNON_RANGE = 100; // Maximum range for cannons
const CANNON_COOLDOWN = 0.3; // Seconds between cannon shots
const CANNON_DAMAGE = 3; // Damage per cannon hit
const CANNON_BALL_SPEED = 3; // Speed of cannonballs

// Cannon state - RENAME the boat variable to avoid shadowing
let playerBoat = null; // Renamed from 'boat' to avoid conflict
let cannonCooldown = 0;
let cannonballs = [];
let monsters = [];
let lastFiredTime = 0;
let leftCannon = null;
let rightCannon = null;
let frontCannon = null;
let targetingSystem = null;

// Initialize cannon system - Update to use the correct boat
export function initCannons(boatObject, seaMonsters) {
    playerBoat = boatObject; // Store locally for backward compatibility
    monsters = seaMonsters;

    // Find cannon meshes in the boat from gameState
    boat.traverse((child) => {
        if (child.isMesh && child.material && child.material.name === 'cannonMaterial') {
            // Determine which cannon based on position
            if (child.position.x < -2) {
                leftCannon = child;
            } else if (child.position.x > 2) {
                rightCannon = child;
            } else if (child.position.z < -8) {
                frontCannon = child;
            }
        }
    });

    // Set up event listeners for cannon UI
    gameUI.elements.cannon.fireButton.addEventListener('click', fireCannons);

    // Expose fireCannons function globally for hotkey usage
    window.fireCannons = fireCannons;

    // Initialize the targeting system with cannons
    targetingSystem = initCannonTargetingSystem(
        playerBoat,
        seaMonsters,
        { left: leftCannon, right: rightCannon, front: frontCannon },
        CANNON_RANGE
    );
}

// Update cannon system
export function updateCannons(deltaTime) {
    if (!playerBoat || !monsters) return;

    // Update cooldown
    if (cannonCooldown > 0) {
        cannonCooldown -= deltaTime;

        // Update cooldown UI
        const cooldownPercent = Math.max(0, Math.min(100, (cannonCooldown / CANNON_COOLDOWN) * 100));
        gameUI.elements.cannon.cooldown.progress.style.width = `${100 - cooldownPercent}%`;
    }

    // Check for monsters in range
    const monstersInRange = checkForMonstersInRange();

    // Update UI based on monsters in range
    if (monstersInRange > 0) {
        gameUI.elements.cannon.status.textContent = `${monstersInRange} monster${monstersInRange > 1 ? 's' : ''} in range!`;
        gameUI.elements.cannon.status.style.color = 'rgba(255, 100, 100, 1)';

        // Enable fire button if cooldown is complete
        if (cannonCooldown <= 0) {
            gameUI.elements.cannon.fireButton.disabled = false;
            gameUI.elements.cannon.fireButton.style.backgroundColor = 'rgba(255, 100, 50, 0.8)';
            gameUI.elements.cannon.fireButton.style.cursor = 'pointer';
        }
    } else {
        gameUI.elements.cannon.status.textContent = 'No targets in range';
        gameUI.elements.cannon.status.style.color = 'white';
        gameUI.elements.cannon.fireButton.disabled = true;
        gameUI.elements.cannon.fireButton.style.backgroundColor = 'rgba(100, 100, 100, 0.5)';
        gameUI.elements.cannon.fireButton.style.cursor = 'default';
    }

    // Update targeting system
    if (targetingSystem) {
        //updateTargeting(deltaTime);
    }

    // Update cannonballs
    updateCannonballs(deltaTime);
}

// Check for monsters in range
function checkForMonstersInRange() {
    if (!playerBoat || !monsters) return 0;

    let count = 0;

    monsters.forEach(monster => {
        // Only count monsters that are attacking (on the surface)
        if (monster.state === 'attacking') {
            const distance = monster.mesh.position.distanceTo(playerBoat.position);
            if (distance <= CANNON_RANGE) {
                count++;
            }
        }
    });

    return count;
}

// Fire cannons
export function fireCannons() {


    // Fire cannons from both sides of the boat simultaneously
    createSideCannons('left');
    createSideCannons('right');

    // Play sound for feedback
    playCannonSound();

    // Shake camera for feedback
    shakeCamera(1.0);
}

// Create cannons firing from a specific side of the boat
function createSideCannons(side) {
    // Calculate positions for the two cannons on this side
    const frontPosition = new THREE.Vector3();
    const rearPosition = new THREE.Vector3();

    // Set positions based on side
    if (side === 'left') {
        frontPosition.set(-3, 1.5, -3); // Left front cannon
        rearPosition.set(-3, 1.5, 3);   // Left rear cannon
    } else {
        frontPosition.set(3, 1.5, -3);  // Right front cannon
        rearPosition.set(3, 1.5, 3);    // Right rear cannon
    }

    // Convert to world positions
    frontPosition.applyMatrix4(boat.matrixWorld);
    rearPosition.applyMatrix4(boat.matrixWorld);

    // Create firing direction - straight out to the side
    const direction = new THREE.Vector3();
    if (side === 'left') {
        direction.set(-1, 0, 0); // Directly left
    } else {
        direction.set(1, 0, 0);  // Directly right
    }

    // Apply boat's rotation to the direction
    direction.applyQuaternion(boat.quaternion);

    // Create cannonballs for both positions
    createCannonballWithTrajectory(frontPosition, direction);
    createCannonballWithTrajectory(rearPosition, direction);

    // Create smoke for both cannons
    createCannonSmoke(side === 'left' ? 'leftFront' : 'rightFront');
    createCannonSmoke(side === 'left' ? 'leftRear' : 'rightRear');
}

// Create a cannonball with improved trajectory
function createCannonballWithTrajectory(position, direction) {


    // Create a more visible cannonball (but not as extreme as the debug version)
    const cannonballGeometry = new THREE.SphereGeometry(2.0, 16, 16); // Good visible size
    const cannonballMaterial = new THREE.MeshBasicMaterial({
        color: 0x222222, // Dark black ball
    });

    const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
    cannonball.position.copy(position);

    // Add to scene
    scene.add(cannonball);



    // Higher speed for longer trajectory
    const cannonballSpeed = CANNON_BALL_SPEED * 5; // Much faster

    // Add a slight upward component to the direction for a better arc
    const firingDirection = direction.clone();
    firingDirection.y += 0.1; // Slight upward angle
    firingDirection.normalize();

    // Create velocity vector
    const velocity = firingDirection.clone().multiplyScalar(cannonballSpeed);

    // Create muzzle flash at cannon position
    createMuzzleFlash(position, firingDirection);

    // Animate directly instead of using the cannonballs array
    const startTime = getTime();
    const maxDistance = 150; // Maximum distance before removal
    const initialPosition = position.clone();

    function animateCannonball() {
        // Calculate elapsed time
        const elapsedTime = (getTime() - startTime) / 1000;

        // Check if cannonball has traveled too far
        const distanceTraveled = cannonball.position.distanceTo(initialPosition);
        if (distanceTraveled > maxDistance) {

            scene.remove(cannonball);
            return;
        }

        // Apply gravity effect that increases over time
        velocity.y -= 0.12 * elapsedTime; // Progressive gravity effect

        // Move cannonball
        cannonball.position.x += velocity.x * 0.16;
        cannonball.position.y += velocity.y * 0.16;
        cannonball.position.z += velocity.z * 0.16;

        // Rotate for visual effect
        cannonball.rotation.x += 0.02;
        cannonball.rotation.z += 0.02;

        // Check for water collision
        if (cannonball.position.y <= 0) {

            createEnhancedSplashEffect(cannonball.position.clone(), 3.0); // Big splash
            scene.remove(cannonball);
            return;
        }

        requestAnimationFrame(animateCannonball);
    }

    // Start animation
    animateCannonball();
}

// Create muzzle flash at cannon position
function createMuzzleFlash(position, direction) {
    // Create muzzle flash geometry
    const flashGeometry = new THREE.SphereGeometry(1.0, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 1.0
    });

    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);

    // Move flash slightly in firing direction
    flash.position.add(direction.clone().multiplyScalar(1.0));

    scene.add(flash);

    // Animate flash
    const startTime = getTime();

    function animateFlash() {
        const elapsedTime = (getTime() - startTime) / 1000;

        if (elapsedTime > 0.2) {
            scene.remove(flash);
            return;
        }

        // Quick expansion
        const scale = 1.0 + elapsedTime * 5.0;
        flash.scale.set(scale, scale, scale);

        // Quick fade
        flash.material.opacity = 1.0 - elapsedTime * 5.0;

        requestAnimationFrame(animateFlash);
    }

    animateFlash();
}

// Create cannon fire effects
function createCannonFireEffects() {
    // Create muzzle flash and smoke for each cannon
    if (leftCannon) createCannonEffect(leftCannon);
    if (rightCannon) createCannonEffect(rightCannon);
    if (frontCannon) createCannonEffect(frontCannon);

    // Play cannon sound
    playCannonSound();
}

// Create effect for a single cannon
function createCannonEffect(cannon) {


    // Create an absolutely enormous, bright cannonball with emission properties
    const cannonballGeometry = new THREE.SphereGeometry(5.0, 32, 32); // Massive 5-unit radius
    const cannonballMaterial = new THREE.MeshBasicMaterial({ // MeshBasicMaterial doesn't need lighting
        color: 0xff00ff,  // Bright pink
        wireframe: true,  // Show wireframe for extra visibility
    });

    // Create a fixed position in front of the boat regardless of rotation
    const cannonballPosition = new THREE.Vector3();
    cannonballPosition.copy(boat.position);
    cannonballPosition.y += 10; // Place high above the boat



    const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
    cannonball.position.copy(cannonballPosition);

    // Add a large wireframe box around the cannonball to make it even more visible
    const boxGeometry = new THREE.BoxGeometry(8, 8, 8);
    const boxMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true
    });
    const boxHelper = new THREE.Mesh(boxGeometry, boxMaterial);
    cannonball.add(boxHelper);

    // Make sure it's not prematurely removed
    cannonball.userData.isCannonball = true;

    // Add to the scene via boat.parent to ensure it's in the same scene
    scene.add(cannonball);




    // Static test - don't even bother with physics for now
    const duration = 5; // seconds
    const startTime = getTime();

    // Animate without using the cannonballs array for now
    function moveTestCannonball() {
        const elapsedTime = (getTime() - startTime) / 1000;

        if (elapsedTime > duration) {

            scene.remove(cannonball);
            return;
        }

        // Simple animation - move forward and downward
        cannonball.position.z -= 0.2; // Move forward
        cannonball.position.y -= 0.05; // Fall slowly

        // Rotate for visibility
        cannonball.rotation.x += 0.01;
        cannonball.rotation.y += 0.02;

        requestAnimationFrame(moveTestCannonball);
    }

    moveTestCannonball();

    // Skip the regular cannonball logic for now - focus on just making something visible
}

// Add fallback sound function in case module loading fails
function playFallbackCannonSound() {
    // Create audio context if not already created
    if (!window.audioContext) {
        try {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {

            return;
        }
    }

    // Simple oscillator for fallback
    const oscillator = window.audioContext.createOscillator();
    const gainNode = window.audioContext.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, window.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(20, window.audioContext.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.25, window.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.005, window.audioContext.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(window.audioContext.destination);

    oscillator.start();
    oscillator.stop(window.audioContext.currentTime + 0.3);
}

// Update the fireAtMonsters function to better integrate with the targeting system
function fireAtMonsters(targetsInRange) {
    // We don't need this function to calculate hits anymore, as we're now using
    // physics-based collisions in the updateCannonballs function

    // Instead, we'll just shake the camera
    shakeCamera(1.0);
}

// New helper function to create smoke for a specific side
function createSmokeForSide(side) {
    if (side === 'left') {
        createCannonSmoke('leftFront');
        createCannonSmoke('leftRear');
    } else if (side === 'right') {
        createCannonSmoke('rightFront');
        createCannonSmoke('rightRear');
    } else {
        // If side is unknown, fire all cannons
        createCannonSmoke('leftFront');
        createCannonSmoke('leftRear');
        createCannonSmoke('rightFront');
        createCannonSmoke('rightRear');
    }
}

// Add this function to create smoke for the cannons that fired at a particular monster
function createSmokeForTargetedCannons(monster) {
    if (!playerBoat || !monster) return;

    // Determine which side of the boat the monster is on
    const monsterPosition = monster.mesh.position;
    const boatPosition = playerBoat.position;

    // Create vector from boat to monster
    const toMonster = new THREE.Vector3()
        .subVectors(monsterPosition, boatPosition)
        .normalize();

    // Get boat's right vector
    const shipRight = new THREE.Vector3(1, 0, 0).applyQuaternion(playerBoat.quaternion);

    // Determine which side the monster is on by taking dot product
    const dotProduct = shipRight.dot(toMonster);

    // Generate smoke from appropriate cannons
    if (dotProduct < -0.2) {
        // Monster is on the left side - fire left cannons
        createCannonSmoke('leftFront');
        createCannonSmoke('leftRear');
    } else if (dotProduct > 0.2) {
        // Monster is on the right side - fire right cannons
        createCannonSmoke('rightFront');
        createCannonSmoke('rightRear');
    } else {
        // Monster is roughly in front or behind - fire all cannons
        createCannonSmoke('leftFront');
        createCannonSmoke('leftRear');
        createCannonSmoke('rightFront');
        createCannonSmoke('rightRear');
    }
}

// Add function to create smoke at a specific cannon position
function createCannonSmoke(cannonPosition) {
    if (!playerBoat) return;

    // Get cannon position configuration
    const positionConfig = {
        leftFront: { x: -2.5, z: -3 },
        leftRear: { x: -2.5, z: 3 },
        rightFront: { x: 2.5, z: -3 },
        rightRear: { x: 2.5, z: 3 }
    }[cannonPosition];

    if (!positionConfig) return;

    // Create cannon position in world space
    const cannonWorldPosition = new THREE.Vector3(
        positionConfig.x,
        1.5, // Height above deck
        positionConfig.z
    );

    // Apply boat's transformation to get world position
    cannonWorldPosition.applyMatrix4(playerBoat.matrixWorld);

    // Calculate cannon direction based on position
    const cannonDirection = new THREE.Vector3();
    if (positionConfig.x < 0) {
        // Left cannons fire left
        cannonDirection.set(-0.7, 0, positionConfig.z < 0 ? -0.7 : 0.7);
    } else {
        // Right cannons fire right
        cannonDirection.set(0.7, 0, positionConfig.z < 0 ? -0.7 : 0.7);
    }
    cannonDirection.applyQuaternion(playerBoat.quaternion);

    // ENHANCED: Significantly more smoke particles
    const smokeCount = 45; // Tripled from 15

    // Multiple smoke geometry sizes for more variety
    const smokeGeometries = [
        new THREE.SphereGeometry(0.4, 8, 8),  // Small
        new THREE.SphereGeometry(0.6, 8, 8),  // Medium
        new THREE.SphereGeometry(0.8, 8, 8)   // Large
    ];

    // Create initial blast cloud (larger puff at firing point)
    const blastGeometry = new THREE.SphereGeometry(1.0, 10, 10);
    const blastMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.9, 0.8, 0.6), // Yellowish for initial blast
        transparent: true,
        opacity: 0.9
    });

    const blastCloud = new THREE.Mesh(blastGeometry, blastMaterial);
    blastCloud.position.copy(cannonWorldPosition);
    blastCloud.position.add(cannonDirection.clone().multiplyScalar(1.2));
    scene.add(blastCloud);

    // Animate blast cloud
    const blastStartTime = getTime();
    function animateBlast() {
        const elapsed = (getTime() - blastStartTime) / 1000;

        if (elapsed > 0.4) {
            scene.remove(blastCloud);
            blastCloud.geometry.dispose();
            blastCloud.material.dispose();
            return;
        }

        // Quick expansion
        const scale = 1 + elapsed * 8;
        blastCloud.scale.set(scale, scale, scale);

        // Fade quickly
        blastCloud.material.opacity = 0.9 * (1 - elapsed / 0.4);

        requestAnimationFrame(animateBlast);
    }
    animateBlast();

    // Create main smoke particles
    for (let i = 0; i < smokeCount; i++) {
        // Vary smoke color from dark grey to light grey
        const brightness = 0.3 + Math.random() * 0.4; // 0.3-0.7 range
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(brightness, brightness, brightness),
            transparent: true,
            opacity: 0.8 + Math.random() * 0.2
        });

        // Randomly select a geometry size
        const geometryIndex = Math.floor(Math.random() * smokeGeometries.length);
        const smoke = new THREE.Mesh(smokeGeometries[geometryIndex], smokeMaterial);

        // Position smoke at end of cannon with wider randomization
        const smokePosition = cannonWorldPosition.clone();
        smokePosition.add(
            cannonDirection.clone()
                .multiplyScalar(1.0 + Math.random() * 1.0) // Position from cannon barrel
        );

        // Add more random offset for a wider cloud
        smokePosition.x += (Math.random() - 0.5) * 1.0;
        smokePosition.y += (Math.random() - 0.5) * 0.8;
        smokePosition.z += (Math.random() - 0.5) * 1.0;

        smoke.position.copy(smokePosition);

        // Random velocity - more varied
        const smokeVelocity = cannonDirection.clone().multiplyScalar(0.2 + Math.random() * 0.8);
        smokeVelocity.x += (Math.random() - 0.5) * 0.7;
        smokeVelocity.y += 0.6 + Math.random() * 1.2; // Stronger upward component
        smokeVelocity.z += (Math.random() - 0.5) * 0.7;

        // Add to scene
        scene.add(smoke);

        // Longer duration for smoke
        const smokeStartTime = getTime();
        const smokeDuration = 2.5 + Math.random() * 2.0; // 2.5-4.5 seconds

        function animateSmoke() {
            const smokeElapsedTime = (getTime() - smokeStartTime) / 1000;

            if (smokeElapsedTime > smokeDuration) {
                scene.remove(smoke);
                smoke.geometry.dispose();
                smoke.material.dispose();
                return;
            }

            // Move smoke with varied speed
            smoke.position.add(smokeVelocity.clone().multiplyScalar(0.06));

            // Slow down over time (air resistance)
            smokeVelocity.multiplyScalar(0.98);

            // More pronounced wind effect
            const windEffect = Math.sin(getTime() * 0.001 + smoke.position.x * 0.1) * 0.006;
            smoke.position.x += windEffect;
            smoke.position.z += windEffect * 0.5;

            // Fade out gradually, then more rapidly at the end
            const normalizedTime = smokeElapsedTime / smokeDuration;
            if (normalizedTime < 0.7) {
                // Slow fade for first 70% of lifetime
                smoke.material.opacity = 1.0 - normalizedTime * 0.3;
            } else {
                // Faster fade for last 30%
                smoke.material.opacity = 0.79 - (normalizedTime - 0.7) * 2.5;
            }

            // Expand smoke over time - more dramatic expansion
            const scale = 1 + smokeElapsedTime * (1.0 + Math.random() * 0.5);
            smoke.scale.set(scale, scale, scale);

            requestAnimationFrame(animateSmoke);
        }

        animateSmoke();
    }

    // Shake the camera when firing cannons
    shakeCamera(0.8); // Intensity parameter
}

// Add new camera shake function
function shakeCamera(intensity = 1.0) {
    if (!camera) return;

    // Store original camera position
    const originalPosition = camera.position.clone();

    // Shake parameters
    const duration = 0.5; // seconds
    const startTime = getTime();
    let lastShakeTime = startTime;
    const shakeInterval = 0.03; // seconds between position changes

    function updateShake() {
        const elapsedTime = (getTime() - startTime) / 1000;
        const currentTime = getTime();

        // Stop shaking after duration
        if (elapsedTime >= duration) {
            // Make sure camera returns to original position
            camera.position.copy(originalPosition);
            return;
        }

        // Apply random offset to camera position at intervals
        if (currentTime - lastShakeTime > shakeInterval * 1000) {
            lastShakeTime = currentTime;

            // Diminishing intensity over time
            const currentIntensity = intensity * (1 - elapsedTime / duration);

            // Random offsets based on intensity
            const offsetX = (Math.random() - 0.5) * currentIntensity * 0.5;
            const offsetY = (Math.random() - 0.5) * currentIntensity * 0.5;
            const offsetZ = (Math.random() - 0.5) * currentIntensity * 0.3;

            // Apply offsets to camera
            camera.position.set(
                originalPosition.x + offsetX,
                originalPosition.y + offsetY,
                originalPosition.z + offsetZ
            );
        }

        requestAnimationFrame(updateShake);
    }

    updateShake();
}

// Move the hit monster function to module level (not nested inside updateCannonballs)
function hitMonster(monster, hasGreenLine = false, damage = CANNON_DAMAGE) {
    // Apply damage
    if (!monster.health) monster.health = 10; // Default health if not set
    monster.health -= damage;

    // Create hit effect
    createHitEffect(monster.mesh.position);

    // Make monster flash red - with more intensity if it had a green targeting line
    flashMonsterRed(monster, hasGreenLine);

    // Check if monster is defeated
    if (monster.health <= 0) {
        // Remove the outline first before death animation
        removeMonsterOutline(monster);

        // Create treasure drop before monster disappears
        handleMonsterTreasureDrop(monster);

        // Add treasure to player's inventory
        const treasureType = monster.type || 'common'; // Use monster type if available
        const treasureValue = monster.value || 5; // Default value if not specified
        const treasureColor = monster.color || 0xFFD700; // Default gold color

        // Add to player's inventory using the network system
        addToInventory({
            item_type: 'treasure',
            item_name: `${treasureType.charAt(0).toUpperCase() + treasureType.slice(1)} Treasure`,
            item_data: {
                value: treasureValue,
                color: treasureColor,
                description: `Treasure from defeated ${treasureType} sea monster`
            }
        });

        // Monster is defeated, make it dive and eventually remove it
        monster.state = 'dying';
        monster.stateTimer = 3; // Time for death animation
        monster.velocity.y = -0.2; // Start sinking

        // Create a more dramatic death effect
        createMonsterDeathEffect(monster.mesh.position);

        onMonsterKilled(1);

        // Play death sound
        playMonsterDeathSound();

        // Schedule removal after animation
        setTimeout(() => {
            if (monster.mesh && monster.mesh.parent) {
                scene.remove(monster.mesh);
                // Remove from monsters array
                const index = monsters.indexOf(monster);
                if (index > -1) {
                    monsters.splice(index, 1);
                }
            }
        }, 3000);
    } else {
        // Monster is hit but not defeated, make it move away temporarily
        const directionFromBoat = new THREE.Vector3()
            .subVectors(monster.mesh.position, playerBoat.position)
            .normalize();

        // Set velocity away from boat (faster retreat)
        monster.velocity.copy(directionFromBoat.multiplyScalar(1.2));
    }
}

// Create hit effect
function createHitEffect(position) {
    // Create explosion effect
    const explosionGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.8
    });

    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(position);

    scene.add(explosion);

    // Animate explosion
    const startTime = getTime();

    function animateExplosion() {
        const elapsedTime = (getTime() - startTime) / 1000;

        if (elapsedTime > 0.5) {
            scene.remove(explosion);
            return;
        }

        // Fade out
        explosion.material.opacity = 0.8 * (1 - elapsedTime / 0.5);

        // Expand
        explosion.scale.set(1 + elapsedTime * 5, 1 + elapsedTime * 5, 1 + elapsedTime * 5);

        requestAnimationFrame(animateExplosion);
    }

    animateExplosion();

    // Create splash particles
    const splashCount = 15;
    const splashGeometry = new THREE.SphereGeometry(0.2, 4, 4);
    const splashMaterial = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.7
    });

    for (let i = 0; i < splashCount; i++) {
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.copy(position);

        // Random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2 + 1,
            (Math.random() - 0.5) * 2
        );

        scene.add(splash);

        // Animate splash
        const splashStartTime = getTime();

        function animateSplash() {
            const splashElapsedTime = (getTime() - splashStartTime) / 1000;

            if (splashElapsedTime > 1) {
                scene.remove(splash);
                return;
            }

            // Apply gravity
            velocity.y -= 0.1;

            // Move splash
            splash.position.add(velocity.clone().multiplyScalar(0.1));

            // Fade out
            splash.material.opacity = 0.7 * (1 - splashElapsedTime);

            requestAnimationFrame(animateSplash);
        }

        animateSplash();
    }
}

// Move this function to module level - not nested inside another function
export function createMonsterDeathEffect(position) {
    // Create explosion effect
    const explosionGeometry = new THREE.SphereGeometry(2, 16, 16);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.8
    });

    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(position);
    scene.add(explosion);

    // Animate explosion
    const startTime = getTime();

    function animateExplosion() {
        const elapsedTime = (getTime() - startTime) / 1000;

        if (elapsedTime > 1.5) {
            scene.remove(explosion);
            return;
        }

        // Fade out
        explosion.material.opacity = 0.8 * (1 - elapsedTime / 1.5);

        // Expand
        explosion.scale.set(1 + elapsedTime * 8, 1 + elapsedTime * 8, 1 + elapsedTime * 8);

        requestAnimationFrame(animateExplosion);
    }

    animateExplosion();

    // Create debris particles
    const debrisCount = 30;
    const debrisGeometries = [
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.TetrahedronGeometry(0.4)
    ];

    const debrisMaterials = [
        new THREE.MeshBasicMaterial({ color: 0x225588 }),
        new THREE.MeshBasicMaterial({ color: 0x336699 }),
        new THREE.MeshBasicMaterial({ color: 0x88aacc })
    ];

    for (let i = 0; i < debrisCount; i++) {
        const geometryIndex = Math.floor(Math.random() * debrisGeometries.length);
        const materialIndex = Math.floor(Math.random() * debrisMaterials.length);

        const debris = new THREE.Mesh(
            debrisGeometries[geometryIndex],
            debrisMaterials[materialIndex].clone()
        );

        debris.material.transparent = true;
        debris.position.copy(position);

        // Random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 3 + 1,
            (Math.random() - 0.5) * 3
        );

        scene.add(debris);

        // Animate debris
        const debrisStartTime = getTime();

        function animateDebris() {
            const debrisElapsedTime = (getTime() - debrisStartTime) / 1000;

            if (debrisElapsedTime > 2) {
                scene.remove(debris);
                return;
            }

            // Apply gravity
            velocity.y -= 0.15;

            // Move debris
            debris.position.add(velocity.clone().multiplyScalar(0.1));

            // Rotate debris
            debris.rotation.x += 0.1;
            debris.rotation.y += 0.15;

            // Fade out
            debris.material.opacity = 1 * (1 - debrisElapsedTime / 2);

            requestAnimationFrame(animateDebris);
        }

        animateDebris();
    }

    // Create large splash
    createLargeSplashEffect(position);
}

// Create a larger splash effect
function createLargeSplashEffect(position) {
    // Ensure y position is at water level
    const splashPosition = position.clone();
    splashPosition.y = 0;

    // Create splash particles
    const splashCount = 40;
    const splashGeometry = new THREE.SphereGeometry(0.4, 4, 4);
    const splashMaterial = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < splashCount; i++) {
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.copy(splashPosition);

        // Random velocity - higher and wider than normal splash
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 4 + 2,
            (Math.random() - 0.5) * 3
        );

        scene.add(splash);

        // Animate splash
        const startTime = getTime();

        function animateSplash() {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime > 1.5) {
                scene.remove(splash);
                return;
            }

            // Apply gravity
            velocity.y -= 0.15;

            // Move splash
            splash.position.add(velocity.clone().multiplyScalar(0.1));

            // Fade out
            splash.material.opacity = 0.8 * (1 - elapsedTime / 1.5);

            requestAnimationFrame(animateSplash);
        }

        animateSplash();
    }

    // Create ripple effect on water
    const rippleGeometry = new THREE.RingGeometry(0.5, 5, 32);
    const rippleMaterial = new THREE.MeshBasicMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });

    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.rotation.x = -Math.PI / 2; // Flat on water
    ripple.position.copy(splashPosition);
    ripple.position.y = 0.1; // Just above water

    scene.add(ripple);

    // Animate ripple
    const rippleStartTime = getTime();

    function animateRipple() {
        const rippleElapsedTime = (getTime() - rippleStartTime) / 1000;

        if (rippleElapsedTime > 2) {
            scene.remove(ripple);
            return;
        }

        // Expand ripple
        const scale = 1 + rippleElapsedTime * 5;
        ripple.scale.set(scale, scale, 1);

        // Fade out
        ripple.material.opacity = 0.6 * (1 - rippleElapsedTime / 2);

        requestAnimationFrame(animateRipple);
    }

    animateRipple();
}

// Add a simple sound function (you can enhance this with actual audio)
function playMonsterDeathSound() {
    // If you have an audio system, play a death sound here
    //
}

// Update cannonballs with more dramatic physics
function updateCannonballs(deltaTime) {
    const gravity = 0.005; // Much reduced gravity for testing

    for (let i = cannonballs.length - 1; i >= 0; i--) {
        const cannonball = cannonballs[i];

        // Move cannonball with simpler physics for debugging
        cannonball.mesh.position.add(
            cannonball.velocity.clone().multiplyScalar(deltaTime * 30) // Slowed down
        );

        // Apply reduced gravity
        cannonball.velocity.y -= gravity * deltaTime * 60;

        // Update lifetime check
        const lifetime = (getTime() - cannonball.startTime) / 1000;
        if (lifetime > 10) { // Extended lifetime

            scene.remove(cannonball.mesh);
            cannonballs.splice(i, 1);
            continue;
        }

        // Simplified water collision
        if (cannonball.mesh.position.y <= 0) {

            createEnhancedSplashEffect(cannonball.mesh.position.clone(), 2.0); // Bigger splash
            scene.remove(cannonball.mesh);
            cannonballs.splice(i, 1);
        }
    }
}

// Create enhanced splash effect
function createEnhancedSplashEffect(position, intensity = 1.0) {
    // Ensure y position is at water level
    position.y = 0;

    // Base number of splash particles on intensity
    const splashCount = Math.round(10 * intensity);

    // Create splash column (vertical water spout)
    const columnGeometry = new THREE.CylinderGeometry(0.1, 0.6, intensity * 2, 8);
    const columnMaterial = new THREE.MeshBasicMaterial({
        color: 0xAACCFF,
        transparent: true,
        opacity: 0.7
    });

    const column = new THREE.Mesh(columnGeometry, columnMaterial);
    column.position.copy(position);
    column.position.y += intensity; // Center above water
    scene.add(column);

    // Animate water column
    const columnStartTime = getTime();
    const columnDuration = 0.5;

    function animateColumn() {
        const elapsedTime = (getTime() - columnStartTime) / 1000;

        if (elapsedTime > columnDuration) {
            scene.remove(column);
            column.geometry.dispose();
            column.material.dispose();
            return;
        }

        const progress = elapsedTime / columnDuration;
        column.scale.y = 1 + progress * 2; // Get taller
        column.position.y = intensity * (1 - progress * 0.5); // Slight sink
        column.material.opacity = 0.7 * (1 - progress);

        requestAnimationFrame(animateColumn);
    }

    animateColumn();

    // Create splash particles
    const splashGeometry = new THREE.SphereGeometry(0.2 * intensity, 4, 4);
    const splashMaterial = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.7
    });

    for (let i = 0; i < splashCount; i++) {
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.copy(position);
        splash.position.y += 0.1; // Start slightly above water

        // Random velocity - based on intensity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5 * intensity,
            (Math.random() * 1.5 + 1.0) * intensity,
            (Math.random() - 0.5) * 1.5 * intensity
        );

        scene.add(splash);

        // Animate splash
        const startTime = getTime();
        const splashDuration = 1 + Math.random() * 0.5;

        function animateSplash() {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime > splashDuration) {
                scene.remove(splash);
                splash.geometry.dispose();
                splash.material.dispose();
                return;
            }

            // Apply gravity
            velocity.y -= 0.1 * intensity;

            // Move splash
            splash.position.add(velocity.clone().multiplyScalar(0.1));

            // If below water and moving down, create a tiny secondary splash and remove
            if (splash.position.y <= 0 && velocity.y < 0) {
                splash.position.y = 0; // Set at water level
                velocity.y = Math.abs(velocity.y) * 0.3; // Bounce with reduced velocity

                // Reduce opacity for "disappearing" effect
                splash.material.opacity *= 0.7;
            }

            // Fade out
            splash.material.opacity = 0.7 * (1 - elapsedTime / splashDuration);

            requestAnimationFrame(animateSplash);
        }

        animateSplash();
    }

    // Create ripple effect on water
    const rippleGeometry = new THREE.RingGeometry(0.2, 2 * intensity, 32);
    const rippleMaterial = new THREE.MeshBasicMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });

    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.rotation.x = -Math.PI / 2; // Flat on water
    ripple.position.copy(position);
    ripple.position.y = 0.05; // Just above water
    scene.add(ripple);

    // Animate ripple
    const rippleStartTime = getTime();
    const rippleDuration = 1.0 * intensity;

    function animateRipple() {
        const rippleElapsedTime = (getTime() - rippleStartTime) / 1000;

        if (rippleElapsedTime > rippleDuration) {
            scene.remove(ripple);
            ripple.geometry.dispose();
            ripple.material.dispose();
            return;
        }

        // Expand ripple
        const scale = 1 + rippleElapsedTime * 5 * intensity;
        ripple.scale.set(scale, scale, 1);

        // Fade out
        ripple.material.opacity = 0.6 * (1 - rippleElapsedTime / rippleDuration);

        requestAnimationFrame(animateRipple);
    }

    animateRipple();
} 