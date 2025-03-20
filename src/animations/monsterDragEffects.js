import * as THREE from 'three';
import { scene, getTime, addToScene, removeFromScene } from '../core/gameState.js';
import { getAllMonsters } from '../entities/monsterManager.js';
import { activeHarpoons } from '../abilities/harpoonDamageSystem.js';
import { applyOutline, removeOutline } from '../theme/outlineStyles.js';
import { boat } from '../core/gameState.js'; // Add boat import to determine direction

// Configuration for water splash effects - DRAMATICALLY ENHANCED
const SPLASH_CONFIG = {
    EMISSION_RATE: 0.005,      // Emit particles much more frequently
    PARTICLE_COUNT: 13,        // Reduced particle count
    PARTICLE_SIZE: 0.4,        // 50% SMALLER particles (was 0.8)
    PARTICLE_COLOR: 0x55aaff,  // Bright blue color
    PARTICLE_LIFETIME: 2.5,    // Long lifetime
    PARTICLE_OPACITY: 0.9,     // High opacity
    PARTICLE_SPEED: 0.5,       // Fast movement
    RANDOM_SPEED: 0.8,         // INCREASED random variation (was 0.4)
    SPLASH_HEIGHT: 10.0,       // Ultra-high splashes
    GRAVITY: 18,               // Fast falling
    EFFECT_DURATION: 3.0,      // How long effects persist after dragging stops
    SPAWN_RADIUS: 3.0,         // How far from monster center particles can spawn
    INITIAL_SPLASH_COUNT: 27,  // Reduced particle count
    USE_OUTLINES: true,        // Add outlines to particles for more visibility
    OUTLINE_SCALE: 1.08,       // Scale factor for outlines
    SIDE_BIAS: 0.8,            // How much to bias movement to the sides
    BACKWARD_BIAS: 0.7         // How much to bias movement backward
};

// Track active effects for each monster
const dragEffects = new Map();

// Debug flag - set to true to log drag detection information
const DEBUG_DRAG = true;

/**
 * Initialize water effects for a dragged monster
 * @param {Object} monster - The monster being dragged
 */
export function initDragEffects(monster) {
    if (!monster || !monster.mesh) return;

    // If already initialized, don't recreate
    if (dragEffects.has(monster)) return;

    // Create new effect tracking
    dragEffects.set(monster, {
        lastPosition: monster.mesh.position.clone(),
        lastEmitTime: 0,
        particles: [],
        isActive: true,
        lastActiveTime: getTime() / 1000
    });



    // Create an immediate splash to show effects working
    createImmediateSplash(monster);
}

/**
 * Create an immediate splash when drag starts - ENHANCED VERSION
 */
function createImmediateSplash(monster) {
    if (!monster || !monster.mesh) return;

    const position = monster.mesh.position.clone();
    position.y = 0; // Force to water level

    // Calculate direction to boat (for directional spray)
    const toBoat = getDirectionToBoat(position);

    // Create MANY particles in a big splash
    for (let i = 0; i < SPLASH_CONFIG.INITIAL_SPLASH_COUNT; i++) {
        // Larger size with more variation - but 50% smaller overall
        const size = SPLASH_CONFIG.PARTICLE_SIZE * 1.8 * (0.7 + Math.random() * 0.6);
        const geometry = new THREE.SphereGeometry(size, 6, 6);

        // Brighter blue water material
        const material = new THREE.MeshBasicMaterial({
            color: SPLASH_CONFIG.PARTICLE_COLOR,
            transparent: true,
            opacity: SPLASH_CONFIG.PARTICLE_OPACITY
        });

        const splash = new THREE.Mesh(geometry, material);

        // Position around the monster with wider spread
        const angle = Math.random() * Math.PI * 2;
        const radius = (monster.mesh.scale.x || 2) * (0.5 + Math.random() * 1.5);

        const splashPos = position.clone();
        splashPos.x += Math.cos(angle) * radius;
        splashPos.z += Math.sin(angle) * radius;
        splashPos.y = 0.1 + Math.random() * 0.5; // Higher initial position

        splash.position.copy(splashPos);
        addToScene(splash);

        // Apply outline to make particles more visible
        if (SPLASH_CONFIG.USE_OUTLINES) {
            applyOutline(splash, {
                scale: SPLASH_CONFIG.OUTLINE_SCALE
            });
        }

        // Create directional bias for more natural spray pattern
        const directionalVelocity = createDirectionalVelocity(toBoat, 6);

        // Add higher upward component
        directionalVelocity.y = 12 + Math.random() * 24;  // High upward velocity

        // Add to tracking with longer lifetime
        const effects = dragEffects.get(monster);
        if (effects) {
            effects.particles.push({
                mesh: splash,
                velocity: directionalVelocity,
                createdAt: getTime() / 1000,
                lifetime: SPLASH_CONFIG.PARTICLE_LIFETIME * 1.8 // Even longer for initial splash
            });
        }
    }


}

