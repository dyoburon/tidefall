import * as THREE from 'three';
import { scene, boat, boatVelocity, removeFromScene, addToScene } from '../core/gameState.js';

// Configuration for the wake effect
const wakeConfig = {
    // Shared settings
    speedThreshold: 0.2,      // Minimum speed to show wake
    verticalOffset: 0.05,     // Slight offset above water to prevent z-fighting
    color: 0xffffff,          // White color
    opacity: 0.7,             // Semi-transparent

    // Particle (bubble) settings
    maxParticles: 100,        // Maximum number of particles in the pool
    particleSize: 0.4,        // Size of wake particles
    minSize: 0.3,             // Minimum size of particles
    maxSize: 0.5,             // Maximum size of particles
    maxLifetime: 2.5,         // Maximum lifetime of particles in seconds
    spawnRate: 0.07,          // Seconds between particle spawns
    spawnAreaWidth: 3.0,      // Width of spawn area behind boat
    spawnDistanceMin: -3,     // Minimum distance behind boat
    spawnDistanceMax: 3,      // Maximum distance behind boat
    baseOffset: 0,            // Base offset behind the boat before min/max distances are applied

    // Line settings
    maxLength: 2.5,             // Maximum length of wake trails
    width: 0.5,              // Width of wake lines
    wakeLinesCount: 4,        // Number of diagonal wake lines
    diagonalAngle: 0.3,       // Angle of diagonal lines in radians (about 17 degrees)
    spacingMultiplier: 1.3,   // Distance multiplier between lines
    startOffset: -8,         // Distance behind the boat to start wake lines
    sideOffset: 2.0,          // Distance from center of boat to each wake line
};

// Store particle and line systems
let wakeParticles = [];
let wakeLines = [];
let isInitialized = false;
let timeSinceLastSpawn = 0;

/**
 * Create the wake effect particles and lines
 */
export function initWakeEffect() {
    if (isInitialized) return;

    // Create shared material properties
    const materialSettings = {
        color: wakeConfig.color,
        transparent: true,
        opacity: wakeConfig.opacity,
        side: THREE.DoubleSide,
        depthWrite: false // Prevents z-fighting with water
    };

    // INITIALIZE PARTICLES (BUBBLES)

    // Create material for wake particles
    const particleMaterial = new THREE.MeshBasicMaterial(materialSettings);

    // Create geometry for wake particles (simple circle)
    const particleGeometry = new THREE.CircleGeometry(1, 8);
    particleGeometry.rotateX(-Math.PI / 2); // Rotate to be horizontal

    // Create particle pool
    for (let i = 0; i < wakeConfig.maxParticles; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());

        // Initialize with default values
        particle.position.set(0, wakeConfig.verticalOffset, 0);
        particle.visible = false;
        particle.scale.set(wakeConfig.particleSize, wakeConfig.particleSize, wakeConfig.particleSize);

        // Store particle data
        particle.userData = {
            lifetime: 0,
            maxLifetime: 0,
            active: false
        };

        // Add to scene and to our array
        addToScene(particle);
        wakeParticles.push(particle);
    }

    // INITIALIZE WAKE LINES

    // Create material for wake lines
    const lineMaterial = new THREE.MeshBasicMaterial(materialSettings);

    // Create geometry for wake lines (simple plane)
    const lineGeometry = new THREE.PlaneGeometry(wakeConfig.width, wakeConfig.maxLength);
    lineGeometry.rotateX(-Math.PI / 2); // Rotate to be horizontal

    // Create array of wake meshes (both left and right sides)
    for (let i = 0; i < wakeConfig.wakeLinesCount; i++) {
        // Left side wake
        const leftWakeMesh = new THREE.Mesh(lineGeometry.clone(), lineMaterial.clone());
        leftWakeMesh.position.set(0, wakeConfig.verticalOffset, 0);
        leftWakeMesh.visible = false;
        leftWakeMesh.userData.side = 'left';
        leftWakeMesh.userData.index = i;

        // Right side wake
        const rightWakeMesh = new THREE.Mesh(lineGeometry.clone(), lineMaterial.clone());
        rightWakeMesh.position.set(0, wakeConfig.verticalOffset, 0);
        rightWakeMesh.visible = false;
        rightWakeMesh.userData.side = 'right';
        rightWakeMesh.userData.index = i;

        // Add to scene and to our array
        addToScene(leftWakeMesh);
        addToScene(rightWakeMesh);
        wakeLines.push(leftWakeMesh, rightWakeMesh);
    }

    isInitialized = true;
    return { particles: wakeParticles, lines: wakeLines };
}

/**
 * Spawn a new wake particle
 */
function spawnParticle(speed) {
    // Find an inactive particle to reuse
    const particle = wakeParticles.find(p => !p.userData.active);
    if (!particle) return; // No available particles

    // Get boat's forward and right vectors
    const boatForward = new THREE.Vector3(0, 0, -1).applyQuaternion(boat.quaternion);
    const boatRight = new THREE.Vector3(1, 0, 0).applyQuaternion(boat.quaternion);

    // Random position behind boat with base offset applied
    const distanceBehind = wakeConfig.baseOffset + wakeConfig.spawnDistanceMin +
        Math.random() * (wakeConfig.spawnDistanceMax - wakeConfig.spawnDistanceMin);
    const sideOffset = (Math.random() * 2 - 1) * wakeConfig.spawnAreaWidth;

    // Calculate spawn position
    const spawnPosition = boat.position.clone()
        .sub(boatForward.clone().multiplyScalar(distanceBehind))
        .add(boatRight.clone().multiplyScalar(sideOffset));
    spawnPosition.y = wakeConfig.verticalOffset;

    // Set particle properties
    particle.position.copy(spawnPosition);

    // Random size based on configuration
    const size = wakeConfig.minSize + Math.random() * (wakeConfig.maxSize - wakeConfig.minSize);
    particle.scale.set(size, size, size);

    // Set lifetime based on speed and distance
    const distanceFactor = Math.abs(distanceBehind) / (wakeConfig.baseOffset + wakeConfig.spawnDistanceMax);
    const maxLifetime = wakeConfig.maxLifetime * (0.7 + 0.3 * Math.random()) * (1 + distanceFactor * 0.5);

    // Set opacity
    particle.material.opacity = wakeConfig.opacity;

    // Activate particle
    particle.userData.lifetime = 0;
    particle.userData.maxLifetime = maxLifetime;
    particle.userData.active = true;
    particle.visible = true;
}

