import * as THREE from 'three';
import { scene, getTime } from '../core/gameState.js';
import { gameUI } from '../ui/ui.js';
import { onMonsterKilled, addToInventory } from '../core/network.js';
import { handleMonsterTreasureDrop, removeMonsterOutline } from '../entities/seaMonsters.js';
import { initCannonTargetingSystem, updateTargeting, isMonsterEffectivelyTargeted, isMonsterTargetedWithGreenLine } from './cannonautosystem.js';
import { playCannonSound } from '../audio/soundEffects.js';
import { flashMonsterRed } from '../entities/seaMonsters.js';

// Cannon system configuration
const CANNON_RANGE = 100; // Maximum range for cannons
const CANNON_COOLDOWN = 0.3; // Seconds between cannon shots
const CANNON_DAMAGE = 3; // Damage per cannon hit
const CANNON_BALL_SPEED = 3; // Speed of cannonballs

// Cannon state
let boat = null;
let cannonCooldown = 0;
let cannonballs = [];
let monsters = [];
let lastFiredTime = 0;
let leftCannon = null;
let rightCannon = null;
let frontCannon = null;
let targetingSystem = null;

// Initialize cannon system
export function initCannons(playerBoat, seaMonsters) {
    boat = playerBoat;
    monsters = seaMonsters;

    // Find cannon meshes in the boat
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
    if (!boat || !monsters) return;

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
        updateTargeting(deltaTime);
    }

    // Update cannonballs
    updateCannonballs(deltaTime);
}

// Check for monsters in range
function checkForMonstersInRange() {
    if (!boat || !monsters) return 0;

    let count = 0;

    monsters.forEach(monster => {
        // Only count monsters that are attacking (on the surface)
        if (monster.state === 'attacking') {
            const distance = monster.mesh.position.distanceTo(boat.position);
            if (distance <= CANNON_RANGE) {
                count++;
            }
        }
    });

    return count;
}

// Fire cannons
export function fireCannons() {
    if (cannonCooldown > 0) return;

    // Set cooldown
    cannonCooldown = CANNON_COOLDOWN;
    lastFiredTime = getTime();

    // Disable fire button during cooldown
    gameUI.elements.cannon.fireButton.disabled = true;
    gameUI.elements.cannon.fireButton.style.backgroundColor = 'rgba(100, 100, 100, 0.5)';
    gameUI.elements.cannon.fireButton.style.cursor = 'default';

    // Reset cooldown UI
    gameUI.elements.cannon.cooldown.progress.style.width = '0%';

    // Get current targeting data if needed
    if (targetingSystem) {
        const targets = targetingSystem.getTargets();

        // This could be used to adjust firing accuracy based on how well-aimed the cannons are
        // For example, monsters closer to the aim point would be more likely to be hit
    }

    // Find monsters in range
    const targetsInRange = [];

    monsters.forEach(monster => {
        if (monster.state === 'attacking') {
            const distance = monster.mesh.position.distanceTo(boat.position);
            if (distance <= CANNON_RANGE) {
                targetsInRange.push(monster);
            }
        }
    });

    if (targetsInRange.length === 0) return;

    // Create cannon fire effects
    createCannonFireEffects();

    // Fire at monsters
    fireAtMonsters(targetsInRange);
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
    // Get cannon direction
    const cannonDirection = new THREE.Vector3(0, 0, 1);
    cannonDirection.applyQuaternion(cannon.quaternion);

    // Create muzzle flash
    const flashGeometry = new THREE.SphereGeometry(0.7, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });

    const flash = new THREE.Mesh(flashGeometry, flashMaterial);

    // Position flash at end of cannon
    const flashPosition = cannon.position.clone();
    flashPosition.add(cannonDirection.clone().multiplyScalar(1.2));
    flash.position.copy(flashPosition);

    // Add to scene
    //scene.add(flash);

    // Animate flash
    const startTime = getTime();

    function animateFlash() {
        const elapsedTime = (getTime() - startTime) / 1000;

        if (elapsedTime > 0.2) {
            scene.remove(flash);
            return;
        }

        // Fade out
        flash.material.opacity = 0.8 * (1 - elapsedTime / 0.2);

        // Expand slightly
        flash.scale.set(1 + elapsedTime * 2, 1 + elapsedTime * 2, 1 + elapsedTime * 2);

        requestAnimationFrame(animateFlash);
    }

    animateFlash();

    // Create smoke
    const smokeCount = 10;
    const smokeGeometry = new THREE.SphereGeometry(0.5, 6, 6);
    const smokeMaterial = new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.6
    });

    for (let i = 0; i < smokeCount; i++) {
        const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);

        // Position smoke at end of cannon
        smoke.position.copy(flashPosition);

        // Random velocity in general direction of cannon plus upward
        const smokeVelocity = cannonDirection.clone().multiplyScalar(0.5 + Math.random() * 0.5);
        smokeVelocity.x += (Math.random() - 0.5) * 0.5;
        smokeVelocity.y += Math.random() * 0.5;
        smokeVelocity.z += (Math.random() - 0.5) * 0.5;

        //scene.add(smoke);

        // Animate smoke
        const smokeStartTime = getTime();

        function animateSmoke() {
            const smokeElapsedTime = (getTime() - smokeStartTime) / 1000;

            if (smokeElapsedTime > 2) {
                scene.remove(smoke);
                return;
            }

            // Move smoke
            smoke.position.add(smokeVelocity.clone().multiplyScalar(0.05));

            // Slow down over time
            smokeVelocity.multiplyScalar(0.98);

            // Fade out
            smoke.material.opacity = 0.6 * (1 - smokeElapsedTime / 2);

            // Expand
            smoke.scale.set(1 + smokeElapsedTime, 1 + smokeElapsedTime, 1 + smokeElapsedTime);

            requestAnimationFrame(animateSmoke);
        }

        animateSmoke();
    }

    // Create cannonball
    const cannonballGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const cannonballMaterial = new THREE.MeshPhongMaterial({
        color: 0x111111,
        specular: 0x333333,
        shininess: 30
    });

    const cannonball = new THREE.Mesh(cannonballGeometry, cannonballMaterial);
    cannonball.position.copy(flashPosition);

    //scene.add(cannonball);

    // Add to cannonballs array
    cannonballs.push({
        mesh: cannonball,
        velocity: cannonDirection.clone().multiplyScalar(CANNON_BALL_SPEED),
        startTime: getTime()
    });
}

