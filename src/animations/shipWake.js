import * as THREE from 'three';
import { boat, boatVelocity, scene } from '../core/gameState.js';

// Wake configuration
const wakeConfig = {
    maxLength: 20,          // Max length of wake at full speed
    width: 8,               // Width of wake at its widest point
    fadeTime: 4.0,          // Time in seconds for wake to fade out
    speedThreshold: 0.05,   // Minimum speed to show wake
    particleDensity: 0.3    // Density of foam particles (0-1)
};

// Store wake components
let wakeMesh;               // Main wake mesh
let wakeParticleSystem;     // Foam particle system
let wakeSegments = [];      // Array of wake segments for animation
let lastWakePosition = new THREE.Vector3();

// Initialize the wake system
export function initShipWake() {
    // Create the main wake mesh
    createWakeMesh();

    // Create the particle system for foam
    createWakeParticles();

    // Store initial position
    lastWakePosition.copy(boat.position);


}

// Create the main wedge-shaped wake mesh
function createWakeMesh() {
    // Create a fan/wedge geometry
    const wakeGeometry = new THREE.BufferGeometry();

    // Define vertices for a triangular fan shape
    const vertices = new Float32Array([
        0, 0.1, 0,             // Front point (slightly above water)
        -wakeConfig.width / 2, 0.05, -wakeConfig.maxLength / 3,  // Left point at 1/3 length
        -wakeConfig.width, 0, -wakeConfig.maxLength,         // Left point at full length
        0, 0, -wakeConfig.maxLength,                         // Center point at full length
        wakeConfig.width, 0, -wakeConfig.maxLength,          // Right point at full length
        wakeConfig.width / 2, 0.05, -wakeConfig.maxLength / 3,   // Right point at 1/3 length
    ]);

    // Define triangular faces
    const indices = [
        0, 1, 5,  // Front triangle left
        1, 2, 3,  // Left side triangle
        0, 5, 3,  // Front triangle right
        5, 4, 3   // Right side triangle
    ];

    // Set vertices and faces
    wakeGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    wakeGeometry.setIndex(indices);
    wakeGeometry.computeVertexNormals();

    // Create UVs for texture mapping
    const uvs = new Float32Array([
        0.5, 0,      // Front center
        0, 0.33,     // Left third
        0, 1,        // Left edge
        0.5, 1,      // Center edge
        1, 1,        // Right edge
        1, 0.33      // Right third
    ]);
    wakeGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    // Create wake material
    const wakeMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    // Load foam texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('./assets/wake_foam.png', (texture) => {
        wakeMaterial.map = texture;
        wakeMaterial.needsUpdate = true;
    });

    // Create the mesh
    wakeMesh = new THREE.Mesh(wakeGeometry, wakeMaterial);
    wakeMesh.visible = false;  // Initially hidden

    // Add to scene
    scene.add(wakeMesh);
}

// Create particle system for foam effects
function createWakeParticles() {
    // Particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 60;

    // Arrays to store particle data
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);

    // Initialize particles (will be properly positioned during update)
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = 0;     // x
        positions[i * 3 + 1] = 0;  // y
        positions[i * 3 + 2] = 0;  // z
        sizes[i] = 0.5 + Math.random() * 0.5;  // Random size
        opacities[i] = 0;  // Start invisible
        lifetimes[i] = 0;  // No lifetime yet
    }

    // Add attributes to geometry
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

    // Particle texture
    const textureLoader = new THREE.TextureLoader();
    const particleTexture = textureLoader.load('./assets/foam_particle.png');

    // Create material
    const particleMaterial = new THREE.PointsMaterial({
        size: 1.0,
        map: particleTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });

    // Create the particle system
    wakeParticleSystem = new THREE.Points(particleGeometry, particleMaterial);
    wakeParticleSystem.visible = false;  // Initially hidden

    // Add to scene
    scene.add(wakeParticleSystem);
}