/**
 * Get direction vector from position to boat
 * @param {THREE.Vector3} position - Current position
 * @returns {THREE.Vector3} Direction vector to boat (normalized)
 */
function getDirectionToBoat(position) {
    // If boat doesn't exist, use default direction
    if (!boat || !boat.position) {
        return new THREE.Vector3(0, 0, -1);
    }

    // Calculate direction vector from position to boat
    return new THREE.Vector3()
        .subVectors(boat.position, position)
        .normalize();
}

/**
 * Create a velocity vector with bias away from a direction
 * @param {THREE.Vector3} avoidDirection - Direction to avoid (usually toward boat)
 * @param {number} baseSpeed - Base speed for the velocity
 * @returns {THREE.Vector3} A velocity vector biased away from avoidDirection
 */
function createDirectionalVelocity(avoidDirection, baseSpeed) {
    // Start with a random velocity in the horizontal plane
    const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * SPLASH_CONFIG.RANDOM_SPEED * baseSpeed,
        0,
        (Math.random() - 0.5) * SPLASH_CONFIG.RANDOM_SPEED * baseSpeed
    );

    // Create a perpendicular vector for side movement
    const sideDir = new THREE.Vector3(avoidDirection.z, 0, -avoidDirection.x);

    // Add side bias (randomly left or right)
    const sideBias = (Math.random() > 0.5 ? 1 : -1) * SPLASH_CONFIG.SIDE_BIAS * baseSpeed;
    velocity.add(sideDir.multiplyScalar(sideBias));

    // Add backward bias (away from boat)
    const backwardBias = -SPLASH_CONFIG.BACKWARD_BIAS * baseSpeed;
    velocity.add(avoidDirection.clone().multiplyScalar(backwardBias));

    return velocity;
}

/**
 * Clean up water effects for a monster
 * @param {Object} monster - The monster to clean up effects for
 */
export function cleanupDragEffects(monster) {
    if (!dragEffects.has(monster)) return;

    const effects = dragEffects.get(monster);

    // Remove all particles and their outlines
    effects.particles.forEach(particle => {
        if (particle.mesh) {
            // First remove the outline, then the mesh
            if (SPLASH_CONFIG.USE_OUTLINES) {
                removeOutline(particle.mesh);
            }
            removeFromScene(particle.mesh);
        }
    });

    // Remove from tracking
    dragEffects.delete(monster);
}

/**
 * Properly remove a particle and its outline
 * @param {Object} particle - The particle to remove
 */
function removeParticleWithOutline(particle) {
    if (!particle || !particle.mesh) return;

    // First remove the outline if it exists
    if (SPLASH_CONFIG.USE_OUTLINES) {
        removeOutline(particle.mesh);
    }

    // Then remove the particle mesh from the scene
    removeFromScene(particle.mesh);
}

/**
 * Directly check if a monster has active harpoons attached
 * This is more reliable than checking flags or states
 * @param {Object} monster - Monster to check
 * @returns {boolean} True if monster has harpoons attached
 */