// Add fallback sound function in case module loading fails
function playFallbackCannonSound() {
    // Create audio context if not already created
    if (!window.audioContext) {
        try {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported in this browser');
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

// Fire at monsters
function fireAtMonsters(targets) {
    // For each target, calculate hit probability based on distance AND targeting
    targets.forEach(monster => {
        const distance = monster.mesh.position.distanceTo(boat.position);

        // Get targeting information
        const targetingInfo = isMonsterEffectivelyTargeted(monster);
        const hasGreenLine = isMonsterTargetedWithGreenLine(monster);

        // Base probability on distance and whether the targeting line is green
        let hitProbability = 1 - (distance / CANNON_RANGE) * 0.7; // 70% chance at max range, 100% up close

        if (hasGreenLine) {
            // Significant boost if there's a green/yellow targeting line
            hitProbability *= 1.5;
            hitProbability = Math.min(1.0, hitProbability); // Cap at 100%
        } else {
            // Severe penalty if no green targeting line
            hitProbability *= 0.2; // Only 20% of normal chance
        }

        // Add some debugging to help see what's happening
        if (Math.random() < 0.1) { // Only log occasionally to avoid console spam
            console.log(`Monster hit probability: ${(hitProbability * 100).toFixed(1)}% (Distance: ${distance.toFixed(1)}, Green Line: ${hasGreenLine})`);
        }

        if (Math.random() < hitProbability) {
            // Hit! Make sure to flash red
            hitMonster(monster, hasGreenLine);
        }
    });
}

// Hit a monster with cannon
function hitMonster(monster, hasGreenLine = false) {
    // Apply damage
    if (!monster.health) monster.health = 3; // Default health if not set
    monster.health -= CANNON_DAMAGE;

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
            .subVectors(monster.mesh.position, boat.position)
            .normalize();

        // Set velocity away from boat (faster retreat)
        monster.velocity.copy(directionFromBoat.multiplyScalar(1.2));
    }
}

// Update the flashMonsterRed function to properly restore colors


// Create a separate function to restore monster colors to make the code cleaner
// and ensure it can be called from multiple places if needed
function restoreMonsterColors(monster) {
    // Safety check - make sure monster exists
    if (!monster || !monster.mesh || !monster.storedColors) {
        return;
    }

    // Only restore if monster still exists and has stored colors
    try {
        monster.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((material, index) => {
                    if (material && material.color) {
                        const materialId = `${child.id}-${index}`;
                        const originalColor = monster.storedColors.get(materialId);

                        if (originalColor) {
                            // Use copy to ensure we're properly transferring the color values
                            material.color.copy(originalColor);
                        }

                        // Restore emissive if it exists
                        if (material.emissive && monster.storedEmissive) {
                            const originalEmissive = monster.storedEmissive.get(materialId);
                            if (originalEmissive) {
                                material.emissive.copy(originalEmissive);
                            }
                        }
                    }
                });
            }
        });

        // Restore special parts
        const specialParts = ['dorsalFin', 'leftFin', 'rightFin'];
        specialParts.forEach(partName => {
            if (monster[partName] && monster[partName].material && monster[partName].material.color) {
                const materialId = `special-${partName}`;
                const originalColor = monster.storedColors.get(materialId);

                if (originalColor) {
                    monster[partName].material.color.copy(originalColor);
                }
            }
        });
    } catch (error) {
        console.error("Error restoring monster colors:", error);
    }

    // Reset flag
    monster.isFlashingRed = false;
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

    //scene.add(explosion);

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