// Update the wake effect based on boat movement
export function updateShipWake(deltaTime) {
    // Check if wake system is initialized
    if (!wakeMesh || !wakeParticleSystem) return;

    // Get boat speed
    const speed = new THREE.Vector3().copy(boatVelocity).length();

    // Only show wake if boat is moving faster than threshold
    if (speed > wakeConfig.speedThreshold) {
        // Calculate wake properties based on speed
        const wakeLength = Math.min(speed * 50, wakeConfig.maxLength);
        const wakeOpacity = Math.min(speed * 3, 0.7);

        // Position wake behind boat
        const boatDir = new THREE.Vector3(0, 0, -1).applyQuaternion(boat.quaternion);
        wakeMesh.position.copy(boat.position);
        wakeMesh.quaternion.copy(boat.quaternion);

        // Scale wake based on speed
        wakeMesh.scale.set(1, 1, wakeLength / wakeConfig.maxLength);

        // Set opacity based on speed
        wakeMesh.material.opacity = wakeOpacity;

        // Make visible
        wakeMesh.visible = true;
        wakeParticleSystem.visible = true;

        // Update particle system
        updateWakeParticles(deltaTime, speed, boatDir);

        // Remember position for next frame
        lastWakePosition.copy(boat.position);
    } else {
        // Hide wake when boat is slow/stopped
        wakeMesh.visible = false;
        wakeParticleSystem.visible = false;
    }
}

// Update foam particles
function updateWakeParticles(deltaTime, speed, boatDirection) {
    if (!wakeParticleSystem) return;

    const positions = wakeParticleSystem.geometry.attributes.position.array;
    const sizes = wakeParticleSystem.geometry.attributes.size.array;
    const opacities = wakeParticleSystem.geometry.attributes.opacity.array;
    const lifetimes = wakeParticleSystem.geometry.attributes.lifetime.array;
    const particleCount = positions.length / 3;

    // Calculate emission rate based on speed
    const emitRate = speed * 5; // Particles per second
    const particlesToEmit = Math.min(Math.floor(emitRate * deltaTime), 5);

    // Update existing particles
    for (let i = 0; i < particleCount; i++) {
        // Update lifetime
        lifetimes[i] -= deltaTime;

        // If alive, update properties
        if (lifetimes[i] > 0) {
            // Fade out based on lifetime
            const lifeRatio = lifetimes[i] / wakeConfig.fadeTime;
            opacities[i] = lifeRatio * 0.7;

            // Drift and sink
            positions[i * 3] += (Math.random() - 0.5) * 0.1;         // Random X drift
            positions[i * 3 + 1] -= deltaTime * 0.2;                 // Sink slowly
            positions[i * 3 + 2] -= deltaTime * (1 - lifeRatio) * 2; // Drift backward slower over time
        } else {
            // Dead particles are invisible
            opacities[i] = 0;
        }
    }

    // Emit new particles if needed
    for (let j = 0; j < particlesToEmit; j++) {
        // Find a dead particle to reuse
        for (let i = 0; i < particleCount; i++) {
            if (lifetimes[i] <= 0) {
                // Reset properties
                const side = Math.random() > 0.5 ? 1 : -1;
                const distBack = Math.random() * wakeConfig.maxLength * 0.3;
                const distSide = Math.random() * wakeConfig.width * 0.5 * side;

                // Position relative to boat
                const pos = new THREE.Vector3(
                    distSide,
                    0.1, // Slightly above water
                    -distBack
                ).applyQuaternion(boat.quaternion).add(boat.position);

                positions[i * 3] = pos.x;
                positions[i * 3 + 1] = pos.y;
                positions[i * 3 + 2] = pos.z;

                // Set size based on position (larger in center)
                sizes[i] = 0.5 + Math.random() * 0.5;

                // Set full opacity
                opacities[i] = 0.7;

                // Set lifetime
                lifetimes[i] = wakeConfig.fadeTime * (0.7 + Math.random() * 0.3);

                break; // Only reset one particle per emission cycle
            }
        }
    }

    // Mark attributes for update
    wakeParticleSystem.geometry.attributes.position.needsUpdate = true;
    wakeParticleSystem.geometry.attributes.size.needsUpdate = true;
    wakeParticleSystem.geometry.attributes.opacity.needsUpdate = true;
}

// Clean up resources when not needed
export function disposeShipWake() {
    if (wakeMesh) {
        scene.remove(wakeMesh);
        wakeMesh.geometry.dispose();
        wakeMesh.material.dispose();
        wakeMesh = null;
    }

    if (wakeParticleSystem) {
        scene.remove(wakeParticleSystem);
        wakeParticleSystem.geometry.dispose();
        wakeParticleSystem.material.dispose();
        wakeParticleSystem = null;
    }

    wakeSegments = [];
}