function hasActiveHarpoons(monster) {
    if (!activeHarpoons || !monster) return false;

    for (const [_, harpoonData] of activeHarpoons.entries()) {
        if (harpoonData.attachedMonster === monster) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a monster is being dragged by a harpoon - more reliable version
 * @param {Object} monster - The monster to check
 * @returns {boolean} True if monster is being dragged
 */
export function isMonsterBeingDragged(monster) {
    if (!monster || !monster.mesh) return false;

    // First check the direct flag which might be set by harpoonshot.js
    if (monster.isBeingDragged) {
        if (DEBUG_DRAG)
            return true;
    }

    // Check if monster is in 'tethered' state (set by harpoon damage system)
    if (monster.state === 'tethered' || monster.originalState) {
        if (DEBUG_DRAG)
            return true;
    }

    // Check harpoon damage system directly to see if monster is attached to any harpoons
    if (hasActiveHarpoons(monster)) {
        if (DEBUG_DRAG)
            return true;
    }

    // Check if the monster has attachedHarpoons array
    if (monster.attachedHarpoons && monster.attachedHarpoons.length > 0) {
        if (DEBUG_DRAG)
            return true;
    }

    // Check for fast movement
    if (dragEffects.has(monster)) {
        const effects = dragEffects.get(monster);
        const currentPos = monster.mesh.position;
        const lastPos = effects.lastPosition;

        // Calculate distance moved since last frame
        const distance = currentPos.distanceTo(lastPos);
        if (distance > 0.8) { // Monster moved significantly in a single frame
            if (DEBUG_DRAG)
                return true;
        }
    }

    return false;
}

/**
 * Update water effects for all monsters
 * @param {number} deltaTime - Time since last update
 */
export function updateDragEffects(deltaTime) {
    const currentTime = getTime() / 1000;

    // Get all monsters
    const monsters = getAllMonsters();

    // Check each monster for drag state
    monsters.forEach(monster => {
        if (!monster || !monster.mesh) return;

        // Check if monster is being dragged
        const isDragged = isMonsterBeingDragged(monster);

        if (isDragged) {
            // Initialize if not already tracked
            if (!dragEffects.has(monster)) {
                initDragEffects(monster);
            } else {
                // Update existing effects
                const effects = dragEffects.get(monster);
                effects.isActive = true;
                effects.lastActiveTime = currentTime;

                // Force position update to detect movement
                const newPosition = monster.mesh.position.clone();
                const distanceMoved = newPosition.distanceTo(effects.lastPosition);

                // Create splash particles regardless of movement
                createSplashParticles(monster, currentTime, deltaTime, Math.max(0.2, distanceMoved));

                // Update last position
                effects.lastPosition.copy(newPosition);
            }
        }
        else if (dragEffects.has(monster)) {
            // Keep effects for a much longer time after dragging stops
            const effects = dragEffects.get(monster);
            const timeSinceActive = currentTime - effects.lastActiveTime;

            // Create additional "trailing" particles for a while after dragging stops
            if (timeSinceActive < SPLASH_CONFIG.EFFECT_DURATION * 0.7) {
                // Still create some particles, but fewer as time passes
                const fadeOutFactor = 1 - (timeSinceActive / (SPLASH_CONFIG.EFFECT_DURATION * 0.7));
                if (currentTime - effects.lastEmitTime > SPLASH_CONFIG.EMISSION_RATE * 2) {
                    createSplashParticles(monster, currentTime, deltaTime, 0.2 * fadeOutFactor);
                    effects.lastEmitTime = currentTime;
                }
            }

            if (timeSinceActive > SPLASH_CONFIG.EFFECT_DURATION) {
                cleanupDragEffects(monster);
            }
        }
    });

    // Update existing particles
    updateParticles(deltaTime);

    // Clean up effects for monsters that no longer exist
    dragEffects.forEach((effects, monsterKey) => {
        if (monsterKey !== 'debug' && !monsters.includes(monsterKey)) {
            cleanupDragEffects(monsterKey);
        }
    });
}

/**
 * Create water splash particles around a monster - ENHANCED VERSION
 * @param {Object} monster - The monster to create splashes for
 * @param {number} currentTime - Current game time
 * @param {number} deltaTime - Time since last update
 * @param {number} distanceMoved - How far monster moved since last frame
 */
function createSplashParticles(monster, currentTime, deltaTime, distanceMoved) {
    if (!monster || !monster.mesh) return;

    const effects = dragEffects.get(monster);
    if (!effects) return;

    // Check if it's time to emit new particles
    if (currentTime - effects.lastEmitTime < SPLASH_CONFIG.EMISSION_RATE) {
        return;
    }

    // Get monster position (always at water level)
    const position = monster.mesh.position.clone();

    // Keep the original Y to check if monster is near surface
    const originalY = position.y;
    position.y = 0; // Force to water level

    // Only create particles if monster is near surface
    if (originalY < -3) {
        // Monster is too deep underwater, don't create surface splashes
        return;
    }

    // Calculate velocity from previous position
    const velocity = new THREE.Vector3()
        .subVectors(monster.mesh.position, effects.lastPosition)
        .divideScalar(deltaTime);

    // Get direction to boat
    const toBoat = getDirectionToBoat(position);

    // Scale particle count based on movement speed - faster = more particles
    const speedFactor = Math.min(3.0, distanceMoved * 5);
    const particleCount = Math.ceil(SPLASH_CONFIG.PARTICLE_COUNT * speedFactor);

    // Create splash particles in multiple locations around monster
    for (let i = 0; i < particleCount; i++) {
        // Create particle with larger size variation - but 50% smaller overall
        const size = SPLASH_CONFIG.PARTICLE_SIZE * (0.6 + Math.random() * 0.8);
        const geometry = new THREE.SphereGeometry(size, 6, 6);

        // Brighter blue water material with slight color variation
        const hueShift = (Math.random() - 0.5) * 0.1; // Subtle color variation
        const color = new THREE.Color(SPLASH_CONFIG.PARTICLE_COLOR);
        color.offsetHSL(hueShift, 0, 0);

        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: SPLASH_CONFIG.PARTICLE_OPACITY * (0.8 + Math.random() * 0.2)
        });

        const splash = new THREE.Mesh(geometry, material);

        // Position around monster with much wider spread
        const angle = Math.random() * Math.PI * 2;

        // Increase splash radius based on monster size and added random factor
        const monsterWidth = monster.mesh.scale.x || 2;
        const radius = monsterWidth * (0.3 + Math.random() * SPLASH_CONFIG.SPAWN_RADIUS);

        const splashPos = position.clone();
        splashPos.x += Math.cos(angle) * radius;
        splashPos.z += Math.sin(angle) * radius;
        splashPos.y = 0.1 + Math.random() * 0.4; // Higher initial position

        splash.position.copy(splashPos);
        addToScene(splash);

        // Apply outline to make particles more visible
        if (SPLASH_CONFIG.USE_OUTLINES) {
            applyOutline(splash, {
                scale: SPLASH_CONFIG.OUTLINE_SCALE
            });
        }

        // Create directional bias with monster movement influence
        const directionalVelocity = createDirectionalVelocity(toBoat, 2);

        // Add influence from monster movement (30% influence)
        if (velocity.length() > 0.1) {
            directionalVelocity.x += velocity.x * 0.3;
            directionalVelocity.z += velocity.z * 0.3;
        }

        // Higher upward velocity based on monster speed
        directionalVelocity.y = SPLASH_CONFIG.SPLASH_HEIGHT * (0.7 + Math.random() * 0.6) * speedFactor;

        // Add to tracking with varied lifetime
        effects.particles.push({
            mesh: splash,
            velocity: directionalVelocity,
            createdAt: currentTime,
            lifetime: SPLASH_CONFIG.PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6)
        });
    }

    // Update last emission time
    effects.lastEmitTime = currentTime;
}