// Add this new function for monster death effect
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
    //scene.add(explosion);

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

        //scene.add(debris);

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

// Add this function for a larger splash effect
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

        //scene.add(splash);

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

    //scene.add(ripple);

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
    console.log("Monster death sound played");
}

// Update cannonballs
function updateCannonballs(deltaTime) {
    const maxLifetime = 3; // seconds

    for (let i = cannonballs.length - 1; i >= 0; i--) {
        const cannonball = cannonballs[i];

        // Move cannonball
        cannonball.mesh.position.add(cannonball.velocity.clone().multiplyScalar(deltaTime * 60));

        // Apply gravity
        cannonball.velocity.y -= 0.01 * deltaTime * 60;

        // Check lifetime
        const lifetime = (getTime() - cannonball.startTime) / 1000;
        if (lifetime > maxLifetime) {
            // Remove cannonball
            scene.remove(cannonball.mesh);
            cannonballs.splice(i, 1);
            continue;
        }

        // Check for collision with water
        if (cannonball.mesh.position.y <= 0) {
            // Create splash effect
            createSplashEffect(cannonball.mesh.position.clone());

            // Remove cannonball
            scene.remove(cannonball.mesh);
            cannonballs.splice(i, 1);
            continue;
        }

        // Check for collision with monsters
        monsters.forEach(monster => {
            if (monster.state === 'attacking' || monster.state === 'surfacing') {
                const distance = cannonball.mesh.position.distanceTo(monster.mesh.position);
                if (distance < 5) { // Monster collision radius
                    // Hit monster
                    hitMonster(monster);

                    // Remove cannonball
                    scene.remove(cannonball.mesh);
                    cannonballs.splice(i, 1);
                }
            }
        });
    }
}

// Create splash effect
function createSplashEffect(position) {
    // Ensure y position is at water level
    position.y = 0;

    // Create splash particles
    const splashCount = 10;
    const splashGeometry = new THREE.SphereGeometry(0.3, 4, 4);
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
            (Math.random() - 0.5) * 1.5,
            Math.random() * 1.5 + 0.5,
            (Math.random() - 0.5) * 1.5
        );

        //scene.add(splash);

        // Animate splash
        const startTime = getTime();

        function animateSplash() {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime > 1) {
                scene.remove(splash);
                return;
            }

            // Apply gravity
            velocity.y -= 0.1;

            // Move splash
            splash.position.add(velocity.clone().multiplyScalar(0.1));

            // Fade out
            splash.material.opacity = 0.7 * (1 - elapsedTime);

            requestAnimationFrame(animateSplash);
        }

        animateSplash();
    }
} 