import * as THREE from 'three';
import { scene, getTime } from '../core/gameState.js';

// Rain configuration - simplified from snow with increased fall speed
const RAIN_CONFIG = {
    PARTICLES_COUNT: 200,            // Number of rain particles
    PARTICLE_SIZE_MIN: 0.05,         // Minimum size
    PARTICLE_SIZE_MAX: 0.10,         // Maximum size
    FALL_SPEED_MIN: 0.5,             // Faster than snow
    FALL_SPEED_MAX: 0.6,             // Faster than snow
    WIND_STRENGTH: 0.00003,             // Same as snow
    WIND_CHANGE_SPEED: 0.001,        // Same as snow
    SPAWN_RADIUS: 100,               // Same as snow
    SPAWN_HEIGHT: 50,                // Same as snow
    LIFETIME: 15,                    // Same as snow
    COLOR: 0x5599dd,                 // Blue color for rain
    OPACITY: 0.9                     // Slightly less opaque than snow
};

// Rain state
let raindrops = [];
let isRaining = false;
let windAngle = 0;
let lastPlayerPosition = new THREE.Vector3();

/**
 * Initialize the rain system
 * @returns {Object} The rain system
 */
export function initRain() {
    return {
        start: startRain,
        stop: stopRain,
        update: updateRain,
        isActive: () => isRaining
    };
}

/**
 * Start rain effect
 * @param {THREE.Vector3} playerPosition - Player's current position
 * @param {Object} intensity - Rain intensity parameters (optional)
 */
export function startRain(playerPosition, intensity = {}) {
    isRaining = true;
    lastPlayerPosition.copy(playerPosition);

    // Apply intensity overrides if provided
    if (intensity.count) RAIN_CONFIG.PARTICLES_COUNT = intensity.count;
    if (intensity.windStrength) RAIN_CONFIG.WIND_STRENGTH = intensity.windStrength;

    // Initialize with some particles
    for (let i = 0; i < 20; i++) {
        createRaindrop(playerPosition);
    }
}

/**
 * Stop rain effect
 */
export function stopRain() {
    isRaining = false;
    // Existing raindrops will fall naturally
}

/**
 * Create a new raindrop
 * @param {THREE.Vector3} centerPosition - Center position (usually player)
 * @returns {Object} The created raindrop
 */
function createRaindrop(centerPosition) {
    // Random position around the player within spawn radius
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * RAIN_CONFIG.SPAWN_RADIUS;

    const position = new THREE.Vector3(
        centerPosition.x + Math.cos(angle) * radius,
        centerPosition.y + RAIN_CONFIG.SPAWN_HEIGHT,
        centerPosition.z + Math.sin(angle) * radius
    );

    // Random size - INCREASE size to make raindrops more visible
    const size = RAIN_CONFIG.PARTICLE_SIZE_MIN * 2 +
        Math.random() * (RAIN_CONFIG.PARTICLE_SIZE_MAX * 2 - RAIN_CONFIG.PARTICLE_SIZE_MIN * 2);

    // Create geometry and material (LONGER cylinder for better visibility)
    const geometry = new THREE.CylinderGeometry(size * 0.1, size * 0.1, size * 15, 4);

    // Brighter blue color and higher opacity for better visibility
    const material = new THREE.MeshBasicMaterial({
        color: 0x77BBFF,  // Brighter blue
        transparent: true,
        opacity: 0.9       // Higher opacity
    });

    // Create mesh
    const raindrop = new THREE.Mesh(geometry, material);
    raindrop.position.copy(position);

    // Add to scene
    scene.add(raindrop);

    // Random fall speed
    const fallSpeed = RAIN_CONFIG.FALL_SPEED_MIN +
        Math.random() * (RAIN_CONFIG.FALL_SPEED_MAX - RAIN_CONFIG.FALL_SPEED_MIN);

    // Store with metadata
    const particle = {
        mesh: raindrop,
        velocity: new THREE.Vector3(0, -fallSpeed, 0),
        size: size,
        lifetime: RAIN_CONFIG.LIFETIME,
        age: 0
    };

    raindrops.push(particle);
    return particle;
}

/**
 * Update all raindrops
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {THREE.Vector3} playerPosition - Current player position
 */
export function updateRain(deltaTime, playerPosition) {
    if (!deltaTime || isNaN(deltaTime)) {
        deltaTime = 0.016; // Default to ~60fps
    }

    // Add debug logging to check if update is being called
    console.log(`🌧️ Updating rain: ${raindrops.length} drops, isRaining=${isRaining}`);

    // Update player position reference
    if (playerPosition) {
        lastPlayerPosition.copy(playerPosition);
    }

    // Update wind direction
    windAngle += RAIN_CONFIG.WIND_CHANGE_SPEED * deltaTime;
    const windX = Math.cos(windAngle) * RAIN_CONFIG.WIND_STRENGTH;
    const windZ = Math.sin(windAngle) * RAIN_CONFIG.WIND_STRENGTH;

    // Spawn new raindrops if raining
    if (isRaining && raindrops.length < RAIN_CONFIG.PARTICLES_COUNT) {
        const particlesToSpawn = Math.min(
            10, // Max per frame
            RAIN_CONFIG.PARTICLES_COUNT - raindrops.length
        );

        // Add debug logging to check if raindrops are being created
        console.log(`🌧️ Spawning ${particlesToSpawn} new raindrops`);

        for (let i = 0; i < particlesToSpawn; i++) {
            createRaindrop(lastPlayerPosition);
        }
    }

    // Update each raindrop
    for (let i = raindrops.length - 1; i >= 0; i--) {
        const drop = raindrops[i];

        // Update age
        drop.age += deltaTime;

        // Add wind to velocity
        drop.velocity.x = windX * (1 + Math.sin(getTime() * 0.5 + i) * 0.2);
        drop.velocity.z = windZ * (1 + Math.cos(getTime() * 0.5 + i) * 0.2);

        // Update position
        drop.mesh.position.x += drop.velocity.x;
        drop.mesh.position.y += drop.velocity.y;
        drop.mesh.position.z += drop.velocity.z;

        // Check if too far from player
        const distanceToPlayer = drop.mesh.position.distanceTo(lastPlayerPosition);

        // Check if hit ground (y = 0) or lifetime exceeded or too far from player
        if (drop.mesh.position.y <= 0 || drop.age >= drop.lifetime ||
            distanceToPlayer > RAIN_CONFIG.SPAWN_RADIUS * 2) {
            // Remove from scene
            scene.remove(drop.mesh);
            drop.mesh.geometry.dispose();
            drop.mesh.material.dispose();
            raindrops.splice(i, 1);
        }
    }
}

/**
 * Clear all rain effects
 */
export function clearAllRain() {
    // Clear active raindrops
    raindrops.forEach(drop => {
        scene.remove(drop.mesh);
        drop.mesh.geometry.dispose();
        drop.mesh.material.dispose();
    });
    raindrops = [];
    isRaining = false;
}