/**
 * Update particles (position, opacity, lifetime)
 * @param {number} deltaTime - Time since last update
 */
function updateParticles(deltaTime) {
    const currentTime = getTime() / 1000;

    // Update all particles for all monsters
    dragEffects.forEach(effects => {
        for (let i = effects.particles.length - 1; i >= 0; i--) {
            const particle = effects.particles[i];

            if (!particle || !particle.mesh) {
                effects.particles.splice(i, 1);
                continue;
            }

            const age = currentTime - particle.createdAt;

            // Remove expired particles
            if (age >= particle.lifetime) {
                // Use our helper to remove both the particle and its outline
                removeParticleWithOutline(particle);
                effects.particles.splice(i, 1);
                continue;
            }

            // Calculate normalized age (0-1)
            const normalizedAge = age / particle.lifetime;

            // Apply gravity to particle - DOUBLED gravity for faster falling
            particle.velocity.y -= SPLASH_CONFIG.GRAVITY * deltaTime;

            // Update position
            particle.mesh.position.x += particle.velocity.x * deltaTime;
            particle.mesh.position.y += particle.velocity.y * deltaTime;
            particle.mesh.position.z += particle.velocity.z * deltaTime;

            // Fade out gradually
            if (particle.mesh.material) {
                particle.mesh.material.opacity =
                    SPLASH_CONFIG.PARTICLE_OPACITY * (1 - normalizedAge);
            }

            // Remove if below water
            if (particle.mesh.position.y < 0) {
                // Use our helper to remove both the particle and its outline
                removeParticleWithOutline(particle);
                effects.particles.splice(i, 1);
            }
        }
    });
}