/**
 * Update the wake lines
 */
function updateWakeLines(speed) {
    // Get boat's forward and right vectors
    const boatForward = new THREE.Vector3(0, 0, -1).applyQuaternion(boat.quaternion);
    const boatRight = new THREE.Vector3(1, 0, 0).applyQuaternion(boat.quaternion);

    // Update each wake line
    wakeLines.forEach(wakeMesh => {
        const index = wakeMesh.userData.index;
        const side = wakeMesh.userData.side;

        // Calculate offset based on index (place further back for higher indices)
        const backOffset = wakeConfig.startOffset + (index * wakeConfig.spacingMultiplier);

        // Create a quaternion for the diagonal rotation
        const diagonalRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            side === 'left' ? wakeConfig.diagonalAngle : -wakeConfig.diagonalAngle
        );

        // Position wake behind boat
        const wakeOrigin = boat.position.clone().sub(
            boatForward.clone().multiplyScalar(backOffset)
        );

        // Calculate side offset based on side
        const sideOffset = side === 'left' ? -wakeConfig.sideOffset : wakeConfig.sideOffset;

        // Base position with side offset
        const wakePos = wakeOrigin.clone().add(
            boatRight.clone().multiplyScalar(sideOffset)
        );

        // Update position
        wakeMesh.position.copy(wakePos);
        wakeMesh.position.y = wakeConfig.verticalOffset;

        // Combine boat quaternion with diagonal rotation
        const combinedRotation = new THREE.Quaternion().copy(boat.quaternion).multiply(diagonalRotation);
        wakeMesh.quaternion.copy(combinedRotation);

        // Scale length based on speed and position (smaller for further back)
        const distanceFactor = 1.0 - (index / wakeConfig.wakeLinesCount);
        const wakeLength = Math.min(speed * 6, wakeConfig.maxLength) * distanceFactor;
        wakeMesh.scale.set(1, 1, wakeLength);

        // Set opacity based on speed and position (more transparent for further back)
        const opacityFactor = 1.0 - (index / (wakeConfig.wakeLinesCount * 1.5));
        const wakeOpacity = Math.min(speed * wakeConfig.opacity, 0.7) * opacityFactor;
        wakeMesh.material.opacity = wakeOpacity;

        // Show wake
        wakeMesh.visible = true;
    });
}

/**
 * Update the wake effect based on boat movement
 * @param {number} deltaTime - Time since last frame
 */
export function updateWakeEffect(deltaTime) {
    // Check if wake is initialized
    if (!isInitialized || (wakeParticles.length === 0 && wakeLines.length === 0) || !boat) return;

    // Get boat speed
    const speed = boatVelocity.length();

    // Only show wake if boat is moving faster than threshold
    if (speed > wakeConfig.speedThreshold) {
        // ---- UPDATE PARTICLES ----
        // Spawn new particles based on speed and time
        timeSinceLastSpawn += deltaTime;
        const spawnInterval = wakeConfig.spawnRate / Math.min(speed * 0.8, 5);

        while (timeSinceLastSpawn >= spawnInterval) {
            // Spawn two particles each iteration for double density
            spawnParticle(speed);
            spawnParticle(speed);
            timeSinceLastSpawn -= spawnInterval;
        }

        // ---- UPDATE WAKE LINES ----
        updateWakeLines(speed);
    } else {
        // Hide all wake lines when boat is slow/stopped
        wakeLines.forEach(wakeMesh => {
            wakeMesh.visible = false;
        });
    }

    // Always update all active particles
    wakeParticles.forEach(particle => {
        if (particle.userData.active) {
            // Update lifetime
            particle.userData.lifetime += deltaTime;

            // Check if particle should die
            if (particle.userData.lifetime >= particle.userData.maxLifetime) {
                // Deactivate
                particle.userData.active = false;
                particle.visible = false;
            } else {
                // Update opacity based on lifetime
                const lifeRatio = particle.userData.lifetime / particle.userData.maxLifetime;
                particle.material.opacity = wakeConfig.opacity * (1 - lifeRatio * 0.8);

                // Optional: Make particles sink/shrink as they age
                particle.position.y = wakeConfig.verticalOffset - lifeRatio * 0.1;

                // Optional: Make particles slightly expand as they age
                const sizeMultiplier = 1 + lifeRatio * 0.5;
                const baseSize = particle.userData.baseSize || particle.scale.x;
                particle.userData.baseSize = baseSize;
                particle.scale.set(baseSize * sizeMultiplier, baseSize * sizeMultiplier, baseSize * sizeMultiplier);
            }
        }
    });
}

/**
 * Clean up wake effect resources
 */
export function cleanupWakeEffect() {
    // Clean up particles
    wakeParticles.forEach(particle => {
        if (particle) {
            removeFromScene(particle);
        }
    });

    // Clean up wake lines
    wakeLines.forEach(line => {
        if (line) {
            removeFromScene(line);
        }
    });

    wakeParticles = [];
    wakeLines = [];
    isInitialized = false;
} 