/**
 * Main update function to call from game loop
 * @param {number} deltaTime - Time since last update
 */
export function updateWaterDragEffects(deltaTime) {
    // Fall back to default deltaTime if not provided
    if (!deltaTime) deltaTime = 0.016;

    updateDragEffects(deltaTime);
}

/**
 * For debugging: Force create water effects at a position - ENHANCED VERSION
 * @param {THREE.Vector3} position - Position to create effects
 */
export function createDebugSplash(position) {
    const currentTime = getTime() / 1000;
    const mockEffects = { particles: [], lastEmitTime: 0 };

    // Calculate direction to boat
    const toBoat = getDirectionToBoat(position);

    // Create MANY particles for a dramatic effect
    for (let i = 0; i < 40; i++) {
        // 50% smaller particles
        const size = SPLASH_CONFIG.PARTICLE_SIZE * 1.5 * (0.7 + Math.random() * 0.6);
        const geometry = new THREE.SphereGeometry(size, 6, 6);

        // Brighter blue color
        const material = new THREE.MeshBasicMaterial({
            color: SPLASH_CONFIG.PARTICLE_COLOR,
            transparent: true,
            opacity: SPLASH_CONFIG.PARTICLE_OPACITY
        });

        const splash = new THREE.Mesh(geometry, material);

        // Position around the given point with wider spread
        const angle = Math.random() * Math.PI * 2;
        const radius = 3 + Math.random() * 3;

        const splashPos = position.clone();
        splashPos.x += Math.cos(angle) * radius;
        splashPos.z += Math.sin(angle) * radius;
        splashPos.y = 0.1 + Math.random() * 0.4;

        splash.position.copy(splashPos);
        addToScene(splash);

        // Apply outline to debug particles too
        if (SPLASH_CONFIG.USE_OUTLINES) {
            applyOutline(splash, {
                scale: SPLASH_CONFIG.OUTLINE_SCALE
            });
        }

        // Create directional velocity with more sideways and backward bias
        const directionalVelocity = createDirectionalVelocity(toBoat, 4);

        // Add high upward component
        directionalVelocity.y = 16 + Math.random() * 16;

        mockEffects.particles.push({
            mesh: splash,
            velocity: directionalVelocity,
            createdAt: currentTime,
            lifetime: SPLASH_CONFIG.PARTICLE_LIFETIME * 2.0
        });
    }

    // Add to tracking as a special case
    dragEffects.set('debug', mockEffects);


} 